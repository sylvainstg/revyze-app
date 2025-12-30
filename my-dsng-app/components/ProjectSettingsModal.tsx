import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Project } from '../types';
import { X, Settings, Users, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface ProjectSettingsModalProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: { name: string; description?: string }) => Promise<void>;
    onOpenInvites: () => void;
    onDelete: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
    project,
    isOpen,
    onClose,
    onSave,
    onOpenInvites,
    onDelete
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [showDangerZone, setShowDangerZone] = useState(false);

    useEffect(() => {
        if (project) {
            setName(project.name || '');
            setDescription(project.description || '');
        }
    }, [project]);

    if (!isOpen || !project) return null;

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        await onSave({ name: name.trim(), description: description.trim() });
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Settings className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Project Settings</h3>
                            <p className="text-xs text-slate-500">Edit details and manage collaborators</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <Input
                        label="Project name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter project name"
                    />
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700">Description (optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900"
                            rows={3}
                            placeholder="Short description"
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            variant="secondary"
                            icon={<Users className="w-4 h-4" />}
                            onClick={() => {
                                onClose();
                                onOpenInvites();
                            }}
                        >
                            Manage invites
                        </Button>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                        <button
                            onClick={() => setShowDangerZone(!showDangerZone)}
                            className="flex items-center justify-between w-full text-left py-2 group"
                        >
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-red-700">Danger Zone</h4>
                                {showDangerZone ? <ChevronDown className="w-4 h-4 text-red-500" /> : <ChevronRight className="w-4 h-4 text-red-500" />}
                            </div>
                        </button>

                        {showDangerZone && (
                            <div className="flex items-center justify-between mt-2 p-3 bg-red-50 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div>
                                    <div className="text-sm font-semibold text-red-700">Delete project</div>
                                    <div className="text-xs text-red-500 max-w-[240px]">Moves project to trash; collaborators lose access. This action can be undone from the cemetery.</div>
                                </div>
                                <Button
                                    variant="danger"
                                    icon={<Trash2 className="w-4 h-4" />}
                                    onClick={onDelete}
                                >
                                    Delete
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} isLoading={saving} disabled={!name.trim()}>
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
};
