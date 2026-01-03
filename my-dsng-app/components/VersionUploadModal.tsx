import React, { useState, useRef } from "react";
import { Button } from "./ui/Button";
import { X, Upload, AlertCircle, FileText } from "lucide-react";

interface VersionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, category: string) => Promise<void>;
  unresolvedCommentsCount: number;
  currentFileName: string;
  existingCategories: string[]; // List of existing categories
  activeCategory?: string; // Currently active category (pre-selected)
}

export const VersionUploadModal: React.FC<VersionUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  unresolvedCommentsCount,
  currentFileName,
  existingCategories,
  activeCategory,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    activeCategory || existingCategories[0] || "",
  );
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update selected category when activeCategory changes
  React.useEffect(() => {
    if (activeCategory) {
      setSelectedCategory(activeCategory);
      setIsNewCategory(false);
    }
  }, [activeCategory]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const categoryToUse = isNewCategory
      ? newCategoryName.trim()
      : selectedCategory;
    if (!categoryToUse) return;

    setIsUploading(true);
    try {
      await onUpload(selectedFile, categoryToUse);
      onClose();
      setSelectedFile(null);
      setIsNewCategory(false);
      setNewCategoryName("");
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null);
      setIsNewCategory(false);
      setNewCategoryName("");
      onClose();
    }
  };

  const fileSizeMB = selectedFile
    ? (selectedFile.size / (1024 * 1024)).toFixed(2)
    : "0";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Upload New Version
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Current: {currentFileName}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Document Category
            </label>
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Select existing
                </label>
                <select
                  disabled={isUploading || isNewCategory}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm text-slate-900 bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                >
                  {existingCategories.length === 0 && (
                    <option value="">No categories yet</option>
                  )}
                  {existingCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={`p-3 rounded-lg border ${isNewCategory ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}
              >
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNewCategory}
                    onChange={(e) => {
                      setIsNewCategory(e.target.checked);
                      if (
                        !e.target.checked &&
                        !selectedCategory &&
                        existingCategories[0]
                      ) {
                        setSelectedCategory(existingCategories[0]);
                      }
                    }}
                    disabled={isUploading}
                    className="mt-0.5 w-4 h-4 text-indigo-600"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-900">
                      Create new category
                    </span>
                    <p className="text-xs text-slate-500">
                      Use a fresh category name for this upload.
                    </p>
                    {isNewCategory && (
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g., HVAC, Landscaping..."
                        disabled={isUploading}
                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900"
                        autoFocus
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* File Input */}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select New Version File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
              } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="w-12 h-12 text-indigo-600 mx-auto" />
                  <div className="font-medium text-slate-900">
                    {selectedFile.name}
                  </div>
                  <div className="text-sm text-slate-500">{fileSizeMB} MB</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    disabled={isUploading}
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                  <div className="text-sm text-slate-600">
                    Click to select a file or drag and drop
                  </div>
                  <div className="text-xs text-slate-500">
                    PDF, PNG, JPG (max 10MB)
                  </div>
                </div>
              )}
            </div>
          </div>

          {unresolvedCommentsCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900 mb-2">
                    Unresolved Comments Detected
                  </h4>
                  <p className="text-sm text-amber-800">
                    There {unresolvedCommentsCount === 1 ? "is" : "are"}{" "}
                    <strong>{unresolvedCommentsCount}</strong> unresolved
                    comment
                    {unresolvedCommentsCount === 1 ? "" : "s"} in the current
                    version.
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    New versions start clean. Turn on “show previous versions”
                    in the viewer to reference older comments.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              !selectedFile ||
              isUploading ||
              (isNewCategory && !newCategoryName.trim())
            }
            isLoading={isUploading}
            icon={<Upload className="w-4 h-4" />}
          >
            {isUploading ? "Uploading..." : "Upload Version"}
          </Button>
        </div>
      </div>
    </div>
  );
};
