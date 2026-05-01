import React, { useState, useRef, useEffect } from "react";
import { FurnitureItem, ProjectScale } from "../types";
import { cmToPagePercent } from "../utils/scaleConversion";
import { Trash2 } from "lucide-react";

interface FurnitureLayerProps {
  pdfWrapperRef: React.RefObject<HTMLDivElement | null>;
  pdfScale: number; // current PDF zoom (Page scale prop)
  scale: ProjectScale | undefined; // calibrated project scale
  pageNumber: number;
  items: FurnitureItem[]; // all items across pages — filtered here
  visible: boolean;
  active: boolean; // true when furniture-edit mode is active (intercept clicks)
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (items: FurnitureItem[]) => void;
  canEdit: boolean;
}

type DragKind = "move" | "resize" | "rotate";

interface DragState {
  kind: DragKind;
  itemId: string;
  startMouse: { x: number; y: number }; // client coords
  startItem: FurnitureItem; // immutable snapshot at drag start
}

export const FurnitureLayer: React.FC<FurnitureLayerProps> = ({
  pdfWrapperRef,
  pdfScale,
  scale,
  pageNumber,
  items,
  visible,
  active,
  selectedId,
  onSelect,
  onUpdate,
  canEdit,
}) => {
  const [draft, setDraft] = useState<FurnitureItem | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // cm <-> pixel at the current render. pdfScale=1 means cmPerPx is native.
  const cmPerPxNow = scale ? scale.cmPerPx / pdfScale : 0;

  // Page-filtered items, with draft overlay for the in-flight item.
  const pageItems = items
    .filter((it) => it.pageNumber === pageNumber && !it.deleted)
    .map((it) => (draft && draft.id === it.id ? draft : it))
    .sort((a, b) => a.zIndex - b.zIndex);

  useEffect(() => {
    if (!dragRef.current) return;
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !scale) return;
      const dxPx = e.clientX - drag.startMouse.x;
      const dyPx = e.clientY - drag.startMouse.y;
      const dxCm = dxPx * cmPerPxNow;
      const dyCm = dyPx * cmPerPxNow;
      const it = drag.startItem;

      if (drag.kind === "move") {
        setDraft({ ...it, xCm: it.xCm + dxCm, yCm: it.yCm + dyCm });
      } else if (drag.kind === "resize") {
        // Drag bottom-right corner: top-left stays put → center shifts by half delta.
        const newW = Math.max(5, it.widthCm + dxCm);
        const newH = Math.max(5, it.heightCm + dyCm);
        setDraft({
          ...it,
          widthCm: newW,
          heightCm: newH,
          xCm: it.xCm + (newW - it.widthCm) / 2,
          yCm: it.yCm + (newH - it.heightCm) / 2,
        });
      } else if (drag.kind === "rotate") {
        // Compute angle from item center to current mouse.
        const wrapper = pdfWrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const centerXPct = cmToPagePercent(it.xCm, "x", scale);
        const centerYPct = cmToPagePercent(it.yCm, "y", scale);
        const centerClientX = rect.left + (centerXPct / 100) * rect.width;
        const centerClientY = rect.top + (centerYPct / 100) * rect.height;
        const angle =
          (Math.atan2(
            e.clientY - centerClientY,
            e.clientX - centerClientX,
          ) *
            180) /
            Math.PI +
          90; // +90 because the rotate handle is above (north)
        const normalized = ((angle % 360) + 360) % 360;
        setDraft({ ...it, rotation: normalized });
      }
    };
    const onUp = () => {
      const drag = dragRef.current;
      const finalDraft = draftRef.current;
      dragRef.current = null;
      if (drag && finalDraft) {
        // Commit to parent: replace the item, bump updatedAt.
        const next = items.map((it) =>
          it.id === finalDraft.id
            ? { ...finalDraft, updatedAt: Date.now() }
            : it,
        );
        onUpdate(next);
      }
      setDraft(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // We deliberately re-bind every render so closures see latest state.
  });

  // Mirror draft into a ref so the global mouseup handler reads fresh value.
  const draftRef = useRef<FurnitureItem | null>(null);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Delete key removes the selected item.
  useEffect(() => {
    if (!active || !selectedId || !canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = items.find((it) => it.id === selectedId);
        if (!target) return;
        // Soft-delete to mirror Comment behavior.
        const next = items.map((it) =>
          it.id === selectedId
            ? { ...it, deleted: true, updatedAt: Date.now() }
            : it,
        );
        onUpdate(next);
        onSelect(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, selectedId, canEdit, items, onUpdate, onSelect]);

  if (!visible || !scale) return null;

  const handleItemMouseDown = (
    e: React.MouseEvent,
    item: FurnitureItem,
    kind: DragKind,
  ) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    dragRef.current = {
      kind,
      itemId: item.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startItem: item,
    };
  };

  // Click on empty layer area deselects (only when active).
  const handleLayerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onSelect(null);
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 5,
        pointerEvents: active ? "auto" : "none",
      }}
      onClick={handleLayerClick}
    >
      {pageItems.map((item) => {
        const leftPct = cmToPagePercent(
          item.xCm - item.widthCm / 2,
          "x",
          scale,
        );
        const topPct = cmToPagePercent(
          item.yCm - item.heightCm / 2,
          "y",
          scale,
        );
        const widthPct = cmToPagePercent(item.widthCm, "x", scale);
        const heightPct = cmToPagePercent(item.heightCm, "y", scale);
        const isSelected = selectedId === item.id;

        return (
          <div
            key={item.id}
            className={`absolute group ${isSelected ? "ring-2 ring-indigo-500" : ""}`}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              transform: `rotate(${item.rotation}deg)`,
              transformOrigin: "center center",
              cursor: canEdit ? "move" : "default",
              zIndex: isSelected ? 10 : 1,
            }}
            onMouseDown={(e) => handleItemMouseDown(e, item, "move")}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
          >
            <img
              src={item.imageUrl}
              alt={item.label || ""}
              className="w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />

            {/* Always-horizontal label */}
            {item.label && (
              <div
                className="absolute left-1/2 pointer-events-none select-none"
                style={{
                  bottom: "-1.25rem",
                  transform: `translateX(-50%) rotate(${-item.rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <span className="bg-slate-800/75 text-white text-[10px] leading-tight px-1.5 py-0.5 rounded whitespace-nowrap">
                  {item.label}
                </span>
              </div>
            )}

            {/* Note tooltip on hover */}
            {hoveredId === item.id && item.note && !isSelected && (
              <div
                className="absolute left-1/2 pointer-events-none z-50"
                style={{
                  bottom: item.label ? "calc(100% + 0.5rem)" : "calc(100% + 0.25rem)",
                  transform: `translateX(-50%) rotate(${-item.rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <div className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg max-w-[200px] whitespace-pre-wrap">
                  {item.note}
                </div>
              </div>
            )}

            {isSelected && canEdit && (
              <>
                {/* Rotate handle (above top-center) */}
                <div
                  className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-grab shadow-md hover:scale-110 transition-transform"
                  onMouseDown={(e) => handleItemMouseDown(e, item, "rotate")}
                  title="Rotate"
                />
                {/* Connector line for rotate handle */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-indigo-500 pointer-events-none" />
                {/* Resize handle (bottom-right) */}
                <div
                  className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border-2 border-indigo-500 rounded cursor-nwse-resize shadow-md hover:scale-110 transition-transform flex items-center justify-center"
                  onMouseDown={(e) => handleItemMouseDown(e, item, "resize")}
                  title="Resize"
                >
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                </div>
                {/* Quick delete button (top-right) */}
                <button
                  className="absolute -top-3 -right-3 w-7 h-7 bg-white border border-slate-200 shadow-xl rounded-full flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = items.map((it) =>
                      it.id === item.id
                        ? { ...it, deleted: true, updatedAt: Date.now() }
                        : it,
                    );
                    onUpdate(next);
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
    </div>
  );
};
