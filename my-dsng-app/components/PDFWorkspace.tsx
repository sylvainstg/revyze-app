import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Comment, UserRole } from '../types';
import { PDF_WORKER_URL } from '../constants';
import { Plus, Loader2, ZoomIn, ZoomOut, Sparkles, X, AlertCircle, Upload } from 'lucide-react';
import * as geminiService from '../services/geminiService';
import { getPDFObjectURL, revokePDFObjectURL } from '../utils/pdfUtils';
import { VersionSelectorDetailed } from './VersionSelector';

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

// Options to ensure character maps load correctly from CDN
const pdfOptions = {
  cMapUrl: 'https://aistudiocdn.com/pdfjs-dist@4.4.168/cmaps/',
  cMapPacked: true,
};

interface PDFWorkspaceProps {
  fileUrl: string;
  comments: Comment[];
  onAddComment: (comment: Omit<Comment, 'id' | 'timestamp' | 'resolved'>) => void;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  currentUserRole: UserRole;
  pageNumber: number;
  setPageNumber: (page: number) => void;
  scale: number;
  setScale: (scale: number | ((prev: number) => number)) => void;
  filter: { active: boolean; resolved: boolean; deleted: boolean };
  // Version management props
  versions?: any[];
  currentVersionId?: string;
  onVersionChange?: (versionId: string) => void;
  onUploadNewVersion?: () => void;
  canUploadVersion?: boolean;
  onEditVersion?: (versionId: string) => void;
  initialPanOffset?: { x: number, y: number };
  onPanChange?: (offset: { x: number, y: number }) => void;
  onFocusComment?: (commentId: string) => void;
  canAddComment?: boolean;
  onCaptureThumbnail?: () => void;
  onSetDefaultPage?: (page: number) => void;
  isDefaultPage?: boolean;
}

export const PDFWorkspace: React.FC<PDFWorkspaceProps> = ({
  fileUrl,
  comments,
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
  onCaptureThumbnail,
  onSetDefaultPage,
  isDefaultPage = false
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [tempMarker, setTempMarker] = useState<{ x: number; y: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [panOffset, setPanOffset] = useState(initialPanOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [pdfObjectURL, setPdfObjectURL] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [defaultPageSet, setDefaultPageSet] = useState(false);
  const [thumbnailSet, setThumbnailSet] = useState(false);

  const hasDraggedRef = useRef(false); // Track if actual movement occurred
  const viewportRef = useRef<HTMLDivElement>(null);

  // Update pan offset when initialPanOffset changes (e.g. when category switches)
  useEffect(() => {
    setPanOffset(initialPanOffset);
  }, [initialPanOffset]);

  // Notify parent of pan changes only when dragging ends (handled in mouseUp)

  // Handle Esc key to close comment popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (tempMarker) {
          setTempMarker(null);
          setCommentText('');
          setUseAI(false);
        }
        if (activeCommentId) {
          setActiveCommentId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tempMarker, activeCommentId, setTempMarker, setCommentText, setActiveCommentId]);

  // Convert Firebase Storage URL to object URL to bypass CORS
  useEffect(() => {
    let isMounted = true;
    let currentObjectURL: string | null = null;

    const loadPDF = async () => {
      console.log('[PDFWorkspace] Loading PDF from URL:', fileUrl);

      // Clean up previous object URL before loading new one
      if (pdfObjectURL) {
        console.log('[PDFWorkspace] Revoking previous PDF object URL');
        revokePDFObjectURL(pdfObjectURL);
        setPdfObjectURL(null);
      }

      try {
        const objectURL = await getPDFObjectURL(fileUrl);
        console.log('[PDFWorkspace] Converted to proxy URL:', objectURL);
        currentObjectURL = objectURL;

        if (isMounted) {
          setPdfObjectURL(objectURL);
        } else {
          // Component unmounted during load, clean up immediately
          revokePDFObjectURL(objectURL);
        }
      } catch (error) {
        console.error('[PDFWorkspace] Failed to load PDF:', error);
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
        console.log('[PDFWorkspace] Cleanup: Revoking PDF object URL');
        revokePDFObjectURL(currentObjectURL);
      }
    };
  }, [fileUrl]);



  const pdfWrapperRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(null);
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
  };

  // Pan/drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow panning at all zoom levels
    setIsDragging(true);
    hasDraggedRef.current = false; // Reset drag flag
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      hasDraggedRef.current = true; // Mark that we have moved
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onPanChange?.(panOffset);
    }
  };

  const handlePdfClick = (e: React.MouseEvent) => {
    // Don't create comments if we were dragging/panning
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false; // Reset for next time
      return;
    }

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
    setCommentText('');
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
        const canvas = document.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
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

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = sw;
          tempCanvas.height = sh;
          const ctx = tempCanvas.getContext('2d');
          ctx?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

          const base64 = tempCanvas.toDataURL('image/png');
          aiAnalysis = await geminiService.analyzeDesignArea(base64, commentText);
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
      aiAnalysis
    });

    setTempMarker(null);
    setCommentText('');
  };

  // Filter comments for the current page and status
  const visibleComments = comments.filter(c => {
    if ((c.pageNumber || 1) !== pageNumber) return false;

    // Status filters
    if (c.deleted) return filter.deleted;
    if (c.resolved) return filter.resolved;
    return filter.active;
  });

  return (
    <div className="flex-1 bg-slate-200/50 flex flex-col h-full">
      {/* Version Toolbar */}
      {(versions && versions.length > 0) || canUploadVersion ? (
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {versions && versions.length > 0 && currentVersionId && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Version:</span>
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
              {numPages && numPages > 1 && (
                <div id="page-navigation" className="flex items-center gap-2">
                  <button
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber(prev => prev - 1)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-700 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-700 transition-all shadow-sm text-sm font-medium"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600 font-medium whitespace-nowrap">Page {pageNumber} of {numPages}</span>
                  <button
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber(prev => prev + 1)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-700 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-700 transition-all shadow-sm text-sm font-medium"
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Zoom Controls */}
              <div id="zoom-controls" className="flex items-center gap-2 border-l border-slate-300 pl-4">
                <button
                  onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
                  className="p-2 bg-white border border-slate-200 rounded-full text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                  title="Zoom out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <button
                  onClick={() => setScale(prev => Math.min(5, prev + 0.1))}
                  className="p-2 bg-white border border-slate-200 rounded-full text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                  title="Zoom in"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </button>
              </div>

              {/* Plan Preferences Menu */}
              <div id="plan-preferences" className="relative group border-l border-slate-300 pl-4">
                <button className="px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm text-sm font-medium flex items-center gap-1">
                  Plan Preferences
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                <div className="fixed bg-white border border-slate-200 rounded-lg shadow-2xl py-1 min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200" style={{ zIndex: 99999, marginTop: '0.5rem' }}>
                  <button
                    onClick={() => {
                      if (onSetDefaultPage) {
                        onSetDefaultPage(pageNumber);
                        setDefaultPageSet(true);
                        setTimeout(() => setDefaultPageSet(false), 2000);
                      }
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${defaultPageSet || isDefaultPage
                      ? 'bg-green-50 text-green-700'
                      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {defaultPageSet ? 'Default page set!' : isDefaultPage ? 'Default page' : 'Set this page as default'}
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
                      ? 'bg-green-50 text-green-700'
                      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {thumbnailSet ? 'Thumbnail set!' : 'Set this page as thumbnail'}
                  </button>
                </div>
              </div>
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

      {/* PDF Card - Fixed height container with scroll */}
      <div className="flex-1 bg-white shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col">
        {/* PDF Viewport - Scrollable area */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden bg-slate-100 flex items-start justify-start"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <Document
              key={pdfObjectURL} // Force remount when PDF changes to prevent stale access
              file={pdfObjectURL}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              options={pdfOptions}
              loading={
                <div className="w-[600px] h-[800px] flex items-center justify-center bg-white rounded-lg">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                </div>
              }
              error={
                <div className="w-[600px] h-[800px] flex flex-col items-center justify-center bg-white rounded-lg text-red-500 p-10 text-center">
                  <AlertCircle className="w-10 h-10 mb-4 opacity-50" />
                  <p className="font-semibold mb-2">Failed to load PDF.</p>
                  <p className="text-sm text-slate-500 mb-4">Ensure the file is a valid PDF and try again.</p>
                  {loadError && (
                    <div className="text-xs bg-red-50 p-2 rounded border border-red-100 max-w-md break-all">
                      <span className="font-bold">Error Details:</span> {loadError.message}
                    </div>
                  )}
                </div>
              }
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

            {/* Existing Comment Pins - Only show if not error */}
            {!loadError && visibleComments.map((comment) => (
              <button
                key={comment.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveCommentId(comment.id);
                  onFocusComment?.(comment.id);
                }}
                className={`absolute w-8 h-8 -ml-4 -mt-8 transform transition-all duration-200 hover:scale-110 z-10 group ${activeCommentId === comment.id ? 'scale-150 z-30' : ''
                  } ${comment.deleted ? 'opacity-50 grayscale' : ''}`}
                style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
              >
                <div className={`relative flex items-center justify-center w-full h-full rounded-full shadow-lg border-2 transition-all duration-200 
                  ${comment.deleted ? 'bg-red-100 border-red-200' :
                    comment.resolved ? 'bg-slate-400 border-slate-500' :
                      comment.author === currentUserRole ? 'bg-indigo-600 border-indigo-200 ring-2 ring-indigo-400' : // Emphasis for own comments
                        comment.author === UserRole.DESIGNER ? 'bg-purple-600 border-white' : 'bg-blue-500 border-white'
                  } ${activeCommentId === comment.id ? 'ring-4 ring-indigo-300/50 shadow-xl' : ''}`}>

                  {comment.deleted ? (
                    <X className="w-4 h-4 text-red-500" />
                  ) : (
                    <span className="text-white text-xs font-bold">{
                      // Use findIndex with ID comparison (same as CollaborationPanel)
                      comments.findIndex(c => c.id === comment.id) + 1
                    }</span>
                  )}

                  {/* Tooltip on hover - Full text */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs py-2 px-3 rounded shadow-xl pointer-events-none z-50">
                    <p className="line-clamp-3">{comment.text}</p>
                    <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
                {/* Arrow pointer */}
                {!comment.deleted && (
                  <div className={`absolute top-full left-1/2 -ml-1 -mt-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${comment.resolved ? 'border-t-slate-400' :
                    comment.author === UserRole.DESIGNER ? 'border-t-purple-600' : 'border-t-indigo-600'
                    }`}></div>
                )}
              </button>
            ))}

            {/* New Comment Form */}
            {!loadError && tempMarker && (
              <div
                className="absolute bg-white rounded-lg shadow-2xl p-4 w-80 z-30 border border-slate-200"
                style={{
                  left: `${tempMarker.x}%`,
                  top: `${tempMarker.y}%`,
                  transform: 'translate(-50%, calc(-100% - 20px))'
                }}
              >
                <div className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45"></div>

                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">New Note</span>
                  <button onClick={() => setTempMarker(null)} className="text-slate-400 hover:text-slate-600">
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
                  <label className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none px-2 py-1.5 rounded transition-colors ${useAI ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={useAI}
                      onChange={(e) => setUseAI(e.target.checked)}
                      className="hidden"
                    />
                    <Sparkles className={`w-3.5 h-3.5 ${useAI ? 'text-indigo-500' : 'text-slate-400'}`} />
                    {useAI ? 'AI Analysis On' : 'AI Analysis Off'}
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
            )}

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
    </div>
  );
};