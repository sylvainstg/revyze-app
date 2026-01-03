import React, { useState, useRef, useEffect } from "react";
import { Comment, UserRole } from "../types";
import {
  Plus,
  Loader2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  X,
  Upload,
} from "lucide-react";
import { VersionSelectorDetailed } from "./VersionSelector";
import * as geminiService from "../services/geminiService";
import { getFileObjectURL, revokeFileObjectURL } from "../utils/pdfUtils";

interface ImageWorkspaceProps {
  fileUrl: string;
  comments: Comment[];
  onAddComment: (
    comment: Omit<Comment, "id" | "timestamp" | "resolved">,
  ) => void;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  currentUserRole: UserRole;
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
  showPreviousVersionComments?: boolean;
  onTogglePreviousComments?: (value: boolean) => void;
  onCaptureThumbnail?: () => void;
  onUpdateCommentPosition?: (
    commentId: string,
    position: { x: number; y: number },
  ) => void;
  isOwner?: boolean;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
  fileUrl,
  comments,
  onAddComment,
  activeCommentId,
  setActiveCommentId,
  currentUserRole,
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
  showPreviousVersionComments = false,
  onTogglePreviousComments,
  onCaptureThumbnail,
  onUpdateCommentPosition,
  isOwner = false,
}) => {
  const [tempMarker, setTempMarker] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [commentText, setCommentText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [panOffset, setPanOffset] = useState(initialPanOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedCommentId, setDraggedCommentId] = useState<string | null>(null); // For comment moving
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

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [proxiedFileUrl, setProxiedFileUrl] = useState<string | null>(null);
  const [thumbnailSet, setThumbnailSet] = useState(false);

  // Convert Firebase Storage URL to object URL to bypass CORS
  useEffect(() => {
    setImageError(false);
    let isMounted = true;
    let currentObjectURL: string | null = null;

    const loadImage = async () => {
      console.log("[ImageWorkspace] Loading image from URL:", fileUrl);

      // Clean up previous object URL
      if (proxiedFileUrl) {
        revokeFileObjectURL(proxiedFileUrl);
        setProxiedFileUrl(null);
      }

      try {
        const objectURL = await getFileObjectURL(fileUrl);
        currentObjectURL = objectURL;

        if (isMounted) {
          setProxiedFileUrl(objectURL);
        } else {
          revokeFileObjectURL(objectURL);
        }
      } catch (error) {
        console.error("[ImageWorkspace] Failed to load image proxy:", error);
        if (isMounted) {
          setProxiedFileUrl(fileUrl); // Fallback
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (currentObjectURL) {
        revokeFileObjectURL(currentObjectURL);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  // Update pan offset when initialPanOffset changes
  useEffect(() => {
    setPanOffset(initialPanOffset);
  }, [initialPanOffset]);

  // Notify parent of pan changes only when dragging ends (handled in mouseUp)
  // useEffect(() => {
  //     onPanChange?.(panOffset);
  // }, [panOffset, onPanChange]);

  // Pan/drag state
  const hasDraggedRef = useRef(false); // Track if actual movement occurred
  const viewportRef = useRef<HTMLDivElement>(null);

  const [useAI, setUseAI] = useState(false);

  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

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
    if (draggedCommentId) return;
    // Allow panning at all zoom levels
    setIsDragging(true);
    hasDraggedRef.current = false; // Reset drag flag
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Handle Comment Dragging
    if (draggedCommentId && commentDragStart && imageWrapperRef.current) {
      const rect = imageWrapperRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - commentDragStart.startX) / rect.width) * 100;
      const deltaY =
        ((e.clientY - commentDragStart.startY) / rect.height) * 100;

      setDraggedItemPosition({
        x: Math.min(100, Math.max(0, commentDragStart.x + deltaX)),
        y: Math.min(100, Math.max(0, commentDragStart.y + deltaY)),
      });
      return;
    }

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

  const handleImageClick = (e: React.MouseEvent) => {
    // Don't create comments if we were dragging/panning
    if (hasDraggedRef.current || draggedCommentId) {
      hasDraggedRef.current = false; // Reset for next time
      return;
    }

    if (!imageWrapperRef.current) return;

    // Check if commenting is allowed
    if (!canAddComment) {
      setActiveCommentId(null);
      return;
    }

    const rect = imageWrapperRef.current.getBoundingClientRect();
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

    if (useAI && imageRef.current) {
      setIsAnalyzing(true);
      try {
        // Create a canvas to capture the image area
        const img = imageRef.current;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Calculate marker position in pixels
          const markerPxX = (tempMarker.x / 100) * img.naturalWidth;
          const markerPxY = (tempMarker.y / 100) * img.naturalHeight;

          // Crop size
          const cropSize = 500;
          const sx = Math.max(0, markerPxX - cropSize / 2);
          const sy = Math.max(0, markerPxY - cropSize / 2);
          const sw = Math.min(cropSize, img.naturalWidth - sx);
          const sh = Math.min(cropSize, img.naturalHeight - sy);

          canvas.width = sw;
          canvas.height = sh;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

          const base64 = canvas.toDataURL("image/png");
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
      pageNumber: 1, // Images only have one "page"
      text: commentText,
      author: currentUserRole,
      aiAnalysis,
    });

    setTempMarker(null);
    setCommentText("");
  };

  // Build combined comment list (current + previous versions when enabled)
  const buildVisibleComments = () => {
    console.log("[ImageWorkspace] Building visible comments:", {
      totalComments: comments.length,
      currentVersionId,
      showPreviousVersionComments,
    });

    let versionsOrdered = versions
      ? [...versions].sort(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0),
        )
      : [];
    const currentIdx = versionsOrdered.findIndex(
      (v) => v.id === currentVersionId,
    );
    if (currentIdx === -1) {
      console.warn("[ImageWorkspace] currentVersionId not found in versions!", {
        currentVersionId,
        versionsCount: versions?.length,
      });
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
        // For images, we accept page 1 or undefined
        if (c.pageNumber && c.pageNumber !== 1) return;

        if (c.deleted && !filter.deleted) return;
        if (c.resolved && !filter.resolved) return;
        if (!c.resolved && !c.deleted && !filter.active) return;

        collected.push({ comment: c, distance });
      });
    });

    console.log("[ImageWorkspace] Visible comments built:", collected.length);
    return collected;
  };

  const visibleComments = buildVisibleComments();

  return (
    <div className="flex-1 bg-slate-200/50 flex flex-col h-full">
      {/* Version Toolbar */}
      {(versions && versions.length > 0) || canUploadVersion ? (
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {versions &&
              versions.length > 0 &&
              onVersionChange &&
              currentVersionId && (
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
          <div className="flex items-center gap-3">
            {versions && versions.length > 1 && (
              <label className="flex items-center gap-2 text-xs font-medium text-indigo-900 bg-indigo-50 border border-indigo-300 px-3 py-2 rounded-full shadow cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!showPreviousVersionComments}
                  onChange={(e) => onTogglePreviousComments?.(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-indigo-300 bg-white rounded focus:ring-indigo-500"
                />
                Show previous versions' comments
              </label>
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
        </div>
      ) : null}

      {/* Viewport Toolbar (Zoom + Preferences) */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setScale((prev) => Math.max(0.1, prev - 0.1))}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-600 min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((prev) => Math.min(5, prev + 0.1))}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Plan Preferences Menu - Owner Only */}
          {isOwner && (
            <div
              id="plan-preferences"
              className="relative group border-l border-slate-200 pl-4"
            >
              <button className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 transition-all shadow-sm text-sm font-medium flex items-center gap-1">
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
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100]">
                <button
                  onClick={() => {
                    if (onCaptureThumbnail) {
                      onCaptureThumbnail();
                      setThumbnailSet(true);
                      setTimeout(() => setThumbnailSet(false), 2000);
                    }
                  }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                    thumbnailSet
                      ? "bg-green-50 text-green-700"
                      : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                  }`}
                >
                  <svg
                    className="w-4 h-4 text-indigo-500"
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
                    : "Set as project thumbnail"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col">
        {/* Image Viewport */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="relative transition-transform"
            ref={imageWrapperRef}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
              transformOrigin: "center center",
            }}
          >
            {!imageLoaded && !imageError && (
              <div className="w-[800px] h-[600px] flex items-center justify-center bg-white rounded-lg">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              </div>
            )}

            {imageError && (
              <div className="w-[800px] h-[600px] flex flex-col items-center justify-center bg-white rounded-lg text-red-500 p-10 text-center">
                <p className="font-semibold mb-2">Failed to load image.</p>
                <p className="text-sm text-slate-500">
                  Ensure the file is a valid image and try again.
                </p>
              </div>
            )}

            <div
              className="relative"
              onClick={handleImageClick}
              style={{ cursor: "crosshair" }}
            >
              {proxiedFileUrl && (
                <img
                  ref={imageRef}
                  src={proxiedFileUrl}
                  alt="Design"
                  crossOrigin="anonymous"
                  className="rounded-lg shadow-lg ImageWorkspace"
                  style={{ display: imageLoaded ? "block" : "none" }}
                  onLoad={() => {
                    setImageLoaded(true);
                    setImageError(false);
                  }}
                  onError={() => {
                    setImageError(true);
                    setImageLoaded(false);
                  }}
                />
              )}

              {/* Existing Comment Pins */}
              {imageLoaded &&
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
                      className={`absolute w-8 h-8 -ml-4 -mt-8 transform transition-all duration-200 hover:scale-110 z-10 group ${
                        activeCommentId === comment.id ? "scale-150 z-30" : ""
                      } ${comment.deleted ? "opacity-50 grayscale" : ""} ${
                        isDraggable ? "cursor-move" : "cursor-pointer"
                      }`}
                      style={{
                        left: `${displayX}%`,
                        top: `${displayY}%`,
                        zIndex: isBeingDragged ? 100 : undefined,
                      }}
                    >
                      <div
                        className={`relative flex items-center justify-center w-full h-full rounded-full shadow-lg border-2 transition-all duration-200 
                                            ${
                                              comment.deleted
                                                ? "bg-red-100 border-red-200"
                                                : comment.resolved
                                                  ? "bg-slate-400 border-slate-500"
                                                  : comment.author ===
                                                      currentUserRole
                                                    ? "bg-indigo-600 border-indigo-200 ring-2 ring-indigo-400" // Emphasis for own comments
                                                    : comment.author ===
                                                        UserRole.DESIGNER
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
                          className={`absolute top-full left-1/2 -ml-1 -mt-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${
                            comment.resolved
                              ? "border-t-slate-400"
                              : comment.author === UserRole.DESIGNER
                                ? "border-t-purple-600"
                                : "border-t-indigo-600"
                          } `}
                          style={{ opacity: fade }}
                        ></div>
                      )}
                    </button>
                  );
                })}

              {/* New Comment Form */}
              {imageLoaded &&
                tempMarker &&
                (() => {
                  const isLowY = tempMarker.y < 25;
                  const isLeftX = tempMarker.x < 15;
                  const isRightX = tempMarker.x > 85;

                  return (
                    <div
                      className="absolute bg-white rounded-lg shadow-2xl p-4 w-80 z-30 border border-slate-200"
                      style={{
                        left: `${tempMarker.x}% `,
                        top: `${tempMarker.y}% `,
                        transform: `translate(${isLeftX ? "0%" : isRightX ? "-100%" : "-50%"}, ${isLowY ? "20px" : "calc(-100% - 20px)"})`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Arrow pointing to marker */}
                      <div
                        className={`absolute w-4 h-4 bg-white border-slate-200 transform rotate-45 ${
                          isLowY
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

                      <textarea
                        autoFocus
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none mb-3 bg-white text-slate-900 placeholder:text-slate-400"
                        placeholder="Type your feedback here..."
                        rows={3}
                      />

                      <div className="flex items-center justify-between">
                        <label
                          className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none px-2 py-1.5 rounded transition-colors ${
                            useAI
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-slate-500 hover:bg-slate-50"
                          }`}
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
              {imageLoaded && tempMarker && (
                <div
                  className="absolute w-4 h-4 bg-indigo-500/50 rounded-full -ml-2 -mt-2 animate-ping pointer-events-none"
                  style={{
                    left: `${tempMarker.x}% `,
                    top: `${tempMarker.y}% `,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
