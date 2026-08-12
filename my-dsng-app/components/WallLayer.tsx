import React, { useState, useRef, useEffect } from "react";
import { WallItem, MaskItem, ElementItem, ProjectScale, User } from "../types";
import { cmToPagePercent, pagePercentToCm } from "../utils/scaleConversion";
import { Trash2, FlipHorizontal2, FlipVertical2 } from "lucide-react";

export type WallTool = "select" | "wall" | "mask" | "door";
export type WallSelection = { id: string; kind: "wall" | "mask" | "door" } | null;

interface WallLayerProps {
  pdfWrapperRef: React.RefObject<HTMLDivElement | null>;
  pdfScale: number;
  scale: ProjectScale | undefined;
  pageNumber: number;
  wallItems: WallItem[];
  maskItems: MaskItem[];
  elementItems: ElementItem[];
  visible: boolean;
  tool: WallTool;
  active: boolean; // true when the wall-change mode is active at all (intercept clicks)
  selection: WallSelection;
  onSelect: (selection: WallSelection) => void;
  onUpdateWalls: (items: WallItem[]) => void;
  onUpdateMasks: (items: MaskItem[]) => void;
  onUpdateElements: (items: ElementItem[]) => void;
  canEdit: boolean;
  currentUser: User | undefined;
}

const DEFAULT_THICKNESS_CM = 10;
const DEFAULT_DOOR_WIDTH_CM = 90;
const MIN_DOOR_WIDTH_CM = 20;

type ItemDragKind =
  | "move-wall"
  | "endpoint-a"
  | "endpoint-b"
  | "move-mask"
  | "resize-mask"
  | "rotate-mask"
  | "move-door"
  | "resize-door-a"
  | "resize-door-b"
  | "rotate-door";

interface ItemDragState {
  kind: ItemDragKind;
  id: string;
  startMouse: { x: number; y: number };
  startWall?: WallItem;
  startMask?: MaskItem;
  startElement?: ElementItem;
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
  elementItems,
  visible,
  tool,
  active,
  selection,
  onSelect,
  onUpdateWalls,
  onUpdateMasks,
  onUpdateElements,
  canEdit,
  currentUser,
}) => {
  const [draftWall, setDraftWall] = useState<WallItem | null>(null);
  const [draftMask, setDraftMask] = useState<MaskItem | null>(null);
  const [draftElement, setDraftElement] = useState<ElementItem | null>(null);
  const dragRef = useRef<ItemDragState | null>(null);
  const draftWallRef = useRef<WallItem | null>(null);
  const draftMaskRef = useRef<MaskItem | null>(null);
  const draftElementRef = useRef<ElementItem | null>(null);

  // Pending first point while drawing a new wall (2-click placement).
  const [newWallStart, setNewWallStart] = useState<CmPoint | null>(null);
  // In-flight rectangle while dragging out a new mask.
  const [newMaskRect, setNewMaskRect] = useState<{ start: CmPoint; current: CmPoint } | null>(null);
  const newMaskRectRef = useRef<{ start: CmPoint; current: CmPoint } | null>(null);

  const cmPerPxNow = scale ? scale.cmPerPx / pdfScale : 0;
  const pxPerCmNow = cmPerPxNow > 0 ? 1 / cmPerPxNow : 1;

  const pageWalls = wallItems
    .filter((w) => w.pageNumber === pageNumber && !w.deleted)
    .map((w) => (draftWall && draftWall.id === w.id ? draftWall : w))
    .sort((a, b) => a.zIndex - b.zIndex);

  const pageMasks = maskItems
    .filter((m) => m.pageNumber === pageNumber && !m.deleted)
    .map((m) => (draftMask && draftMask.id === m.id ? draftMask : m))
    .sort((a, b) => a.zIndex - b.zIndex);

  const pageElements = elementItems
    .filter((el) => el.pageNumber === pageNumber && !el.deleted)
    .map((el) => (draftElement && draftElement.id === el.id ? draftElement : el))
    .sort((a, b) => a.zIndex - b.zIndex);

  const nextZIndex = () => {
    const maxWall = wallItems.reduce((m, w) => (w.deleted ? m : Math.max(m, w.zIndex)), 0);
    const maxMask = maskItems.reduce((m, mk) => (mk.deleted ? m : Math.max(m, mk.zIndex)), 0);
    const maxElement = elementItems.reduce((m, el) => (el.deleted ? m : Math.max(m, el.zIndex)), 0);
    return Math.max(maxWall, maxMask, maxElement) + 1;
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

  // Editing drag for an existing wall, mask, or door. Re-bound every render
  // so closures see latest state, mirroring FurnitureLayer.
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
      } else if (drag.kind === "move-door" && drag.startElement) {
        const el = drag.startElement;
        setDraftElement({ ...el, xCm: el.xCm + dxCm, yCm: el.yCm + dyCm });
      } else if (drag.kind === "resize-door-a" && drag.startElement) {
        const el = drag.startElement;
        const angleRad = (el.rotation * Math.PI) / 180;
        const dirX = Math.cos(angleRad);
        const dirY = Math.sin(angleRad);
        const proj = dxCm * dirX + dyCm * dirY;
        const newWidth = Math.max(MIN_DOOR_WIDTH_CM, el.widthCm - proj);
        const widthDelta = newWidth - el.widthCm;
        setDraftElement({
          ...el,
          widthCm: newWidth,
          xCm: el.xCm - (widthDelta / 2) * dirX,
          yCm: el.yCm - (widthDelta / 2) * dirY,
        });
      } else if (drag.kind === "resize-door-b" && drag.startElement) {
        const el = drag.startElement;
        const angleRad = (el.rotation * Math.PI) / 180;
        const dirX = Math.cos(angleRad);
        const dirY = Math.sin(angleRad);
        const proj = dxCm * dirX + dyCm * dirY;
        const newWidth = Math.max(MIN_DOOR_WIDTH_CM, el.widthCm + proj);
        const widthDelta = newWidth - el.widthCm;
        setDraftElement({
          ...el,
          widthCm: newWidth,
          xCm: el.xCm + (widthDelta / 2) * dirX,
          yCm: el.yCm + (widthDelta / 2) * dirY,
        });
      } else if (drag.kind === "rotate-door" && drag.startElement) {
        const wrapper = pdfWrapperRef.current;
        if (!wrapper) return;
        const el = drag.startElement;
        const rect = wrapper.getBoundingClientRect();
        const centerXPct = cmToPagePercent(el.xCm, "x", scale);
        const centerYPct = cmToPagePercent(el.yCm, "y", scale);
        const centerClientX = rect.left + (centerXPct / 100) * rect.width;
        const centerClientY = rect.top + (centerYPct / 100) * rect.height;
        const angle =
          (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) / Math.PI + 90;
        const normalized = ((angle % 360) + 360) % 360;
        setDraftElement({ ...el, rotation: normalized });
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
        } else if (drag.startElement) {
          const finalElement = draftElementRef.current;
          if (finalElement) {
            onUpdateElements(
              elementItems.map((el) =>
                el.id === finalElement.id ? { ...finalElement, updatedAt: Date.now() } : el,
              ),
            );
          }
        }
      }
      setDraftWall(null);
      setDraftMask(null);
      setDraftElement(null);
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
  useEffect(() => {
    draftElementRef.current = draftElement;
  }, [draftElement]);

  // Drag-out creation of a new mask rectangle.
  useEffect(() => {
    if (!newMaskRectRef.current) return;
    const onMove = (e: MouseEvent) => {
      const p = cmPointFromEvent(e);
      const rectState = newMaskRectRef.current;
      if (!p || !rectState) return;
      const updated = { start: rectState.start, current: p };
      newMaskRectRef.current = updated;
      setNewMaskRect(updated);
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

  // Delete key removes the current selection (wall, mask, or door).
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
        } else if (selection.kind === "mask") {
          onUpdateMasks(
            maskItems.map((m) => (m.id === selection.id ? { ...m, deleted: true, updatedAt: Date.now() } : m)),
          );
        } else {
          onUpdateElements(
            elementItems.map((el) =>
              el.id === selection.id ? { ...el, deleted: true, updatedAt: Date.now() } : el,
            ),
          );
        }
        onSelect(null);
      } else if (e.key === "Escape") {
        setNewWallStart(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    active,
    selection,
    canEdit,
    wallItems,
    maskItems,
    elementItems,
    onUpdateWalls,
    onUpdateMasks,
    onUpdateElements,
    onSelect,
  ]);

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

  const handleItemMouseDown = (
    e: React.MouseEvent,
    kind: ItemDragKind,
    wall?: WallItem,
    mask?: MaskItem,
    element?: ElementItem,
  ) => {
    if (!canEdit || tool !== "select") return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(
      wall
        ? { id: wall.id, kind: "wall" }
        : mask
          ? { id: mask.id, kind: "mask" }
          : { id: element!.id, kind: "door" },
    );
    dragRef.current = {
      kind,
      id: wall ? wall.id : mask ? mask.id : element!.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startWall: wall,
      startMask: mask,
      startElement: element,
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
      return;
    }
    if (tool === "door" && canEdit && currentUser) {
      const p = cmPointFromEvent(e);
      if (!p) return;
      const item: ElementItem = {
        id: `door_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        pageNumber,
        kind: "door",
        xCm: p.xCm,
        yCm: p.yCm,
        widthCm: DEFAULT_DOOR_WIDTH_CM,
        thicknessCm: DEFAULT_THICKNESS_CM,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: nextZIndex(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onUpdateElements([...elementItems, item]);
      onSelect({ id: item.id, kind: "door" });
    }
  };

  const handleLayerMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    // Stop the pan handler on the ancestor viewport from also engaging —
    // this layer owns pointer interaction over the plan while active.
    e.stopPropagation();
    if (tool !== "mask" || !canEdit) return;
    const p = cmPointFromEvent(e);
    if (!p) return;
    newMaskRectRef.current = { start: p, current: p };
    setNewMaskRect({ start: p, current: p });
  };

  const toggleDoorFlip = (element: ElementItem, axis: "x" | "y") => {
    const next =
      axis === "x"
        ? { ...element, flipX: !element.flipX, updatedAt: Date.now() }
        : { ...element, flipY: !element.flipY, updatedAt: Date.now() };
    onUpdateElements(elementItems.map((el) => (el.id === element.id ? next : el)));
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 3,
        pointerEvents: active ? "auto" : "none",
        cursor: tool === "wall" || tool === "mask" || tool === "door" ? "crosshair" : "default",
      }}
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

      {/* Doors render above walls */}
      {pageElements.map((el) => {
        const widthPct = cmToPagePercent(el.widthCm, "x", scale);
        const heightPct = cmToPagePercent(el.thicknessCm, "y", scale);
        const leftPct = cmToPagePercent(el.xCm, "x", scale) - widthPct / 2;
        const topPct = cmToPagePercent(el.yCm, "y", scale) - heightPct / 2;
        const isSelected = selection?.kind === "door" && selection.id === el.id;

        // Swing symbol geometry, computed in on-screen px so the leaf length
        // and arc radius stay true circles/lines regardless of the door's
        // (possibly tiny) thickness — see canonical (flipX=false, flipY=false)
        // derivation: hinge at the local top-left corner, swing extends
        // "outward" (negative local y). flipX/flipY are applied as a single
        // CSS mirror on this group, which is simpler and less error-prone
        // than re-deriving per-corner coordinates for all four cases.
        const leafLenPx = Math.max(4, el.widthCm * pxPerCmNow);
        const thicknessPx = Math.max(1, el.thicknessCm * pxPerCmNow);

        const aXPct = cmToPagePercent(el.xCm - el.widthCm / 2, "x", scale);
        const aYPct = cmToPagePercent(el.yCm, "y", scale);
        const bXPct = cmToPagePercent(el.xCm + el.widthCm / 2, "x", scale);
        const bYPct = cmToPagePercent(el.yCm, "y", scale);

        return (
          <React.Fragment key={el.id}>
            <div
              className={`absolute bg-white ${isSelected ? "ring-2 ring-indigo-500" : "border border-dashed border-indigo-300"}`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                minHeight: 2,
                transform: `rotate(${el.rotation}deg)`,
                transformOrigin: "center center",
                cursor: canEdit && tool === "select" ? "move" : "default",
                zIndex: 3,
                overflow: "visible",
              }}
              onMouseDown={(e) => handleItemMouseDown(e, "move-door", undefined, undefined, el)}
              onClick={(e) => {
                if (tool !== "select") return;
                e.stopPropagation();
                onSelect({ id: el.id, kind: "door" });
              }}
            >
              {/* Swing group: leaf + arc, canonical orientation is hinge at
                  local top-left, swinging above the wall (negative y). */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  top: el.flipY ? thicknessPx : -leafLenPx,
                  width: leafLenPx,
                  height: leafLenPx,
                  transform: `scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`,
                  transformOrigin: "center center",
                }}
              >
                <div
                  className="absolute bg-indigo-500"
                  style={{ left: 0, bottom: 0, width: 2, height: "100%" }}
                />
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: "absolute", left: 0, top: 0 }}
                >
                  <path
                    d="M 0 0 A 100 100 0 0 1 100 100"
                    fill="none"
                    stroke="rgb(99 102 241)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>

              {el.label && (
                <div
                  className="absolute left-1/2 pointer-events-none select-none"
                  style={{
                    bottom: "-1.25rem",
                    transform: `translateX(-50%) rotate(${-el.rotation}deg)`,
                    transformOrigin: "center center",
                  }}
                >
                  <span className="bg-indigo-500/75 text-white text-[10px] leading-tight px-1.5 py-0.5 rounded whitespace-nowrap">
                    {el.label}
                  </span>
                </div>
              )}
            </div>

            {isSelected && canEdit && tool === "select" && (
              <>
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-grab shadow-md hover:scale-110 transition-transform"
                  style={{
                    left: `${cmToPagePercent(el.xCm, "x", scale)}%`,
                    top: `${cmToPagePercent(el.yCm - el.thicknessCm / 2, "y", scale)}%`,
                    marginTop: -22,
                    zIndex: 4,
                  }}
                  onMouseDown={(e) => handleItemMouseDown(e, "rotate-door", undefined, undefined, el)}
                  title="Rotate"
                />
                <div
                  className="absolute w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full cursor-ew-resize shadow-md hover:scale-110 transition-transform"
                  style={{ left: `${aXPct}%`, top: `${aYPct}%`, transform: "translate(-50%, -50%)", zIndex: 4 }}
                  onMouseDown={(e) => handleItemMouseDown(e, "resize-door-a", undefined, undefined, el)}
                  title="Resize width"
                />
                <div
                  className="absolute w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full cursor-ew-resize shadow-md hover:scale-110 transition-transform"
                  style={{ left: `${bXPct}%`, top: `${bYPct}%`, transform: "translate(-50%, -50%)", zIndex: 4 }}
                  onMouseDown={(e) => handleItemMouseDown(e, "resize-door-b", undefined, undefined, el)}
                  title="Resize width"
                />
                <div
                  className="absolute flex gap-1"
                  style={{
                    left: `${(aXPct + bXPct) / 2}%`,
                    top: `${(aYPct + bYPct) / 2}%`,
                    transform: "translate(-50%, calc(-100% - 34px))",
                    zIndex: 4,
                  }}
                >
                  <button
                    className="w-7 h-7 bg-white border border-slate-200 shadow-xl rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDoorFlip(el, "x");
                    }}
                    title="Flip horizontal"
                  >
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="w-7 h-7 bg-white border border-slate-200 shadow-xl rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDoorFlip(el, "y");
                    }}
                    title="Flip vertical"
                  >
                    <FlipVertical2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="w-7 h-7 bg-white border border-slate-200 shadow-xl rounded-full flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateElements(
                        elementItems.map((item) =>
                          item.id === el.id ? { ...item, deleted: true, updatedAt: Date.now() } : item,
                        ),
                      );
                      onSelect(null);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
