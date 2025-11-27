import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Comment, UserRole } from '../types';
import { PDF_WORKER_URL } from '../constants';
import { Plus, Loader2, ZoomIn, ZoomOut, Sparkles, X, AlertCircle } from 'lucide-react';
import * as geminiService from '../services/geminiService';
import { getPDFObjectURL, revokePDFObjectURL } from '../utils/pdfUtils';

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
  setScale
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [pdfObjectURL, setPdfObjectURL] = useState<string | null>(null);

  // Pan/drag state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Convert Firebase Storage URL to object URL to bypass CORS
  useEffect(() => {
    let isMounted = true;

    const loadPDF = async () => {
      console.log('[PDFWorkspace] Loading PDF from URL:', fileUrl);
      try {
        const objectURL = await getPDFObjectURL(fileUrl);
        console.log('[PDFWorkspace] Converted to proxy URL:', objectURL);
        if (isMounted) {
          setPdfObjectURL(objectURL);
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
      if (pdfObjectURL) {
        revokePDFObjectURL(pdfObjectURL);
      }
    };
  }, [fileUrl]);

  // Reset pan when scale changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [scale, pageNumber]);


  // Temporary marker for new comment creation
  const [tempMarker, setTempMarker] = useState<{ x: number, y: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [useAI, setUseAI] = useState(false);

  const pdfWrapperRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF Load Error:", error);
    setLoadError(error);
  };

  // Pan/drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) { // Only allow panning when zoomed in
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handlePdfClick = (e: React.MouseEvent) => {
    // Don't create comments when dragging
    if (isDragging) return;

    if (!pdfWrapperRef.current) return;

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

  // Filter comments for the current page
  // Legacy comments without pageNumber (undefined) will be shown on page 1 or handled gracefully
  const visibleComments = comments.filter(c => (c.pageNumber || 1) === pageNumber);

  return (
    <div className="flex-1 bg-slate-200/50 flex flex-col h-full">
      {/* Page Navigation Toolbar */}
      {!loadError && numPages && numPages > 1 && (
        <div className="mt-4 mb-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm flex items-center gap-4 border border-white/50 w-fit mx-auto">
          <button
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(prev => prev - 1)}
            className="text-slate-500 disabled:opacity-30 hover:text-indigo-600 text-sm font-medium"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600 font-medium">Page {pageNumber} of {numPages}</span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(prev => prev + 1)}
            className="text-slate-500 disabled:opacity-30 hover:text-indigo-600 text-sm font-medium"
          >
            Next
          </button>
        </div>
      )}

      {/* PDF Card - Fixed height container with scroll */}
      <div className="flex-1 bg-white shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col">
        {/* PDF Viewport - Scrollable area */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden bg-slate-100 flex items-start justify-start"
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
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
                }}
                className={`absolute w-8 h-8 -ml-4 -mt-8 transform transition-all duration-200 hover:scale-110 z-10 group ${activeCommentId === comment.id ? 'scale-125 z-20' : ''
                  }`}
                style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
              >
                <div className={`relative flex items-center justify-center w-full h-full rounded-full shadow-lg border-2 border-white ${comment.resolved ? 'bg-slate-400' : comment.author === UserRole.DESIGNER ? 'bg-purple-600' : 'bg-indigo-600'
                  }`}>
                  <span className="text-white text-xs font-bold">{
                    // Initials or number could go here, simple dot for now
                    comments.indexOf(comment) + 1
                  }</span>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-slate-800 text-white text-xs py-1 px-2 rounded pointer-events-none">
                    {comment.author}: {comment.text.substring(0, 20)}...
                  </div>
                </div>
                {/* Arrow pointer */}
                <div className={`absolute top-full left-1/2 -ml-1 -mt-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${comment.resolved ? 'border-t-slate-400' : comment.author === UserRole.DESIGNER ? 'border-t-purple-600' : 'border-t-indigo-600'
                  }`}></div>
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