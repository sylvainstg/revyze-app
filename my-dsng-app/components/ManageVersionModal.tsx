import React, { useState, useEffect } from 'react';
import { X, Settings2, Trash2, ShieldAlert, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './ui/Button';

interface ManageVersionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: { name: string; category: string }) => void;
    onDelete: () => void;
    currentName: string;
    currentCategory: string;
    existingCategories: string[];
    versionDisplay: string;
}

export const ManageVersionModal: React.FC<ManageVersionModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    currentName,
    currentCategory,
    existingCategories,
    versionDisplay
}) => {
    const [name, setName] = useState(currentName);
    const [selectedCategory, setSelectedCategory] = useState(currentCategory);
    const [isNewCategory, setIsNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showDangerZone, setShowDangerZone] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setName(currentName);
            setSelectedCategory(currentCategory);
            setIsNewCategory(false);
            setNewCategoryName('');
            setIsSaving(false);
            setShowDangerZone(false);
            setDeleteConfirm(false);
        }
    }, [isOpen, currentName, currentCategory]);

    if (!isOpen) return null;

    const handleSave = async () => {
        const categoryToUse = isNewCategory ? newCategoryName.trim() : selectedCategory;

        if (!categoryToUse) {
            alert("Please select or enter a category.");
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                name: name.trim(),
                category: categoryToUse
            });
            onClose();
        } catch (error) {
            console.error("Error saving version details:", error);
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Settings2 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">Manage Version</h3>
                            <p className="text-xs text-slate-500 font-medium">{versionDisplay}</p>
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
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Name Editing */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
                            Version Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Final Client Review, Draft 2..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900"
                            autoFocus
                        />
                        <p className="text-[10px] text-slate-400 italic">
                            This replaces the default "Version X" label in the selectors.
                        </p>
                    </div>

                    {/* Category Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">
                            Category
                        </label>
                        <div className="space-y-2">
                            {existingCategories.filter(c => c !== 'Mood Board').map((category) => (
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
                                            placeholder="e.g., HVAC, Structural..."
                                            disabled={isSaving}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900"
                                            onFocus={() => setIsNewCategory(true)}
                                        />
                                    )}
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="border-t border-slate-100 pt-4">
                        <button
                            onClick={() => setShowDangerZone(!showDangerZone)}
                            className="flex items-center justify-between w-full text-left py-2 group"
                        >
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-red-700 uppercase tracking-wider text-[10px]">Danger Zone</h4>
                                {showDangerZone ? <ChevronDown className="w-4 h-4 text-red-500" /> : <ChevronRight className="w-4 h-4 text-red-500" />}
                            </div>
                        </button>

                        {showDangerZone && (
                            <div className="mt-2 p-4 bg-red-50 rounded-xl border border-red-100 space-y-4 animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-red-800">Delete this version</p>
                                        <p className="text-xs text-red-600 leading-relaxed">
                                            This will permanently remove the file and all associated comments. If this is the only version in its category, the category will also disappear.
                                        </p>
                                    </div>
                                </div>

                                {!deleteConfirm ? (
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => setDeleteConfirm(true)}
                                    >
                                        Delete Version
                                    </Button>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-red-700 text-center">Are you absolutely sure?</p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => setDeleteConfirm(false)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                className="flex-1"
                                                onClick={onDelete}
                                            >
                                                Yes, Delete
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
