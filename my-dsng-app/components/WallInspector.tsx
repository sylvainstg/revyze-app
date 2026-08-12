import React, { useState, useEffect } from "react";
import { WallItem, MaskItem, ElementItem, LengthSystem, LengthUnit } from "../types";
import { displayUnitFor, formatLength, fromCm, toCm } from "../utils/scaleConversion";
import { X, Trash2, FlipHorizontal2, FlipVertical2 } from "lucide-react";

interface WallInspectorProps {
  wall: WallItem;
  lengthSystem: LengthSystem;
  onChange: (next: WallItem) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const WallInspector: React.FC<WallInspectorProps> = ({
  wall,
  lengthSystem,
  onChange,
  onDelete,
  onClose,
}) => {
  const displayUnit: LengthUnit = displayUnitFor(lengthSystem);
  const [thicknessInput, setThicknessInput] = useState(fromCm(wall.thicknessCm, displayUnit).toFixed(1));
  const [labelInput, setLabelInput] = useState(wall.label || "");
  const [noteInput, setNoteInput] = useState(wall.note || "");

  useEffect(() => {
    setThicknessInput(fromCm(wall.thicknessCm, displayUnit).toFixed(1));
    setLabelInput(wall.label || "");
    setNoteInput(wall.note || "");
  }, [wall.id, wall.thicknessCm, wall.label, wall.note, displayUnit]);

  const lengthCm = Math.hypot(wall.x2Cm - wall.x1Cm, wall.y2Cm - wall.y1Cm);

  const commitThickness = () => {
    const t = parseFloat(thicknessInput);
    if (!t || t <= 0) return;
    onChange({ ...wall, thicknessCm: toCm(t, displayUnit), updatedAt: Date.now() });
  };

  const commitLabel = () => {
    onChange({ ...wall, label: labelInput.trim() || undefined, updatedAt: Date.now() });
  };

  const commitNote = () => {
    onChange({ ...wall, note: noteInput.trim() || undefined, updatedAt: Date.now() });
  };

  return (
    <div className="absolute top-4 left-4 w-64 bg-white rounded-lg shadow-2xl z-30 border border-slate-200">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Wall change</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 space-y-3">
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
            placeholder="e.g. New partition"
          />
        </div>

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
            placeholder="Add a note (visible to the GC)"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Thickness ({displayUnit})
          </label>
          <input
            type="number"
            min="0.01"
            step="0.1"
            value={thicknessInput}
            onChange={(e) => setThicknessInput(e.target.value)}
            onBlur={commitThickness}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="text-[10px] text-slate-400 mt-1">Length: {formatLength(lengthCm, lengthSystem)}</div>
        </div>

        <div className="flex items-center justify-end pt-1 border-t border-slate-100">
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
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

interface MaskInspectorProps {
  mask: MaskItem;
  lengthSystem: LengthSystem;
  onChange: (next: MaskItem) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const MaskInspector: React.FC<MaskInspectorProps> = ({
  mask,
  lengthSystem,
  onChange,
  onDelete,
  onClose,
}) => {
  const displayUnit: LengthUnit = displayUnitFor(lengthSystem);
  const [widthInput, setWidthInput] = useState(fromCm(mask.widthCm, displayUnit).toFixed(1));
  const [heightInput, setHeightInput] = useState(fromCm(mask.heightCm, displayUnit).toFixed(1));

  useEffect(() => {
    setWidthInput(fromCm(mask.widthCm, displayUnit).toFixed(1));
    setHeightInput(fromCm(mask.heightCm, displayUnit).toFixed(1));
  }, [mask.id, mask.widthCm, mask.heightCm, displayUnit]);

  const commitDimensions = () => {
    const w = parseFloat(widthInput);
    const h = parseFloat(heightInput);
    if (!w || w <= 0 || !h || h <= 0) return;
    onChange({ ...mask, widthCm: toCm(w, displayUnit), heightCm: toCm(h, displayUnit), updatedAt: Date.now() });
  };

  return (
    <div className="absolute top-4 left-4 w-64 bg-white rounded-lg shadow-2xl z-30 border border-slate-200">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">White-out</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 space-y-3">
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
            {formatLength(mask.widthCm, lengthSystem)} × {formatLength(mask.heightCm, lengthSystem)}
          </div>
        </div>

        <div className="flex items-center justify-end pt-1 border-t border-slate-100">
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
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

interface DoorInspectorProps {
  element: ElementItem;
  lengthSystem: LengthSystem;
  onChange: (next: ElementItem) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const DoorInspector: React.FC<DoorInspectorProps> = ({
  element,
  lengthSystem,
  onChange,
  onDelete,
  onClose,
}) => {
  const displayUnit: LengthUnit = displayUnitFor(lengthSystem);
  const [widthInput, setWidthInput] = useState(fromCm(element.widthCm, displayUnit).toFixed(1));
  const [labelInput, setLabelInput] = useState(element.label || "");
  const [noteInput, setNoteInput] = useState(element.note || "");

  useEffect(() => {
    setWidthInput(fromCm(element.widthCm, displayUnit).toFixed(1));
    setLabelInput(element.label || "");
    setNoteInput(element.note || "");
  }, [element.id, element.widthCm, element.label, element.note, displayUnit]);

  const commitWidth = () => {
    const w = parseFloat(widthInput);
    if (!w || w <= 0) return;
    onChange({ ...element, widthCm: toCm(w, displayUnit), updatedAt: Date.now() });
  };

  const commitLabel = () => {
    onChange({ ...element, label: labelInput.trim() || undefined, updatedAt: Date.now() });
  };

  const commitNote = () => {
    onChange({ ...element, note: noteInput.trim() || undefined, updatedAt: Date.now() });
  };

  return (
    <div className="absolute top-4 left-4 w-64 bg-white rounded-lg shadow-2xl z-30 border border-slate-200">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Door</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 space-y-3">
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
            placeholder="e.g. New door"
          />
        </div>

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
            placeholder="Add a note (visible to the GC)"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Width ({displayUnit})
          </label>
          <input
            type="number"
            min="0.01"
            step="0.1"
            value={widthInput}
            onChange={(e) => setWidthInput(e.target.value)}
            onBlur={commitWidth}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="text-[10px] text-slate-400 mt-1">{formatLength(element.widthCm, lengthSystem)}</div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Flip
          </label>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onChange({ ...element, flipX: !element.flipX, updatedAt: Date.now() })}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border ${
                element.flipX
                  ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
              title="Flip horizontal"
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              Horizontal
            </button>
            <button
              onClick={() => onChange({ ...element, flipY: !element.flipY, updatedAt: Date.now() })}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border ${
                element.flipY
                  ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
              title="Flip vertical"
            >
              <FlipVertical2 className="w-3.5 h-3.5" />
              Vertical
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end pt-1 border-t border-slate-100">
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
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
