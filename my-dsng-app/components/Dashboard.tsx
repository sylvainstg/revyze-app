import React, { useState, useRef } from 'react';
import { Project, User, UserRole } from '../types';
import { Button } from './ui/Button';
import { Plus, Search, FileText, Clock, FolderOpen, LogOut, Share2, Users, Upload, MessageSquare, Trash2, Shield, Gift } from 'lucide-react';
import { ReferralDashboard } from './ReferralDashboard';
import { PLANS } from '../constants';
import { getProjectRole, canSeeComment } from '../utils/projectRoleHelper';
import { getSubscriptionStatusDisplay } from '../utils/planHelpers';
import { BarChart3 } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';

interface DashboardProps {
  user: User;
  projects: Project[];
  onCreateProject: () => void;
  onImportProject: (file: File) => void;
  onOpenProject: (projectId: string) => void;
  onShareProject: (project: Project) => void;
  onGoToLanding: () => void;
  onLogout: () => void;
  onUpgrade: () => void;
  onDeleteProject: (project: Project) => void;
  onOpenAdmin: () => void;
  onOpenCemetery: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  projects,
  onCreateProject,
  onImportProject,
  onOpenProject,
  onShareProject,
  onGoToLanding,
  onLogout,
  onUpgrade,
  onDeleteProject,
  onOpenAdmin,
  onOpenCemetery
}) => {
  const [search, setSearch] = useState('');
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showReferralDashboard, setShowReferralDashboard] = useState(false);


  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toggleAdminMode, impersonatedRole } = useAdmin();

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const currentPlan = PLANS[user.plan || 'free'];
  const limits = currentPlan.limits;

  const handleUpdateProfile = async () => {
    if (!editName.trim()) return;
    setIsSavingProfile(true);

    try {
      const { updateUserProfile } = await import('../services/authService');
      const { createPortalSession } = await import('../services/paymentService');
      const success = await updateUserProfile(user.id, { name: editName });
      if (success) {
        setIsEditProfileOpen(false);
        window.location.reload();
      } else {
        alert("Failed to update profile.");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button onClick={onGoToLanding} className="hover:opacity-80 transition-opacity">
                <img src="/revyze-logo.png" alt="Revyze" className="h-16 w-auto object-contain" />
              </button>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            </div>

            <div className="flex items-center gap-6">
              {/* Referral Button */}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowReferralDashboard(true)}
                icon={<Gift className="w-4 h-4" />}
                className="hidden md:flex"
              >
                Referrals
              </Button>

              {/* Show Upgrade button for Free users OR Trial users */}
              {(currentPlan.id === 'free' || user.subscriptionStatus === 'trialing') && (
                <Button size="sm" onClick={onUpgrade} className="hidden md:flex bg-gradient-to-r from-indigo-600 to-purple-600 border-none">
                  {user.subscriptionStatus === 'trialing' ? 'Upgrade Trial' : 'Upgrade to Pro'}
                </Button>
              )}

              <div className="relative">
                <div
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${user.role === UserRole.DESIGNER ? 'bg-purple-600' : 'bg-blue-600'}`}>
                    {user.name.charAt(0)}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{getSubscriptionStatusDisplay(user)} Plan</p>
                  </div>
                </div>

                {isProfileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-4 py-2 border-b border-slate-50 md:hidden">
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{getSubscriptionStatusDisplay(user)} Plan</p>
                      </div>

                      <button
                        onClick={() => {
                          setEditName(user.name);
                          setIsEditProfileOpen(true);
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Users className="w-4 h-4" /> Account Settings
                      </button>

                      {user.isAdmin && (
                        <button
                          onClick={() => {
                            onOpenAdmin();
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-medium"
                        >
                          <Shield className="w-4 h-4" /> System Admin
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onOpenCemetery();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Trash
                      </button>

                      <div className="h-px bg-slate-100 my-1" />

                      <button
                        onClick={onLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            />
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            {(limits.ownedProjects !== Infinity || limits.totalProjects !== Infinity) && (
              <div className="text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-lg">
                <span className="font-medium">{projects.filter(p => p.ownerId === user.id).length}/{limits.ownedProjects}</span> owned
                <span className="mx-2">·</span>
                <span className="font-medium">{projects.length}/{limits.totalProjects}</span> total
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".designsync,.json,application/pdf,image/png,image/jpeg,image/jpg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportProject(file);
                    e.target.value = ''; // Reset so same file can be selected again
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                icon={<Upload className="w-4 h-4" />}
              >
                Import
              </Button>
              <Button onClick={onCreateProject} icon={<Plus className="w-4 h-4" />}>
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Project Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No projects found</h3>
            <p className="text-slate-500 mb-6">Create a new project or import one to get started.</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import File</Button>
              <Button onClick={onCreateProject}>Create Project</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const isOwner = project.ownerId === user.id;
              const isShared = !isOwner;
              const userProjectRole = getProjectRole(project, user, false, impersonatedRole);

              // Get active version's comments
              const activeVersion = project.versions.find(v => v.id === project.currentVersionId) || project.versions[project.versions.length - 1];
              const allComments = activeVersion?.comments || [];

              let unresolvedCount = 0;
              let guestUnresolvedCount = 0;
              let proUnresolvedCount = 0;

              if (isOwner) {
                // For owners, count guest and pro comments separately
                const unresolvedComments = allComments.filter(comment => !comment.resolved);
                guestUnresolvedCount = unresolvedComments.filter(c => c.audience === 'guest-owner').length;
                proUnresolvedCount = unresolvedComments.filter(c => c.audience === 'pro-owner').length;
              } else {
                // For non-owners, show total visible comments
                const visibleComments = allComments.filter(comment => canSeeComment(comment, userProjectRole));
                unresolvedCount = visibleComments.filter(comment => !comment.resolved).length;
              }

              return (
                <div
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden flex flex-col relative"
                >
                  {/* Shared Badge */}
                  {isShared && (
                    <div className="absolute top-3 left-3 z-10 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Shared with me
                    </div>
                  )}

                  <div className="h-40 bg-slate-100 relative flex items-center justify-center border-b border-slate-100 group-hover:bg-indigo-50/50 transition-colors overflow-hidden">
                    {/* Thumbnail Image or Fallback Icon */}
                    {project.thumbnailUrl ? (
                      <img
                        src={project.thumbnailUrl}
                        alt={`${project.name} thumbnail`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-12 h-12 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                    )}

                    {/* Comment Status Badge */}
                    {(() => {
                      const currentVersion = project.versions.find(v => v.id === project.currentVersionId);
                      const unresolvedCount = currentVersion?.comments.filter(c => !c.resolved).length || 0;

                      if (unresolvedCount > 0) {
                        return (
                          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {unresolvedCount}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate pr-2 flex-1">
                        {project.name}
                      </h3>

                      {/* Actions Menu / Share Button */}
                      <div className="flex items-center -mr-1 gap-1">
                        {isOwner && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onShareProject(project);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                              title="Share Project"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProject(project);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{project.description}</p>

                    <div className="mt-auto flex items-center justify-between text-xs text-slate-400 border-t border-slate-50 pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(project.lastModified).toLocaleDateString()}
                        </div>

                        {/* Comment Status Badges */}
                        {isOwner ? (
                          <>
                            {/* Guest comments badge (blue) */}
                            {guestUnresolvedCount > 0 && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium" title={`${guestUnresolvedCount} unresolved guest comment${guestUnresolvedCount > 1 ? 's' : ''}`}>
                                <MessageSquare className="w-3 h-3" />
                                {guestUnresolvedCount} Guest
                              </span>
                            )}
                            {/* Pro comments badge (purple) */}
                            {proUnresolvedCount > 0 && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium" title={`${proUnresolvedCount} unresolved pro comment${proUnresolvedCount > 1 ? 's' : ''}`}>
                                <MessageSquare className="w-3 h-3" />
                                {proUnresolvedCount} Pro
                              </span>
                            )}
                          </>
                        ) : (
                          /* Non-owner: single badge */
                          unresolvedCount > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium" title={`${unresolvedCount} unresolved comment${unresolvedCount > 1 ? 's' : ''}`}>
                              <MessageSquare className="w-3 h-3" />
                              {unresolvedCount}
                            </span>
                          )
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {project.collaborators && project.collaborators.length > 0 && (
                          <span className="flex items-center gap-1 text-slate-500" title={`${project.collaborators.length} collaborators`}>
                            <Users className="w-3 h-3" />
                            {project.collaborators.length}
                          </span>
                        )}
                        <div className="font-medium text-slate-500">
                          {project.versions.length} Ver
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Account Settings</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-3">Profile</h3>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                />
              </div>

              {/* Subscription Section */}
              {(currentPlan.id !== 'free' || user.stripeCustomerId) && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Subscription</h3>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">{currentPlan.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {user.subscriptionStatus ? user.subscriptionStatus.charAt(0).toUpperCase() + user.subscriptionStatus.slice(1) : 'Active'}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full mt-2"
                      onClick={async () => {
                        try {
                          const { createPortalSession } = await import('../services/paymentService');
                          const url = await createPortalSession();
                          if (url) {
                            window.location.href = url;
                          } else {
                            alert("Failed to load subscription portal.");
                          }
                        } catch (e) {
                          console.error(e);
                          alert("Error loading portal.");
                        }
                      }}
                    >
                      Manage Subscription
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateProfile} isLoading={isSavingProfile}>Save Changes</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Referral Dashboard Modal */}
      {showReferralDashboard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-xl font-bold text-slate-900">Referral Program</h2>
              <Button variant="secondary" onClick={() => setShowReferralDashboard(false)}>
                Close
              </Button>
            </div>
            <div className="p-6">
              <ReferralDashboard currentUser={user} />
            </div>
          </div>
        </div>
      )}


    </div>
  );
};