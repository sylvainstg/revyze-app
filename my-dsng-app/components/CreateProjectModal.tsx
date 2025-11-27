import React, { useState, useRef } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { X, Upload } from 'lucide-react';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (file: File, name: string, clientName: string) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [clientName, setClientName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (file && name && clientName && !isCreating) {
            try {
                setIsCreating(true);
                await onCreate(file, name, clientName);
                // Reset form
                setName('');
                setClientName('');
                setFile(null);
                onClose();
            } catch (error) {
                console.error('Error creating project:', error);
                alert('Failed to create project. Please try again.');
            } finally {
                setIsCreating(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-900">Create New Project</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <Input
                        label="Project Name"
                        placeholder="Kitchen Renovation"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    <Input
                        label="Client Name"
                        placeholder="John Smith"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        required
                    />

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Design File
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/jpg"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="hidden"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 text-slate-600 hover:text-indigo-600"
                        >
                            <Upload className="w-5 h-5" />
                            {file ? file.name : 'Choose PDF or image file'}
                        </button>
                        {file && (
                            <p className="mt-2 text-sm text-slate-600">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!file || !name || !clientName || isCreating}
                            isLoading={isCreating}
                            className="flex-1"
                        >
                            {isCreating ? 'Creating...' : 'Create Project'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
