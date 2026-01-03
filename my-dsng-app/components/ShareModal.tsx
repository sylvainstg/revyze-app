import React, { useState, useEffect, useMemo } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Project, ShareSettings, User } from "../types";
import {
  X,
  UserPlus,
  Mail,
  Link as LinkIcon,
  Copy,
  Check,
  Globe,
  Lock,
  AlertCircle,
} from "lucide-react";
import { generateShareToken, getUserByEmail } from "../services/storageService";
import { format } from "date-fns";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: "guest" | "pro", name?: string) => void;
  onRemoveCollaborator: (email: string) => void;
  onRevokeAll: () => void;
  onUpdateShareSettings: (projectId: string, settings: ShareSettings) => void;
  onTransferOwnership?: (newOwnerEmail: string) => Promise<void>;
  onUpgradeRequest: () => void;
  currentUser: User | null;
  project: Project | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  onInvite,
  onRemoveCollaborator,
  onRevokeAll,
  onUpdateShareSettings,
  onTransferOwnership,
  onUpgradeRequest,
  currentUser,
  project,
}) => {
  const [email, setEmail] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteRole, setInviteRole] = useState<"guest" | "pro">("guest");
  const [fromNameOverride, setFromNameOverride] = useState("");

  // ... (existing state and effects) ...

  // Local state for share settings to allow immediate UI updates
  const [shareEnabled, setShareEnabled] = useState(false);
  const [accessLevel, setAccessLevel] = useState<"view" | "comment">("view");
  const [shareToken, setShareToken] = useState("");
  const [collaboratorDetails, setCollaboratorDetails] = useState<
    Record<string, User | null>
  >({});
  const [transferEmail, setTransferEmail] = useState("");
  const [limitDialog, setLimitDialog] = useState<{
    role: "guest" | "pro";
  } | null>(null);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);

  const [confirmation, setConfirmation] = useState<{
    type: "remove" | "regenerate";
    data?: string; // email for remove
    message: string;
  } | null>(null);

  // ... (existing effects) ...
  // Sync state with project when it opens/changes
  useEffect(() => {
    if (project) {
      if (project.shareSettings) {
        setShareEnabled(project.shareSettings.enabled);
        setAccessLevel(project.shareSettings.accessLevel);
        setShareToken(project.shareSettings.shareToken);
      } else {
        // Default state if no settings exist
        setShareEnabled(false);
        setAccessLevel("view");
        setShareToken(generateShareToken());
      }
    }
  }, [project, isOpen]);

  // Fetch collaborator details
  useEffect(() => {
    const fetchCollaborators = async () => {
      if (!project || !project.collaborators) return;

      const details: Record<string, User | null> = {};

      for (const email of project.collaborators) {
        if (!collaboratorDetails[email]) {
          const user = await getUserByEmail(email);
          details[email] = user;
        }
      }

      if (Object.keys(details).length > 0) {
        setCollaboratorDetails((prev) => ({ ...prev, ...details }));
      }
    };

    if (isOpen) {
      fetchCollaborators();
    }
  }, [project?.collaborators, isOpen]);

  const fallbackDisplayName = useMemo(() => {
    const candidate = fromNameOverride || currentUser?.name || "";
    const isEmail = candidate.includes("@");
    if (!candidate || isEmail) {
      if (project?.ownerEmail) {
        const emailLocal = project.ownerEmail.split("@")[0];
        const friendly = emailLocal
          .replace(/[._-]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return friendly || "Project Owner";
      }
      return "Project Owner";
    }
    return candidate;
  }, [fromNameOverride, currentUser?.name, project?.ownerEmail]);

  if (!isOpen || !project) return null;

  const handleShareToggle = (enabled: boolean) => {
    setShareEnabled(enabled);

    // If enabling and no token exists, generate one
    let currentToken = shareToken;
    if (enabled && !currentToken) {
      currentToken = generateShareToken();
      setShareToken(currentToken);
    }

    onUpdateShareSettings(project.id, {
      enabled,
      accessLevel,
      shareToken: currentToken,
    });
  };

  const handleAccessLevelChange = (level: "view" | "comment") => {
    setAccessLevel(level);
    onUpdateShareSettings(project.id, {
      enabled: shareEnabled,
      accessLevel: level,
      shareToken,
    });
  };

  const getShareLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}?project=${project.id}&token=${shareToken}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (project.collaborators.includes(email)) {
      setError("This user is already a collaborator");
      return;
    }

    // For free plan users, enforce 1 guest and 1 pro invite limit
    if (currentUser?.plan === "free") {
      let guestCount = 0;
      let proCount = 0;
      project.collaborators.forEach((collabEmail) => {
        if (collabEmail === project.ownerEmail) return;
        const detail = collaboratorDetails[collabEmail];
        if (detail?.plan === "pro" || detail?.plan === "business") {
          proCount += 1;
        } else {
          guestCount += 1;
        }
      });

      if (inviteRole === "guest" && guestCount >= 1) {
        setLimitDialog({ role: "guest" });
        return;
      }
      if (inviteRole === "pro" && proCount >= 1) {
        setLimitDialog({ role: "pro" });
        return;
      }
    }

    onInvite(email, inviteRole, inviteeName || undefined);
    setEmail("");
    setInviteeName("");
    setError("");
  };

  const handleRemoveClick = (email: string) => {
    setConfirmation({
      type: "remove",
      data: email,
      message: `Are you sure you want to remove ${email} from this project?`,
    });
  };

  const handleRegenerateClick = () => {
    setConfirmation({
      type: "regenerate",
      message:
        "Are you sure? This will invalidate the existing link AND remove all invited collaborators.",
    });
  };

  const confirmAction = () => {
    if (!confirmation) return;

    if (confirmation.type === "remove" && confirmation.data) {
      onRemoveCollaborator(confirmation.data);
    } else if (confirmation.type === "regenerate") {
      onRevokeAll();
    }
    setConfirmation(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 relative">
        {/* Confirmation Overlay */}
        {confirmation && (
          <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-200">
            <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
            <h4 className="text-base font-bold text-slate-900 mb-1">
              Confirm Action
            </h4>
            <p className="text-sm text-slate-600 mb-4 max-w-[280px]">
              {confirmation.message}
            </p>
            <div className="flex gap-2 w-full max-w-[280px]">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={confirmAction}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}

        {/* Upgrade Prompt for free plan limits */}
        {limitDialog && (
          <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-5 text-center animate-in fade-in duration-200">
            <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
            <h4 className="text-base font-bold text-slate-900 mb-2">
              Invite limit reached
            </h4>
            <p className="text-sm text-slate-600 mb-4 max-w-[320px]">
              Free accounts can invite 1 professional and 1 guest. Upgrade to
              add more collaborators.
            </p>
            <div className="flex gap-2 w-full max-w-[320px]">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setLimitDialog(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setLimitDialog(null);
                  onUpgradeRequest();
                }}
              >
                Upgrade
              </Button>
            </div>
          </div>
        )}

        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Invite to Project
            </h3>
            <p className="text-sm text-slate-500">
              Invite others to "{project.name}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Public Link Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" /> Public Link Access
              </h4>
              <button
                onClick={() => handleShareToggle(!shareEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${shareEnabled ? "bg-indigo-600" : "bg-slate-200"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${shareEnabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            {shareEnabled ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    onClick={() => handleAccessLevelChange("view")}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${accessLevel === "view" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    View Only
                  </button>
                  <button
                    onClick={() => handleAccessLevelChange("comment")}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${accessLevel === "comment" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Can Comment
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={getShareLink()}
                      className="block w-full pl-10 pr-3 py-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <Button
                    onClick={handleCopyLink}
                    variant="secondary"
                    icon={
                      copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )
                    }
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleRegenerateClick}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Revoke All Access & Regenerate Link
                  </button>
                </div>

                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  {accessLevel === "view"
                    ? "Anyone with the link can view this project."
                    : "Anyone with the link can view and add comments."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Link sharing is disabled. Only invited users can access this
                project.
              </p>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* Local Invitation Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Invite by Email
              </h4>
              <div className="text-[10px] text-slate-500">
                From:{" "}
                <span className="font-semibold text-slate-800">
                  {fallbackDisplayName}
                </span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setInviteRole("guest")}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${inviteRole === "guest" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Guest
                </button>
                <button
                  type="button"
                  onClick={() => setInviteRole("pro")}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${inviteRole === "pro" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Professional
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Name (Optional)"
                  value={inviteeName}
                  onChange={(e) => setInviteeName(e.target.value)}
                />
                <Input
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  error={error}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!email}>
                  Add User
                </Button>
              </div>
            </form>

            {project.collaborators && project.collaborators.length > 0 && (
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {project.collaborators.map((collabEmail, idx) => {
                  const user = collaboratorDetails[collabEmail];
                  const isOwner = collabEmail === project.ownerEmail; // Should not happen in this list usually
                  const isPro =
                    user?.plan === "pro" || user?.plan === "business";
                  const isGuest = user && !isPro;
                  const isInvited = !user;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                          {collabEmail.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-700 leading-tight">
                            {collabEmail}
                          </span>
                          <div className="flex gap-1 mt-0.5">
                            {isPro && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold uppercase tracking-wider">
                                {user?.subscriptionStatus === "trialing"
                                  ? "Pro (Trial)"
                                  : "Pro"}
                              </span>
                            )}
                            {isGuest && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold uppercase tracking-wider">
                                Guest
                              </span>
                            )}
                            {isInvited && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full font-bold uppercase tracking-wider">
                                Invited
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Can edit</span>
                        <button
                          onClick={() => handleRemoveClick(collabEmail)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Remove user"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone - Ownership Transfer */}
        {onTransferOwnership && (
          <div className="mt-8 pt-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setIsDangerZoneOpen(!isDangerZoneOpen)}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-slate-100 transition-colors group"
            >
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-red-500 transition-colors">
                <AlertCircle className="w-3.5 h-3.5" />
                Danger Zone
              </h4>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDangerZoneOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isDangerZoneOpen && (
              <div className="p-6 pt-2 animate-in slide-in-from-top-2 duration-200">
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <h5 className="text-sm font-bold text-red-900 mb-1">
                    Transfer Ownership
                  </h5>
                  <p className="text-xs text-red-700 mb-4 leading-relaxed">
                    Transfer this project to another user. You will become a
                    guest on this project. This action cannot be undone.
                  </p>

                  <div className="flex gap-2">
                    <Input
                      placeholder="New owner's email"
                      value={transferEmail}
                      onChange={(e) => setTransferEmail(e.target.value)}
                      className="flex-1 bg-white border-red-200 focus:border-red-500 focus:ring-red-500"
                    />
                    <Button
                      variant="danger"
                      className="whitespace-nowrap shadow-sm"
                      disabled={!transferEmail || !onTransferOwnership}
                      onClick={() => {
                        if (onTransferOwnership && transferEmail) {
                          if (
                            window.confirm(
                              `Are you sure you want to transfer ownership to ${transferEmail}? You will lose owner privileges.`,
                            )
                          ) {
                            onTransferOwnership(transferEmail);
                          }
                        }
                      }}
                    >
                      Transfer
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
