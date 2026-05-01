// Built-in furniture catalog. Each entry has real-world default dimensions
// and a generated top-down placeholder SVG. Categorized for the palette UI.

export type FurnitureCategory =
  | "bedroom"
  | "living"
  | "dining"
  | "office"
  | "kitchen"
  | "bathroom"
  | "storage";

export interface FurnitureLibraryItem {
  id: string;
  label: string;
  category: FurnitureCategory;
  // Default real-world dimensions in cm (top-down footprint).
  defaultWidthCm: number;
  defaultHeightCm: number;
  // Hex color of the placeholder silhouette.
  color: string;
}

const CATEGORY_COLORS: Record<FurnitureCategory, string> = {
  bedroom: "#a78bfa",
  living: "#60a5fa",
  dining: "#34d399",
  office: "#f59e0b",
  kitchen: "#f87171",
  bathroom: "#22d3ee",
  storage: "#94a3b8",
};

export const FURNITURE_LIBRARY: FurnitureLibraryItem[] = [
  // Bedroom
  { id: "bed-single", label: "Single bed", category: "bedroom", defaultWidthCm: 100, defaultHeightCm: 200, color: CATEGORY_COLORS.bedroom },
  { id: "bed-double", label: "Double bed", category: "bedroom", defaultWidthCm: 140, defaultHeightCm: 200, color: CATEGORY_COLORS.bedroom },
  { id: "bed-queen", label: "Queen bed", category: "bedroom", defaultWidthCm: 160, defaultHeightCm: 200, color: CATEGORY_COLORS.bedroom },
  { id: "bed-king", label: "King bed", category: "bedroom", defaultWidthCm: 180, defaultHeightCm: 200, color: CATEGORY_COLORS.bedroom },
  { id: "nightstand", label: "Nightstand", category: "bedroom", defaultWidthCm: 50, defaultHeightCm: 40, color: CATEGORY_COLORS.bedroom },

  // Living room
  { id: "sofa-2", label: "Sofa (2-seat)", category: "living", defaultWidthCm: 160, defaultHeightCm: 90, color: CATEGORY_COLORS.living },
  { id: "sofa-3", label: "Sofa (3-seat)", category: "living", defaultWidthCm: 220, defaultHeightCm: 90, color: CATEGORY_COLORS.living },
  { id: "armchair", label: "Armchair", category: "living", defaultWidthCm: 90, defaultHeightCm: 90, color: CATEGORY_COLORS.living },
  { id: "coffee-table", label: "Coffee table", category: "living", defaultWidthCm: 110, defaultHeightCm: 60, color: CATEGORY_COLORS.living },
  { id: "tv-stand", label: "TV stand", category: "living", defaultWidthCm: 160, defaultHeightCm: 40, color: CATEGORY_COLORS.living },

  // Dining
  { id: "dining-table-4", label: "Dining table (4)", category: "dining", defaultWidthCm: 120, defaultHeightCm: 80, color: CATEGORY_COLORS.dining },
  { id: "dining-table-6", label: "Dining table (6)", category: "dining", defaultWidthCm: 180, defaultHeightCm: 90, color: CATEGORY_COLORS.dining },
  { id: "dining-chair", label: "Dining chair", category: "dining", defaultWidthCm: 45, defaultHeightCm: 45, color: CATEGORY_COLORS.dining },

  // Office
  { id: "desk", label: "Desk", category: "office", defaultWidthCm: 140, defaultHeightCm: 70, color: CATEGORY_COLORS.office },
  { id: "office-chair", label: "Office chair", category: "office", defaultWidthCm: 60, defaultHeightCm: 60, color: CATEGORY_COLORS.office },

  // Kitchen
  { id: "fridge", label: "Refrigerator", category: "kitchen", defaultWidthCm: 70, defaultHeightCm: 70, color: CATEGORY_COLORS.kitchen },
  { id: "stove", label: "Stove", category: "kitchen", defaultWidthCm: 60, defaultHeightCm: 60, color: CATEGORY_COLORS.kitchen },
  { id: "kitchen-sink", label: "Kitchen sink", category: "kitchen", defaultWidthCm: 80, defaultHeightCm: 50, color: CATEGORY_COLORS.kitchen },

  // Bathroom
  { id: "toilet", label: "Toilet", category: "bathroom", defaultWidthCm: 40, defaultHeightCm: 70, color: CATEGORY_COLORS.bathroom },
  { id: "bathtub", label: "Bathtub", category: "bathroom", defaultWidthCm: 170, defaultHeightCm: 75, color: CATEGORY_COLORS.bathroom },
  { id: "shower", label: "Shower", category: "bathroom", defaultWidthCm: 90, defaultHeightCm: 90, color: CATEGORY_COLORS.bathroom },
  { id: "bath-sink", label: "Bathroom sink", category: "bathroom", defaultWidthCm: 60, defaultHeightCm: 50, color: CATEGORY_COLORS.bathroom },

  // Storage
  { id: "wardrobe", label: "Wardrobe", category: "storage", defaultWidthCm: 200, defaultHeightCm: 60, color: CATEGORY_COLORS.storage },
  { id: "bookshelf", label: "Bookshelf", category: "storage", defaultWidthCm: 80, defaultHeightCm: 30, color: CATEGORY_COLORS.storage },
  { id: "washing-machine", label: "Washing machine", category: "storage", defaultWidthCm: 60, defaultHeightCm: 60, color: CATEGORY_COLORS.storage },
];

// Generate a top-down silhouette SVG data URL for a library item. Uses a
// solid rounded rectangle with the label centered. Aspect ratio matches the
// item's real-world footprint so it scales correctly.
export const generatePlaceholderImage = (item: FurnitureLibraryItem): string => {
  const w = item.defaultWidthCm;
  const h = item.defaultHeightCm;
  const fontSize = Math.min(w, h) * 0.18;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="6" ry="6" fill="${item.color}" fill-opacity="0.35" stroke="${item.color}" stroke-width="2"/>
    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="600" fill="${item.color}" stroke="white" stroke-width="0.5" paint-order="stroke">${item.label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Regenerate a placeholder SVG with a custom label, using the item's
// dimensions and its library category color (falls back to slate).
export const regeneratePlaceholderSvg = (
  widthCm: number,
  heightCm: number,
  label: string,
  color?: string,
  libraryItemId?: string,
): string => {
  const c =
    color ||
    FURNITURE_LIBRARY.find((li) => li.id === libraryItemId)?.color ||
    "#94a3b8";
  const fontSize = Math.min(widthCm, heightCm) * 0.18;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthCm} ${heightCm}">
    <rect x="2" y="2" width="${widthCm - 4}" height="${heightCm - 4}" rx="6" ry="6" fill="${c}" fill-opacity="0.35" stroke="${c}" stroke-width="2"/>
    <text x="${widthCm / 2}" y="${heightCm / 2}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="600" fill="${c}" stroke="white" stroke-width="0.5" paint-order="stroke">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const FURNITURE_CATEGORIES: { id: FurnitureCategory; label: string }[] = [
  { id: "bedroom", label: "Bedroom" },
  { id: "living", label: "Living" },
  { id: "dining", label: "Dining" },
  { id: "office", label: "Office" },
  { id: "kitchen", label: "Kitchen" },
  { id: "bathroom", label: "Bathroom" },
  { id: "storage", label: "Storage" },
];
