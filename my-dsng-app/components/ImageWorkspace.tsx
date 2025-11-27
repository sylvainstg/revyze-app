import React, { useState, useRef } from 'react';
import { Comment, UserRole } from '../types';
import { Plus, Loader2, X, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import * as geminiService from '../services/geminiService';

interface ImageWorkspaceProps {
    fileUrl: string;
    comments: Comment[];
    onAddComment: (comment: Omit<Comment, 'id' | 'timestamp' | 'resolved' | 'audience'>) => void;
    activeCommentId: string | null;
    setActiveCommentId: (id: string | null) => void;
    currentUserRole: UserRole;
    scale: number;
    setScale: (scale: number | ((prev: number) => number)) => void;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
    fileUrl,
    comments,
    onAddComment,
    activeCommentId,
    setActiveCommentId,
    currentUserRole,
    scale,
    setScale
}) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Pan/drag state
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const viewportRef = useRef<HTMLDivElement>(null);

    // Temporary marker for new comment creation
    const [tempMarker, setTempMarker] = useState<{ x: number, y: number } | null>(null);
    const [commentText, setCommentText] = useState('');
    const [useAI, setUseAI] = useState(false);

    const imageWrapperRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // Pan/drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
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

    const handleImageClick = (e: React.MouseEvent) => {
        if (isDragging) return;
        if (!imageWrapperRef.current) return;

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
    const visibleComments = comments.filter(c => (c.pageNumber || 1) === 1);

    return (
        <div className="flex-1 bg-slate-200/50 flex flex-col h-full">
            {/* Image Card */}
            <div className="flex-1 bg-white shadow-2xl border-l border-slate-200 overflow-hidden flex flex-col">
                {/* Image Viewport */}
                <div
                    ref={viewportRef}
                    className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center"
                    style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
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
                                    }}
                                    className={`absolute w-8 h-8 -ml-4 -mt-8 transform transition-all duration-200 hover:scale-110 z-10 group ${activeCommentId === comment.id ? 'scale-125 z-20' : ''
                                        }`}
                                    style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
                                >
                                    <div
                                        className={`relative flex items-center justify-center w-full h-full rounded-full shadow-lg border-2 border-white ${comment.resolved
                                            ? 'bg-slate-400'
                                            : comment.author === UserRole.DESIGNER
                                                ? 'bg-purple-600'
                                                : 'bg-indigo-600'
                                            }`}
                                    >
                                        <span className="text-white text-xs font-bold">
                                            {comments.indexOf(comment) + 1}
                                        </span>

                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-slate-800 text-white text-xs py-1 px-2 rounded pointer-events-none">
                                            {comment.author}: {comment.text.substring(0, 20)}...
                                        </div>
                                    </div>
                                    {/* Arrow pointer */}
                                    <div
                                        className={`absolute top-full left-1/2 -ml-1 -mt-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${comment.resolved
                                            ? 'border-t-slate-400'
                                            : comment.author === UserRole.DESIGNER
                                                ? 'border-t-purple-600'
                                                : 'border-t-indigo-600'
                                            }`}
                                    ></div>
                                </button>
                            ))}

                            {/* New Comment Form */}
                            {imageLoaded && tempMarker && (
                                <div
                                    className="absolute bg-white rounded-lg shadow-2xl p-4 w-80 z-30 border border-slate-200"
                                    style={{
                                        left: `${tempMarker.x}%`,
                                        top: `${tempMarker.y}%`,
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
                                            className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none px-2 py-1.5 rounded transition-colors ${useAI
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'text-slate-500 hover:bg-slate-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={useAI}
                                                onChange={(e) => setUseAI(e.target.checked)}
                                                className="hidden"
                                            />
                                            <Sparkles
                                                className={`w-3.5 h-3.5 ${useAI ? 'text-indigo-500' : 'text-slate-400'}`}
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
                                    style={{ left: `${tempMarker.x}%`, top: `${tempMarker.y}%` }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
