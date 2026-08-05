import React, { useState, useRef, useEffect } from "react";
import { WallItem, MaskItem, ProjectScale, User } from "../types";
import { cmToPagePercent, pagePercentToCm } from "../utils/scaleConversion";
import { Trash2 } from "lucide-react";

export type WallTool = "select" | "wall" | "mask";
export type WallSelection = { id: string; kind: "wall" | "mask" } | null;

interface WallLayerProps {
  pdfWrapperRef: React.RefObject<HTMLDivElement | null>;
  pdfScale: number;
  scale: ProjectScale | undefined;
  pageNumber: number;
  wallItems: WallItem[];
  maskItems: MaskItem[];
  visible: boolean;
  tool: WallTool;
  active: boolean; // true when the wall-change mode is active at all (intercept clicks)
  selection: WallSelection;
  onSelect: (selection: WallSelection) => void;
  onUpdateWalls: (items: WallItem[]) => void;
  onUpdateMasks: (items: MaskItem[]) => void;
  canEdit: boolean;
  currentUser: User | undefined;
}

const DEFAULT_THICKNESS_CM = 10;

type ItemDragKind =
  | "move-wall"
  | "endpoint-a"
  | "endpoint-b"
  | "move-mask"
  | "resize-mask"
  | "rotate-mask";

interface ItemDragState {
  kind: ItemDragKind;
  id: string;
  startMouse: { x: number; y: number };
  startWall?: WallItem;
  startMask?: MaskItem;
}

interface CmPoint {
  xCm: number;
  yCm: number;
}

export const WallLayer: React.FC<WallLayerProps> = ({
  pdfWrapperRef,
  pdfScale,
  scale,
  pageNumber,
  wallItems,
  maskItems,
  visible,
  tool,
  active,
  selection,
  onSelect,
  onUpdateWalls,
  onUpdateMasks,
  canEdit,
  currentUser,
}) => {
  const [draftWall, setDraftWall] = useState<WallItem | null>(null);
  const [draftMask, setDraftMask] = useState<MaskItem | null>(null);
  const dragRef = useRef<ItemDragState | null>(null);
  const draftWallRef = useRef<WallItem | null>(null);
  const draftMaskRef = useRef<MaskItem | null>(null);

  // Pending first point while drawing a new wall (2-click placement).
  const [newWallStart, setNewWallStart] = useState<CmPoint | null>(null);
  // In-flight rectangle while dragging out a new mask.
  const [newMaskRect, setNewMaskRect] = useState<{ start: CmPoint; current: CmPoint } | null>(null);
  const newMaskRectRef = useRef<{ start: CmPoint; current: CmPoint } | null>(null);

  const cmPerPxNow = scale ? scale.cmPerPx / pdfScale : 0;

  const pageWalls = wallItems
    .filter((w) => w.pageNumber === pageNumber && !w.deleted)
    .map((w) => (draftWall && draftWall.id === w.id ? draftWall : w))
    .sort((a, b) => a.zIndex - b.zIndex);

  const pageMasks = maskItems
    .filter((m) => m.pageNumber === pageNumber && !m.deleted)
    .map((m) => (draftMask && draftMask.id === m.id ? draftMask : m))
    .sort((a, b) => a.zIndex - b.zIndex);

  const nextZIndex = () => {
    const maxWall = wallItems.reduce((m, w) => (w.deleted ? m : Math.max(m, w.zIndex)), 0);
    const maxMask = maskItems.reduce((m, mk) => (mk.deleted ? m : Math.max(m, mk.zIndex)), 0);
    return Math.max(maxWall, maxMask) + 1;
  };

  const cmPointFromEvent = (e: React.MouseEvent | MouseEvent): CmPoint | null => {
    if (!pdfWrapperRef.current || !scale) return null;
    const rect = pdfWrapperRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      xCm: pagePercentToCm(xPct, "x", scale),
      yCm: pagePercentToCm(yPct, "y", scale),
    };
  };

  // Editing drag for an existing wall or mask. Re-bound every render so
  // closures see latest state, mirroring FurnitureLayer.
  useEffect(() => {
    if (!dragRef.current) return;
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !scale) return;
      const dxPx = e.clientX - drag.startMouse.x;
      const dyPx = e.clientY - drag.startMouse.y;
      const dxCm = dxPx * cmPerPxNow;
      const dyCm = dyPx * cmPerPxNow;

      if (drag.kind === "move-wall" && drag.startWall) {
        const w = drag.startWall;
        setDraftWall({
          ...w,
          x1Cm: w.x1Cm + dxCm,
          y1Cm: w.y1Cm + dyCm,
          x2Cm: w.x2Cm + dxCm,
          y2Cm: w.y2Cm + dyCm,
        });
      } else if (drag.kind === "endpoint-a" && drag.startWall) {
        const w = drag.startWall;
        setDraftWall({ ...w, x1Cm: w.x1Cm + dxCm, y1Cm: w.y1Cm + dyCm });
      } else if (drag.kind === "endpoint-b" && drag.startWall) {
        const w = drag.startWall;
        setDraftWall({ ...w, x2Cm: w.x2Cm + dxCm, y2Cm: w.y2Cm + dyCm });
      } else if (drag.kind === "move-mask" && drag.startMask) {
        const m = drag.startMask;
        setDraftMask({ ...m, xCm: m.xCm + dxCm, yCm: m.yCm + dyCm });
      } else if (drag.kind === "resize-mask" && drag.startMask) {
        const m = drag.startMask;
        const newW = Math.max(5, m.widthCm + dxCm);
        const newH = Math.max(5, m.heightCm + dyCm);
        setDraftMask({
          ...m,
          widthCm: newW,
          heightCm: newH,
          xCm: m.xCm + (newW - m.widthCm) / 2,
          yCm: m.yCm + (newH - m.heightCm) / 2,
        });
      } else if (drag.kind === "rotate-mask" && drag.startMask) {
        const wrapper = pdfWrapperRef.current;
        if (!wrapper) return;
        const m = drag.startMask;
        const rect = wrapper.getBoundingClientRect();
        const centerXPct = cmToPagePercent(m.xCm, "x", scale);
        const centerYPct = cmToPagePercent(m.yCm, "y", scale);
        const centerClientX = rect.left + (centerXPct / 100) * rect.width;
        const centerClientY = rect.top + (centerYPct / 100) * rect.height;
        const angle =
          (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) / Math.PI + 90;
        const normalized = ((angle % 360) + 360) % 360;
        setDraftMask({ ...m, rotation: normalized });
      }
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        if (drag.startWall) {
          const finalWall = draftWallRef.current;
          if (finalWall) {
            onUpdateWalls(
              wallItems.map((w) => (w.id === finalWall.id ? { ...finalWall, updatedAt: Date.now() } : w)),
            );
          }
        } else if (drag.startMask) {
          const finalMask = draftMaskRef.current;
          if (finalMask) {
            onUpdateMasks(
              maskItems.map((m) => (m.id === finalMask.id ? { ...finalMask, updatedAt: Date.now() } : m)),
            );
          }
        }
      }
      setDraftWall(null);
      setDraftMask(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  useEffect(() => {
    draftWallRef.current = draftWall;
  }, [draftWall]);
  useEffect(() => {
    draftMaskRef.current = draftMask;
  }, [draftMask]);

  // Drag-out creation of a new mask rectangle.
  useEffect(() => {
    if (!newMaskRectRef.current) return;
    const onMove = (e: MouseEvent) => {
      const p = cmPointFromEvent(e);
      const rectState = newMaskRectRef.current;
      if (!p || !rectState) return;
      setNewMaskRect({ start: rectState.start, current: p });
    };
    const onUp = () => {
      const rectState = newMaskRectRef.current;
      newMaskRectRef.current = null;
      setNewMaskRect(null);
      if (!rectState || !currentUser) return;
      const { start, current } = rectState;
      const widthCm = Math.abs(current.xCm - start.xCm);
      const heightCm = Math.abs(current.yCm - start.yCm);
      if (widthCm < 2 || heightCm < 2) return; // ignore accidental micro-drags
      const item: MaskItem = {
        id: `mask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        pageNumber,
        xCm: (start.xCm + current.xCm) / 2,
        yCm: (start.yCm + current.yCm) / 2,
        widthCm,
        heightCm,
        rotation: 0,
        zIndex: nextZIndex(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onUpdateMasks([...maskItems, item]);
      onSelect({ id: item.id, kind: "mask" });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  // Delete key removes the current selection (wall or mask).
  useEffect(() => {
    if (!active || !selection || !canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (selection.kind === "wall") {
          onUpdateWalls(
            wallItems.map((w) => (w.id === selection.id ? { ...w, deleted: true, updatedAt: Date.now() } : w)),
          );
        } else {
          onUpdateMasks(
            maskItems.map((m) => (m.id === selection.id ? { ...m, deleted: true, updatedAt: Date.now() } : m)),
          );
        }
        onSelect(null);
      } else if (e.key === "Escape") {
        setNewWallStart(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, selection, canEdit, wallItems, maskItems, onUpdateWalls, onUpdateMasks, onSelect]);

  // Escape also cancels an in-progress wall placement even without a selection.
  useEffect(() => {
    if (tool !== "wall" || !newWallStart) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNewWallStart(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, newWallStart]);

  if (!visible || !scale) return null;

  const handleItemMouseDown = (e: React.MouseEvent, kind: ItemDragKind, wall?: WallItem, mask?: MaskItem) => {
    if (!canEdit || tool !== "select") return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(wall ? { id: wall.id, kind: "wall" } : { id: mask!.id, kind: "mask" });
    dragRef.current = {
      kind,
      id: wall ? wall.id : mask!.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startWall: wall,
      startMask: mask,
    };
  };

  const handleLayerClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (tool === "select") {
      onSelect(null);
      return;
    }
    if (tool === "wall" && canEdit && currentUser) {
      const p = cmPointFromEvent(e);
      if (!p) return;
      if (!newWallStart) {
        setNewWallStart(p);
      } else {
        const item: WallItem = {
          id: `wall_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          pageNumber,
          x1Cm: newWallStart.xCm,
          y1Cm: newWallStart.yCm,
          x2Cm: p.xCm,
          y2Cm: p.yCm,
          thicknessCm: DEFAULT_THICKNESS_CM,
          zIndex: nextZIndex(),
          createdBy: currentUser.id,
          createdByName: currentUser.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        onUpdateWalls([...wallItems, item]);
        onSelect({ id: item.id, kind: "wall" });
        setNewWallStart(null);
      }
    }
  };

  const handleLayerMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (tool !== "mask" || !canEdit) return;
    const p = cmPointFromEvent(e);
    if (!p) return;
    newMaskRectRef.current = { start: p, current: p };
    setNewMaskRect({ start: p, current: p });
  };

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 3, pointerEvents: active ? "auto" : "none" }}
      onClick={handleLayerClick}
      onMouseDown={handleLayerMouseDown}
    >
      {/* Masks render first (white-out), underneath walls */}
      {pageMasks.map((mask) => {
        const leftPct = cmToPagePercent(mask.xCm - mask.widthCm / 2, "x", scale);
        const topPct = cmToPagePercent(mask.yCm - mask.heightCm / 2, "y", scale);
        const widthPct = cmToPagePercent(mask.widthCm, "x", scale);
        const heightPct = cmToPagePercent(mask.heightCm, "y", scale);
        const isSelected = selection?.kind === "mask" && selection.id === mask.id;

        return (
          <div
            key={mask.id}
            className={`absolute bg-white ${isSelected ? "ring-2 ring-indigo-500" : "border border-dashed border-slate-300"}`}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              transform: `rotate(${mask.rotation}deg)`,
              transformOrigin: "center center",
              cursor: canEdit && tool === "select" ? "move" : "default",
              zIndex: 1,
            }}
            onMouseDown={(e) => handleItemMouseDown(e, "move-mask", undefined, mask)}
            onClick={(e) => {
              if (tool !== "select") return;
              e.stopPropagation();
              onSelect({ id: mask.id, kind: "mask" });
            }}
          >
            {isSelected && canEdit && tool === "select" && (
              <>
                <div
                  className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-grab shadow-md hover:scale-110 transition-transform"
                  onMouseDown={(e) => handleItemMouseDown(e, "rotate-mask", undefined, mask)}
                  title="Rotate"
                />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-indigo-500 pointer-events-none" />
                <div
                  className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border-2 border-indigo-500 rounded cursor-nwse-resize shadow-md hover:scale-110 transition-transform flex items-center justify-center"
                  onMouseDown={(e) => handleItemMouseDown(e, "resize-mask", undefined, mask)}
                  title="Resize"
                >
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                </div>
                <button
                  className="absolute -top-3 -right-3 w-7 h-7 bg-white border border-slate-200 shadow-xl rounded-full flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateMasks(
                      maskItems.map((m) => (m.id === mask.id ? { ...m, deleted: true, updatedAt: Date.now() } : m)),
                    );
                    onSelect(null);
                  }}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        );
      })}

      {/* In-flight mask drag preview */}
      {newMaskRect && scale && (
        <div
          className="absolute bg-white/70 border-2 border-dashed border-indigo-400 pointer-events-none"
          style={{
            left: `${cmToPagePercent(Math.min(newMaskRect.start.xCm, newMaskRect.current.xCm), "x", scale)}%`,
            top: `${cmToPagePercent(Math.min(newMaskRect.start.yCm, newMaskRect.current.yCm), "y", scale)}%`,
            width: `${cmToPagePercent(Math.abs(newMaskRect.current.xCm - newMaskRect.start.xCm), "x", scale)}%`,
            height: `${cmToPagePercent(Math.abs(newMaskRect.current.yCm - newMaskRect.start.yCm), "y", scale)}%`,
            zIndex: 1,
          }}
        />
      )}

      {/* Walls render above masks */}
      {pageWalls.map((wall) => {
        const lengthCm = Math.hypot(wall.x2Cm - wall.x1Cm, wall.y2Cm - wall.y1Cm);
        const angleDeg = (Math.atan2(wall.y2Cm - wall.y1Cm, wall.x2Cm - wall.x1Cm) * 180) / Math.PI;
        const centerXCm = (wall.x1Cm + wall.x2Cm) / 2;
        const centerYCm = (wall.y1Cm + wall.y2Cm) / 2;
        const widthPct = cmToPagePercent(lengthCm, "x", scale);
        const heightPct = cmToPagePercent(wall.thicknessCm, "y", scale);
        const leftPct = cmToPagePercent(centerXCm, "x", scale) - widthPct / 2;
        const topPct = cmToPagePercent(centerYCm, "y", scale) - heightPct / 2;
        const isSelected = selection?.kind === "wall" && selection.id === wall.id;

        const aXPct = cmToPagePercent(wall.x1Cm, "x", scale);
        const aYPct = cmToPagePercent(wall.y1Cm, "y", scale);
        const bXPct = cmToPagePercent(wall.x2Cm, "x", scale);
        const bYPct = cmToPagePercent(wall.y2Cm, "y", scale);

        return (
          <React.Fragment key={wall.id}>
            <div
              className={`absolute bg-slate-800 ${isSelected ? "ring-2 ring-indigo-500" : ""}`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                minHeight: 2,
                transform: `rotate(${angleDeg}deg)`,
                transformOrigin: "center center",
                cursor: canEdit && tool === "select" ? "move" : "default",
                zIndex: 2,
              }}
              onMouseDown={(e) => handleItemMouseDown(e, "move-wall", wall)}
              onClick={(e) => {
                if (tool !== "select") return;
                e.stopPropagation();
                onSelect({ id: wall.id, kind: "wall" });
              }}
            >
              {wall.label && (
                <div
                  className="absolute left-1/2 pointer-events-none select-none"
                  style={{
                    bottom: "-1.25rem",
                    transform: `translateX(-50%) rotate(${-angleDeg}deg)`,
                    transformOrigin: "center center",
                  }}
                >
                  <span className="bg-slate-800/75 text-white text-[10px] leading-tight px-1.5 py-0.5 rounded whitespace-nowrap">
                    {wall.label}
                  </span>
                </div>
              )}
            </div>

            {isSelected && canEdit && tool === "select" && (
              <>
                <div
                  className="absolute w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full cursor-grab shadow-md hover:scale-110 transition-transform"
                  style={{ left: `${aXPct}%`, top: `${aYPct}%`, transform: "translate(-50%, -50%)", zIndex: 4 }}
                  onMouseDown={(e) => handleItemMouseDown(e, "endpoint-a", wall)}
                  title="Drag endpoint"
                />
                <div
                  className="absolute w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full cursor-grab shadow-md hover:scale-110 transition-transform"
                  style={{ left: `${bXPct}%`, top: `${bYPct}%`, transform: "translate(-50%, -50%)", zIndex: 4 }}
                  onMouseDown={(e) => handleItemMouseDown(e, "endpoint-b", wall)}
                  title="Drag endpoint"
                />
                <button
                  className="absolute w-7 h-7 bg-white border border-slate-200 shadow-xl rounded-full flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
                  style={{
                    left: `${(aXPct + bXPct) / 2}%`,
                    top: `${(aYPct + bYPct) / 2}%`,
                    transform: "translate(-50%, calc(-100% - 12px))",
                    zIndex: 4,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateWalls(
                      wallItems.map((w) => (w.id === wall.id ? { ...w, deleted: true, updatedAt: Date.now() } : w)),
                    );
                    onSelect(null);
                  }}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </React.Fragment>
        );
      })}

      {/* Pending first point of a wall being drawn */}
      {newWallStart && scale && (
        <div
          className="absolute w-3 h-3 bg-indigo-500 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
          style={{
            left: `${cmToPagePercent(newWallStart.xCm, "x", scale)}%`,
            top: `${cmToPagePercent(newWallStart.yCm, "y", scale)}%`,
            zIndex: 4,
          }}
        />
      )}
    </div>
  );
};
