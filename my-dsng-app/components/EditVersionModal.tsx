import React, { useState, useEffect } from 'react';
import { X, FolderInput } from 'lucide-react';

interface EditVersionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newCategory: string) => void;
    currentCategory: string;
    existingCategories: string[];
    versionName: string;
}

export const EditVersionModal: React.FC<EditVersionModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentCategory,
    existingCategories,
    versionName
}) => {
    const [selectedCategory, setSelectedCategory] = useState(currentCategory);
    const [isNewCategory, setIsNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedCategory(currentCategory);
            setIsNewCategory(false);
            setNewCategoryName('');
            setIsSaving(false);
        }
    }, [isOpen, currentCategory]);

    if (!isOpen) return null;

    const handleSave = async () => {
        const categoryToUse = isNewCategory ? newCategoryName.trim() : selectedCategory;

        if (!categoryToUse) {
            alert("Please select or enter a category.");
            return;
        }

        setIsSaving(true);
        try {
            await onSave(categoryToUse);
            onClose();
        } catch (error) {
            console.error("Error saving category:", error);
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <FolderInput className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">Edit Version Category</h3>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{versionName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">
                            Select Category
                        </label>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {existingCategories.map((category) => (
                                <label
                                    key={category}
                                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${!isNewCategory && selectedCategory === category
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="category"
                                        checked={!isNewCategory && selectedCategory === category}
                                        onChange={() => {
                                            setSelectedCategory(category);
                                            setIsNewCategory(false);
                                        }}
                                        disabled={isSaving}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    <span className="text-sm font-medium text-slate-900">{category}</span>
                                </label>
                            ))}

                            {/* New Category Option */}
                            <label
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${isNewCategory
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="category"
                                    checked={isNewCategory}
                                    onChange={() => setIsNewCategory(true)}
                                    disabled={isSaving}
                                    className="w-4 h-4 text-indigo-600 mt-0.5"
                                />
                                <div className="flex-1">
                                    <span className="text-sm font-medium text-slate-900 block mb-2">
                                        Create new category
                                    </span>
                                    {isNewCategory && (
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="e.g., HVAC, Landscaping..."
                                            disabled={isSaving}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900"
                                            onFocus={() => setIsNewCategory(true)}
                                            autoFocus
                                        />
                                    )}
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
