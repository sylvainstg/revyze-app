import React, { useState, useRef, useEffect } from "react";
import { LengthSystem, LengthUnit, ProjectScale, User } from "../types";
import {
  computeProjectScale,
  cmToPagePercent,
  formatLength,
  toCm,
} from "../utils/scaleConversion";
import { X, Check, RotateCcw } from "lucide-react";

interface CalibrationOverlayProps {
  pdfWrapperRef: React.RefObject<HTMLDivElement | null>;
  pdfScale: number; // current PDF zoom (Page scale prop)
  pageNumber: number;
  currentUser: User;
  lengthSystem: LengthSystem;
  onCommit: (scale: ProjectScale) => void;
  onCancel: () => void;
}

type Step = "await-first" | "await-second" | "enter-distance" | "verify";

const UNIT_OPTIONS_METRIC: LengthUnit[] = ["cm", "m", "mm"];
const UNIT_OPTIONS_IMPERIAL: LengthUnit[] = ["in", "ft"];

export const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({
  pdfWrapperRef,
  pdfScale,
  pageNumber,
  currentUser,
  lengthSystem,
  onCommit,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>("await-first");
  const [pointA, setPointA] = useState<{ x: number; y: number } | null>(null);
  const [pointB, setPointB] = useState<{ x: number; y: number } | null>(null);
  const [distance, setDistance] = useState<string>("");
  const [unit, setUnit] = useState<LengthUnit>(
    lengthSystem === "imperial" ? "ft" : "cm",
  );
  const [pendingScale, setPendingScale] = useState<ProjectScale | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Esc cancels at any step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    if (step === "enter-distance") inputRef.current?.focus();
  }, [step]);

  const getPagePercent = (e: React.MouseEvent) => {
    if (!pdfWrapperRef.current) return null;
    const rect = pdfWrapperRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (step !== "await-first" && step !== "await-second") return;
    const p = getPagePercent(e);
    if (!p) return;
    if (step === "await-first") {
      setPointA(p);
      setStep("await-second");
    } else {
      setPointB(p);
      setStep("enter-distance");
    }
  };

  const handleSubmitDistance = () => {
    const value = parseFloat(distance);
    if (!value || value <= 0 || !pointA || !pointB) return;

    const canvas = document.querySelector(
      ".react-pdf__Page__canvas",
    ) as HTMLCanvasElement | null;
    if (!canvas) return;

    // canvas.width/height reflect the rendered size at current pdfScale.
    // Normalize to natural (scale=1) dimensions.
    const pageWidthPx = canvas.width / pdfScale;
    const pageHeightPx = canvas.height / pdfScale;

    const scale = computeProjectScale({
      pointA,
      pointB,
      pageNumber,
      pageWidthPx,
      pageHeightPx,
      distance: value,
      unit,
      userId: currentUser.id,
    });
    setPendingScale(scale);
    setStep("verify");
  };

  const handleConfirm = () => {
    if (pendingScale) onCommit(pendingScale);
  };

  const handleRecalibrate = () => {
    setPointA(null);
    setPointB(null);
    setDistance("");
    setPendingScale(null);
    setStep("await-first");
  };

  const unitOptions =
    lengthSystem === "imperial" ? UNIT_OPTIONS_IMPERIAL : UNIT_OPTIONS_METRIC;

  // --- Render helpers ---

  const renderLine = () => {
    if (!pointA) return null;
    const target = pointB ?? pointA;
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 2 }}
      >
        <line
          x1={`${pointA.x}%`}
          y1={`${pointA.y}%`}
          x2={`${target.x}%`}
          y2={`${target.y}%`}
          stroke="#4f46e5"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <circle cx={`${pointA.x}%`} cy={`${pointA.y}%`} r="6" fill="#4f46e5" />
        {pointB && (
          <circle
            cx={`${pointB.x}%`}
            cy={`${pointB.y}%`}
            r="6"
            fill="#4f46e5"
          />
        )}
      </svg>
    );
  };

  const renderDistanceInput = () => {
    if (step !== "enter-distance" || !pointA || !pointB) return null;
    const midX = (pointA.x + pointB.x) / 2;
    const midY = (pointA.y + pointB.y) / 2;
    const isLowY = midY < 25;
    return (
      <div
        className="absolute bg-white rounded-lg shadow-2xl p-3 w-64 z-30 border border-indigo-200"
        style={{
          left: `${midX}%`,
          top: `${midY}%`,
          transform: `translate(-50%, ${isLowY ? "20px" : "calc(-100% - 20px)"})`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Real distance
          </span>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="number"
            min="0.01"
            step="0.01"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitDistance();
            }}
            placeholder="e.g. 300"
            className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as LengthUnit)}
            className="px-2 py-1.5 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSubmitDistance}
          disabled={!distance || parseFloat(distance) <= 0}
          className="w-full mt-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    );
  };

  const renderVerifySquare = () => {
    if (step !== "verify" || !pendingScale) return null;
    // 100cm reference square (or 1ft for imperial users) centered on page.
    const refCm = lengthSystem === "imperial" ? toCm(1, "ft") : 100;
    const widthPct = cmToPagePercent(refCm, "x", pendingScale);
    const heightPct = cmToPagePercent(refCm, "y", pendingScale);
    const left = 50 - widthPct / 2;
    const top = 50 - heightPct / 2;
    const label = formatLength(refCm, lengthSystem);
    return (
      <>
        <div
          className="absolute border-2 border-dashed border-emerald-500 bg-emerald-50/40 pointer-events-none flex items-center justify-center"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${widthPct}%`,
            height: `${heightPct}%`,
            zIndex: 3,
          }}
        >
          <span className="text-xs font-bold text-emerald-700 bg-white/90 px-1.5 py-0.5 rounded">
            {label} × {label}
          </span>
        </div>
        <div
          className="absolute bg-white rounded-lg shadow-2xl p-3 z-30 border border-emerald-200"
          style={{
            left: "50%",
            top: `${top + heightPct}%`,
            transform: "translate(-50%, 16px)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-slate-600 mb-2 max-w-xs">
            Does the reference square look the right size?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRecalibrate}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recalibrate
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded"
            >
              <Check className="w-3.5 h-3.5" />
              Looks right
            </button>
          </div>
        </div>
      </>
    );
  };

  const statusMessage =
    step === "await-first"
      ? "Click the first reference point on the plan"
      : step === "await-second"
        ? "Click the second reference point"
        : null;

  return (
    <div
      className="absolute inset-0 z-20"
      style={{
        cursor:
          step === "await-first" || step === "await-second"
            ? "crosshair"
            : "default",
        // Only intercept clicks while we still need them.
        pointerEvents:
          step === "await-first" || step === "await-second" ? "auto" : "none",
      }}
      onClick={handleClick}
    >
      {/* Status banner */}
      {statusMessage && (
        <div
          className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-full shadow-xl"
          style={{ pointerEvents: "auto", zIndex: 25 }}
        >
          {statusMessage}
          <button
            onClick={onCancel}
            className="ml-3 text-indigo-100 hover:text-white"
          >
            <X className="w-4 h-4 inline" />
          </button>
        </div>
      )}

      {renderLine()}
      <div style={{ pointerEvents: "auto" }}>{renderDistanceInput()}</div>
      <div style={{ pointerEvents: "auto" }}>{renderVerifySquare()}</div>
    </div>
  );
};
