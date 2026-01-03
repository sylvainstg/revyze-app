import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleComingSoonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  defaultCollapsed?: boolean;
}

export const CollapsibleComingSoon: React.FC<CollapsibleComingSoonProps> = ({
  title,
  description,
  icon,
  children,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={`border-b transition-all duration-200 ${
        isCollapsed
          ? "bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-indigo-100/50"
          : "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100"
      }`}
    >
      {/* Collapsed State - Minimal */}
      {isCollapsed ? (
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full p-2 flex items-center gap-2 hover:bg-white/30 transition-colors group"
        >
          <ChevronRight className="w-4 h-4 text-indigo-600 group-hover:text-indigo-700 transition-transform group-hover:translate-x-0.5" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-1 bg-white rounded shadow-sm shrink-0">
              {React.cloneElement(icon as React.ReactElement, {
                className: "w-3 h-3 text-indigo-600",
              })}
            </div>
            <span className="text-xs font-semibold text-slate-700 truncate">
              {title}
            </span>
            <span className="px-1.5 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full shrink-0">
              SOON
            </span>
          </div>
        </button>
      ) : (
        /* Expanded State - Full */
        <div className="p-4">
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-full flex items-start gap-3 group"
          >
            <ChevronDown className="w-4 h-4 text-indigo-600 mt-2 group-hover:text-indigo-700 transition-transform group-hover:translate-y-0.5 shrink-0" />
            <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
              {React.cloneElement(icon as React.ReactElement, {
                className: "w-5 h-5 text-indigo-600",
              })}
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-slate-900">{title}</p>
                <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
                  COMING SOON
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-3">{description}</p>
              {children}
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
