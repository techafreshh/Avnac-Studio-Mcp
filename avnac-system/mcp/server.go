package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"

	avnacio "Avnac/avnac-system/io"
	avnacserver "Avnac/avnac-system/server"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type AvnacMCP struct {
	server          *mcp.Server
	httpServer      *http.Server
	pendingRequests map[string]chan any
	mu              sync.Mutex
	Unsplash        *avnacserver.UnsplashService
	// IO gives file-level tools (list_files) direct access to workspace
	// metadata without a frontend round-trip. The IOManager pointer is
	// initialized by App.startup after NewApp returns, so holders must call
	// its methods lazily (inside handlers), never at construction time.
	IO *avnacio.IOManager
}

const DesignerInstructions = `You are the Avnac Studio AI Design Director.
Avnac Studio is a modern graphic design canvas (similar to Canva / Figma).

CORE DESIGN WORKFLOW — Brief, then Setup, then Compose, then Verify:

1. DESIGN BRIEF (before ANY tool call):
   - Parse the request and extract known constraints: dimensions, exact copy, brand or shop names, dates/addresses, palette, style, imagery.
   - Identify critical unknowns: real text content, names, dates, addresses, size intent. If any are missing, ask the user up to 3 targeted questions and STOP — do not call tools yet. If nothing critical is missing, state your assumptions explicitly and proceed.
   - Write a compact design plan: layout zones with approximate coordinates, type hierarchy, palette, fonts, asset needs. The later verification step checks the render against this brief.
   - For EDIT requests, write a diff-oriented brief (what changes, what stays). Start from the real canvas: if the target file is not currently open, call list_files then open_canvas — NEVER silently recreate an existing design in a new file.

2. INSPECT / CANVAS SETUP:
   - Call get_canvas_summary to see the active canvas. For a NEW design, call create_canvas with width, height, backgroundColor, and a descriptive name.
   - create_canvas already applies backgroundColor — do not call set_background again with the same value.
   - To edit an existing file that is not open: list_files → open_canvas(fileId). To change its title: rename_file(fileId, name).

3. ASSETS:
   - Call search_unsplash for photography when relevant, and get_font_list if unsure which fonts to use.

4. DECLARATIVE COMPOSITION:
   - Call render_elements once with all elements, layered bottom (background) to top (foreground).
   - Coordinates: top-left origin (0, 0). 'left' (or 'x') and 'top' (or 'y') in pixels.
   - Elements: 'rect', 'ellipse', 'polygon' (sides 3-8), 'star', 'line', 'text', 'image', 'sticker'.
   - Typography: strong hierarchy (Headline 48-72px, Subhead 24-32px, Body 16-20px). Prefer Poppins, Inter, and DM Serif Display — other Google Fonts may fall back if not yet loaded; get_canvas_image now waits for fonts before rendering.
   - Styling: hex colors, cornerRadius, blur, opacity, shadows (blur, offsetX, offsetY, color, opacity), and gradientStops.

5. VERIFY AGAINST THE BRIEF:
   - Call get_canvas_image and compare it to the design brief AND the user's original request, item by item: required content present and spelled correctly, dimensions, hierarchy, palette, style, no unintended placeholder text.
   - If something mismatches, fix it with modify_elements (or align_objects / group_objects), take one more screenshot, then report an honest pass/fail per requirement. Explicitly flag any content you invented.
`

func NewAvnacMCP(unsplash *avnacserver.UnsplashService, io *avnacio.IOManager) *AvnacMCP {
	return &AvnacMCP{
		server: mcp.NewServer(&mcp.Implementation{
			Name:    "Avnac Studio",
			Version: "1.0.0",
		}, &mcp.ServerOptions{
			Instructions: DesignerInstructions,
		}),
		pendingRequests: make(map[string]chan any),
		Unsplash:        unsplash,
		IO:              io,
	}
}

func (m *AvnacMCP) Start(wailsCtx context.Context) {
	m.RegisterTools(wailsCtx)
	m.RegisterPrompts()

	streamable := mcp.NewStreamableHTTPHandler(func(req *http.Request) *mcp.Server {
		return m.server
	}, &mcp.StreamableHTTPOptions{
		DisableLocalhostProtection: true,
	})

	sse := mcp.NewSSEHandler(func(req *http.Request) *mcp.Server {
		return m.server
	}, &mcp.SSEOptions{
		DisableLocalhostProtection: true,
	})

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Log incoming request
		log.Printf("[MCP] %s %s from %s (Accept: %q, Mcp-Session-Id: %q)",
			r.Method, r.URL.String(), r.RemoteAddr, r.Header.Get("Accept"), r.Header.Get("Mcp-Session-Id"))

		// Comprehensive CORS Headers for browser-based / WebView clients
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		w.Header().Set("Access-Control-Expose-Headers", "*")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Friendly browser test page if someone navigates to http://localhost:12345 in a browser
		if r.Method == http.MethodGet && strings.Contains(r.Header.Get("Accept"), "text/html") && !strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, `<!DOCTYPE html><html><head><title>Avnac MCP Server</title></head><body style="font-family:sans-serif;padding:2rem;line-height:1.5;"><h2>Avnac MCP Server is running</h2><p>Port: <strong>12345</strong></p><p>Transports supported:</p><ul><li><strong>Streamable HTTP</strong>: <code>http://localhost:12345/</code></li><li><strong>SSE</strong>: <code>http://localhost:12345/sse</code></li></ul></body></html>`)
			return
		}

		// Handle server/discover capability negotiation probe
		if r.Method == http.MethodPost {
			body, err := io.ReadAll(r.Body)
			if err == nil {
				var probe struct {
					JSONRPC string `json:"jsonrpc"`
					ID      any    `json:"id"`
					Method  string `json:"method"`
				}
				if json.Unmarshal(body, &probe) == nil && probe.Method == "server/discover" {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					resp := map[string]any{
						"jsonrpc": "2.0",
						"id":      probe.ID,
						"result": map[string]any{
							"protocolVersion":   "2025-11-25",
							"supportedVersions": []string{"2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"},
							"capabilities": map[string]any{
								"tools": map[string]any{
									"listChanged": true,
								},
								"prompts": map[string]any{
									"listChanged": true,
								},
							},
							"serverInfo": map[string]string{
								"name":    "Avnac Studio",
								"version": "1.0.0",
							},
							"instructions": DesignerInstructions,
						},
					}
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
				r.Body = io.NopCloser(bytes.NewReader(body))
			}
		}

		// Routing logic:
		// 1. If query has "sessionid", it is a legacy SSE message POST -> sse
		// 2. If POST without "sessionid", it is a Streamable HTTP request (initialize or tool call) -> streamable
		// 3. If GET with "Mcp-Session-Id", it is a Streamable HTTP stream -> streamable
		// 4. If GET without "Mcp-Session-Id" (or requesting /sse), it is a legacy SSE connection -> sse
		// 5. If DELETE, it is Streamable HTTP closing session -> streamable
		if r.URL.Query().Has("sessionid") {
			sse.ServeHTTP(w, r)
			return
		}

		if r.Method == http.MethodPost {
			streamable.ServeHTTP(w, r)
			return
		}

		if r.Method == http.MethodGet {
			if r.Header.Get("Mcp-Session-Id") != "" {
				streamable.ServeHTTP(w, r)
				return
			}
			sse.ServeHTTP(w, r)
			return
		}

		if r.Method == http.MethodDelete {
			streamable.ServeHTTP(w, r)
			return
		}

		// Fallback
		streamable.ServeHTTP(w, r)
	})

	mux := http.NewServeMux()
	mux.Handle("/", handler)

	m.httpServer = &http.Server{
		Addr:    ":12345",
		Handler: mux,
	}

	go func() {
		if err := m.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[MCP] Server failed to start on port 12345: %v\n", err)
		} else {
			log.Printf("[MCP] Server stopped.\n")
		}
	}()
}

func (m *AvnacMCP) SubmitResponse(requestID string, data any) {
	m.mu.Lock()
	ch, ok := m.pendingRequests[requestID]
	if ok {
		delete(m.pendingRequests, requestID)
	}
	m.mu.Unlock()

	if ok {
		ch <- data
	}
}

func (m *AvnacMCP) Stop(ctx context.Context) error {
	if m.httpServer != nil {
		return m.httpServer.Shutdown(ctx)
	}
	return nil
}
