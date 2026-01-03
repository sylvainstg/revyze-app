import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Plus, X, FileText, Palette } from "lucide-react";
import { getCategoryCounts } from "../utils/categoryHelpers";
import { ProjectVersion } from "../types";

interface CategorySelectorProps {
  versions: ProjectVersion[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  versions,
  activeCategory,
  onCategoryChange,
}) => {
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const categoryCounts = getCategoryCounts(versions);
  // Ensure active category is always shown, even if it has no versions yet
  const allCategories = new Set(Object.keys(categoryCounts));
  if (activeCategory && activeCategory !== "Mood Board") {
    allCategories.add(activeCategory);
  }
  const categories = Array.from(allCategories)
    .filter((c) => c !== "Mood Board")
    .sort();

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onCategoryChange(newCategoryName.trim());
      setNewCategoryName("");
      setShowNewCategory(false);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
        {/* Category Tabs */}
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeCategory === category
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            {category}
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeCategory === category
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {categoryCounts[category] || 0}
            </span>
          </button>
        ))}

        {/* Add New Category Button */}
        {!showNewCategory ? (
          <button
            onClick={() => setShowNewCategory(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all whitespace-nowrap border-2 border-dashed border-slate-300"
          >
            <Plus className="w-4 h-4" />
            New Category
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1.5 h-[42px]">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory();
                if (e.key === "Escape") {
                  setShowNewCategory(false);
                  setNewCategoryName("");
                }
              }}
              placeholder="Category name..."
              className="w-48 text-sm px-3 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-full bg-white text-slate-900"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim()}
              className="h-full"
            >
              Add
            </Button>
            <button
              onClick={() => {
                setShowNewCategory(false);
                setNewCategoryName("");
              }}
              className="p-1.5 hover:bg-slate-200 rounded-md h-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        )}
      </div>

      {/* Dedicated Mood Board Button */}
      <div className="flex-shrink-0 border-l border-slate-200 pl-4 py-1">
        <Button
          variant={activeCategory === "Mood Board" ? "primary" : "secondary"}
          size="sm"
          className={`gap-2 transition-all ${activeCategory === "Mood Board" ? "shadow-md scale-105" : ""}`}
          icon={<Palette className="w-4 h-4" />}
          onClick={() => onCategoryChange("Mood Board")}
        >
          Mood Board
        </Button>
      </div>
    </div>
  );
};
