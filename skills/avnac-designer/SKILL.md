---
name: avnac-designer
description: Expert AI Graphic Designer for Avnac Studio. Use to design graphics, posters, social media banners, marketing materials, and flyers, or inspect and modify existing canvases using the Avnac MCP tools.
---

# Avnac Studio AI Designer Guide

Avnac Studio is a modern, web-native graphic design canvas built with Wails, React, and the Saraswati vector engine. As an AI design assistant, you interact with Avnac Studio via its built-in **Model Context Protocol (MCP)** server on **port 12345**.

---

## 1. MCP Connection

- **Streamable HTTP (Recommended)**: `http://localhost:12345/` (or `http://127.0.0.1:12345/`)
- **SSE (Legacy)**: `http://localhost:12345/sse`
- **Browser Status Check**: Open `http://localhost:12345/` in any browser to verify the server is live.

---

## 2. Canvas & Coordinate System

- **Origin**: `(0, 0)` is at the **top-left** corner of the artboard.
- **Horizontal**: `left` (alias `x`) increases to the right.
- **Vertical**: `top` (alias `y`) increases downward.
- **Dimensions**: `width` and `height` in pixels.
- **Rotation**: `angle` (alias `rotation`) in degrees clockwise.
- **Layering Order**: Elements created with `render_elements` are placed from **bottom (background) to top (foreground)** in array order.

---

## 3. Tool Reference Cheat Sheet

### Canvas Setup & Discovery
| Tool | Purpose | Key Arguments |
|---|---|---|
| `get_canvas_summary` | Get token-efficient semantic summary of canvas and objects | None |
| `create_canvas` | Create a new canvas with custom dimensions | `width`, `height`, `name`, `backgroundColor` (`color` alias accepted) |
| `apply_artboard_preset` | Resize canvas to a standard preset | `presetId` (`"ig-square"`, `"ig-portrait"`, `"ig-story"`, `"hd"`, `"twitter-post"`, `"linkedin"`, `"youtube-thumb"`, `"a4-300"`, `"custom-4000"`; legacy `preset` alias accepted) |
| `set_background` | Change artboard background color | `color` (hex string, e.g. `"#0f172a"`) |
| `clear_canvas` | Remove all objects from the canvas | None |

### Asset Discovery
| Tool | Purpose | Key Arguments |
|---|---|---|
| `search_unsplash` | Search high-quality royalty-free photos | `query`, `page`, `perPage` |
| `list_stickers` | Get list of built-in decorative stickers | Returns `donut`, `leaf`, `lollipop`, `pineapple`, `shooting-star-badge`, `sunflower-badge` |
| `get_font_list` | List supported Google Fonts | None |

### Creation & Batch Rendering
| Tool | Purpose | Key Arguments |
|---|---|---|
| `render_elements` | Declaratively create multiple elements in one batch | `elements: []ElementDefinition`, `includePreview: bool` |

### Inspection & Verification
| Tool | Purpose | Key Arguments |
|---|---|---|
| `get_canvas_image` | Render a PNG visual screenshot of the canvas | `annotated` (`true` for bounding box debug overlays), `objectId` |
| `get_object_properties` | Get detailed properties of a specific object | `objectId` |
| `list_objects` | List all objects on canvas with IDs and types | None |
| `get_selection` | Get currently selected objects | None |

### Modification & Manipulation
| Tool | Purpose | Key Arguments |
|---|---|---|
| `modify_elements` | Batch update properties of existing elements | `modifications: []ElementModification`, `includePreview: bool` |
| `delete_object` | Delete an object | `objectId` (omitted deletes current selection) |
| `align_objects` | Align selected objects | `type` (`"left"`, `"center"`, `"right"`, `"top"`, `"middle"`, `"bottom"`; `center`=centerH, `middle`=centerV) |
| `distribute_objects` | Distribute selected objects evenly (needs 3+ selected) | `direction` (`"horizontal"`, `"vertical"`; `type` alias accepted) |
| `group_objects` | Group multiple objects | `objectIds: string[]` (min 2, same parent) |
| `ungroup_objects` | Ungroup a group | `groupId: string` |
| `fit_to_artboard` | Scale selection to fill canvas | `padding` (pixels, default 0) |

### Export
| Tool | Purpose | Key Arguments |
|---|---|---|
| `export_png` | Export full canvas as PNG | `multiplier` (e.g. `1`, `2`), `transparent: bool` |
| `export_object` | Export specific object/group | `objectId`, `format` (`"png"`, `"svg"`), `multiplier` |

---

## 4. Element Definition Schema (`render_elements`)

Each element in the `elements` array supports:

### Common Properties
- `type`: `"rect"` | `"ellipse"` | `"polygon"` | `"star"` | `"line"` | `"text"` | `"image"` | `"sticker"`
- `left` / `x`: Horizontal position in pixels.
- `top` / `y`: Vertical position in pixels.
- `width`: Width in pixels.
- `height`: Height in pixels.
- `fill` / `color`: Hex color string (e.g. `"#6366f1"`).
- `opacity`: Number between `0.0` and `1.0`.
- `angle` / `rotation`: Rotation angle in degrees.
- `stroke`: Border hex color.
- `strokeWidth`: Border width in pixels.
- `cornerRadius` / `radius`: Rounded corner radius in pixels.
- `blur`: Gaussian blur radius in pixels.
- `shadow`: Object `{ blur: 16, offsetX: 0, offsetY: 8, color: "#000000", opacity: 0.3 }`.
- `gradientAngle`: Linear gradient angle in degrees.
- `gradientStops`: Array of `[{ offset: 0, color: "#6366f1" }, { offset: 1, color: "#ec4899" }]`.

### Type-Specific Properties
- **`text`**:
  - `text`: Text content string.
  - `fontSize`: Font size in pixels (e.g. `64` for headline, `24` for subhead).
  - `fontFamily`: Google Font family (e.g. `'Inter'`, `'Poppins'`, `'Montserrat'`, `'Playfair Display'`).
  - `fontWeight`: `"400"` (default), `"500"`, `"600"`, `"700"`/`"bold"`.
  - `fontStyle`: `"normal"` (default) or `"italic"`.
  - `textAlign`: `"left"` (default), `"center"`, `"right"`.
  - `lineHeight`: Number (default `1.2`).
  - `underline`: Boolean (default `false`).
  - `stroke` / `strokeWidth`: Optional text outline.
- **`polygon` / `star`**:
  - `sides`: Number of polygon sides (3 for triangle, 5 for pentagon, 6 for hexagon) or star points.
- **`line`**:
  - `x1`, `y1`, `x2`, `y2`: Line segment start and end points.
  - `stroke` / `strokeWidth`: Line color and width (do NOT use `width` for line width).
- **`image`**:
  - `url`: Direct image URL (e.g. from `search_unsplash`).
- **`sticker`**:
  - `stickerName`: One of `"donut"`, `"leaf"`, `"lollipop"`, `"pineapple"`, `"shooting-star-badge"`, `"sunflower-badge"`.

---

## 5. Standard 6-Step Design Workflow

Always follow this structured workflow when designing:

1. **Inspect First**: Call `get_canvas_summary` to understand the existing canvas state, artboard dimensions, and any pre-existing elements.
2. **Setup Canvas**: If starting a new design or the sizing does not fit the goal, call `create_canvas` (e.g. `1080x1080` for Instagram square, `1920x1080` for landscape) or `apply_artboard_preset`.
3. **Establish Atmosphere & Palette**: Call `set_background` to establish the mood (e.g., deep dark `#0a0f1d`, clean warm white `#fafafa`, or bold `#1e1b4b`).
4. **Gather Imagery**: If the design benefits from photography, call `search_unsplash` with relevant keywords to get high-res URLs.
5. **Declarative Composition**: Call `render_elements` with all design components in a **single call**:
   - Background card / overlay container panels.
   - Images and photo frames.
   - Text hierarchy: Headline $\rightarrow$ Subheadline $\rightarrow$ Body / Call-To-Action.
   - Accents: pill badges, divider lines, stickers.
6. **Visual Audit & Refine**: Call `get_canvas_image` to inspect the visual result. Look for:
   - Contrast between text and background.
   - Generous margins (keep content at least 40–80px away from canvas borders).
   - If anything needs adjustment, call `modify_elements` with the object's `objectId`.

---

## 6. Design Best Practices

- **Visual Hierarchy**:
  - **Hero Headline**: 48px – 72px (Bold, high contrast).
  - **Subheadline**: 24px – 32px (Medium weight, complementary color).
  - **Body / Badges**: 14px – 18px (Clean, high readability).
- **Margins & Breathing Room**: Never place important text right up against canvas edges. Leave a margin of 60–100px.
- **Contrast**: Never place dark text on dark backgrounds or light text on light backgrounds. When placing text over photos, create a semi-transparent dark card (`fill: "#000000"`, `opacity: 0.5`, `cornerRadius: 16`) behind the text.
- **Layering with `action`**: In `modify_elements`, use `action: "bringToFront"` or `"sendToBack"` to fix any z-index stacking issues.
