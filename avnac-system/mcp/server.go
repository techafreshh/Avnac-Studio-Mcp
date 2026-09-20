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

	avnacserver "Avnac/avnac-system/server"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type AvnacMCP struct {
	server          *mcp.Server
	httpServer      *http.Server
	pendingRequests map[string]chan any
	mu              sync.Mutex
	Unsplash        *avnacserver.UnsplashService
}

func NewAvnacMCP(unsplash *avnacserver.UnsplashService) *AvnacMCP {
	return &AvnacMCP{
		server: mcp.NewServer(&mcp.Implementation{
			Name:    "Avnac Studio",
			Version: "1.0.0",
		}, &mcp.ServerOptions{}),
		pendingRequests: make(map[string]chan any),
		Unsplash:        unsplash,
	}
}

func (m *AvnacMCP) Start(wailsCtx context.Context) {
	m.RegisterTools(wailsCtx)

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
							},
							"serverInfo": map[string]string{
								"name":    "Avnac Studio",
								"version": "1.0.0",
							},
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
