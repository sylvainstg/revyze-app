import React, { useState, useEffect } from "react";
import { FurnitureItem, LengthSystem, LengthUnit } from "../types";
import { displayUnitFor, formatLength, fromCm, toCm } from "../utils/scaleConversion";
import { regeneratePlaceholderSvg } from "../data/furnitureLibrary";
import { X, Trash2, ChevronUp, ChevronDown, RotateCw } from "lucide-react";

interface FurnitureInspectorProps {
  item: FurnitureItem;
  lengthSystem: LengthSystem;
  onChange: (next: FurnitureItem) => void;
  onDelete: () => void;
  onClose: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export const FurnitureInspector: React.FC<FurnitureInspectorProps> = ({
  item,
  lengthSystem,
  onChange,
  onDelete,
  onClose,
  onBringToFront,
  onSendToBack,
}) => {
  const displayUnit: LengthUnit = displayUnitFor(lengthSystem);
  const [widthInput, setWidthInput] = useState(
    fromCm(item.widthCm, displayUnit).toFixed(1),
  );
  const [heightInput, setHeightInput] = useState(
    fromCm(item.heightCm, displayUnit).toFixed(1),
  );
  const [labelInput, setLabelInput] = useState(item.label || "");
  const [noteInput, setNoteInput] = useState(item.note || "");

  // Keep inputs in sync if the item changes externally (e.g. after drag).
  useEffect(() => {
    setWidthInput(fromCm(item.widthCm, displayUnit).toFixed(1));
    setHeightInput(fromCm(item.heightCm, displayUnit).toFixed(1));
    setLabelInput(item.label || "");
    setNoteInput(item.note || "");
  }, [item.id, item.widthCm, item.heightCm, item.label, item.note, displayUnit]);

  const commitDimensions = () => {
    const w = parseFloat(widthInput);
    const h = parseFloat(heightInput);
    if (!w || w <= 0 || !h || h <= 0) return;
    onChange({
      ...item,
      widthCm: toCm(w, displayUnit),
      heightCm: toCm(h, displayUnit),
      updatedAt: Date.now(),
    });
  };

  const commitLabel = () => {
    const updates: Partial<FurnitureItem> = {
      label: labelInput,
      updatedAt: Date.now(),
    };
    // Regenerate SVG placeholder when label changes for library items
    if (
      item.source === "library" &&
      item.imageUrl.startsWith("data:image/svg")
    ) {
      updates.imageUrl = regeneratePlaceholderSvg(
        item.widthCm,
        item.heightCm,
        labelInput,
        undefined,
        item.libraryItemId,
      );
    }
    onChange({ ...item, ...updates });
  };

  const commitNote = () => {
    onChange({ ...item, note: noteInput, updatedAt: Date.now() });
  };

  const handleRotation = (deg: number) => {
    onChange({ ...item, rotation: deg, updatedAt: Date.now() });
  };

  const snapRotation = () => {
    // Snap to nearest 45°
    const snapped = Math.round(item.rotation / 45) * 45;
    handleRotation(((snapped % 360) + 360) % 360);
  };

  return (
    <div className="absolute top-4 left-4 w-64 bg-white rounded-lg shadow-2xl border border-slate-200 z-30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
          Furniture
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Label */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Label
          </label>
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Sofa"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Note
          </label>
          <textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onBlur={commitNote}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            rows={2}
            className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Add a note (visible on hover)"
          />
        </div>

        {/* Size readout & inputs */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Size ({displayUnit})
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0.01"
              step="0.1"
              value={widthInput}
              onChange={(e) => setWidthInput(e.target.value)}
              onBlur={commitDimensions}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400 text-xs">×</span>
            <input
              type="number"
              min="0.01"
              step="0.1"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              onBlur={commitDimensions}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {formatLength(item.widthCm, lengthSystem)} ×{" "}
            {formatLength(item.heightCm, lengthSystem)}
          </div>
        </div>

        {/* Rotation */}
        <div>
          <label className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            <span>Rotation ({Math.round(item.rotation)}°)</span>
            <button
              onClick={snapRotation}
              className="flex items-center gap-1 normal-case font-medium text-indigo-600 hover:text-indigo-800"
              title="Snap to nearest 45°"
            >
              <RotateCw className="w-3 h-3" /> snap
            </button>
          </label>
          <input
            type="range"
            min="0"
            max="360"
            value={item.rotation}
            onChange={(e) => handleRotation(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Z-order + Delete */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={onSendToBack}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
            title="Send to back"
          >
            <ChevronDown className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={onBringToFront}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
            title="Bring to front"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Front
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded ml-auto"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
