# Avnac Studio MCP Server

This directory contains the Model Context Protocol (MCP) server implementation for Avnac Studio.

## Overview

The MCP server allows external AI agents and clients to interact with the Avnac Studio canvas directly. It leverages the official Go SDK for MCP (`github.com/modelcontextprotocol/go-sdk`) and exposes a standard SSE (Server-Sent Events) HTTP transport.

### Architecture

1. **MCP Server (`server.go`)**: Runs an HTTP server on `127.0.0.1:12345`. It listens for incoming SSE connections on `/sse`, `/message`, and `/`.
2. **Tool Registration (`tools.go`)**: Defines the tools available to MCP clients. When a tool is invoked by a client, the Go backend processes the request and emits a Wails IPC event (`mcp:action`) to the frontend.
3. **Frontend Listener (`frontend/src/lib/mcp-listener.ts`)**: The React frontend listens for the `mcp:action` event and applies the requested changes directly to the Fabric.js canvas.

## Available Tools

The MCP server provides 27 tools for canvas automation. Tool names equal their emitted `mcp:action` action strings 1:1, except `open_canvas`/`rename_file`, which emit `open_workspace`/`rename_workspace` (the frontend handler also keys on those).

### 1. File Management (no canvas required)
- `list_files`: Lists all saved canvas files (`id`, `name`, width, height, `updatedAt`) from workspace storage.
- `open_canvas`: Opens a saved file by workspace id and makes it the active scene (emits `open_workspace`; pre-validates the id in Go).
- `rename_file`: Renames a saved file (emits `rename_workspace`), also updating the live editor title when open.

### 2. Context & Inspection
- `get_canvas_summary`: Token-efficient semantic summary of artboard + objects.
- `list_objects`: Lists all objects with raw IDs.
- `get_selection`: Returns the current selection.
- `get_canvas_state`: Returns the full scene state.
- `get_canvas_image`: Returns a visual PNG screenshot of the canvas (or one object).
- `get_object_properties`: Returns detailed properties of a specific object.
- `get_font_list`: Returns supported Google Fonts.

### 3. Creation
- `create_canvas`: Navigates to the editor and initializes a new artboard (width, height, optional name/background).
- `render_elements`: Declaratively creates a batch of elements (`rect`, `ellipse`, `polygon`, `star`, `line`, `text`, `image`, `sticker`) in one call, bottom-to-top layering.

### 4. Manipulation & Styling
- `modify_elements`: Batch-updates element properties by objectId (fill, text controls, shadow, gradients, z-order `action`).
- `delete_object`: Removes an object (or the current selection).
- `set_background`: Changes the artboard background color.
- `apply_artboard_preset`: Quickly resizes to standard sizes (IG, X, HD, A4).

### 5. Layout & Organization
- `select_objects`: Programmatically selects objects by ID.
- `group_objects` / `ungroup_objects`: Manages object hierarchy.
- `align_objects`: Aligns objects to the artboard or each other.
- `distribute_objects`: Evenly spaces objects horizontally or vertically.
- `fit_to_artboard`: Scales objects to fill the canvas area.

### 6. Utilities & Assets
- `clear_canvas`: Removes all objects.
- `search_unsplash`: Searches Unsplash; returns compact records (id, alt, size, photographer, small/regular URLs).
- `export_png` / `export_object`: Export the canvas or a single object as an image.

## Development

The MCP server is initialized in `app.go` and started automatically when the Wails application launches.

If you add new tools in `tools.go`, make sure to update the corresponding frontend handler in `mcp-listener.ts` to process the action payload correctly.
