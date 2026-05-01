import { LengthUnit, LengthSystem, ProjectScale } from "../types";

const CM_PER_UNIT: Record<LengthUnit, number> = {
  mm: 0.1,
  cm: 1,
  m: 100,
  in: 2.54,
  ft: 30.48,
};

export const toCm = (value: number, unit: LengthUnit): number =>
  value * CM_PER_UNIT[unit];

export const fromCm = (cm: number, unit: LengthUnit): number =>
  cm / CM_PER_UNIT[unit];

export const displayUnitFor = (system: LengthSystem): LengthUnit =>
  system === "imperial" ? "in" : "cm";

// Format a cm value for display in the user's preferred system.
// Imperial: feet+inches (e.g. 4'2"), metric: cm or m for ≥100cm.
export const formatLength = (cm: number, system: LengthSystem): string => {
  if (system === "imperial") {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - feet * 12);
    if (feet === 0) return `${inches}"`;
    if (inches === 0) return `${feet}'`;
    return `${feet}'${inches}"`;
  }
  if (cm >= 100) return `${(cm / 100).toFixed(2)} m`;
  return `${Math.round(cm)} cm`;
};

// Compute ProjectScale from two clicks in page-percent space and a measured distance.
// Assumes isotropic scaling on the PDF (architectural drawings preserve aspect ratio).
export const computeProjectScale = (params: {
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  pageNumber: number;
  pageWidthPx: number; // natural pixel width (scale=1)
  pageHeightPx: number;
  distance: number;
  unit: LengthUnit;
  userId: string;
}): ProjectScale => {
  const dxPx =
    ((params.pointB.x - params.pointA.x) / 100) * params.pageWidthPx;
  const dyPx =
    ((params.pointB.y - params.pointA.y) / 100) * params.pageHeightPx;
  const lineLengthPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
  const distanceCm = toCm(params.distance, params.unit);
  const cmPerPx = distanceCm / lineLengthPx;
  return {
    cmPerPx,
    pageWidthPx: params.pageWidthPx,
    pageHeightPx: params.pageHeightPx,
    calibrationLine: {
      pointA: params.pointA,
      pointB: params.pointB,
      pageNumber: params.pageNumber,
    },
    calibratedDistance: params.distance,
    calibratedUnit: params.unit,
    calibratedAt: Date.now(),
    calibratedBy: params.userId,
  };
};

// Convert a furniture item's cm position/size to page-percent for absolute layout.
export const cmToPagePercent = (
  cm: number,
  axis: "x" | "y",
  scale: ProjectScale,
): number => {
  const pagePxAtNative = axis === "x" ? scale.pageWidthPx : scale.pageHeightPx;
  return (cm / scale.cmPerPx / pagePxAtNative) * 100;
};

export const pagePercentToCm = (
  percent: number,
  axis: "x" | "y",
  scale: ProjectScale,
): number => {
  const pagePxAtNative = axis === "x" ? scale.pageWidthPx : scale.pageHeightPx;
  return (percent / 100) * pagePxAtNative * scale.cmPerPx;
};
