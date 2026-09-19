# Avnac Studio MCP Server

This directory contains the Model Context Protocol (MCP) server implementation for Avnac Studio.

## Overview

The MCP server allows external AI agents and clients to interact with the Avnac Studio canvas directly. It leverages the official Go SDK for MCP (`github.com/modelcontextprotocol/go-sdk`) and exposes a standard SSE (Server-Sent Events) HTTP transport.

### Architecture

1. **MCP Server (`server.go`)**: Runs an HTTP server on `127.0.0.1:12345`. It listens for incoming SSE connections on `/sse`, `/message`, and `/`.
2. **Tool Registration (`tools.go`)**: Defines the tools available to MCP clients. When a tool is invoked by a client, the Go backend processes the request and emits a Wails IPC event (`mcp:action`) to the frontend.
3. **Frontend Listener (`frontend/src/lib/mcp-listener.ts`)**: The React frontend listens for the `mcp:action` event and applies the requested changes directly to the Fabric.js canvas.

## Available Tools

The MCP server provides a comprehensive suite of tools for canvas automation:

### 1. Context & Inspection
- `list_objects`: Lists all objects on the canvas.
- `get_selection`: Returns the current selection.
- `get_canvas_state`: Returns the full Fabric.js JSON state.
- `get_canvas_image`: Returns a visual screenshot of the current canvas.
- `get_object_properties`: Returns detailed properties of a specific object.
- `get_font_list`: Returns supported Google Fonts.

### 2. Creation
- `create_canvas`: Navigates to the editor and initializes a new artboard.
- `add_shape`: Adds rectangles, circles, triangles, stars, or polygons.
- `add_line`: Adds a line between two points.
- `add_text`: Adds an interactive text object.
- `add_image`: Adds an image from a URL.
- `add_sticker`: Adds a built-in sticker asset (e.g., 'donut', 'pineapple').

### 3. Manipulation & Styling
- `update_object` / `update_text`: Modifies object properties or text content.
- `delete_object`: Removes objects from the canvas.
- `lock_object`: Prevents selection and movement of an object.
- `rename_layer`: Assigns a custom name to a layer.
- `set_blur`: Applies Gaussian blur to an object.
- `set_corner_radius`: Rounds corners of rectangles or images.
- `apply_shadow`: Adds a customizable drop shadow.
- `apply_gradient`: Applies a linear gradient fill.

### 4. Layout & Organization
- `select_objects`: Programmatically selects objects by ID.
- `group_objects` / `ungroup_objects`: Manages object hierarchy.
- `align_objects`: Aligns objects to the artboard or each other.
- `distribute_objects`: Evenly spaces objects horizontally or vertically.
- `fit_to_artboard`: Scales objects to fill the canvas area.
- `arrange_z_index`: Moves objects forward/backward in the layer stack.

### 5. Utilities & Assets
- `set_background`: Changes the artboard background color.
- `clear_canvas`: Resets the workspace.
- `search_unsplash`: Searches for high-quality photos using the built-in Unsplash service.
- `apply_artboard_preset`: Quickly resizes to standard sizes (IG, X, HD, A4).
- `export_png` / `export_object`: Triggers downloads or returns object data.

## Development

The MCP server is initialized in `app.go` and started automatically when the Wails application launches.

If you add new tools in `tools.go`, make sure to update the corresponding frontend handler in `mcp-listener.ts` to process the action payload correctly.
