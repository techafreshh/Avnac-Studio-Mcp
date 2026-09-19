package mcp

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)














type ShadowDefinition struct {
	Blur    float64 `json:"blur"`
	OffsetX float64 `json:"offsetX"`
	OffsetY float64 `json:"offsetY"`
	Color   string  `json:"color"`
	Opacity float64 `json:"opacity"`
}

type ElementDefinition struct {
	ID            *string           `json:"id,omitempty"`
	Name          *string           `json:"name,omitempty"`
	Type          string            `json:"type"`
	Left          *float64          `json:"left,omitempty"`
	Top           *float64          `json:"top,omitempty"`
	X             *float64          `json:"x,omitempty"`
	Y             *float64          `json:"y,omitempty"`
	Width         *float64          `json:"width,omitempty"`
	Height        *float64          `json:"height,omitempty"`
	Fill          *string           `json:"fill,omitempty"`
	Color         *string           `json:"color,omitempty"`
	Text          *string           `json:"text,omitempty"`
	FontSize      *int              `json:"fontSize,omitempty"`
	FontFamily    *string           `json:"fontFamily,omitempty"`
	Blur          *float64          `json:"blur,omitempty"`
	Radius        *float64          `json:"radius,omitempty"`
	CornerRadius  *float64          `json:"cornerRadius,omitempty"`
	Shadow        *ShadowDefinition `json:"shadow,omitempty"`
	URL           *string           `json:"url,omitempty"`
	StickerName   *string           `json:"stickerName,omitempty"`
	Sides         *int              `json:"sides,omitempty"`
	X1            *float64          `json:"x1,omitempty"`
	Y1            *float64          `json:"y1,omitempty"`
	X2            *float64          `json:"x2,omitempty"`
	Y2            *float64          `json:"y2,omitempty"`
	GradientAngle *float64          `json:"gradientAngle,omitempty"`
	GradientStops []GradientStop    `json:"gradientStops,omitempty"`
	Stroke        *string           `json:"stroke,omitempty"`
	StrokeWidth   *float64          `json:"strokeWidth,omitempty"`
	Angle         *float64          `json:"angle,omitempty"`
	Rotation      *float64          `json:"rotation,omitempty"`
	Opacity       *float64          `json:"opacity,omitempty"`
}

type RenderElementsInput struct {
	Elements       []ElementDefinition `json:"elements"`
	IncludePreview *bool               `json:"includePreview,omitempty"`
}

type ElementModification struct {
	ObjectID      string            `json:"objectId"`
	Type          *string           `json:"type,omitempty"`
	Left          *float64          `json:"left,omitempty"`
	Top           *float64          `json:"top,omitempty"`
	X             *float64          `json:"x,omitempty"`
	Y             *float64          `json:"y,omitempty"`
	Width         *float64          `json:"width,omitempty"`
	Height        *float64          `json:"height,omitempty"`
	Fill          *string           `json:"fill,omitempty"`
	Color         *string           `json:"color,omitempty"`
	Text          *string           `json:"text,omitempty"`
	FontSize      *int              `json:"fontSize,omitempty"`
	FontFamily    *string           `json:"fontFamily,omitempty"`
	Blur          *float64          `json:"blur,omitempty"`
	Radius        *float64          `json:"radius,omitempty"`
	CornerRadius  *float64          `json:"cornerRadius,omitempty"`
	Shadow        *ShadowDefinition `json:"shadow,omitempty"`
	ScaleX        *float64          `json:"scaleX,omitempty"`
	ScaleY        *float64          `json:"scaleY,omitempty"`
	Angle         *float64          `json:"angle,omitempty"`
	Rotation      *float64          `json:"rotation,omitempty"`
	Opacity       *float64          `json:"opacity,omitempty"`
	Action        *string           `json:"action,omitempty"`
	Name          *string           `json:"name,omitempty"`
	Locked        *bool             `json:"locked,omitempty"`
	GradientAngle *float64          `json:"gradientAngle,omitempty"`
	GradientStops []GradientStop    `json:"gradientStops,omitempty"`
}

type ModifyElementsInput struct {
	Modifications  []ElementModification `json:"modifications"`
	IncludePreview *bool                 `json:"includePreview,omitempty"`
}

type GetCanvasImageInput struct {
	ObjectID  string `json:"objectId,omitempty"`
	Annotated bool   `json:"annotated,omitempty"`
}

type DeleteObjectInput struct {
	// The unique ID of the object to delete. If omitted, deletes the current selection.
	ObjectID string `json:"objectId,omitempty"`
}

type CreateCanvasInput struct {
	// The width of the canvas in pixels
	Width int `json:"width"`
	// The height of the canvas in pixels
	Height int `json:"height"`
	// The name of the workspace
	Name string `json:"name,omitempty"`
	// The background color of the canvas
	BackgroundColor string `json:"backgroundColor,omitempty"`
}

type SetBackgroundInput struct {
	// The background color (hex or name)
	Color string `json:"color"`
}

type AlignObjectsInput struct {
	// The alignment type (left, center, right, top, middle, bottom)
	Type string `json:"type"`
}



type ExportPngInput struct {
	// Scale multiplier (e.g. 1, 2)
	Multiplier *float64 `json:"multiplier,omitempty"`
	// Whether the background should be transparent
	Transparent *bool `json:"transparent,omitempty"`
}

type SelectObjectsInput struct {
	// List of object IDs to select
	ObjectIDs []string `json:"objectIds"`
}









type GroupObjectsInput struct {
	// List of object IDs to group
	ObjectIDs []string `json:"objectIds"`
}

type UngroupObjectsInput struct {
	// The unique ID of the group to ungroup
	GroupID string `json:"groupId"`
}

type DistributeObjectsInput struct {
	// The direction to distribute (horizontal or vertical)
	Direction string `json:"direction"`
}

type FitToArtboardInput struct {
	// Padding around the objects in pixels
	Padding float64 `json:"padding"`
}

type SearchUnsplashInput struct {
	// The search query
	Query string `json:"query"`
	// Page number
	Page int `json:"page,omitempty"`
	// Number of items per page
	PerPage int `json:"perPage,omitempty"`
}





type GradientStop struct {
	// Offset from 0.0 to 1.0
	Offset float64 `json:"offset"`
	// Color (hex or name)
	Color string `json:"color"`
}



type ApplyArtboardPresetInput struct {
	// The preset ID (e.g. 'ig-square', 'a4-300')
	PresetID string `json:"presetId"`
}

type ExportObjectInput struct {
	// The unique ID of the object to export
	ObjectID string `json:"objectId"`
	// The format (png, svg)
	Format string `json:"format"`
	// Scale multiplier (for PNG)
	Multiplier *float64 `json:"multiplier,omitempty"`
}

type GetObjectPropertiesInput struct {
	// The unique ID of the object
	ObjectID string `json:"objectId"`
}

func (m *AvnacMCP) RegisterTools(wailsCtx context.Context) {
	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "render_elements",
		Description: "Declaratively create multiple elements (rect, ellipse, polygon, star, text, image, sticker, line) in a single batch. Supports layout (left, top, width, height), styling (fill, opacity, angle, blur, radius), complex effects (shadows, gradients), and specialized properties (fontFamily, stickerName, URL). Returns created element IDs and metadata, plus an optional visual preview if includePreview=true.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input RenderElementsInput) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "render_elements",
			"requestId": requestID,
			"payload":   input,
		})

		select {
		case data := <-ch:
			respMap, ok := data.(map[string]any)
			if ok && respMap != nil {
				if base64Str, ok := respMap["imageData"].(string); ok && base64Str != "" {
					imgBytes, err := base64.StdEncoding.DecodeString(base64Str)
					if err == nil {
						delete(respMap, "imageData")
						return &mcp.CallToolResult{
							Content: []mcp.Content{
								&mcp.TextContent{
									Text: fmt.Sprintf("Elements rendered successfully. Created: %v", respMap["created"]),
								},
								&mcp.ImageContent{
									Data:     imgBytes,
									MIMEType: "image/png",
								},
							},
						}, respMap, nil
					}
				}
			}
			return nil, data, nil
		case <-time.After(20 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for render_elements completion")
		}
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "modify_elements",
		Description: "Batch update properties of existing elements by their ObjectID. Supports modifying layout, styling, effects (shadows, gradients), locking status, layer names, and z-index actions (bringToFront, sendToBack, bringForward, sendBackwards). Returns modified counts and an optional visual preview if includePreview=true.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input ModifyElementsInput) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "modify_elements",
			"requestId": requestID,
			"payload":   input,
		})

		select {
		case data := <-ch:
			respMap, ok := data.(map[string]any)
			if ok && respMap != nil {
				if base64Str, ok := respMap["imageData"].(string); ok && base64Str != "" {
					imgBytes, err := base64.StdEncoding.DecodeString(base64Str)
					if err == nil {
						delete(respMap, "imageData")
						return &mcp.CallToolResult{
							Content: []mcp.Content{
								&mcp.TextContent{
									Text: "Elements modified successfully.",
								},
								&mcp.ImageContent{
									Data:     imgBytes,
									MIMEType: "image/png",
								},
							},
						}, respMap, nil
					}
				}
			}
			return nil, data, nil
		case <-time.After(15 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for modify_elements completion")
		}
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "search_unsplash",
		Description: "Search for high-quality photos on Unsplash",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input SearchUnsplashInput) (*mcp.CallToolResult, any, error) {
		page := input.Page
		if page < 1 {
			page = 1
		}
		perPage := input.PerPage
		if perPage < 1 {
			perPage = 10
		}

		result, err := m.Unsplash.Search(input.Query, page, perPage)
		if err != nil {
			return nil, nil, err
		}

		return nil, result, nil
	})

		mcp.AddTool(m.server, &mcp.Tool{
		Name:        "list_stickers",
		Description: "Get the list of available built-in stickers",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input any) (*mcp.CallToolResult, any, error) {
		stickers := []string{"donut", "leaf", "lollipop", "pineapple", "shooting-star-badge", "sunflower-badge"}
		return nil, map[string]any{"stickers": stickers}, nil
	})

			mcp.AddTool(m.server, &mcp.Tool{
		Name:        "apply_artboard_preset",
		Description: "Quickly resize the canvas to a standard dimension preset",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input ApplyArtboardPresetInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "apply_artboard_preset",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Artboard preset application requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "export_object",
		Description: "Export a specific object or group as PNG or SVG",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input ExportObjectInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "export_object",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Object export requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "get_object_properties",
		Description: "Get detailed properties of a specific object by its ID",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input GetObjectPropertiesInput) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "get_object_properties",
			"requestId": requestID,
			"payload":   input,
		})

		select {
		case data := <-ch:
			return nil, data, nil
		case <-time.After(5 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for object properties")
		}
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "create_canvas",
		Description: "Create a new canvas with the specified dimensions",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input CreateCanvasInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "create_canvas",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Navigation to new canvas initiated"}, nil
	})

							mcp.AddTool(m.server, &mcp.Tool{
		Name:        "select_objects",
		Description: "Select one or more objects by their IDs",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input SelectObjectsInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "select_objects",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Selection requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "delete_object",
		Description: "Delete an object from the canvas. If no objectId is provided, deletes the current selection.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input DeleteObjectInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "delete_object",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Object deletion requested"}, nil
	})

					mcp.AddTool(m.server, &mcp.Tool{
		Name:        "group_objects",
		Description: "Group multiple objects together",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input GroupObjectsInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "group_objects",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Object grouping requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "ungroup_objects",
		Description: "Ungroup an existing group",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input UngroupObjectsInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "ungroup_objects",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Object ungrouping requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "distribute_objects",
		Description: "Evenly space objects horizontally or vertically",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input DistributeObjectsInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "distribute_objects",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Object distribution requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "fit_to_artboard",
		Description: "Scale selection to fill the canvas",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input FitToArtboardInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "fit_to_artboard",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Fit to artboard requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "get_font_list",
		Description: "Get the list of supported Google Fonts",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input any) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "get_font_list",
			"requestId": requestID,
		})

		select {
		case data := <-ch:
			return nil, data, nil
		case <-time.After(5 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for font list")
		}
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "clear_canvas",
		Description: "Remove all objects from the canvas",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input any) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action": "clear_canvas",
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Canvas clearing requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "set_background",
		Description: "Change the background color of the artboard",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input SetBackgroundInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "set_background",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Background update requested"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "align_objects",
		Description: "Align the currently selected objects",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input AlignObjectsInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "align_objects",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Object alignment requested"}, nil
	})

		mcp.AddTool(m.server, &mcp.Tool{
		Name:        "export_png",
		Description: "Trigger a PNG export of the current canvas",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input ExportPngInput) (*mcp.CallToolResult, any, error) {
		payload := map[string]any{
			"action":  "export_png",
			"payload": input,
		}

		runtime.EventsEmit(wailsCtx, "mcp:action", payload)

		return nil, map[string]any{"message": "Export initiated"}, nil
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "list_objects",
		Description: "List all objects currently on the canvas with their IDs and types",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input any) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "list_objects",
			"requestId": requestID,
		})

		select {
		case data := <-ch:
			return nil, data, nil
		case <-time.After(5 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for object list")
		}
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "get_selection",
		Description: "Get the IDs and properties of the currently selected objects",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input any) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "get_selection",
			"requestId": requestID,
		})

		select {
		case data := <-ch:
			return nil, data, nil
		case <-time.After(5 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for selection state")
		}
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "get_canvas_state",
		Description: "Get the current state of the canvas",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input any) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "get_canvas_state",
			"requestId": requestID,
		})

		select {
		case data := <-ch:
			return nil, data, nil
		case <-time.After(5 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for canvas state")
		}
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "get_canvas_summary",
		Description: "Get a token-efficient semantic summary of the current canvas artboard and objects without raw engine internals",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input any) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "get_canvas_summary",
			"requestId": requestID,
		})

		select {
		case data := <-ch:
			return nil, data, nil
		case <-time.After(5 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for canvas summary")
		}
	})

	mcp.AddTool(m.server, &mcp.Tool{
		Name:        "get_canvas_image",
		Description: "Get a visual PNG screenshot of the current canvas or a specific object. Set annotated=true for bounding box debug overlays.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, input GetCanvasImageInput) (*mcp.CallToolResult, any, error) {
		requestID := uuid.New().String()
		ch := make(chan any, 1)

		m.mu.Lock()
		m.pendingRequests[requestID] = ch
		m.mu.Unlock()

		runtime.EventsEmit(wailsCtx, "mcp:action", map[string]any{
			"action":    "get_canvas_image",
			"requestId": requestID,
			"payload":   input,
		})

		select {
		case data := <-ch:
			// data is expected to be a map[string]any with "imageData" (base64)
			respMap, ok := data.(map[string]any)
			if !ok {
				return nil, nil, fmt.Errorf("unexpected response format from frontend")
			}

			base64Str, ok := respMap["imageData"].(string)
			if !ok {
				return nil, nil, fmt.Errorf("missing imageData in frontend response")
			}

			imgBytes, err := base64.StdEncoding.DecodeString(base64Str)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to decode image data: %v", err)
			}

			return &mcp.CallToolResult{
				Content: []mcp.Content{
					&mcp.ImageContent{
						Data:     imgBytes,
						MIMEType: "image/png",
					},
				},
			}, nil, nil
		case <-time.After(10 * time.Second):
			m.mu.Lock()
			delete(m.pendingRequests, requestID)
			m.mu.Unlock()
			return nil, nil, fmt.Errorf("timeout waiting for canvas image")
		}
	})
}
