import React, { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Comment,
  FurnitureItem,
  WallItem,
  MaskItem,
  LengthSystem,
  ProjectScale,
  User,
  UserRole,
} from "../types";
import { PDF_WORKER_URL } from "../constants";
import {
  Plus,
  Loader2,
  Sparkles,
  X,
  AlertCircle,
  Upload,
  UserPlus,
  MessageSquare,
  Sofa,
  Ruler,
  Eye,
  EyeOff,
  Minus,
  Square,
  MousePointer2,
} from "lucide-react";
import * as geminiService from "../services/geminiService";
import { getPDFObjectURL, revokePDFObjectURL } from "../utils/pdfUtils";
import { VersionSelectorDetailed } from "./VersionSelector";
import { MentionInput } from "./MentionInput";
import { FurnitureLayer } from "./FurnitureLayer";
import { FurnitureInspector } from "./FurnitureInspector";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { WallLayer, WallTool, WallSelection } from "./WallLayer";
import { WallInspector, MaskInspector } from "./WallInspector";

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

// Options to ensure character maps load correctly from CDN
const pdfOptions = {
  cMapUrl: "https://aistudiocdn.com/pdfjs-dist@4.4.168/cmaps/",
  cMapPacked: true,
};

interface PDFWorkspaceProps {
  fileUrl: string;
  comments: Comment[];
  onAddComment: (
    comment: Omit<Comment, "id" | "timestamp" | "resolved">,
  ) => void;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  currentUserRole: UserRole;
  pageNumber: number;
  setPageNumber: (page: number) => void;
  scale: number;
  setScale: (scale: number | ((prev: number) => number)) => void;
  filter: { active: boolean; resolved: boolean; deleted: boolean };
  // Version management props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  versions?: any[];
  currentVersionId?: string;
  onVersionChange?: (versionId: string) => void;
  onUploadNewVersion?: () => void;
  canUploadVersion?: boolean;
  onEditVersion?: (versionId: string) => void;
  initialPanOffset?: { x: number; y: number };
  onPanChange?: (offset: { x: number; y: number }) => void;
  onFocusComment?: (commentId: string) => void;
  canAddComment?: boolean;
  onUpdateCommentPosition?: (
    commentId: string,
    position: { x: number; y: number },
  ) => void;
  onCaptureThumbnail?: () => void;
  onSetDefaultPage?: (page: number) => void;
  isDefaultPage?: boolean;
  showPreviousVersionComments?: boolean;
  onTogglePreviousComments?: (value: boolean) => void;
  onPageCountChange?: (count: number | null) => void;
  collaborators?: string[];
  currentUserEmail?: string;
  isOwner?: boolean;
  // Guest banner props
  isGuest?: boolean;
  accessLevel?: "view" | "comment";
  onSignUpClick?: () => void;
  // Furniture layer props
  currentUser?: User;
  projectId?: string;
  projectScale?: ProjectScale;
  onUpdateProjectScale?: (scale: ProjectScale) => void;
  furnitureItems?: FurnitureItem[];
  onUpdateFurnitureItems?: (items: FurnitureItem[]) => void;
  lengthSystem?: LengthSystem;
  // Lifted state — App owns mode + selection to coordinate with right sidebar.
  mode?: "comment" | "furniture" | "calibrate" | "wall";
  onModeChange?: (mode: "comment" | "furniture" | "calibrate" | "wall") => void;
  selectedFurnitureId?: string | null;
  onSelectFurniture?: (id: string | null) => void;
  // Wall change layer props
  wallItems?: WallItem[];
  onUpdateWallItems?: (items: WallItem[]) => void;
  maskItems?: MaskItem[];
  onUpdateMaskItems?: (items: MaskItem[]) => void;
  wallTool?: WallTool;
  onWallToolChange?: (tool: WallTool) => void;
  selectedWall?: WallSelection;
  onSelectWall?: (selection: WallSelection) => void;
}

export const PDFWorkspace: React.FC<PDFWorkspaceProps> = ({
  fileUrl,
  // comments prop is unused here as we use versions to build visible comments
  onAddComment,
  activeCommentId,
  setActiveCommentId,
  currentUserRole,
  pageNumber,
  setPageNumber,
  scale,
  setScale,
  filter,
  versions,
  currentVersionId,
  onVersionChange,
  onUploadNewVersion,
  canUploadVersion,
  onEditVersion,
  initialPanOffset = { x: 0, y: 0 },
  onPanChange,
  onFocusComment,
  canAddComment = true,
  onUpdateCommentPosition,
  onCaptureThumbnail,
  onSetDefaultPage,
  isDefaultPage = false,
  showPreviousVersionComments = false,
  onTogglePreviousComments,
  onPageCountChange,
  collaborators = [],
  currentUserEmail = "",
  isOwner = false,
  isGuest = false,
  accessLevel = "comment",
  onSignUpClick,
  currentUser,
  projectId,
  projectScale,
  onUpdateProjectScale,
  furnitureItems = [],
  onUpdateFurnitureItems,
  lengthSystem = "metric",
  mode: modeProp,
  onModeChange,
  selectedFurnitureId: selectedFurnitureIdProp,
  onSelectFurniture,
  wallItems = [],
  onUpdateWallItems,
  maskItems = [],
  onUpdateMaskItems,
  wallTool: wallToolProp,
  onWallToolChange,
  selectedWall: selectedWallProp,
  onSelectWall,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [tempMarker, setTempMarker] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [commentText, setCommentText] = useState("");
  const [pendingMentions, setPendingMentions] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [panOffset, setPanOffset] = useState(initialPanOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // For panning
  const [draggedCommentId, setDraggedCommentId] = useState<string | null>(null); // For comment moving
  // Initial position of the comment being dragged (to calculate delta)
  const [commentDragStart, setCommentDragStart] = useState<{
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [draggedItemPosition, setDraggedItemPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [loadError, setLoadError] = useState<Error | null>(null);
  const [pdfObjectURL, setPdfObjectURL] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [defaultPageSet, setDefaultPageSet] = useState(false);
  const [thumbnailSet, setThumbnailSet] = useState(false);

  const hasDraggedRef = useRef(false); // Track if actual movement occurred
  const viewportRef = useRef<HTMLDivElement>(null);

  // Furniture layer state. Mode + selection are lifted to App so the right
  // sidebar can swap between Feedback and Furniture panels in lockstep.
  type Mode = "comment" | "furniture" | "calibrate" | "wall";
  const [internalMode, setInternalMode] = useState<Mode>("comment");
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const mode = modeProp ?? internalMode;
  const setMode = (m: Mode) => {
    if (onModeChange) onModeChange(m);
    else setInternalMode(m);
  };
  const selectedFurnitureId = selectedFurnitureIdProp ?? internalSelectedId;
  const setSelectedFurnitureId = (id: string | null) => {
    if (onSelectFurniture) onSelectFurniture(id);
    else setInternalSelectedId(id);
  };

  // Wall change layer state, same lift-to-App pattern as furniture.
  const [internalWallTool, setInternalWallTool] = useState<WallTool>("select");
  const wallTool = wallToolProp ?? internalWallTool;
  const setWallTool = (t: WallTool) => {
    if (onWallToolChange) onWallToolChange(t);
    else setInternalWallTool(t);
  };
  const [internalSelectedWall, setInternalSelectedWall] = useState<WallSelection>(null);
  const selectedWall = selectedWallProp ?? internalSelectedWall;
  const setSelectedWall = (sel: WallSelection) => {
    if (onSelectWall) onSelectWall(sel);
    else setInternalSelectedWall(sel);
  };

  const [commentsVisible, setCommentsVisible] = useState(true);
  const [furnitureVisible, setFurnitureVisible] = useState(true);
  const [wallVisible, setWallVisible] = useState(true);

  const canEditFurniture =
    !!currentUser && !!onUpdateFurnitureItems && !isGuest;
  const canEditWalls = !!currentUser && !!onUpdateWallItems && !isGuest;
  const hasScale = !!projectScale;
  const selectedFurniture =
    furnitureItems.find((it) => it.id === selectedFurnitureId) || null;
  const selectedWallItem =
    selectedWall?.kind === "wall" ? wallItems.find((w) => w.id === selectedWall.id) || null : null;
  const selectedMaskItem =
    selectedWall?.kind === "mask" ? maskItems.find((m) => m.id === selectedWall.id) || null : null;

  // Update pan offset when initialPanOffset changes (e.g. when category switches)
  useEffect(() => {
    setPanOffset(initialPanOffset);
  }, [initialPanOffset]);

  // Handle Esc key to close comment popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (tempMarker) {
          setTempMarker(null);
          setCommentText("");
          setUseAI(false);
        }
        if (activeCommentId) {
          setActiveCommentId(null);
        }
        if (draggedCommentId) {
          setDraggedCommentId(null);
          setCommentDragStart(null);
          setDraggedItemPosition(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    tempMarker,
    activeCommentId,
    setTempMarker,
    setCommentText,
    setActiveCommentId,
    draggedCommentId,
  ]);

  // Convert Firebase Storage URL to object URL to bypass CORS
  useEffect(() => {
    setLoadError(null);
    let isMounted = true;
    let currentObjectURL: string | null = null;

    const loadPDF = async () => {
      console.log("[PDFWorkspace] Loading PDF from URL:", fileUrl);

      // Clean up previous object URL before loading new one
      if (pdfObjectURL) {
        console.log("[PDFWorkspace] Revoking previous PDF object URL");
        revokePDFObjectURL(pdfObjectURL);
        setPdfObjectURL(null);
      }

      try {
        const objectURL = await getPDFObjectURL(fileUrl);
        console.log("[PDFWorkspace] Converted to proxy URL:", objectURL);
        currentObjectURL = objectURL;

        if (isMounted) {
          setPdfObjectURL(objectURL);
        } else {
          // Component unmounted during load, clean up immediately
          revokePDFObjectURL(objectURL);
        }
      } catch (error) {
        console.error("[PDFWorkspace] Failed to load PDF:", error);
        if (isMounted) {
          setPdfObjectURL(fileUrl); // Fallback to original URL
        }
      }
    };

    loadPDF();

    return () => {
      isMounted = false;
      // Cleanup object URL when component unmounts or fileUrl changes
      if (currentObjectURL) {
        console.log("[PDFWorkspace] Cleanup: Revoking PDF object URL");
        revokePDFObjectURL(currentObjectURL);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  const pdfWrapperRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(null);
    onPageCountChange?.(numPages);
  };

  // Fallback to page 1 if current page is invalid
  useEffect(() => {
    if (numPages && (pageNumber < 1 || pageNumber > numPages)) {
      console.log(`Invalid page number ${pageNumber}, falling back to page 1`);
      setPageNumber(1);
    }
  }, [numPages, pageNumber, setPageNumber]);

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF Load Error:", error);
    setLoadError(error);
    onPageCountChange?.(null);
  };

  // Reset page count when loading a new document
  useEffect(() => {
    onPageCountChange?.(null);
  }, [fileUrl, onPageCountChange]);

  // Handle Comment Drag Start
  const handleCommentMouseDown = (
    e: React.MouseEvent,
    commentId: string,
    currentX: number,
    currentY: number,
  ) => {
    e.stopPropagation(); // Prevent panning
    e.preventDefault();
    setDraggedCommentId(commentId);
    setDraggedItemPosition({ x: currentX, y: currentY });
    setCommentDragStart({
      x: currentX,
      y: currentY,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  // Pan/drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggedCommentId) return; // Don't pan if dragging comment
    // Allow panning at all zoom levels
    setIsDragging(true);
    hasDraggedRef.current = false; // Reset drag flag
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Handle Comment Dragging
    if (draggedCommentId && commentDragStart && pdfWrapperRef.current) {
      const rect = pdfWrapperRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - commentDragStart.startX) / rect.width) * 100;
      const deltaY =
        ((e.clientY - commentDragStart.startY) / rect.height) * 100;

      setDraggedItemPosition({
        x: Math.min(100, Math.max(0, commentDragStart.x + deltaX)),
        y: Math.min(100, Math.max(0, commentDragStart.y + deltaY)),
      });
      return;
    }

    // 2. Handle Panning
    if (isDragging) {
      hasDraggedRef.current = true; // Mark that we have moved
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (draggedCommentId && draggedItemPosition) {
      // Finalize move
      if (onUpdateCommentPosition) {
        onUpdateCommentPosition(draggedCommentId, draggedItemPosition);
      }
      setDraggedCommentId(null);
      setCommentDragStart(null);
      setDraggedItemPosition(null);
      return;
    }

    if (isDragging) {
      setIsDragging(false);
      onPanChange?.(panOffset);
    }
  };

  const handleLeave = () => {
    handleMouseUp();
  };

  const handlePdfClick = (e: React.MouseEvent) => {
    // Don't create comments if we were dragging/panning or moving a comment
    if (hasDraggedRef.current || draggedCommentId) {
      hasDraggedRef.current = false; // Reset for next time
      return;
    }

    // Only the comment tool creates comments. Other modes have their own
    // overlays which intercept clicks before they reach here.
    if (mode !== "comment" || !commentsVisible) return;

    if (!pdfWrapperRef.current) return;

    // Check if commenting is allowed
    if (!canAddComment) {
      setActiveCommentId(null);
      return;
    }

    // If we are already creating a comment, ignore clicks outside (or cancel?)
    // For simplicity, clicking elsewhere moves the marker
    const rect = pdfWrapperRef.current.getBoundingClientRect();

    // Calculate relative coordinates (percentage)
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setTempMarker({ x, y });
    setCommentText("");
    setUseAI(false);
    setActiveCommentId(null);
  };

  const handleSubmitComment = async () => {
    if (!tempMarker || !commentText.trim()) return;

    let aiAnalysis: string | undefined = undefined;

    if (useAI) {
      setIsAnalyzing(true);
      try {
        // Capture canvas area
        const canvas = document.querySelector(
          ".react-pdf__Page__canvas",
        ) as HTMLCanvasElement;
        if (canvas) {
          // We need to crop the canvas around the click area to give Gemini context
          // Marker is in %, canvas is in px.
          const markerPxX = (tempMarker.x / 100) * canvas.width;
          const markerPxY = (tempMarker.y / 100) * canvas.height;

          // Crop size (e.g., 400x400 px around the click)
          const cropSize = 500;
          const sx = Math.max(0, markerPxX - cropSize / 2);
          const sy = Math.max(0, markerPxY - cropSize / 2);
          const sw = Math.min(cropSize, canvas.width - sx);
          const sh = Math.min(cropSize, canvas.height - sy);

          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = sw;
          tempCanvas.height = sh;
          const ctx = tempCanvas.getContext("2d");
          ctx?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

          const base64 = tempCanvas.toDataURL("image/png");
          aiAnalysis = await geminiService.analyzeDesignArea(
            base64,
            commentText,
          );
        }
      } catch (e) {
        console.error("Analysis failed", e);
      } finally {
        setIsAnalyzing(false);
      }
    }

    onAddComment({
      x: tempMarker.x,
      y: tempMarker.y,
      pageNumber: pageNumber, // Include page number
      text: commentText,
      author: currentUserRole,
      aiAnalysis,
      mentions: pendingMentions,
    });

    setTempMarker(null);
    setCommentText("");
    setPendingMentions([]);
  };

  // --- Furniture handlers ---

  const handleCommitScale = (scale: ProjectScale) => {
    onUpdateProjectScale?.(scale);
    setMode("comment");
  };

  const handleCancelCalibrate = () => {
    setMode("comment");
  };

  // Compute next zIndex (top of stack) for new items.
  const nextZIndex = () => {
    const max = furnitureItems.reduce(
      (m, it) => (it.deleted ? m : Math.max(m, it.zIndex)),
      0,
    );
    return max + 1;
  };

  const handleUpdateSelectedFurniture = (next: FurnitureItem) => {
    if (!onUpdateFurnitureItems) return;
    onUpdateFurnitureItems(
      furnitureItems.map((it) => (it.id === next.id ? next : it)),
    );
  };

  const handleDeleteSelectedFurniture = () => {
    if (!onUpdateFurnitureItems || !selectedFurnitureId) return;
    onUpdateFurnitureItems(
      furnitureItems.map((it) =>
        it.id === selectedFurnitureId
          ? { ...it, deleted: true, updatedAt: Date.now() }
          : it,
      ),
    );
    setSelectedFurnitureId(null);
  };

  const handleBringToFront = () => {
    if (!onUpdateFurnitureItems || !selectedFurnitureId) return;
    const top = nextZIndex();
    onUpdateFurnitureItems(
      furnitureItems.map((it) =>
        it.id === selectedFurnitureId
          ? { ...it, zIndex: top, updatedAt: Date.now() }
          : it,
      ),
    );
  };

  const handleSendToBack = () => {
    if (!onUpdateFurnitureItems || !selectedFurnitureId) return;
    const min = furnitureItems.reduce(
      (m, it) => (it.deleted ? m : Math.min(m, it.zIndex)),
      0,
    );
    onUpdateFurnitureItems(
      furnitureItems.map((it) =>
        it.id === selectedFurnitureId
          ? { ...it, zIndex: min - 1, updatedAt: Date.now() }
          : it,
      ),
    );
  };

  const handleUpdateSelectedWall = (next: WallItem) => {
    if (!onUpdateWallItems) return;
    onUpdateWallItems(wallItems.map((w) => (w.id === next.id ? next : w)));
  };

  const handleDeleteSelectedWall = () => {
    if (!onUpdateWallItems || selectedWall?.kind !== "wall") return;
    onUpdateWallItems(
      wallItems.map((w) =>
        w.id === selectedWall.id ? { ...w, deleted: true, updatedAt: Date.now() } : w,
      ),
    );
    setSelectedWall(null);
  };

  const handleUpdateSelectedMask = (next: MaskItem) => {
    if (!onUpdateMaskItems) return;
    onUpdateMaskItems(maskItems.map((m) => (m.id === next.id ? next : m)));
  };

  const handleDeleteSelectedMask = () => {
    if (!onUpdateMaskItems || selectedWall?.kind !== "mask") return;
    onUpdateMaskItems(
      maskItems.map((m) =>
        m.id === selectedWall.id ? { ...m, deleted: true, updatedAt: Date.now() } : m,
      ),
    );
    setSelectedWall(null);
  };

  // Build combined comment list (current + previous versions when enabled)
  const buildVisibleComments = () => {
    // Determine ordering of versions (latest first)
    let versionsOrdered = versions
      ? [...versions].sort(
        (a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0),
      )
      : [];
    const currentIdx = versionsOrdered.findIndex(
      (v) => v.id === currentVersionId,
    );
    if (currentIdx === -1) {
      // Fallback to use provided array as-is
      versionsOrdered = versions || [];
    }

    const buckets = showPreviousVersionComments
      ? versionsOrdered
      : versionsOrdered.filter((v) => v.id === currentVersionId);

    const collected: Array<{ comment: Comment; distance: number }> = [];

    buckets.forEach((ver, idx) => {
      const distance =
        currentIdx >= 0 ? Math.max(0, idx - currentIdx) : Math.max(0, idx);
      (ver.comments || []).forEach((c: Comment) => {
        // Status filters
        if ((c.pageNumber || 1) !== pageNumber) return;
        if (c.deleted && !filter.deleted) return;
        if (c.resolved && !filter.resolved) return;
        if (!c.resolved && !c.deleted && !filter.active) return;

        collected.push({ comment: c, distance });
      });
    });

    return collected;
  };

  const visibleComments = buildVisibleComments();

  return (
    <div className="flex-1 bg-slate-200/50 flex flex-col h-full relative">
      {/* Version Toolbar */}
      {(versions && versions.length > 0) || canUploadVersion ? (
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {versions && versions.length > 0 && currentVersionId && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">
                  Version:
                </span>
                <VersionSelectorDetailed
                  versions={versions}
                  currentVersionId={currentVersionId}
                  onVersionChange={onVersionChange}
                  onEditVersion={onEditVersion}
                />
              </div>
            )}
          </div>

          {/* Page Navigation Toolbar - Moved here */}
          {!loadError && (
            <div className="flex items-center gap-4">
              <div id="page-navigation" className="flex items-center gap-2">
                <button
                  disabled={!numPages || pageNumber <= 1}
                  onClick={() => setPageNumber((prev) => prev - 1)}
                  className="px-3 py-1 bg-indigo-100 border border-indigo-400 rounded-full text-indigo-800 hover:bg-indigo-200 hover:text-indigo-900 disabled:opacity-50 disabled:hover:bg-indigo-100 disabled:hover:text-indigo-700 transition-all shadow text-sm font-medium"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600 font-medium whitespace-nowrap">
                  Page {numPages ? pageNumber : "—"}
                  {numPages ? ` of ${numPages}` : ""}
                </span>
                <button
                  disabled={!numPages || pageNumber >= numPages}
                  onClick={() => setPageNumber((prev) => prev + 1)}
                  className="px-3 py-1 bg-indigo-100 border border-indigo-400 rounded-full text-indigo-800 hover:bg-indigo-200 hover:text-indigo-900 disabled:opacity-50 disabled:hover:bg-indigo-100 disabled:hover:text-indigo-700 transition-all shadow text-sm font-medium"
                >
                  Next
                </button>
              </div>

              {/* Zoom Controls */}
              <div
                id="zoom-controls"
                className="flex items-center gap-2 border-l border-indigo-200 pl-4"
              >
                <button
                  onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
                  className="p-2 bg-indigo-100 border border-indigo-400 rounded-full text-indigo-800 hover:bg-indigo-200 hover:text-indigo-900 transition-all shadow"
                  title="Zoom out"
                >
                  <svg
                    className="w-4 h-4 text-indigo-800"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setScale((prev) => Math.min(5, prev + 0.1))}
                  className="p-2 bg-indigo-100 border border-indigo-400 rounded-full text-indigo-800 hover:bg-indigo-200 hover:text-indigo-900 transition-all shadow"
                  title="Zoom in"
                >
                  <svg
                    className="w-4 h-4 text-indigo-800"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                </button>
              </div>

              {/* Plan Preferences Menu - Owner Only */}
              {isOwner && (
                <div
                  id="plan-preferences"
                  className="relative group border-l border-indigo-200 pl-4"
                >
                  <button className="px-3 py-1 bg-indigo-100 border border-indigo-400 rounded-full text-indigo-800 hover:bg-indigo-200 hover:text-indigo-900 transition-all shadow text-sm font-medium flex items-center gap-1">
                    Plan Preferences
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  <div
                    className="fixed bg-white border border-indigo-200 rounded-lg shadow-2xl py-1 min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
                    style={{ zIndex: 99999, marginTop: "0.5rem" }}
                  >
                    <button
                      onClick={() => {
                        if (onSetDefaultPage) {
                          onSetDefaultPage(pageNumber);
                          setDefaultPageSet(true);
                          setTimeout(() => setDefaultPageSet(false), 2000);
                        }
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${defaultPageSet || isDefaultPage
                        ? "bg-green-50 text-green-700"
                        : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                        }`}
                    >
                      <svg
                        className="w-4 h-4 text-indigo-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {defaultPageSet
                        ? "Default page set!"
                        : isDefaultPage
                          ? "Default page"
                          : "Set this page as default"}
                    </button>
                    <button
                      onClick={() => {
                        if (onCaptureThumbnail) {
                          onCaptureThumbnail();
                          setThumbnailSet(true);
                          setTimeout(() => setThumbnailSet(false), 2000);
                        }
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${thumbnailSet
                        ? "bg-green-50 text-green-700"
                        : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                        }`}
                    >
                      <svg
                        className="w-4 h-4 text-indigo-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {thumbnailSet
                        ? "Thumbnail captured!"
                        : "Set this page as thumbnail"}
                    </button>
                  </div>
                </div>
              )}

              {/* Previous versions toggle */}
              {versions && versions.length > 1 && (
                <label className="flex items-center gap-2 text-xs font-medium text-indigo-900 bg-indigo-50 border border-indigo-300 px-3 py-2 rounded-full shadow cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!showPreviousVersionComments}
                    onChange={(e) =>
                      onTogglePreviousComments?.(e.target.checked)
                    }
                    className="w-4 h-4 text-indigo-600 border-indigo-300 bg-white rounded focus:ring-indigo-500"
                  />
                  Show previous versions' comments
                </label>
              )}
            </div>
          )}

          {canUploadVersion && onUploadNewVersion && (
            <button
              onClick={onUploadNewVersion}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Upload New Version
            </button>
          )}
        </div>
      ) : null}

      {/* Layer/tool toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 text-sm">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">
          Tools
        </span>
        <button
          onClick={() => setMode("comment")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
            mode === "comment"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Comment
        </button>
        <button
          onClick={() => setMode(mode === "furniture" ? "comment" : "furniture")}
          disabled={!canEditFurniture}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === "furniture"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          title={
            !canEditFurniture
              ? "Sign in with edit access to place furniture"
              : ""
          }
        >
          <Sofa className="w-3.5 h-3.5" />
          Furniture
        </button>
        <button
          onClick={() => setMode(mode === "calibrate" ? "comment" : "calibrate")}
          disabled={!canEditFurniture}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === "calibrate"
              ? "bg-emerald-600 text-white"
              : hasScale
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-amber-100 text-amber-800 hover:bg-amber-200"
          }`}
          title={hasScale ? "Recalibrate scale" : "Calibrate the plan's scale"}
        >
          <Ruler className="w-3.5 h-3.5" />
          {hasScale ? "Recalibrate" : "Calibrate"}
        </button>
        <button
          onClick={() => setMode(mode === "wall" ? "comment" : "wall")}
          disabled={!canEditWalls}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === "wall"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          title={
            !canEditWalls
              ? "Sign in with edit access to add wall changes"
              : "Ad-hoc wall changes for this version"
          }
        >
          <Minus className="w-3.5 h-3.5" />
          Wall Changes
        </button>

        {mode === "wall" ? (
          <>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button
              onClick={() => setWallTool("select")}
              className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
                wallTool === "select"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title="Select / edit"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setWallTool("wall")}
              className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
                wallTool === "wall"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title="Draw wall (click start, click end)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setWallTool("mask")}
              className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
                wallTool === "mask"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              title="White-out area (drag to draw)"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </>
        ) : null}

        <div className="w-px h-5 bg-slate-200 mx-2" />

        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">
          Layers
        </span>
        <button
          onClick={() => setCommentsVisible((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
            commentsVisible
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : "bg-slate-100 text-slate-400 line-through"
          }`}
          title={commentsVisible ? "Hide comments" : "Show comments"}
        >
          {commentsVisible ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
          Comments
        </button>
        <button
          onClick={() => setFurnitureVisible((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
            furnitureVisible
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : "bg-slate-100 text-slate-400 line-through"
          }`}
          title={furnitureVisible ? "Hide furniture" : "Show furniture"}
        >
          {furnitureVisible ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
          Furniture
        </button>
        <button
          onClick={() => setWallVisible((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
            wallVisible
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : "bg-slate-100 text-slate-400 line-through"
          }`}
          title={wallVisible ? "Hide wall changes" : "Show wall changes"}
        >
          {wallVisible ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
          Wall Changes
        </button>
      </div>

      {/* PDF Card - Fixed height container with scroll */}
      <div className="flex-1 bg-white shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col">
        {/* PDF Viewport - Scrollable area */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden bg-slate-100 flex items-start justify-start"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="relative transition-transform"
            ref={pdfWrapperRef}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
          >
            {!pdfObjectURL && !loadError && (
              <div className="w-[600px] h-[800px] flex items-center justify-center bg-white rounded-lg">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              </div>
            )}

            {loadError && (
              <div className="w-[600px] h-[800px] flex flex-col items-center justify-center bg-white rounded-lg text-red-500 p-10 text-center">
                <AlertCircle className="w-10 h-10 mb-4 opacity-50" />
                <p className="font-semibold mb-2">Failed to load PDF.</p>
                <p className="text-sm text-slate-500 mb-4">
                  Ensure the file is a valid PDF and try again.
                </p>
                <div className="text-xs bg-red-50 p-2 rounded border border-red-100 max-w-md break-all">
                  <span className="font-bold">Error Details:</span>{" "}
                  {loadError.message}
                </div>
              </div>
            )}

            {pdfObjectURL && !loadError && (
              <Document
                key={pdfObjectURL} // Force remount when PDF changes to prevent stale access
                file={pdfObjectURL}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                options={pdfOptions}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onClick={handlePdfClick}
                  className="rounded-lg overflow-hidden cursor-crosshair shadow-lg"
                />
              </Document>
            )}

            {/* Wall Change Layer */}
            {!loadError && (
              <WallLayer
                pdfWrapperRef={pdfWrapperRef}
                pdfScale={scale}
                scale={projectScale}
                pageNumber={pageNumber}
                wallItems={wallItems}
                maskItems={maskItems}
                visible={wallVisible}
                tool={wallTool}
                active={mode === "wall"}
                selection={selectedWall}
                onSelect={setSelectedWall}
                onUpdateWalls={onUpdateWallItems || (() => {})}
                onUpdateMasks={onUpdateMaskItems || (() => {})}
                canEdit={canEditWalls}
                currentUser={currentUser}
              />
            )}

            {/* Furniture Layer */}
            {!loadError && (
              <FurnitureLayer
                pdfWrapperRef={pdfWrapperRef}
                pdfScale={scale}
                scale={projectScale}
                pageNumber={pageNumber}
                items={furnitureItems}
                visible={furnitureVisible}
                active={mode === "furniture"}
                selectedId={selectedFurnitureId}
                onSelect={setSelectedFurnitureId}
                onUpdate={onUpdateFurnitureItems || (() => {})}
                canEdit={canEditFurniture}
              />
            )}

            {/* Calibration Overlay */}
            {!loadError && mode === "calibrate" && currentUser && (
              <CalibrationOverlay
                pdfWrapperRef={pdfWrapperRef}
                pdfScale={scale}
                pageNumber={pageNumber}
                currentUser={currentUser}
                lengthSystem={lengthSystem}
                onCommit={handleCommitScale}
                onCancel={handleCancelCalibrate}
              />
            )}

            {/* Existing Comment Pins - Only show if not error */}
            {!loadError && commentsVisible &&
              visibleComments.map(({ comment, distance }, idx) => {
                const fade = Math.max(0.25, 1 - distance * 0.2);
                const isDraggable =
                  !comment.deleted &&
                  (isOwner || comment.author === currentUserRole);
                const isBeingDragged = draggedCommentId === comment.id;
                const displayX =
                  isBeingDragged && draggedItemPosition
                    ? draggedItemPosition.x
                    : comment.x;
                const displayY =
                  isBeingDragged && draggedItemPosition
                    ? draggedItemPosition.y
                    : comment.y;

                return (
                  <button
                    key={comment.id}
                    onMouseDown={(e) => {
                      if (isDraggable) {
                        handleCommentMouseDown(
                          e,
                          comment.id,
                          comment.x,
                          comment.y,
                        );
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCommentId(comment.id);
                      onFocusComment?.(comment.id);
                    }}
                    className={`absolute w-8 h-8 -ml-4 -mt-8 transform transition-all duration-200 hover:scale-110 z-10 group ${activeCommentId === comment.id ? "scale-150 z-30" : ""
                      } ${comment.deleted ? "opacity-50 grayscale" : ""} ${isDraggable ? "cursor-move" : "cursor-pointer"
                      }`}
                    style={{
                      left: `${displayX}%`,
                      top: `${displayY}%`,
                      zIndex: isBeingDragged ? 100 : undefined,
                    }}
                  >
                    <div
                      className={`relative flex items-center justify-center w-full h-full rounded-full shadow-lg border-2 transition-all duration-200 
                  ${comment.deleted
                          ? "bg-red-100 border-red-200"
                          : comment.resolved
                            ? "bg-slate-400 border-slate-500"
                            : comment.author === currentUserRole
                              ? "bg-indigo-600 border-indigo-200 ring-2 ring-indigo-400" // Emphasis for own comments
                              : comment.author === UserRole.DESIGNER
                                ? "bg-purple-600 border-white"
                                : "bg-blue-500 border-white"
                        } ${activeCommentId === comment.id ? "ring-4 ring-indigo-300/50 shadow-xl" : ""}`}
                      style={{ opacity: fade }}
                    >
                      {comment.deleted ? (
                        <X className="w-4 h-4 text-red-500" />
                      ) : (
                        <span className="text-white text-xs font-bold">
                          {idx + 1}
                        </span>
                      )}

                      {/* Tooltip on hover - Full text */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs py-2 px-3 rounded shadow-xl pointer-events-none z-50">
                        <p className="line-clamp-3">{comment.text}</p>
                        <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                    {/* Arrow pointer */}
                    {!comment.deleted && (
                      <div
                        className={`absolute top-full left-1/2 -ml-1 -mt-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${comment.resolved
                          ? "border-t-slate-400"
                          : comment.author === UserRole.DESIGNER
                            ? "border-t-purple-600"
                            : "border-t-indigo-600"
                          }`}
                        style={{ opacity: fade }}
                      ></div>
                    )}
                  </button>
                );
              })}

            {/* New Comment Form */}
            {!loadError &&
              tempMarker &&
              (() => {
                const isLowY = tempMarker.y < 25;
                const isLeftX = tempMarker.x < 15;
                const isRightX = tempMarker.x > 85;

                return (
                  <div
                    className="absolute bg-white rounded-lg shadow-2xl p-4 w-80 z-30 border border-slate-200"
                    style={{
                      left: `${tempMarker.x}%`,
                      top: `${tempMarker.y}%`,
                      transform: `translate(${isLeftX ? "0%" : isRightX ? "-100%" : "-50%"}, ${isLowY ? "20px" : "calc(-100% - 20px)"})`,
                    }}
                  >
                    {/* Arrow pointing to marker */}
                    <div
                      className={`absolute w-4 h-4 bg-white border-slate-200 transform rotate-45 ${isLowY
                        ? "-top-2 border-t border-l"
                        : "top-full -mt-2 border-b border-r"
                        }`}
                      style={{
                        left: isLeftX
                          ? "20px"
                          : isRightX
                            ? "calc(100% - 36px)"
                            : "calc(50% - 8px)",
                      }}
                    ></div>

                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        New Note
                      </span>
                      <button
                        onClick={() => setTempMarker(null)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <MentionInput
                      autoFocus
                      value={commentText}
                      onChange={(val, newMentions) => {
                        setCommentText(val);
                        setPendingMentions(newMentions);
                      }}
                      collaborators={collaborators}
                      placeholder="Type your feedback here... Use @ to mention"
                      currentUserEmail={currentUserEmail}
                      className="mb-3 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          handleSubmitComment();
                        }
                      }}
                      minHeight="80px"
                    />

                    <div className="flex items-center justify-between">
                      <label
                        className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none px-2 py-1.5 rounded transition-colors ${useAI ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={useAI}
                          onChange={(e) => setUseAI(e.target.checked)}
                          className="hidden"
                        />
                        <Sparkles
                          className={`w-3.5 h-3.5 ${useAI ? "text-indigo-500" : "text-slate-400"}`}
                        />
                        {useAI ? "AI Analysis On" : "AI Analysis Off"}
                      </label>

                      <button
                        onClick={handleSubmitComment}
                        disabled={!commentText.trim() || isAnalyzing}
                        className="bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-xs font-medium"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            Post
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}

            {/* Indicator for creation point */}
            {!loadError && tempMarker && (
              <div
                className="absolute w-4 h-4 bg-indigo-500/50 rounded-full -ml-2 -mt-2 animate-ping pointer-events-none"
                style={{ left: `${tempMarker.x}%`, top: `${tempMarker.y}%` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Furniture inspector (top-left) */}
      {selectedFurniture && canEditFurniture && (
        <FurnitureInspector
          item={selectedFurniture}
          lengthSystem={lengthSystem}
          onChange={handleUpdateSelectedFurniture}
          onDelete={handleDeleteSelectedFurniture}
          onClose={() => setSelectedFurnitureId(null)}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
        />
      )}

      {/* Wall inspector (top-left) */}
      {selectedWallItem && canEditWalls && (
        <WallInspector
          wall={selectedWallItem}
          lengthSystem={lengthSystem}
          onChange={handleUpdateSelectedWall}
          onDelete={handleDeleteSelectedWall}
          onClose={() => setSelectedWall(null)}
        />
      )}

      {/* Mask inspector (top-left) */}
      {selectedMaskItem && canEditWalls && (
        <MaskInspector
          mask={selectedMaskItem}
          lengthSystem={lengthSystem}
          onChange={handleUpdateSelectedMask}
          onDelete={handleDeleteSelectedMask}
          onClose={() => setSelectedWall(null)}
        />
      )}
    </div>
  );
};
