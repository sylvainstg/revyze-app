import React, { useState, useEffect } from "react";
import { Project, User } from "../types";
import {
  Trash2,
  RotateCcw,
  Clock,
  FolderOpen,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/Button";
import * as storageService from "../services/storageService";

interface CemeteryViewProps {
  currentUser: User;
  onRestore: (project: Project) => void;
  onBack: () => void;
}

export const CemeteryView: React.FC<CemeteryViewProps> = ({
  currentUser,
  onRestore,
  onBack,
}) => {
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeletedProjects();
  }, [currentUser]);

  const loadDeletedProjects = async () => {
    setLoading(true);
    const projects = await storageService.getDeletedProjects(currentUser);
    setDeletedProjects(projects);
    setLoading(false);
  };

  const handleRestore = async (project: Project) => {
    const success = await storageService.restoreProject(project.id);
    if (success) {
      onRestore(project);
      // Remove from local state
      setDeletedProjects((prev) => prev.filter((p) => p.id !== project.id));
    }
  };

  const formatDeletedDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getDaysUntilPermanentDelete = (deletedAt: number) => {
    const daysSinceDelete = Math.floor(
      (Date.now() - deletedAt) / (1000 * 60 * 60 * 24),
    );
    return Math.max(0, 30 - daysSinceDelete);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Trash</h1>
                  <p className="text-sm text-slate-500">
                    {deletedProjects.length}{" "}
                    {deletedProjects.length === 1 ? "project" : "projects"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : deletedProjects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Trash2 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Trash is empty
            </h2>
            <p className="text-slate-500">Deleted projects will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">
                  Projects in trash are automatically deleted after 30 days
                </p>
                <p className="text-blue-700">
                  Restore projects before they're permanently deleted
                </p>
              </div>
            </div>

            {/* Deleted Projects List */}
            <div className="grid gap-4">
              {deletedProjects.map((project) => {
                const daysLeft = getDaysUntilPermanentDelete(
                  project.deletedAt!,
                );
                const categories = new Set(
                  project.versions.map((v) => v.category),
                ).size;

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <FolderOpen className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <h3 className="font-semibold text-slate-900 truncate">
                            {project.name}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                          {project.clientName}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span>
                              Deleted {formatDeletedDate(project.deletedAt!)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                              {categories}{" "}
                              {categories === 1 ? "category" : "categories"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                daysLeft <= 7
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleRestore(project)}
                        variant="secondary"
                        className="flex items-center gap-2 flex-shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
