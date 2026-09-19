package mcp

import (
	"context"
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
	}, nil)

	mux.Handle("/sse", sse)
	mux.Handle("/message", sse)
	mux.Handle("/", sse)

	m.httpServer = &http.Server{
		Addr:    "127.0.0.1:8888",
		Handler: mux,
	}

	go func() {
		if err := m.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[MCP] Server failed to start on port 8888: %v\n", err)
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
