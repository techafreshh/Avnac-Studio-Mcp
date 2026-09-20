import { EventsOn } from "../../wailsjs/runtime/runtime";
import { SubmitResponse } from "../../wailsjs/go/mcp/AvnacMCP";
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
        const { width, height, backgroundColor, color } = payload || {};
        const newId = crypto.randomUUID();
        const w = width || 1080;
        const h = height || 1080;
        if (activeNavigate) {
          void activeNavigate({
            to: "/scene",
            search: { id: newId, w, h },
          });
        }
        try {
          await store.load(newId, { w, h });
          const bg = backgroundColor || color;
          if (bg) {
            store.applyCommands([{ type: "SET_ARTBOARD", bg: parseColor(bg) }]);
          }
          if (requestId) {
            SubmitResponse(requestId, {
              success: true,
              id: newId,
              message: "Canvas created and navigated to /scene",
            });
          }
        } catch (err: any) {
          if (requestId) {
            SubmitResponse(requestId, {
              success: false,
              id: newId,
              error: err?.message || String(err),
            });
          }
        }
        return;
      }

      if (action === "render_elements") {
        const { store: activeStore, scene } = await getReadyScene();
        if (!scene) {
          if (requestId) {
            SubmitResponse(requestId, {
              error: "No active canvas scene. Call create_canvas first.",
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
          const fill = parseColor(el.fill ?? el.color);

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
              stroke: fill.type === "solid" ? fill : { type: "solid", color: "#000000" },
              strokeWidth: el.width ?? 2,
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
              fontWeight: "400",
              fontStyle: "normal",
              textAlign: "left",
              lineHeight: 1.2,
              underline: false,
              color: fill,
              stroke: null,
              strokeWidth: 0,
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
          if (requestId) SubmitResponse(requestId, { error: "No active scene" });
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

          if (mod.fill !== undefined || mod.color !== undefined) {
            const fill = parseColor(mod.fill ?? mod.color);
            commands.push({ type: "SET_NODE_FILL", id: mod.objectId, fill });
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

          if ((mod.fontSize !== undefined || mod.fontFamily !== undefined) && node.type === "text") {
            commands.push({
              type: "SET_TEXT_FORMAT",
              id: mod.objectId,
              fontSize: mod.fontSize,
              fontFamily: mod.fontFamily,
            });
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
          SubmitResponse(requestId, { error: "No active canvas scene" });
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
        SubmitResponse(requestId, { scene });
        return;
      }

      if (action === "get_canvas_image" && requestId) {
        const { scene } = await getReadyScene();
        if (!scene) {
          SubmitResponse(requestId, { error: "No active canvas scene" });
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
        const { objectIds } = payload;
        if (Array.isArray(objectIds)) {
          store.setSelectedIds(objectIds);
        }
        return;
      }

      if (action === "delete_object") {
        const { objectId } = payload;
        if (objectId) {
          store.applyCommands([{ type: "DELETE_NODE", id: objectId }]);
        }
        return;
      }

      if (action === "set_background") {
        const { color } = payload;
        if (color) {
          store.setArtboard(undefined, undefined, parseColor(color));
        }
        return;
      }

      if (action === "apply_artboard_preset") {
        const { presetId } = payload;
        const preset = ARTBOARD_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          store.setArtboard(preset.width, preset.height);
        }
        return;
      }

      if (action === "get_object_properties" && requestId) {
        const scene = store.scene;
        const node = scene?.nodes[payload?.objectId];
        if (node) {
          SubmitResponse(requestId, { node });
        } else {
          SubmitResponse(requestId, { error: `Object ${payload?.objectId} not found` });
        }
        return;
      }

      if (action === "clear_canvas") {
        const scene = store.scene;
        if (scene) {
          const childIds = Object.values(scene.nodes)
            .filter((n) => n.id !== scene.root)
            .map((n) => n.id);
          const cmds: SaraswatiCommand[] = childIds.map((id) => ({
            type: "DELETE_NODE",
            id,
          }));
          store.applyCommands(cmds);
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
