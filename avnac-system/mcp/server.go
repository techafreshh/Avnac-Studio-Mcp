package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
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
	mux := http.NewServeMux()
	
	m.RegisterTools(wailsCtx)

	sse := mcp.NewSSEHandler(func(req *http.Request) *mcp.Server {
		return m.server
	}, &mcp.SSEOptions{
		DisableLocalhostProtection: true,
	})

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

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
							"supportedVersions": []string{"2024-11-05"},
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

		sse.ServeHTTP(w, r)
	})

	mux.Handle("/sse", handler)
	mux.Handle("/message", handler)
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
