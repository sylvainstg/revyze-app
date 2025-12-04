import React from 'react';
import { ProjectVersion } from '../types';
import { Clock, MessageSquare } from 'lucide-react';

interface VersionSelectorProps {
    versions: ProjectVersion[];
    currentVersionId: string;
    onVersionChange: (versionId: string) => void;
}

export const VersionSelector: React.FC<VersionSelectorProps> = ({
    versions,
    currentVersionId,
    onVersionChange
}) => {
    const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

    return (
        <div className="relative inline-block">
            <select
                value={currentVersionId}
                onChange={(e) => onVersionChange(e.target.value)}
                className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-slate-700 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer transition-colors"
            >
                {sortedVersions.map((version) => {
                    const commentsCount = version.comments?.length || 0;
                    const unresolvedCount = version.comments?.filter(c => !c.resolved && !c.deleted).length || 0;

                    return (
                        <option key={version.id} value={version.id}>
                            v{version.versionNumber} - {version.fileName} ({commentsCount} comment{commentsCount !== 1 ? 's' : ''})
                        </option>
                    );
                })}
            </select>

            {/* Custom dropdown arrow */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    );
};

// Alternative: Detailed Version Selector with Dropdown Panel
interface VersionSelectorDetailedProps {
    versions: ProjectVersion[];
    currentVersionId: string;
    onVersionChange: (versionId: string) => void;
    onEditVersion?: (version: ProjectVersion) => void;
}

export const VersionSelectorDetailed: React.FC<VersionSelectorDetailedProps> = ({
    versions,
    currentVersionId,
    onVersionChange,
    onEditVersion
}) => {
    const [isOpen, setIsOpen] = React.useState(false);

    // Debug logging
    console.log('[VersionSelectorDetailed] Props:', {
        versionsCount: versions.length,
        currentVersionId,
        onEditVersionDefined: !!onEditVersion
    });
    const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
    const currentVersion = versions.find(v => v.id === currentVersionId);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
                <span>v{currentVersion?.versionNumber}</span>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0" style={{ zIndex: 99998 }} onClick={() => setIsOpen(false)} />
                    <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 max-h-96 overflow-y-auto" style={{ zIndex: 99999 }}>
                        {sortedVersions.map((version) => {
                            const isActive = version.id === currentVersionId;
                            const commentsCount = version.comments?.length || 0;
                            const unresolvedCount = version.comments?.filter(c => !c.resolved && !c.deleted).length || 0;

                            return (
                                <div
                                    key={version.id}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors group flex items-start justify-between gap-3 ${isActive ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                                        }`}
                                >
                                    <button
                                        onClick={() => {
                                            onVersionChange(version.id);
                                            setIsOpen(false);
                                        }}
                                        className="flex-1 min-w-0 text-left"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`font-semibold ${isActive ? 'text-indigo-600' : 'text-slate-900'}`}>
                                                Version {version.versionNumber}
                                            </span>
                                            {isActive && (
                                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-600 truncate mb-2">
                                            {version.fileName}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(version.timestamp).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MessageSquare className="w-3 h-3" />
                                                {commentsCount} comment{commentsCount !== 1 ? 's' : ''}
                                                {unresolvedCount > 0 && (
                                                    <span className="text-amber-600 font-medium">
                                                        ({unresolvedCount} unresolved)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>

                                    {onEditVersion && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditVersion(version);
                                                setIsOpen(false);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Edit Category"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
