# Avnac Studio MCP & AI Designer Guide

Avnac Studio includes a built-in Model Context Protocol (MCP) server that allows external AI agents (in Cursor, Claude Desktop, MCPJam Inspector, Windsurf, Antigravity, etc.) to automate, design, and manipulate graphics inside the desktop application in real-time.

---

## 1. Connection Details

The MCP server runs on **port 12345** and supports both **Streamable HTTP** (recommended by modern MCP specs) and legacy **Server-Sent Events (SSE)**.

| Transport | Endpoint URL | Use With |
|---|---|---|
| **Streamable HTTP (Recommended)** | `http://localhost:12345/` | Modern MCP clients, Cursor, Claude Desktop, MCPJam |
| **SSE (Legacy)** | `http://localhost:12345/sse` | Legacy SSE clients, EventSource |
| **Browser Status Page** | `http://localhost:12345/` | Open in any browser to verify the server is running |

### Client Configuration Examples

#### Cursor (`~/.cursor/mcp.json` or project `.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "avnac-studio": {
      "url": "http://localhost:12345/"
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "avnac-studio": {
      "url": "http://localhost:12345/sse"
    }
  }
}
```

#### MCPJam Inspector
- **Transport**: SSE or Streamable HTTP
- **URL**: `http://localhost:12345/` or `http://localhost:12345/sse`

---

## 2. Built-in MCP Prompts

Avnac Studio advertises ready-to-use design workflows through the MCP Prompts protocol:

1. **`design-graphic`**:
   - **Arguments**: `topic` (required), `dimensions` (optional), `style` (optional).
   - **Description**: Guides the agent through a 6-step design workflow — writing a design brief (asking the user when critical info is missing), inspecting/creating the canvas, gathering assets, declarative element rendering, visual screenshot audit, and a final verification pass that compares the render against the original request.
2. **`edit-canvas`**:
   - **Arguments**: `instruction` (required, e.g. *"Change the color scheme to dark mode and center the title"*).
   - **Description**: Writes a diff-oriented brief, inspects current canvas elements with `get_canvas_summary`, maps object IDs, and applies targeted updates with `modify_elements`, then verifies the result against the requested changes. If the target file is not open, the agent is directed to `list_files` + `open_canvas` instead of recreating the design.
3. **`design-audit`**:
   - **Description**: Reads the canvas summary and annotated visual screenshot to critique intent match, layout balance, contrast, margins, and typography hierarchy, then fixes the most impactful mismatches and reports pass/fail per requirement.

---

## 3. Skill & Agent Instructions

The repository includes a standardized skill specification for agents:
- [`skills/avnac-designer/SKILL.md`](../skills/avnac-designer/SKILL.md)

When connected, the MCP server also automatically transmits `Instructions` to the LLM upon initialization, ensuring any connected agent understands the coordinate system, element schemas, and recommended design practices without manual prompt engineering.

---

## 4. Key Tools Summary (27 Tools)

### File Management
- `list_files`: List all saved canvas files — `{id, name, width, height, updatedAt}`. Works even when no canvas is open.
- `open_canvas`: Open a saved file by workspace id (from `list_files`) and make it the active scene. Unknown ids return an error listing where to look.
- `rename_file`: Rename a saved file by workspace id; also updates the live editor title if the file is open.

### Setup & Canvas
- `get_canvas_summary`: Get token-efficient summary of the artboard and all objects. Returns `{error: "No active canvas scene..."}` when no canvas is open — call `create_canvas` first, or `list_files` + `open_canvas` to load an existing file.
- `create_canvas`: Initialize canvas with `width`, `height`, optional `backgroundColor` (`color` alias accepted) and `name`.
- `apply_artboard_preset`: Resize via `presetId` (`ig-square`, `ig-portrait`, `ig-story`, `hd`, `twitter-post`, `linkedin`, `youtube-thumb`, `a4-300`, `custom-4000`; `preset` alias accepted). Unknown ids return an error listing valid ids.
- `set_background`: Set canvas background via `color` (`backgroundColor` alias accepted). Returns the new background or a no-scene error. Not needed right after `create_canvas` when a background was passed there.
- `clear_canvas`: Remove all objects. Returns `clearedCount`.

### Assets & Photography
- `search_unsplash`: Search royalty-free photos and retrieve image URLs. Returns compact records (`id`, `alt_description`, `width`, `height`, `photographer`, `urls.small`/`urls.regular`).
- `list_stickers`: Get built-in sticker names (`donut`, `leaf`, `lollipop`, `pineapple`, `shooting-star-badge`, `sunflower-badge`).
- `get_font_list`: List supported Google Fonts. Prefer `Poppins`, `Inter`, and `DM Serif Display` for reliable canvas rendering.

### Creation & Editing
- `render_elements`: Create elements in one call (`rect`, `ellipse`, `polygon`, `star`, `line`, `text`, `image`, `sticker`). Text supports `textAlign`, `fontWeight`, `fontStyle`, `lineHeight`, `underline`. Lines use `stroke`/`strokeWidth` (not `width`).
- `modify_elements`: Update properties by `objectId`, including text controls (`fontWeight`, `textAlign`, `lineHeight`, etc.).
- `delete_object`: Delete object by ID (omit to delete current selection).
- `align_objects`: Align selection via `type` (`left`, `center`, `right`, `top`, `middle`, `bottom`). Single selection aligns to artboard; multiple aligns to each other.
- `distribute_objects`: Distribute 3+ selected elements via `direction` (`horizontal`, `vertical`; `type` alias accepted).
- `group_objects` / `ungroup_objects`: Manage grouping (`objectIds` min 2 / `groupId`).
- `fit_to_artboard`: Scale selection to fill canvas with optional `padding`.

### Verification & Export
- `get_canvas_image`: Render a visual PNG screenshot of the artboard.
- `get_object_properties`: Inspect bounding box and styles of an element.
- `export_png`: Export the canvas to a downloadable PNG file.
- `export_object`: Export an individual object/group as PNG or SVG.
