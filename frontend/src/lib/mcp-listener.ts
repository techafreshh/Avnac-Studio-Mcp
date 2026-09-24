import { EventsOn } from "../../wailsjs/runtime/runtime";
import { SubmitResponse } from "../../wailsjs/go/mcp/AvnacMCP";
import { idbGetEditorRecord, idbSetDocumentName } from "@/lib/avnac-editor-idb";
import { useSceneEditorStore } from "@/features/scene-editor/store";
import {
  SARASWATI_ROOT_ID,
  type SaraswatiColor,
  type SaraswatiCommand,
  type SaraswatiNode,
  type SaraswatiShadow,
} from "@/lib/saraswati";
import { renderSceneToCanvas, renderSceneToPngDataUrl } from "@/lib/renderer/offscreen-render";
import { GOOGLE_FONT_FAMILIES } from "@/data/google-font-families";
import { ARTBOARD_PRESETS } from "@/data/artboard-presets";

interface MCPActionPayload {
  action: string;
  requestId?: string;
  payload: any;
}

function parseColor(input?: string): SaraswatiColor {
  if (!input || input === "transparent") {
    return { type: "solid", color: "transparent" };
  }
  return { type: "solid", color: input };
}

type MCPPaintInput = {
  fill?: string;
  color?: string;
  gradientStops?: unknown;
  gradientAngle?: unknown;
};

function normalizeGradientStops(input: unknown): Array<{ color: string; offset: number }> | null {
  if (!Array.isArray(input)) return null;
  const stops = input
    .filter((s): s is { color: string; offset: number } => {
      if (!s || typeof s !== "object") return false;
      const rec = s as Record<string, unknown>;
      return (
        typeof rec.color === "string" &&
        rec.color.length > 0 &&
        typeof rec.offset === "number" &&
        Number.isFinite(rec.offset)
      );
    })
    .map((s) => ({
      color: s.color,
      offset: Math.min(1, Math.max(0, s.offset)),
    }))
    .sort((a, b) => a.offset - b.offset);
  if (stops.length < 2) return null;
  return stops;
}

function normalizeGradientAngle(input: unknown, fallback = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const n = Number(input);
  if (Number.isFinite(n)) return n;
  return fallback;
}

function gradientCss(stops: Array<{ color: string; offset: number }>, angle: number): string {
  const s = stops.map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(", ");
  return `linear-gradient(${angle}deg, ${s})`;
}

function parsePaint(input: MCPPaintInput): SaraswatiColor {
  const stops = normalizeGradientStops(input.gradientStops);
  if (stops) {
    const angle = normalizeGradientAngle(input.gradientAngle, 0);
    return { type: "gradient", css: gradientCss(stops, angle), stops, angle };
  }
  return parseColor(input.fill ?? input.color);
}

function existingGradientAngle(fill: unknown, fallback = 0): number {
  if (fill && typeof fill === "object") {
    const rec = fill as Record<string, unknown>;
    if (rec.type === "gradient" && typeof rec.angle === "number" && Number.isFinite(rec.angle)) {
      return rec.angle as number;
    }
  }
  return fallback;
}

function existingGradientStops(fill: unknown): Array<{ color: string; offset: number }> | null {
  if (fill && typeof fill === "object") {
    const rec = fill as Record<string, unknown>;
    if (rec.type === "gradient" && Array.isArray(rec.stops)) {
      return normalizeGradientStops(rec.stops);
    }
  }
  return null;
}

/**
 * Resolve a paint update for modify_elements.
 * - gradientStops present + valid → new gradient (angle falls back to mod angle → existing angle → 0)
 * - only gradientAngle present + existing is gradient → re-angle existing stops
 * - fill/color present → solid (unless gradient above takes precedence)
 * - otherwise → null (no paint change)
 */
function resolveModifyPaint(
  mod: { fill?: string; color?: string; gradientStops?: unknown; gradientAngle?: unknown },
  currentPaint: unknown,
): SaraswatiColor | null {
  const hasStopsField = mod.gradientStops !== undefined;
  const hasAngleField = mod.gradientAngle !== undefined;
  const hasSolidField = mod.fill !== undefined || mod.color !== undefined;

  if (hasStopsField) {
    const stops = normalizeGradientStops(mod.gradientStops);
    if (stops) {
      const angle = normalizeGradientAngle(
        mod.gradientAngle,
        existingGradientAngle(currentPaint, 0),
      );
      return { type: "gradient", css: gradientCss(stops, angle), stops, angle };
    }
    // Invalid stops array: fall through to solid if provided, else no change.
    if (hasSolidField) return parseColor(mod.fill ?? mod.color);
    return null;
  }

  if (hasAngleField) {
    const currentStops = existingGradientStops(currentPaint);
    if (currentStops) {
      const angle = normalizeGradientAngle(mod.gradientAngle, existingGradientAngle(currentPaint, 0));
      return { type: "gradient", css: gradientCss(currentStops, angle), stops: currentStops, angle };
    }
    if (hasSolidField) return parsePaint(mod as MCPPaintInput);
    return null;
  }

  if (hasSolidField) {
    // parsePaint also covers the case where solid + gradient arrive together (gradient wins).
    return parsePaint(mod as MCPPaintInput);
  }
  return null;
}

const NO_SCENE_ERROR = "No active canvas scene. Call create_canvas first.";

function normalizeTextAlign(input: unknown): "left" | "center" | "right" {
  const v = String(input ?? "left").trim().toLowerCase();
  if (v === "center" || v === "middle") return "center";
  if (v === "right" || v === "end") return "right";
  return "left";
}

function normalizeFontWeight(input: unknown): string {
  if (input == null) return "400";
  const v = String(input).trim().toLowerCase();
  if (v === "bold") return "700";
  if (v === "medium") return "500";
  if (v === "semibold" || v === "semi-bold") return "600";
  if (v === "normal" || v === "regular") return "400";
  if (/^\d{3}$/.test(v)) return v;
  const n = Number(v);
  if (Number.isFinite(n)) return String(Math.min(900, Math.max(100, Math.round(n))));
  return "400";
}

function normalizeFontStyle(input: unknown): "normal" | "italic" {
  return String(input ?? "normal").trim().toLowerCase() === "italic" ? "italic" : "normal";
}

function normalizeAlignKind(input: unknown): string {
  const v = String(input ?? "").trim();
  const lower = v.toLowerCase();
  if (lower === "left") return "left";
  if (lower === "center" || lower === "centerh" || lower === "center_h") return "centerH";
  if (lower === "right") return "right";
  if (lower === "top") return "top";
  if (lower === "middle" || lower === "centerv" || lower === "center_v") return "centerV";
  if (lower === "bottom") return "bottom";
  // Already-normalized engine kinds pass through.
  if (v === "centerH" || v === "centerV") return v;
  return v;
}

function regularPolygonPoints(sides: number, radius: number) {
  const n = Math.max(3, Math.min(32, Math.round(sides)));
  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < n; index += 1) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
    points.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  }
  return points;
}

function starPolygonPoints(pointsCount: number, outerRadius: number) {
  const n = Math.max(3, Math.min(24, Math.round(pointsCount)));
  const innerRadius = outerRadius * 0.45;
  const points: Array<{ x: number; y: number }> = [];
  const step = Math.PI / n;
  for (let index = 0; index < n * 2; index += 1) {
    const angle = -Math.PI / 2 + index * step;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    points.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  }
  return points;
}

let activeNavigate: ((options: any) => void) | undefined;
let activeUnsub: (() => void) | undefined;
let isSubscribed = false;

async function getReadyScene(timeoutMs = 4000): Promise<{
  store: ReturnType<typeof useSceneEditorStore.getState>;
  scene: ReturnType<typeof useSceneEditorStore.getState>["scene"];
}> {
  let store = useSceneEditorStore.getState();
  let scene = store.scene;
  if (scene) return { store, scene };

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
    store = useSceneEditorStore.getState();
    scene = store.scene;
    if (scene) return { store, scene };
  }
  return { store, scene: null };
}

/**
 * Wait until the /scene route has finished loading a specific document.
 * create_canvas navigates and lets the route own the single initial write;
 * calling store.load() directly as well would double-write the same new
 * workspace and race on Windows (rename → Access is denied).
 */
async function waitForDocument(
  documentId: string,
  timeoutMs = 15000,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const start = Date.now();
  for (;;) {
    const state = useSceneEditorStore.getState();
    if (state.documentId === documentId && state.scene && !state.isLoading) {
      return { ok: true };
    }
    if (state.documentId === documentId && state.loadError) {
      return { ok: false, error: state.loadError };
    }
    if (Date.now() - start >= timeoutMs) {
      const current = useSceneEditorStore.getState();
      if (current.loadError) return { ok: false, error: current.loadError };
      return {
        ok: false,
        error:
          "Timed out waiting for the canvas scene to load. It may still open shortly — retry get_canvas_summary.",
      };
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Initializes the Saraswati MCP event listener.
 * Connects Wails IPC events to the global useSceneEditorStore.
 */
export function initMCPListener(navigate?: (options: any) => void) {
  if (navigate) {
    activeNavigate = navigate;
  }

  if (typeof window === "undefined") {
    return () => {};
  }

  if (isSubscribed) {
    return () => {};
  }

  const handler = async (data: any) => {
    try {
      const actionData = Array.isArray(data) ? data[0] : data;
      if (!actionData || !actionData.action) return;

      const { action, payload, requestId } = actionData as MCPActionPayload;
      const store = useSceneEditorStore.getState();

      if (action === "create_canvas") {
        const { width, height, backgroundColor, color, name } = payload || {};
        const newId = crypto.randomUUID();
        const w = width || 1080;
        const h = height || 1080;
        const bg = backgroundColor || color;
        const title = typeof name === "string" ? name.trim() : "";
        const respondError = (error: string) => {
          if (requestId) {
            SubmitResponse(requestId, { success: false, id: newId, error });
          }
        };
        try {
          if (activeNavigate) {
            // Single-writer path: navigate with name so the /scene route's
            // single load+write creates the row atomically with the title.
            // (Calling store.load() here as well would write the same new
            // workspace twice concurrently.)
            void activeNavigate({
              to: "/scene",
              search: { id: newId, w, h, name: title || undefined },
            });
            const ready = await waitForDocument(newId);
            if (!ready.ok) {
              respondError(`Failed to load: ${ready.error}`);
              return;
            }
            // Belt-and-suspenders: if the route loaded without the name
            // (e.g. older route cached), apply it now.
            let done = useSceneEditorStore.getState();
            if (title && done.documentName !== title) {
              done.setDocumentName(title);
              await useSceneEditorStore.getState().commitDocumentName();
              done = useSceneEditorStore.getState();
            }
            if (bg) {
              done.applyCommands([{ type: "SET_ARTBOARD", bg: parseColor(bg) }]);
            }
            if (requestId) {
              done = useSceneEditorStore.getState();
              const persistedName = done.documentName || "Untitled";
              SubmitResponse(requestId, {
                success: !title || persistedName === title,
                id: newId,
                name: persistedName,
                width: done.scene?.artboard.width ?? w,
                height: done.scene?.artboard.height ?? h,
                message: title
                  ? `Canvas '${persistedName}' created and navigated to /scene`
                  : "Canvas created and navigated to /scene",
              });
            }
          } else {
            // Fallback when no router is wired (tests): direct single load.
            await store.load(newId, { w, h, name: title || undefined });
            let fresh = useSceneEditorStore.getState();
            if (title && fresh.documentName !== title) {
              fresh.setDocumentName(title);
              await useSceneEditorStore.getState().commitDocumentName();
              fresh = useSceneEditorStore.getState();
            }
            if (bg) {
              fresh.applyCommands([{ type: "SET_ARTBOARD", bg: parseColor(bg) }]);
            }
            if (requestId) {
              const done = useSceneEditorStore.getState();
              const persistedName = done.documentName || "Untitled";
              SubmitResponse(requestId, {
                success: !title || persistedName === title,
                id: newId,
                name: persistedName,
                width: done.scene?.artboard.width ?? w,
                height: done.scene?.artboard.height ?? h,
                message: "Canvas created",
              });
            }
          }
        } catch (err: any) {
          respondError(err?.message || String(err));
        }
        return;
      }

      if (action === "open_workspace") {
        const fileId = typeof payload?.fileId === "string" ? payload.fileId.trim() : "";
        if (!fileId) {
          if (requestId) SubmitResponse(requestId, { error: "fileId is required (from list_files)" });
          return;
        }
        try {
          const record = await idbGetEditorRecord(fileId);
          if (!record) {
            if (requestId) {
              SubmitResponse(requestId, {
                error: `No saved file with id '${fileId}'. Call list_files to see available canvases.`,
              });
            }
            return;
          }
          // Already active and loaded? Report without re-navigating.
          const current = useSceneEditorStore.getState();
          if (current.documentId === fileId && current.scene && !current.isLoading) {
            if (requestId) {
              SubmitResponse(requestId, {
                success: true,
                id: fileId,
                name: current.documentName || "Untitled",
                width: current.scene.artboard.width,
                height: current.scene.artboard.height,
                nodeCount: Object.keys(current.scene.nodes).length,
                message: `Canvas '${current.documentName || "Untitled"}' is already open`,
              });
            }
            return;
          }
          if (activeNavigate) {
            // Navigate and let the /scene route own the load, mirroring the
            // create_canvas single-writer contract.
            void activeNavigate({ to: "/scene", search: { id: fileId } });
            const ready = await waitForDocument(fileId);
            if (!ready.ok) {
              if (requestId) SubmitResponse(requestId, { error: `Failed to open canvas: ${ready.error}` });
              return;
            }
          } else {
            // Fallback when no router is wired (tests): direct load.
            await store.load(fileId);
          }
          const done = useSceneEditorStore.getState();
          if (requestId) {
            SubmitResponse(requestId, {
              success: true,
              id: fileId,
              name: done.documentName || "Untitled",
              width: done.scene?.artboard.width ?? record.document?.artboard?.width ?? 0,
              height: done.scene?.artboard.height ?? record.document?.artboard?.height ?? 0,
              nodeCount: done.scene ? Object.keys(done.scene.nodes).length : 0,
              message: `Canvas '${done.documentName || "Untitled"}' opened`,
            });
          }
        } catch (err: any) {
          if (requestId) SubmitResponse(requestId, { error: err?.message || String(err) });
        }
        return;
      }

      if (action === "rename_workspace") {
        const fileId = typeof payload?.fileId === "string" ? payload.fileId.trim() : "";
        const newName = typeof payload?.name === "string" ? payload.name.trim() : "";
        if (!fileId || !newName) {
          if (requestId) SubmitResponse(requestId, { error: "fileId and name are required" });
          return;
        }
        try {
          const active = useSceneEditorStore.getState();
          if (active.documentId === fileId) {
            // Canonical path: the store persists the name with the live doc.
            active.setDocumentName(newName);
            await useSceneEditorStore.getState().commitDocumentName();
          } else {
            await idbSetDocumentName(fileId, newName);
          }
          if (requestId) {
            SubmitResponse(requestId, {
              success: true,
              id: fileId,
              name: newName,
              message: `File renamed to '${newName}'`,
            });
          }
        } catch (err: any) {
          if (requestId) SubmitResponse(requestId, { error: err?.message || String(err) });
        }
        return;
      }

      if (action === "render_elements") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) {
            SubmitResponse(requestId, {
              error: NO_SCENE_ERROR,
            });
          }
          return;
        }

        const { elements, includePreview } = payload;
        if (!elements || !Array.isArray(elements)) {
          if (requestId) SubmitResponse(requestId, { error: "elements must be an array" });
          return;
        }

        const rootId = scene.root || SARASWATI_ROOT_ID;
        const commands: SaraswatiCommand[] = [];
        const created: Array<{
          id: string;
          name?: string;
          type: string;
          bounds: { left: number; top: number; width: number; height: number };
        }> = [];

        for (const el of elements) {
          const id = el.id || crypto.randomUUID();
          const name = el.name || el.type;
          const x = el.x ?? el.left ?? scene.artboard.width / 2 - 50;
          const y = el.y ?? el.top ?? scene.artboard.height / 2 - 50;
          const width = el.width ?? 100;
          const height = el.height ?? 100;
          const rotation = el.rotation ?? el.angle ?? 0;
          const opacity = el.opacity ?? 1;
          const blur = el.blur ?? 0;
          const fill = parsePaint(el);

          let shadow: SaraswatiShadow | null = null;
          if (el.shadow) {
            shadow = {
              blur: el.shadow.blur ?? 0,
              offsetX: el.shadow.offsetX ?? 0,
              offsetY: el.shadow.offsetY ?? 0,
              colorHex: el.shadow.color ?? "#000000",
              opacityPct: el.shadow.opacity ?? 100,
            };
          }

          let node: SaraswatiNode | null = null;

          if (el.type === "rect") {
            node = {
              id,
              type: "rect",
              parentId: rootId,
              name,
              visible: true,
              x,
              y,
              rotation,
              scaleX: 1,
              scaleY: 1,
              opacity,
              originX: "left",
              originY: "top",
              width,
              height,
              radiusX: el.cornerRadius ?? el.radius ?? 0,
              radiusY: el.cornerRadius ?? el.radius ?? 0,
              fill,
              stroke: el.stroke ? parseColor(el.stroke) : null,
              strokeWidth: el.strokeWidth ?? 0,
              shadow,
              blur,
            };
          } else if (el.type === "circle" || el.type === "ellipse") {
            node = {
              id,
              type: "ellipse",
              parentId: rootId,
              name,
              visible: true,
              x,
              y,
              rotation,
              scaleX: 1,
              scaleY: 1,
              opacity,
              originX: "left",
              originY: "top",
              width,
              height,
              fill,
              stroke: el.stroke ? parseColor(el.stroke) : null,
              strokeWidth: el.strokeWidth ?? 0,
              shadow,
              blur,
            };
          } else if (el.type === "polygon") {
            node = {
              id,
              type: "polygon",
              parentId: rootId,
              name,
              visible: true,
              x,
              y,
              rotation,
              scaleX: 1,
              scaleY: 1,
              opacity,
              originX: "left",
              originY: "top",
              width,
              height,
              points: regularPolygonPoints(el.sides || 5, width / 2),
              fill,
              stroke: el.stroke ? parseColor(el.stroke) : null,
              strokeWidth: el.strokeWidth ?? 0,
              shadow,
              blur,
            };
          } else if (el.type === "star") {
            node = {
              id,
              type: "polygon",
              parentId: rootId,
              name,
              visible: true,
              x,
              y,
              rotation,
              scaleX: 1,
              scaleY: 1,
              opacity,
              originX: "left",
              originY: "top",
              width,
              height,
              points: starPolygonPoints(el.sides || 5, width / 2),
              fill,
              stroke: el.stroke ? parseColor(el.stroke) : null,
              strokeWidth: el.strokeWidth ?? 0,
              shadow,
              blur,
            };
          } else if (el.type === "line") {
            const lineStroke = el.stroke ?? el.fill ?? el.color ?? "#000000";
            node = {
              id,
              type: "line",
              parentId: rootId,
              name,
              visible: true,
              x: 0,
              y: 0,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              opacity,
              originX: "left",
              originY: "top",
              x1: el.x1 ?? x,
              y1: el.y1 ?? y,
              x2: el.x2 ?? x + width,
              y2: el.y2 ?? y,
              stroke: parsePaint({ fill: lineStroke, gradientStops: el.gradientStops, gradientAngle: el.gradientAngle }),
              strokeWidth: el.strokeWidth ?? 2,
              arrowStart: false,
              arrowEnd: false,
              lineStyle: "solid",
              pathType: "straight",
              curveBulge: 0,
              curveT: 0.5,
              shadow,
              blur,
            };
          } else if (el.type === "text") {
            node = {
              id,
              type: "text",
              parentId: rootId,
              name,
              visible: true,
              x,
              y,
              rotation,
              scaleX: 1,
              scaleY: 1,
              opacity,
              originX: "left",
              originY: "top",
              text: el.text || "Text",
              width,
              fontSize: el.fontSize ?? 40,
              fontFamily: el.fontFamily ?? "Inter",
              fontWeight: normalizeFontWeight(el.fontWeight),
              fontStyle: normalizeFontStyle(el.fontStyle),
              textAlign: normalizeTextAlign(el.textAlign),
              lineHeight: el.lineHeight ?? 1.2,
              underline: Boolean(el.underline ?? false),
              color: fill,
              stroke: el.stroke ? parseColor(el.stroke) : null,
              strokeWidth: el.strokeWidth ?? 0,
              shadow,
              blur,
            };
          } else if (el.type === "image" && el.url) {
            node = {
              id,
              type: "image",
              parentId: rootId,
              name,
              visible: true,
              x,
              y,
              rotation,
              scaleX: 1,
              scaleY: 1,
              opacity,
              originX: "left",
              originY: "top",
              width,
              height,
              src: el.url,
              cropX: 0,
              cropY: 0,
              clipPath: null,
              borderRadius: el.cornerRadius ?? el.radius ?? 0,
              shadow,
              blur,
            };
          } else if (el.type === "sticker" && el.stickerName) {
            node = {
              id,
              type: "image",
              parentId: rootId,
              name: `Sticker: ${el.stickerName}`,
              visible: true,
              x,
              y,
              rotation,
              scaleX: 1,
              scaleY: 1,
              opacity,
              originX: "left",
              originY: "top",
              width: width || 160,
              height: height || 160,
              src: `/stickers/${el.stickerName}.webp`,
              cropX: 0,
              cropY: 0,
              clipPath: null,
              shadow,
              blur,
            };
          }

          if (node) {
            commands.push({ type: "ADD_NODE", node });
            created.push({
              id: node.id,
              name: node.name,
              type: node.type,
              bounds: {
                left: node.x,
                top: node.y,
                width: (node as any).width ?? 0,
                height: (node as any).height ?? 0,
              },
            });
          }
        }

        if (commands.length > 0) {
          activeStore.applyCommands(commands);
        }

        if (requestId) {
          if (includePreview) {
            try {
              const updatedScene = useSceneEditorStore.getState().scene;
              if (updatedScene) {
                const dataUrl = await renderSceneToPngDataUrl(updatedScene, {
                  maxCssPx: 1024,
                  prePaintArtboardBackground: true,
                });
                const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
                SubmitResponse(requestId, { created, imageData: base64Data });
                return;
              }
            } catch (err) {
              console.warn("Failed to generate preview for render_elements:", err);
            }
          }
          SubmitResponse(requestId, { created });
        }
        return;
      }

      if (action === "modify_elements") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }

        const { modifications, includePreview } = payload;
        if (!modifications || !Array.isArray(modifications)) {
          if (requestId) SubmitResponse(requestId, { error: "modifications must be an array" });
          return;
        }

        const commands: SaraswatiCommand[] = [];
        let modifiedCount = 0;

        for (const mod of modifications) {
          const node = scene.nodes[mod.objectId];
          if (!node) continue;
          modifiedCount++;

          const newX = mod.x ?? mod.left;
          const newY = mod.y ?? mod.top;
          if (newX !== undefined || newY !== undefined || mod.width !== undefined || mod.height !== undefined) {
            const currentX = "x" in node ? (node as any).x : 0;
            const currentY = "y" in node ? (node as any).y : 0;
            const currentW = "width" in node ? (node as any).width : 100;
            const currentH = "height" in node ? (node as any).height : 100;
            commands.push({
              type: "RESIZE_NODE",
              id: mod.objectId,
              x: newX ?? currentX,
              y: newY ?? currentY,
              width: mod.width ?? currentW,
              height: mod.height ?? currentH,
            });
          }

          const rot = mod.rotation ?? mod.angle;
          if (rot !== undefined) {
            commands.push({ type: "ROTATE_NODE", id: mod.objectId, rotation: rot });
          }

          if (mod.opacity !== undefined) {
            commands.push({ type: "SET_NODE_OPACITY", id: mod.objectId, opacity: mod.opacity });
          }

          const hasPaintFields =
            mod.fill !== undefined ||
            mod.color !== undefined ||
            mod.gradientStops !== undefined ||
            mod.gradientAngle !== undefined;
          let pendingPaint: SaraswatiColor | null = null;
          let lineStrokeDone = false;
          if (hasPaintFields) {
            const currentPaint =
              node.type === "text"
                ? (node as any).color
                : node.type === "line"
                  ? (node as any).stroke
                  : (node as any).fill;
            pendingPaint = resolveModifyPaint(mod, currentPaint);
            if (pendingPaint) {
              if (node.type === "text") {
                // Applied via SET_TEXT_FORMAT below.
              } else if (node.type === "line") {
                commands.push({
                  type: "SET_NODE_STROKE",
                  id: mod.objectId,
                  stroke: pendingPaint,
                  strokeWidth: mod.strokeWidth ?? (node as any).strokeWidth ?? 2,
                });
                pendingPaint = null;
                lineStrokeDone = true;
              } else if (node.type !== "image" && node.type !== "group") {
                commands.push({ type: "SET_NODE_FILL", id: mod.objectId, fill: pendingPaint });
                pendingPaint = null;
              } else {
                pendingPaint = null;
              }
            }
          }

          const rad = mod.cornerRadius ?? mod.radius;
          if (rad !== undefined) {
            if (node.type === "rect") {
              commands.push({
                type: "SET_NODE_CORNER_RADIUS",
                id: mod.objectId,
                radiusX: rad,
                radiusY: rad,
              });
            } else if (node.type === "image") {
              commands.push({
                type: "SET_IMAGE_BORDER_RADIUS",
                id: mod.objectId,
                radius: rad,
              });
            }
          }

          if (mod.shadow) {
            commands.push({
              type: "SET_NODE_SHADOW",
              id: mod.objectId,
              shadow: {
                blur: mod.shadow.blur ?? 0,
                offsetX: mod.shadow.offsetX ?? 0,
                offsetY: mod.shadow.offsetY ?? 0,
                colorHex: mod.shadow.color ?? "#000000",
                opacityPct: mod.shadow.opacity ?? 100,
              },
            });
          }

          if (mod.blur !== undefined) {
            commands.push({ type: "SET_NODE_BLUR", id: mod.objectId, blur: mod.blur });
          }

          if (mod.text !== undefined && node.type === "text") {
            commands.push({ type: "SET_TEXT_CONTENT", id: mod.objectId, text: mod.text });
          }

          if (node.type === "text") {
            const formatPatch: Record<string, unknown> = {};
            if (mod.fontSize !== undefined) formatPatch.fontSize = mod.fontSize;
            if (mod.fontFamily !== undefined) formatPatch.fontFamily = mod.fontFamily;
            if (mod.fontWeight !== undefined) formatPatch.fontWeight = normalizeFontWeight(mod.fontWeight);
            if (mod.fontStyle !== undefined) formatPatch.fontStyle = normalizeFontStyle(mod.fontStyle);
            if (mod.textAlign !== undefined) formatPatch.textAlign = normalizeTextAlign(mod.textAlign);
            if (mod.lineHeight !== undefined) formatPatch.lineHeight = mod.lineHeight;
            if (mod.underline !== undefined) formatPatch.underline = Boolean(mod.underline);
            if (pendingPaint) {
              formatPatch.color = pendingPaint;
              pendingPaint = null;
            } else if (mod.color !== undefined || mod.fill !== undefined) {
              formatPatch.color = parseColor(mod.color ?? mod.fill);
            }
            if (Object.keys(formatPatch).length > 0) {
              commands.push({
                type: "SET_TEXT_FORMAT",
                id: mod.objectId,
                ...formatPatch,
              } as SaraswatiCommand);
            }
            if (mod.stroke !== undefined || mod.strokeWidth !== undefined) {
              commands.push({
                type: "SET_NODE_STROKE",
                id: mod.objectId,
                stroke: mod.stroke ? parseColor(mod.stroke) : (node as any).stroke ?? null,
                strokeWidth: mod.strokeWidth ?? (node as any).strokeWidth ?? 0,
              });
            }
          } else if (mod.stroke !== undefined || mod.strokeWidth !== undefined) {
            if (lineStrokeDone) {
              // Gradient stroke already applied above (includes strokeWidth fallback) — skip duplicate.
            } else if (node.type !== "group" && node.type !== "image") {
              commands.push({
                type: "SET_NODE_STROKE",
                id: mod.objectId,
                stroke: mod.stroke ? parseColor(mod.stroke) : ((node as any).stroke ?? null),
                strokeWidth: mod.strokeWidth ?? (node as any).strokeWidth ?? 0,
              });
            }
          }

          if (mod.name !== undefined) {
            commands.push({ type: "SET_NODE_NAME", id: mod.objectId, name: mod.name });
          }
        }

        if (commands.length > 0) {
          activeStore.applyCommands(commands);
        }

        if (requestId) {
          if (includePreview) {
            try {
              const updatedScene = useSceneEditorStore.getState().scene;
              if (updatedScene) {
                const dataUrl = await renderSceneToPngDataUrl(updatedScene, {
                  maxCssPx: 1024,
                  prePaintArtboardBackground: true,
                });
                const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
                SubmitResponse(requestId, { modifiedCount, imageData: base64Data });
                return;
              }
            } catch (err) {
              console.warn("Failed to generate preview for modify_elements:", err);
            }
          }
          SubmitResponse(requestId, { modifiedCount });
        }
        return;
      }

      if (action === "get_canvas_summary" && requestId) {
        const { scene } = await getReadyScene();
        if (!scene) {
          SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }

        const nodesSummary = Object.values(scene.nodes)
          .filter((n) => n.id !== scene.root)
          .map((n) => ({
            id: n.id,
            name: n.name,
            type: n.type,
            visible: n.visible,
            x: "x" in n ? (n as any).x : 0,
            y: "y" in n ? (n as any).y : 0,
            width: "width" in n ? (n as any).width : 0,
            height: "height" in n ? (n as any).height : 0,
            rotation: "rotation" in n ? (n as any).rotation : 0,
            opacity: n.opacity,
            fill: "fill" in n ? (n as any).fill : undefined,
            stroke: "stroke" in n ? (n as any).stroke : undefined,
            text: "text" in n ? (n as any).text : undefined,
          }));

        SubmitResponse(requestId, {
          artboard: scene.artboard,
          nodes: nodesSummary,
        });
        return;
      }

      if (action === "get_canvas_state" && requestId) {
        const { scene } = await getReadyScene();
        if (!scene) {
          SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        SubmitResponse(requestId, { scene });
        return;
      }

      if (action === "get_canvas_image" && requestId) {
        const { scene } = await getReadyScene();
        if (!scene) {
          SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }

        try {
          const canvas = await renderSceneToCanvas(scene, {
            maxCssPx: 1024,
            prePaintArtboardBackground: true,
          });

          if (!canvas) {
            SubmitResponse(requestId, { error: "Failed to render scene to canvas" });
            return;
          }

          if (payload?.annotated) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const scale = canvas.width / Math.max(1, scene.artboard.width);
              ctx.save();
              ctx.font = "12px sans-serif";
              for (const node of Object.values(scene.nodes)) {
                if (node.id === scene.root || !node.visible) continue;
                const nodeX = "x" in node ? (node as any).x : 0;
                const nodeY = "y" in node ? (node as any).y : 0;
                const x = nodeX * scale;
                const y = nodeY * scale;
                const w = ("width" in node ? (node as any).width : 100) * scale;
                const h = ("height" in node ? (node as any).height : 100) * scale;

                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);

                const label = `[#${node.name || node.id.slice(0, 6)}]`;
                const textWidth = ctx.measureText(label).width;
                ctx.fillStyle = "#3b82f6";
                ctx.fillRect(x, Math.max(0, y - 18), textWidth + 8, 18);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(label, x + 4, Math.max(13, y - 4));
              }
              ctx.restore();
            }
          }

          if (payload?.objectId) {
            const targetNode = scene.nodes[payload.objectId];
            if (!targetNode) {
              SubmitResponse(requestId, { error: `Object ${payload.objectId} not found in scene` });
              return;
            }
            const scale = canvas.width / Math.max(1, scene.artboard.width);
            const nx = ("x" in targetNode ? (targetNode as any).x : 0) * scale;
            const ny = ("y" in targetNode ? (targetNode as any).y : 0) * scale;
            const nw = ("width" in targetNode ? (targetNode as any).width : 100) * scale;
            const nh = ("height" in targetNode ? (targetNode as any).height : 100) * scale;

            const pad = 8;
            const cropX = Math.max(0, Math.floor(nx - pad));
            const cropY = Math.max(0, Math.floor(ny - pad));
            const cropW = Math.min(canvas.width - cropX, Math.ceil(nw + pad * 2));
            const cropH = Math.min(canvas.height - cropY, Math.ceil(nh + pad * 2));

            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = Math.max(1, cropW);
            cropCanvas.height = Math.max(1, cropH);
            const cropCtx = cropCanvas.getContext("2d");
            if (cropCtx) {
              cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              const dataUrl = cropCanvas.toDataURL("image/png");
              const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
              SubmitResponse(requestId, { imageData: base64Data });
              return;
            }
          }

          const dataUrl = canvas.toDataURL("image/png");
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
          SubmitResponse(requestId, { imageData: base64Data });
        } catch (err: any) {
          SubmitResponse(requestId, { error: err?.message || "Failed to export image" });
        }
        return;
      }

      if (action === "select_objects") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const ids = payload?.objectIds;
        const list = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
        const valid = list.filter((id: unknown) => typeof id === "string" && (scene.nodes as Record<string, unknown>)[id as string]);
        if (valid.length === 0) {
          if (requestId) SubmitResponse(requestId, { error: `No matching objects for ids: ${JSON.stringify(list)}` });
          return;
        }
        activeStore.setSelectedIds(valid);
        if (requestId) SubmitResponse(requestId, { success: true, selectedIds: valid });
        return;
      }

      if (action === "delete_object") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const objectId = payload?.objectId;
        if (objectId) {
          if (!scene.nodes[objectId]) {
            if (requestId) SubmitResponse(requestId, { error: `Object ${objectId} not found` });
            return;
          }
          activeStore.applyCommands([{ type: "DELETE_NODE", id: objectId }]);
          const next = useSceneEditorStore.getState();
          next.setSelectedIds(next.selectedIds.filter((id) => id !== objectId));
          if (requestId) SubmitResponse(requestId, { success: true, deletedId: objectId });
          return;
        }
        const selected = activeStore.selectedIds ?? [];
        if (selected.length === 0) {
          if (requestId) SubmitResponse(requestId, { error: "No objectId provided and no current selection to delete" });
          return;
        }
        activeStore.applyCommands(selected.map((id) => ({ type: "DELETE_NODE" as const, id })));
        activeStore.setSelectedIds([]);
        if (requestId) SubmitResponse(requestId, { success: true, deletedIds: selected });
        return;
      }

      if (action === "set_background") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const color = payload?.color ?? payload?.backgroundColor;
        if (!color) {
          if (requestId) SubmitResponse(requestId, { error: "color is required (hex e.g. '#0f172a')" });
          return;
        }
        activeStore.setArtboard(undefined, undefined, parseColor(color));
        if (requestId) {
          const updated = useSceneEditorStore.getState().scene;
          SubmitResponse(requestId, { success: true, background: updated?.artboard.bg ?? parseColor(color) });
        }
        return;
      }

      if (action === "apply_artboard_preset") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const presetId = payload?.presetId ?? payload?.preset;
        const preset = ARTBOARD_PRESETS.find((p) => p.id === presetId);
        if (!preset) {
          if (requestId) {
            SubmitResponse(requestId, {
              error: `Unknown preset ${JSON.stringify(presetId)}. Valid presetId: ${ARTBOARD_PRESETS.map((p) => p.id).join(", ")}`,
            });
          }
          return;
        }
        activeStore.setArtboard(preset.width, preset.height);
        if (requestId) SubmitResponse(requestId, { success: true, presetId: preset.id, width: preset.width, height: preset.height });
        return;
      }

      if (action === "get_object_properties" && requestId) {
        const { scene } = await getReadyScene();
        if (!scene) {
          SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const node = scene?.nodes[payload?.objectId];
        if (node) {
          SubmitResponse(requestId, { node });
        } else {
          SubmitResponse(requestId, { error: `Object ${payload?.objectId} not found` });
        }
        return;
      }

      if (action === "clear_canvas") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const childIds = Object.values(scene.nodes)
          .filter((n) => n.id !== scene.root)
          .map((n) => n.id);
        const cmds: SaraswatiCommand[] = childIds.map((id) => ({
          type: "DELETE_NODE",
          id,
        }));
        activeStore.applyCommands(cmds);
        activeStore.setSelectedIds([]);
        if (requestId) SubmitResponse(requestId, { success: true, clearedCount: childIds.length });
        return;
      }

      if (action === "list_objects") {
        const { scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const objects = Object.values(scene.nodes)
          .filter((n) => n.id !== scene.root)
          .map((n) => ({
            id: n.id,
            name: (n as { name?: string }).name,
            type: n.type,
            visible: n.visible,
            parentId: (n as { parentId?: string | null }).parentId ?? null,
            x: "x" in n ? (n as unknown as { x: number }).x : undefined,
            y: "y" in n ? (n as unknown as { y: number }).y : undefined,
            width: "width" in n ? (n as unknown as { width: number }).width : undefined,
            height: "height" in n ? (n as unknown as { height: number }).height : undefined,
            rotation: "rotation" in n ? (n as unknown as { rotation: number }).rotation : undefined,
            opacity: (n as { opacity?: number }).opacity,
            text: "text" in n ? (n as unknown as { text: string }).text : undefined,
          }));
        if (requestId) SubmitResponse(requestId, { objects });
        return;
      }

      if (action === "get_selection") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const selectedIds = activeStore.selectedIds ?? [];
        const objects = selectedIds
          .map((id) => scene.nodes[id])
          .filter(Boolean)
          .map((n) => ({
            id: n!.id,
            name: (n as { name?: string }).name,
            type: n!.type,
            visible: n!.visible,
            x: "x" in n! ? (n as unknown as { x: number }).x : undefined,
            y: "y" in n! ? (n as unknown as { y: number }).y : undefined,
            width: "width" in n! ? (n as unknown as { width: number }).width : undefined,
            height: "height" in n! ? (n as unknown as { height: number }).height : undefined,
          }));
        if (requestId) SubmitResponse(requestId, { selectedIds, objects });
        return;
      }

      if (action === "align_objects") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const kind = normalizeAlignKind(payload?.type ?? payload?.kind ?? payload?.align);
        const validKinds = ["left", "centerH", "right", "top", "centerV", "bottom"];
        if (!validKinds.includes(kind)) {
          if (requestId) SubmitResponse(requestId, { error: `Unknown align type ${JSON.stringify(payload?.type)}. Expected one of left, center, right, top, middle, bottom.` });
          return;
        }
        const selected = (activeStore.selectedIds ?? []).filter((id) => scene.nodes[id]);
        if (selected.length === 0) {
          if (requestId) SubmitResponse(requestId, { error: "No selected objects to align. Call select_objects first." });
          return;
        }
        const boundsOf = (id: string) => {
          const node = scene.nodes[id];
          if (!node) return null;
          if (node.type === "group") {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const stack = [...(node as { children: string[] }).children];
            while (stack.length > 0) {
              const child = scene.nodes[stack.pop()!];
              if (!child) continue;
              if (child.type === "group") {
                stack.push(...(child as { children: string[] }).children);
                continue;
              }
              const cx = "x" in child ? (child as unknown as { x: number }).x : 0;
              const cy = "y" in child ? (child as unknown as { y: number }).y : 0;
              const cw = "width" in child ? (child as unknown as { width: number }).width : 0;
              const ch = "height" in child ? (child as unknown as { height: number }).height : 0;
              minX = Math.min(minX, cx); minY = Math.min(minY, cy);
              maxX = Math.max(maxX, cx + cw); maxY = Math.max(maxY, cy + ch);
            }
            if (!Number.isFinite(minX)) return null;
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          }
          const x = "x" in node ? (node as unknown as { x: number }).x : 0;
          const y = "y" in node ? (node as unknown as { y: number }).y : 0;
          const w = "width" in node ? (node as unknown as { width: number }).width : 0;
          const h = "height" in node ? (node as unknown as { height: number }).height : 0;
          if (node.type === "line") {
            const x1 = (node as unknown as { x1: number }).x1;
            const y1 = (node as unknown as { y1: number }).y1;
            const x2 = (node as unknown as { x2: number }).x2;
            const y2 = (node as unknown as { y2: number }).y2;
            return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
          }
          return { x, y, width: w, height: h };
        };
        const entries = selected.map((id) => ({ id, bounds: boundsOf(id) })).filter((e) => e.bounds != null) as Array<{ id: string; bounds: { x: number; y: number; width: number; height: number } }>;
        if (entries.length === 0) {
          if (requestId) SubmitResponse(requestId, { error: "Selected objects have no measurable bounds" });
          return;
        }
        const cmds: SaraswatiCommand[] = [];
        if (entries.length === 1) {
          const b = entries[0]!.bounds;
          let dx = 0, dy = 0;
          if (kind === "left") dx = -b.x;
          if (kind === "centerH") dx = scene.artboard.width / 2 - (b.x + b.width / 2);
          if (kind === "right") dx = scene.artboard.width - (b.x + b.width);
          if (kind === "top") dy = -b.y;
          if (kind === "centerV") dy = scene.artboard.height / 2 - (b.y + b.height / 2);
          if (kind === "bottom") dy = scene.artboard.height - (b.y + b.height);
          if (dx !== 0 || dy !== 0) cmds.push({ type: "MOVE_NODE", id: entries[0]!.id, dx, dy });
        } else {
          const xs = entries.map((e) => e.bounds.x);
          const ys = entries.map((e) => e.bounds.y);
          const x2s = entries.map((e) => e.bounds.x + e.bounds.width);
          const y2s = entries.map((e) => e.bounds.y + e.bounds.height);
          const ux = Math.min(...xs), uy = Math.min(...ys);
          const ux2 = Math.max(...x2s), uy2 = Math.max(...y2s);
          for (const e of entries) {
            let dx = 0, dy = 0;
            if (kind === "left") dx = ux - e.bounds.x;
            if (kind === "centerH") dx = ux + (ux2 - ux) / 2 - (e.bounds.x + e.bounds.width / 2);
            if (kind === "right") dx = ux2 - (e.bounds.x + e.bounds.width);
            if (kind === "top") dy = uy - e.bounds.y;
            if (kind === "centerV") dy = uy + (uy2 - uy) / 2 - (e.bounds.y + e.bounds.height / 2);
            if (kind === "bottom") dy = uy2 - (e.bounds.y + e.bounds.height);
            if (dx !== 0 || dy !== 0) cmds.push({ type: "MOVE_NODE", id: e.id, dx, dy });
          }
        }
        if (cmds.length > 0) activeStore.applyCommands(cmds);
        if (requestId) SubmitResponse(requestId, { success: true, alignedCount: entries.length, kind, movedCount: cmds.length });
        return;
      }

      if (action === "distribute_objects") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const direction = String(payload?.direction ?? payload?.type ?? "horizontal").toLowerCase();
        if (direction !== "horizontal" && direction !== "vertical") {
          if (requestId) SubmitResponse(requestId, { error: `direction must be 'horizontal' or 'vertical' (got ${JSON.stringify(payload?.direction ?? payload?.type)})` });
          return;
        }
        const selected = (activeStore.selectedIds ?? []).filter((id) => scene.nodes[id]);
        if (selected.length < 3) {
          if (requestId) SubmitResponse(requestId, { error: `distribute_objects needs at least 3 selected objects (got ${selected.length}). Call select_objects first.` });
          return;
        }
        const boundsOf = (id: string) => {
          const node = scene.nodes[id]!;
          const x = "x" in node ? (node as unknown as { x: number }).x : 0;
          const y = "y" in node ? (node as unknown as { y: number }).y : 0;
          const w = "width" in node ? (node as unknown as { width: number }).width : 0;
          const h = "height" in node ? (node as unknown as { height: number }).height : 0;
          return { x, y, width: w, height: h };
        };
        const entries = selected.map((id) => ({ id, bounds: boundsOf(id) }));
        const sorted = [...entries].sort((a, b) => direction === "horizontal"
          ? a.bounds.x + a.bounds.width / 2 - (b.bounds.x + b.bounds.width / 2)
          : a.bounds.y + a.bounds.height / 2 - (b.bounds.y + b.bounds.height / 2));
        const first = sorted[0]!.bounds;
        const last = sorted[sorted.length - 1]!.bounds;
        const startCenter = direction === "horizontal" ? first.x + first.width / 2 : first.y + first.height / 2;
        const endCenter = direction === "horizontal" ? last.x + last.width / 2 : last.y + last.height / 2;
        const step = (endCenter - startCenter) / (sorted.length - 1);
        const cmds: SaraswatiCommand[] = [];
        sorted.forEach((entry, index) => {
          if (index === 0 || index === sorted.length - 1) return;
          const targetCenter = startCenter + step * index;
          if (direction === "horizontal") {
            const currentCenter = entry.bounds.x + entry.bounds.width / 2;
            const dx = targetCenter - currentCenter;
            if (dx !== 0) cmds.push({ type: "MOVE_NODE", id: entry.id, dx, dy: 0 });
          } else {
            const currentCenter = entry.bounds.y + entry.bounds.height / 2;
            const dy = targetCenter - currentCenter;
            if (dy !== 0) cmds.push({ type: "MOVE_NODE", id: entry.id, dx: 0, dy });
          }
        });
        if (cmds.length > 0) activeStore.applyCommands(cmds);
        if (requestId) SubmitResponse(requestId, { success: true, direction, distributedCount: selected.length, movedCount: cmds.length });
        return;
      }

      if (action === "group_objects") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const ids = Array.isArray(payload?.objectIds) ? payload.objectIds : [];
        if (ids.length < 2) {
          if (requestId) SubmitResponse(requestId, { error: "objectIds must contain at least 2 ids to group" });
          return;
        }
        const nodes = ids.map((id: string) => scene.nodes[id]);
        if (nodes.some((n: unknown) => !n)) {
          if (requestId) SubmitResponse(requestId, { error: "One or more objectIds not found in scene" });
          return;
        }
        const parentId = (nodes[0] as { parentId: string | null }).parentId;
        if (!parentId || nodes.some((n: unknown) => (n as { parentId: string | null }).parentId !== parentId)) {
          if (requestId) SubmitResponse(requestId, { error: "All grouped objects must share the same parent" });
          return;
        }
        const groupId = crypto.randomUUID();
        activeStore.applyCommands([{ type: "GROUP_NODES", id: groupId, parentId, children: [...ids] }]);
        activeStore.setSelectedIds([groupId]);
        if (requestId) SubmitResponse(requestId, { success: true, groupId, children: ids });
        return;
      }

      if (action === "ungroup_objects") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const groupId = payload?.groupId ?? payload?.objectId ?? payload?.id;
        const group = groupId ? scene.nodes[groupId] : undefined;
        if (!group || group.type !== "group") {
          if (requestId) SubmitResponse(requestId, { error: `Group ${JSON.stringify(groupId)} not found` });
          return;
        }
        const children = [...(group as { children: string[] }).children];
        activeStore.applyCommands([{ type: "UNGROUP_NODE", id: groupId }]);
        activeStore.setSelectedIds(children);
        if (requestId) SubmitResponse(requestId, { success: true, groupId, children });
        return;
      }

      if (action === "fit_to_artboard") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        const selected = (activeStore.selectedIds ?? []).filter((id) => scene.nodes[id]);
        if (selected.length === 0) {
          if (requestId) SubmitResponse(requestId, { error: "No selected objects to fit. Call select_objects first." });
          return;
        }
        const padding = Number(payload?.padding ?? 0) || 0;
        const targetW = Math.max(1, scene.artboard.width - padding * 2);
        const targetH = Math.max(1, scene.artboard.height - padding * 2);
        const targetX = padding;
        const targetY = padding;
        const boundsOf = (id: string) => {
          const node = scene.nodes[id]!;
          const x = "x" in node ? (node as unknown as { x: number }).x : 0;
          const y = "y" in node ? (node as unknown as { y: number }).y : 0;
          const w = "width" in node ? (node as unknown as { width: number }).width : 0;
          const h = "height" in node ? (node as unknown as { height: number }).height : 0;
          return { x, y, width: Math.max(1, w), height: Math.max(1, h) };
        };
        const cmds: SaraswatiCommand[] = [];
        if (selected.length === 1) {
          const id = selected[0]!;
          const node = scene.nodes[id]!;
          if (node.type === "group" || node.type === "line") {
            if (requestId) SubmitResponse(requestId, { error: "fit_to_artboard currently supports single rect/ellipse/image/text/polygon selections" });
            return;
          }
          cmds.push({ type: "RESIZE_NODE", id, x: targetX, y: targetY, width: targetW, height: targetH });
        } else {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          const boxes = selected.map((id) => ({ id, box: boundsOf(id) }));
          for (const b of boxes) {
            minX = Math.min(minX, b.box.x); minY = Math.min(minY, b.box.y);
            maxX = Math.max(maxX, b.box.x + b.box.width); maxY = Math.max(maxY, b.box.y + b.box.height);
          }
          const srcW = Math.max(1, maxX - minX), srcH = Math.max(1, maxY - minY);
          const s = Math.min(targetW / srcW, targetH / srcH);
          const offsetX = targetX + (targetW - srcW * s) / 2 - minX * s;
          const offsetY = targetY + (targetH - srcH * s) / 2 - minY * s;
          for (const b of boxes) {
            const node = scene.nodes[b.id]!;
            if (node.type === "group" || node.type === "line") continue;
            cmds.push({
              type: "RESIZE_NODE",
              id: b.id,
              x: b.box.x * s + offsetX,
              y: b.box.y * s + offsetY,
              width: Math.max(1, b.box.width * s),
              height: Math.max(1, b.box.height * s),
            });
          }
        }
        if (cmds.length > 0) activeStore.applyCommands(cmds);
        if (requestId) SubmitResponse(requestId, { success: true, fittedCount: cmds.length, padding });
        return;
      }

      if (action === "export_png" || action === "export_object") {
        const { scene } = await getReadyScene();
        if (!scene) {
          if (requestId) SubmitResponse(requestId, { error: NO_SCENE_ERROR });
          return;
        }
        try {
          const canvas = await renderSceneToCanvas(scene, { maxCssPx: 2048, prePaintArtboardBackground: !(payload?.transparent) });
          if (!canvas) {
            if (requestId) SubmitResponse(requestId, { error: "Failed to render scene" });
            return;
          }
          const exportId = payload?.objectId;
          if (exportId) {
            const targetNode = scene.nodes[exportId];
            if (!targetNode) {
              if (requestId) SubmitResponse(requestId, { error: `Object ${exportId} not found in scene` });
              return;
            }
            if (payload?.format === "svg") {
              if (requestId) SubmitResponse(requestId, { error: "SVG object export is not yet supported via MCP; use PNG format" });
              return;
            }
          }
          const dataUrl = canvas.toDataURL("image/png");
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
          if (requestId) SubmitResponse(requestId, { success: true, imageData: base64Data });
        } catch (err: unknown) {
          if (requestId) SubmitResponse(requestId, { error: (err as Error)?.message || "Export failed" });
        }
        return;
      }

      if (action === "get_font_list" && requestId) {
        SubmitResponse(requestId, { fonts: GOOGLE_FONT_FAMILIES });
        return;
      }
    } catch (e: any) {
      console.error("Failed to handle MCP action:", e);
      try {
        const actionData = Array.isArray(data) ? data[0] : data;
        if (actionData?.requestId) {
          SubmitResponse(actionData.requestId, { error: e?.message || "Internal error handling MCP action" });
        }
      } catch {}
    }
  };

  isSubscribed = true;

  if ((window as any).runtime?.EventsOnMultiple) {
    activeUnsub = EventsOn("mcp:action", handler);
    return () => {
      isSubscribed = false;
      activeUnsub?.();
      activeUnsub = undefined;
    };
  }

  const interval = setInterval(() => {
    if ((window as any).runtime?.EventsOnMultiple) {
      clearInterval(interval);
      activeUnsub = EventsOn("mcp:action", handler);
    }
  }, 100);

  const timeout = setTimeout(() => clearInterval(interval), 10000);

  return () => {
    clearInterval(interval);
    clearTimeout(timeout);
    isSubscribed = false;
    activeUnsub?.();
    activeUnsub = undefined;
  };
}
