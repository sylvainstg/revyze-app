import React from "react";
import { Project } from "../types";
import {
  AlertTriangle,
  Users,
  FolderOpen,
  MessageSquare,
  X,
} from "lucide-react";
import { Button } from "./ui/Button";

interface EnhancedDeleteDialogProps {
  project: Project;
  onConfirm: () => void;
  onCancel: () => void;
}

export const EnhancedDeleteDialog: React.FC<EnhancedDeleteDialogProps> = ({
  project,
  onConfirm,
  onCancel,
}) => {
  // Calculate impact metrics
  const categories = new Set(project.versions.map((v) => v.category)).size;
  const totalVersions = project.versions.length;
  const totalComments = project.versions.reduce(
    (sum, v) => sum + (v.comments?.length || 0),
    0,
  );
  const collaborators = project.collaborators.length;

  console.log(
    "[EnhancedDeleteDialog] RENDERING DIALOG for project:",
    project.name,
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Delete Project?
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  This action can be undone from the trash
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Project Info */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-1">
              {project.name}
            </h3>
            <p className="text-sm text-slate-600">{project.clientName}</p>
          </div>

          {/* Impact Summary */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
              Impact Summary
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-900">
                    Categories
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{categories}</p>
                <p className="text-xs text-blue-700 mt-1">
                  {totalVersions} total versions
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-900">
                    Comments
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  {totalComments}
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  across all versions
                </p>
              </div>
            </div>

            {collaborators > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-900">
                    Collaborators
                  </span>
                </div>
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">{collaborators}</span>{" "}
                  {collaborators === 1 ? "person" : "people"} will lose access
                  to this project
                </p>
              </div>
            )}
          </div>

          {/* Warning Message */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Note:</span> This project will be
              moved to trash and can be restored within 30 days. After that, it
              will be permanently deleted.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-200 flex gap-3">
          <Button onClick={onCancel} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="danger" className="flex-1">
            Move to Trash
          </Button>
        </div>
      </div>
    </div>
  );
};
