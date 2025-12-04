import React, { useState, useRef, useEffect } from 'react';
import { Comment, UserRole } from '../types';
import { Plus, Loader2, ZoomIn, ZoomOut, Sparkles, X, AlertCircle, Upload } from 'lucide-react';
import { VersionSelectorDetailed } from './VersionSelector';
import * as geminiService from '../services/geminiService';

interface ImageWorkspaceProps {
    fileUrl: string;
    comments: Comment[];
    onAddComment: (comment: Omit<Comment, 'id' | 'timestamp' | 'resolved'>) => void;
    activeCommentId: string | null;
    setActiveCommentId: (id: string | null) => void;
    currentUserRole: UserRole;
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
    canAddComment = true
}) => {
    const [isAddingComment, setIsAddingComment] = useState(false);
    const [tempMarker, setTempMarker] = useState<{ x: number; y: number } | null>(null);
    const [commentText, setCommentText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [panOffset, setPanOffset] = useState(initialPanOffset);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

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

    const handleImageClick = (e: React.MouseEvent) => {
        // Don't create comments if we were dragging/panning
        if (hasDraggedRef.current) {
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
        setCommentText('');
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
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

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

                    const base64 = canvas.toDataURL('image/png');
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
            pageNumber: 1, // Images only have one "page"
            text: commentText,
            author: currentUserRole,
            aiAnalysis
        });

        setTempMarker(null);
        setCommentText('');
    };

    // All comments are visible (images don't have pages)
    // Filter comments for the current page (images only have one "page") and status
    const visibleComments = comments.filter(c => {
        if ((c.pageNumber || 1) !== 1) return false;

        // Status filters
        if (c.deleted) return filter.deleted;
        if (c.resolved) return filter.resolved;
        return filter.active;
    });

    return (
        <div className="flex-1 bg-slate-200/50 flex flex-col h-full">
            {/* Version Toolbar */}
            {(versions && versions.length > 0) || canUploadVersion ? (
                <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {versions && versions.length > 0 && onVersionChange && currentVersionId && (
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

            {/* Main Content */}
            <div className="flex-1 bg-white shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col">
                {/* Image Viewport */}
                <div
                    ref={viewportRef}
                    className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center"
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            transformOrigin: 'center center'
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
                                <p className="text-sm text-slate-500">Ensure the file is a valid image and try again.</p>
                            </div>
                        )}

                        <div className="relative" onClick={handleImageClick} style={{ cursor: 'crosshair' }}>
                            <img
                                ref={imageRef}
                                src={fileUrl}
                                alt="Design"
                                crossOrigin="anonymous"
                                className="max-w-full h-auto rounded-lg shadow-lg ImageWorkspace"
                                style={{ display: imageLoaded ? 'block' : 'none' }}
                                onLoad={() => {
                                    setImageLoaded(true);
                                    setImageError(false);
                                }}
                                onError={() => {
                                    setImageError(true);
                                    setImageLoaded(false);
                                }}
                            />

                            {/* Existing Comment Pins */}
                            {imageLoaded && visibleComments.map((comment) => (
                                <button
                                    key={comment.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCommentId(comment.id);
                                        onFocusComment?.(comment.id);
                                    }}
                                    className={`absolute w-8 h-8 -ml-4 -mt-8 transform transition-all duration-200 hover:scale-110 z-10 group ${activeCommentId === comment.id ? 'scale-150 z-30' : ''
                                        } ${comment.deleted ? 'opacity-50 grayscale' : ''} `}
                                    style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
                                >
                                    <div
                                        className={`relative flex items-center justify-center w-full h-full rounded-full shadow-lg border-2 transition-all duration-200 
                                            ${comment.deleted ? 'bg-red-100 border-red-200' :
                                                comment.resolved ? 'bg-slate-400 border-slate-500' :
                                                    comment.author === currentUserRole ? 'bg-indigo-600 border-indigo-200 ring-2 ring-indigo-400' : // Emphasis for own comments
                                                        comment.author === UserRole.DESIGNER ? 'bg-purple-600 border-white' : 'bg-blue-500 border-white'
                                            } ${activeCommentId === comment.id ? 'ring-4 ring-indigo-300/50 shadow-xl' : ''} `}
                                    >
                                        {comment.deleted ? (
                                            <X className="w-4 h-4 text-red-500" />
                                        ) : (
                                            <span className="text-white text-xs font-bold">
                                                {comments.indexOf(comment) + 1}
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
                                            className={`absolute top-full left-1/2 -ml-1 -mt-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${comment.resolved ? 'border-t-slate-400' :
                                                comment.author === UserRole.DESIGNER ? 'border-t-purple-600' : 'border-t-indigo-600'
                                                } `}
                                        ></div>
                                    )}
                                </button>
                            ))}

                            {/* New Comment Form */}
                            {imageLoaded && tempMarker && (
                                <div
                                    className="absolute bg-white rounded-lg shadow-2xl p-4 w-80 z-30 border border-slate-200"
                                    style={{
                                        left: `${tempMarker.x}% `,
                                        top: `${tempMarker.y}% `,
                                        transform: 'translate(-50%, calc(-100% - 20px))'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45"></div>

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
                                            className={`flex items - center gap - 1.5 text - xs font - medium cursor - pointer select - none px - 2 py - 1.5 rounded transition - colors ${useAI
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'text-slate-500 hover:bg-slate-50'
                                                } `}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={useAI}
                                                onChange={(e) => setUseAI(e.target.checked)}
                                                className="hidden"
                                            />
                                            <Sparkles
                                                className={`w - 3.5 h - 3.5 ${useAI ? 'text-indigo-500' : 'text-slate-400'} `}
                                            />
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
                            {imageLoaded && tempMarker && (
                                <div
                                    className="absolute w-4 h-4 bg-indigo-500/50 rounded-full -ml-2 -mt-2 animate-ping pointer-events-none"
                                    style={{ left: `${tempMarker.x}% `, top: `${tempMarker.y}% ` }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
