import React, { useState, useRef, useEffect } from "react";
import {
  FURNITURE_LIBRARY,
  FURNITURE_CATEGORIES,
  FurnitureLibraryItem,
  generatePlaceholderImage,
} from "../data/furnitureLibrary";
import { LengthSystem, LengthUnit } from "../types";
import { uploadFile } from "../services/storageService";
import {
  importFurnitureImage,
  searchFurnitureImages,
  SearchHit,
} from "../services/furnitureSearchService";
import { displayUnitFor, formatLength, toCm } from "../utils/scaleConversion";
import { v4 as uuidv4 } from "uuid";
import {
  Upload,
  Loader2,
  X,
  AlertCircle,
  Search,
  Link as LinkIcon,
} from "lucide-react";

export type PlaceRequest =
  | { kind: "library"; libraryItem: FurnitureLibraryItem }
  | {
      kind: "upload";
      imageUrl: string;
      widthCm: number;
      heightCm: number;
      label: string;
    }
  | {
      kind: "search";
      imageUrl: string;
      widthCm: number;
      heightCm: number;
      label: string;
      searchQuery: string;
      attribution?: { source: string; pageUrl?: string };
    };

type Tab = "search" | "library" | "upload";

type PendingPlacement =
  | { kind: "upload"; url: string; suggestedLabel: string }
  | {
      kind: "search";
      url: string;
      suggestedLabel: string;
      query: string;
      attribution?: { source: string; pageUrl?: string };
    };

interface FurniturePaletteProps {
  visible: boolean;
  projectId: string;
  hasScale: boolean;
  lengthSystem: LengthSystem;
  onPlace: (req: PlaceRequest) => void;
  onClose: () => void;
}

export const FurniturePalette: React.FC<FurniturePaletteProps> = ({
  visible,
  projectId,
  hasScale,
  lengthSystem,
  onPlace,
  onClose,
}) => {
  const [tab, setTab] = useState<Tab>("library");
  const [uploading, setUploading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<PendingPlacement | null>(
    null,
  );
  const [uploadWidth, setUploadWidth] = useState("");
  const [uploadHeight, setUploadHeight] = useState("");
  const [uploadUnit, setUploadUnit] = useState<LengthUnit>(
    displayUnitFor(lengthSystem),
  );
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importingHitUrl, setImportingHitUrl] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    const handle = setTimeout(async () => {
      try {
        const hits = await searchFurnitureImages(q);
        setSearchResults(hits);
      } catch (err: any) {
        console.error("Furniture search failed:", err);
        setSearchError(err?.message || "Search failed.");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  if (!visible) return null;

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const path = `projects/${projectId}/furniture/${uuidv4()}_${file.name}`;
      const url = await uploadFile(file, path);
      if (!url) {
        setUploadError("Upload failed. Please try again.");
        return;
      }
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setPendingUpload({ url, suggestedLabel: baseName });
      setUploadLabel(baseName);
      setUploadWidth("");
      setUploadHeight("");
    } catch (err) {
      console.error("Furniture upload failed:", err);
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = () => {
    if (!pendingUpload) return;
    const w = parseFloat(uploadWidth);
    const h = parseFloat(uploadHeight);
    if (!w || w <= 0 || !h || h <= 0) {
      setUploadError("Enter valid dimensions.");
      return;
    }
    const widthCm = toCm(w, uploadUnit);
    const heightCm = toCm(h, uploadUnit);
    const label = uploadLabel || pendingUpload.suggestedLabel;
    if (pendingUpload.kind === "search") {
      onPlace({
        kind: "search",
        imageUrl: pendingUpload.url,
        widthCm,
        heightCm,
        label,
        searchQuery: pendingUpload.query,
        attribution: pendingUpload.attribution,
      });
    } else {
      onPlace({
        kind: "upload",
        imageUrl: pendingUpload.url,
        widthCm,
        heightCm,
        label,
      });
    }
    setPendingUpload(null);
    setUploadLabel("");
    setUploadWidth("");
    setUploadHeight("");
  };

  const handleImportFromUrl = async (
    url: string,
    opts?: {
      kind?: "search";
      query?: string;
      attribution?: { source: string; pageUrl?: string };
      suggestedLabel?: string;
      hitMarker?: string; // identifier shown as "loading" in search grid
    },
  ) => {
    if (!url) return;
    setUploadError(null);
    if (opts?.hitMarker) setImportingHitUrl(opts.hitMarker);
    else setUploading(true);
    try {
      const imported = await importFurnitureImage({
        url,
        projectId,
        attributionSource: opts?.attribution?.source,
        attributionPageUrl: opts?.attribution?.pageUrl,
      });
      const baseLabel =
        opts?.suggestedLabel ||
        opts?.attribution?.source ||
        url.replace(/^https?:\/\//, "").split("/")[0];
      if (opts?.kind === "search") {
        setPendingUpload({
          kind: "search",
          url: imported.storageUrl,
          suggestedLabel: baseLabel,
          query: opts.query || "",
          attribution: imported.attribution,
        });
      } else {
        setPendingUpload({
          kind: "upload",
          url: imported.storageUrl,
          suggestedLabel: baseLabel,
        });
      }
      setUploadLabel(baseLabel);
      setUploadWidth("");
      setUploadHeight("");
      // Switch to upload tab so the user sees the dimension prompt.
      setTab("upload");
    } catch (err: any) {
      console.error("Image import failed:", err);
      setUploadError(err?.message || "Could not import image.");
    } finally {
      setUploading(false);
      setImportingHitUrl(null);
    }
  };

  const renderLibrary = () => (
    <div className="overflow-y-auto flex-1 px-3 py-2">
      {FURNITURE_CATEGORIES.map((cat) => {
        const items = FURNITURE_LIBRARY.filter((i) => i.category === cat.id);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className="mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
              {cat.label}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  disabled={!hasScale}
                  onClick={() => onPlace({ kind: "library", libraryItem: item })}
                  className="group bg-white border border-slate-200 rounded-md p-2 hover:border-indigo-400 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none disabled:cursor-not-allowed"
                  title={`${item.label} — ${formatLength(item.defaultWidthCm, lengthSystem)} × ${formatLength(item.defaultHeightCm, lengthSystem)}`}
                >
                  <div className="aspect-square w-full mb-1.5 flex items-center justify-center bg-slate-50 rounded">
                    <img
                      src={generatePlaceholderImage(item)}
                      alt={item.label}
                      className="max-w-full max-h-full"
                    />
                  </div>
                  <div className="text-xs font-medium text-slate-700 truncate">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {formatLength(item.defaultWidthCm, lengthSystem)} ×{" "}
                    {formatLength(item.defaultHeightCm, lengthSystem)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSearch = () => (
    <div className="px-3 py-3 flex-1 overflow-y-auto">
      <div className="relative mb-3">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          autoFocus
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search images (e.g. 'modern sofa top view')"
          className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
        Tip: include "top view" or "plan view" for better placement images.
        Imported images are saved to your project.
      </p>

      {searchLoading && (
        <div className="flex items-center justify-center py-4 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {searchError && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {searchError}
        </div>
      )}

      {!searchLoading && !searchError && searchResults.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {searchResults.map((hit) => {
            const importing = importingHitUrl === hit.fullUrl;
            return (
              <button
                key={hit.fullUrl}
                disabled={!hasScale || !!importingHitUrl}
                onClick={() =>
                  handleImportFromUrl(hit.fullUrl, {
                    kind: "search",
                    query: searchQuery.trim(),
                    suggestedLabel: hit.title,
                    attribution: {
                      source: hit.sourceUrl
                        ? new URL(hit.sourceUrl).hostname
                        : "google-images",
                      pageUrl: hit.sourceUrl,
                    },
                    hitMarker: hit.fullUrl,
                  })
                }
                className="group bg-white border border-slate-200 rounded-md p-1.5 hover:border-indigo-400 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                title={`${hit.title}${hit.sourceUrl ? `\nSource: ${hit.sourceUrl}` : ""}`}
              >
                <div className="aspect-square w-full mb-1 flex items-center justify-center bg-slate-50 rounded overflow-hidden relative">
                  <img
                    src={hit.thumbUrl}
                    alt={hit.title}
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  {importing && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-600 truncate">
                  {hit.title || "Untitled"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!searchLoading &&
        !searchError &&
        searchQuery.trim().length >= 2 &&
        searchResults.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">No results.</p>
        )}
    </div>
  );

  const renderUpload = () => (
    <div className="px-3 py-3 flex-1 overflow-y-auto">
      {!pendingUpload && (
        <>
          <p className="text-xs text-slate-600 mb-3">
            Upload a top-down image to use as furniture, or paste an image URL.
            You'll set its real-world size after.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !hasScale}
            className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-300 rounded-md text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
            <span className="text-xs font-medium">
              {uploading ? "Working..." : "Choose image"}
            </span>
          </button>

          <div className="my-3 flex items-center gap-2 text-[10px] uppercase font-semibold text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            or
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Image URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                disabled={uploading || !hasScale}
                className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => {
                const trimmed = urlInput.trim();
                if (!trimmed) return;
                setUrlInput("");
                handleImportFromUrl(trimmed);
              }}
              disabled={uploading || !hasScale || !urlInput.trim()}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </>
      )}

      {pendingUpload && (
        <div className="space-y-3">
          <div className="aspect-video w-full bg-slate-50 rounded flex items-center justify-center overflow-hidden">
            <img
              src={pendingUpload.url}
              alt=""
              className="max-w-full max-h-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Label
            </label>
            <input
              type="text"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Real-world size
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="W"
                value={uploadWidth}
                onChange={(e) => setUploadWidth(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-slate-400 text-xs">×</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="H"
                value={uploadHeight}
                onChange={(e) => setUploadHeight(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={uploadUnit}
                onChange={(e) => setUploadUnit(e.target.value as LengthUnit)}
                className="px-2 py-1.5 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {(lengthSystem === "imperial"
                  ? (["in", "ft"] as LengthUnit[])
                  : (["cm", "m", "mm"] as LengthUnit[])
                ).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {uploadError && (
            <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setPendingUpload(null);
                setUploadError(null);
              }}
              className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUpload}
              className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded"
            >
              Place on plan
            </button>
          </div>
        </div>
      )}

      {uploadError && !pendingUpload && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {uploadError}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex flex-col h-full bg-white border-l border-slate-200 shadow-xl shrink-0 z-20 w-96">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-800">Furniture</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          title="Back to comments"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* No-scale gate */}
      {!hasScale && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
          Calibrate the plan's scale to enable furniture placement.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {(["search", "library", "upload"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors capitalize ${
              tab === t
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "search"
        ? renderSearch()
        : tab === "library"
          ? renderLibrary()
          : renderUpload()}
    </div>
  );
};
