package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"
)

func TestMCPServerDiscoverAndSSE(t *testing.T) {
	server := NewAvnacMCP(nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	server.Start(ctx)
	defer server.Stop(context.Background())

	// Give the HTTP server a moment to bind
	time.Sleep(200 * time.Millisecond)

	hosts := []string{"127.0.0.1", "localhost"}

	for _, host := range hosts {
		t.Run("server_discover_probe_"+host, func(t *testing.T) {
			probeReq := map[string]any{
				"jsonrpc": "2.0",
				"id":      0,
				"method":  "server/discover",
			}
			data, _ := json.Marshal(probeReq)

			resp, err := http.Post(fmt.Sprintf("http://%s:12345/sse", host), "application/json", bytes.NewReader(data))
			if err != nil {
				t.Fatalf("Failed to POST server/discover probe to %s: %v", host, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status 200 for server/discover probe, got %d", resp.StatusCode)
			}

			body, _ := io.ReadAll(resp.Body)
			var probeResp struct {
				JSONRPC string         `json:"jsonrpc"`
				ID      any            `json:"id"`
				Result  map[string]any `json:"result"`
			}
			if err := json.Unmarshal(body, &probeResp); err != nil {
				t.Fatalf("Failed to parse probe response: %v", err)
			}

			if probeResp.JSONRPC != "2.0" {
				t.Errorf("Expected jsonrpc 2.0, got %v", probeResp.JSONRPC)
			}
			if probeResp.Result == nil {
				t.Fatalf("Expected non-nil result")
			}
			serverInfo, ok := probeResp.Result["serverInfo"].(map[string]any)
			if !ok || serverInfo["name"] != "Avnac Studio" {
				t.Errorf("Expected serverInfo.name == 'Avnac Studio', got %v", serverInfo)
			}
		})

		t.Run("sse_connect_"+host, func(t *testing.T) {
			req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("http://%s:12345/sse", host), nil)
			if err != nil {
				t.Fatalf("Failed to create SSE request: %v", err)
			}
			req.Header.Set("Accept", "text/event-stream")

			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				t.Fatalf("Failed to connect to SSE on %s: %v", host, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status 200 for SSE, got %d", resp.StatusCode)
			}
			contentType := resp.Header.Get("Content-Type")
			if contentType != "text/event-stream" {
				t.Errorf("Expected text/event-stream, got %s", contentType)
			}
		})
	}
}
