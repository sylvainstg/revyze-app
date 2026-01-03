import React, { useState, useRef, useEffect } from "react";
import { MoodBoardElement, User } from "../types";
import { Button } from "./ui/Button";
import {
  Image as ImageIcon,
  Type,
  Link as LinkIcon,
  Trash2,
  User as UserIcon,
  ZoomIn,
  ZoomOut,
  Move,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface MoodBoardWorkspaceProps {
  elements: MoodBoardElement[];
  onUpdateElements: (elements: MoodBoardElement[]) => void;
  currentUser: User;
  scale: number;
  setScale: (scale: number) => void;
}

export const MoodBoardWorkspace: React.FC<MoodBoardWorkspaceProps> = ({
  elements,
  onUpdateElements,
  currentUser,
  scale,
  setScale,
}) => {
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [draggingElementId, setDraggingElementId] = useState<string | null>(
    null,
  );
  const [resizingElementId, setResizingElementId] = useState<string | null>(
    null,
  );
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Handle zooming with scroll wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale(Math.max(0.1, Math.min(5, scale * delta)));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [scale, setScale]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (e.target === canvasRef.current || e.target === containerRef.current) {
      setSelectedElementId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    if (draggingElementId) {
      const element = elements.find((el) => el.id === draggingElementId);
      if (element) {
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;

        const updatedElements = elements.map((el) =>
          el.id === draggingElementId
            ? { ...el, x: el.x + dx, y: el.y + dy }
            : el,
        );
        onUpdateElements(updatedElements);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    if (resizingElementId) {
      const element = elements.find((el) => el.id === resizingElementId);
      if (element) {
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;

        const updatedElements = elements.map((el) =>
          el.id === resizingElementId
            ? {
                ...el,
                width: Math.max(50, el.width + dx),
                height: Math.max(50, el.height + dy),
              }
            : el,
        );
        onUpdateElements(updatedElements);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingElementId(null);
    setResizingElementId(null);
  };

  const addElement = (type: MoodBoardElement["type"]) => {
    const newElement: MoodBoardElement = {
      id: uuidv4(),
      type,
      x: (window.innerWidth / 2 - panOffset.x) / scale - 100,
      y: (window.innerHeight / 2 - panOffset.y) / scale - 100,
      width: type === "text" ? 200 : 150,
      height: type === "text" ? 200 : 150,
      content: type === "text" ? "New Note" : type === "link" ? "https://" : "",
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      timestamp: Date.now(),
    };
    onUpdateElements([...elements, newElement]);
    setSelectedElementId(newElement.id);
  };

  const deleteElement = (id: string) => {
    onUpdateElements(elements.filter((el) => el.id !== id));
    setSelectedElementId(null);
  };

  const updateElementContent = (id: string, content: string) => {
    onUpdateElements(
      elements.map((el) => (el.id === id ? { ...el, content } : el)),
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-50 overflow-hidden cursor-default select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="absolute inset-0 origin-top-left"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
          backgroundImage:
            "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          width: "5000px",
          height: "5000px",
        }}
      >
        {elements.map((el) => (
          <div
            key={el.id}
            className={`absolute rounded-lg shadow-sm border-2 transition-shadow group ${
              selectedElementId === el.id
                ? "border-indigo-500 ring-4 ring-indigo-200 shadow-xl"
                : "border-white"
            }`}
            style={{
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              backgroundColor: el.type === "text" ? "#fef9c3" : "white",
              cursor: draggingElementId === el.id ? "grabbing" : "grab",
              zIndex: selectedElementId === el.id ? 10 : 1,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setSelectedElementId(el.id);
              setDraggingElementId(el.id);
              setDragStart({ x: e.clientX, y: e.clientY });
            }}
          >
            {/* Content Rendering */}
            <div className="w-full h-full overflow-hidden p-2 relative">
              {el.type === "image" &&
                (el.content && el.content.startsWith("http") ? (
                  <img
                    src={el.content}
                    alt=""
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100 rounded border-2 border-dashed border-slate-200">
                    <ImageIcon className="w-8 h-8 mb-2" />
                    <input
                      className="w-[80%] bg-transparent border-none text-[10px] text-center focus:ring-0"
                      placeholder="Paste Image URL"
                      value={el.content}
                      onChange={(e) =>
                        updateElementContent(el.id, e.target.value)
                      }
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                ))}

              {el.type === "text" && (
                <textarea
                  className="w-full h-full bg-transparent border-none focus:ring-0 resize-none text-slate-800 text-sm font-medium leading-relaxed"
                  value={el.content}
                  onChange={(e) => updateElementContent(el.id, e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="Type something..."
                />
              )}

              {el.type === "link" && (
                <div className="w-full h-full flex flex-col pt-1">
                  <div className="flex items-center gap-2 mb-2 p-1 bg-slate-50 rounded">
                    <LinkIcon className="w-4 h-4 text-slate-400" />
                    <input
                      className="flex-1 bg-transparent border-none p-0 text-xs text-indigo-600 focus:ring-0 truncate font-medium"
                      value={el.content}
                      onChange={(e) =>
                        updateElementContent(el.id, e.target.value)
                      }
                      onMouseDown={(e) => e.stopPropagation()}
                      placeholder="https://..."
                    />
                  </div>
                  {el.content && el.content.startsWith("http") && (
                    <a
                      href={el.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto text-[10px] text-slate-400 hover:text-indigo-600 underline font-semibold flex items-center justify-center gap-1 bg-slate-50 py-2 rounded"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      Open Reference
                    </a>
                  )}
                </div>
              )}

              {/* Ownership Indicator */}
              <div className="absolute bottom-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="px-1.5 py-0.5 bg-white/90 backdrop-blur-sm rounded-md text-[8px] font-bold text-slate-500 uppercase border border-slate-200 flex items-center gap-1 shadow-sm">
                  <UserIcon className="w-2 h-2" />
                  {el.ownerName.split(" ")[0]}
                </div>
              </div>
            </div>

            {/* Selection UI */}
            {selectedElementId === el.id && (
              <>
                {/* Resize Handle */}
                <div
                  className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border-2 border-indigo-500 rounded-lg cursor-nwse-resize z-20 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingElementId(el.id);
                    setDragStart({ x: e.clientX, y: e.clientY });
                  }}
                >
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                </div>

                {/* Delete Button */}
                <button
                  className="absolute -top-3 -right-3 w-7 h-7 bg-white border border-slate-200 shadow-xl rounded-full flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-all z-20"
                  onClick={() => deleteElement(el.id)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Interface Overlay */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-white/50 z-30">
        <Button
          variant="secondary"
          size="sm"
          icon={<Type className="w-4 h-4 text-amber-500" />}
          onClick={() => addElement("text")}
          className="hover:bg-amber-50"
        >
          Note
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<ImageIcon className="w-4 h-4 text-blue-500" />}
          onClick={() => addElement("image")}
          className="hover:bg-blue-50"
        >
          Image
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<LinkIcon className="w-4 h-4 text-indigo-500" />}
          onClick={() => addElement("link")}
          className="hover:bg-indigo-50"
        >
          Link
        </Button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5">
          <button
            onClick={() => setScale(Math.max(0.1, scale - 0.1))}
            className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-indigo-600"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-bold text-slate-500 min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(Math.min(5, scale + 0.1))}
            className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-indigo-600"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-6 right-6 flex items-center gap-4">
        <div className="text-[10px] text-slate-400 font-bold bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200/50 flex gap-4">
          <span className="flex items-center gap-1">
            <ZoomIn className="w-3 h-3" /> Scroll to Zoom
          </span>
          <span className="flex items-center gap-1">
            <Move className="w-3 h-3" /> Alt + Drag to Pan
          </span>
        </div>
      </div>
    </div>
  );
};
