import React, { useState, useEffect } from 'react';
import { PDFWorkspace } from './components/PDFWorkspace';
import { ImageWorkspace } from './components/ImageWorkspace';
import { CollaborationPanel } from './components/CollaborationPanel';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { CheckoutPage } from './components/CheckoutPage';
import { Dashboard } from './components/Dashboard';
import { Button } from './components/ui/Button';
import { PricingPage } from './components/PricingPage';
import { ThankYouPage } from './components/ThankYouPage';
import { UserRole, Comment, Project, ViewState, User, CommentReply, ShareSettings } from './types';
import { Layout, Upload, FileText, Share2, ArrowLeft, ZoomIn, ZoomOut, AlertCircle, Camera } from 'lucide-react';
import { SAMPLE_PROJECT_ID, MAX_FILE_SIZE_MB, PLAN_LIMITS } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { ShareModal } from './components/ShareModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import * as storageService from './services/storageService';
import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as authService from './services/authService';
import { getPDFObjectURL, revokePDFObjectURL } from './utils/pdfUtils';
import { getProjectRole, getProjectRoleDisplay, getCommentAudience, canSeeComment } from './utils/projectRoleHelper';
import { AdminDashboard } from './components/AdminDashboard';
import { useAdmin } from './contexts/AdminContext';
import { functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { Toast, ToastType } from './components/ui/Toast';

const App: React.FC = () => {
  // Navigation State
  const [view, setView] = useState<ViewState>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  const { impersonatedRole, isAdminMode, toggleAdminMode } = useAdmin();

  // Initialize User from Auth Service
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);


  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Invite Details State
  const [inviteDetails, setInviteDetails] = useState<{ inviterName?: string; projectName?: string } | null>(null);

  // Workspace State
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);

  // --- Effects ---

  // 0. Handle Shared Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    const token = params.get('token');
    const inviterName = params.get('inviterName');
    const projectName = params.get('projectName');

    if (inviterName || projectName) {
      setInviteDetails({
        inviterName: inviterName || undefined,
        projectName: projectName || undefined
      });
    }

    if (projectId && token) {
      const loadSharedProject = async () => {
        const project = await storageService.getSharedProject(projectId, token);
        if (project) {
          setProjects([project]);
          setActiveProjectId(project.id);
          setView('workspace');
          setIsGuest(true);

          // If no user is logged in, create a guest user context
          if (!currentUser) {
            const guestRole = project.shareSettings?.accessLevel === 'comment' ? 'collaborator' : 'viewer';
            setCurrentUser({
              id: 'guest-' + uuidv4(),
              email: 'guest@designsync.ai',
              name: 'Guest User',
              role: guestRole as UserRole,
              plan: 'free',
              createdAt: Date.now(),
              subscriptionStatus: 'active'
            });
          }
        } else {
          alert('Invalid or expired share link');
          // Remove params from URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      };
      loadSharedProject();
    }
  }, []);

  // Handle Payment Success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setView('thank-you');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // 1. Handle Auth Session
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuth((user) => {
      // Only update if not in guest mode or if user actually logs in
      if (!isGuest || user) {
        setCurrentUser(user);
        setAuthLoading(false);
        if (user && view === 'landing') {
          setView('dashboard');
        } else if (!user && !isGuest && view !== 'landing' && view !== 'auth') {
          setView('landing');
        }
      }
    });
    return () => unsubscribe();
  }, [isGuest, view]);

  // 2. Load Projects when User changes
  useEffect(() => {
    const loadProjects = async () => {
      if (currentUser && !isGuest) {
        const userProjects = await storageService.getProjectsForUser(currentUser);
        setProjects(userProjects);
      } else if (!isGuest) {
        setProjects([]);
      }
    };
    loadProjects();
  }, [currentUser, isGuest]);

  // 3. Scroll to top whenever view changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Derived State
  const activeProject = projects.find(p => p.id === activeProjectId);
  // Robust version finding: try ID match, fallback to latest
  const activeVersion = activeProject?.versions.find(v => v.id === activeProject.currentVersionId)
    || (activeProject?.versions && activeProject.versions.length > 0 ? activeProject.versions[activeProject.versions.length - 1] : undefined);

  // --- Helper to save state and persist to DB ---
  const updateProjectState = async (updatedProject: Project) => {
    // 1. Update Local React State Optimistically
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));

    // 2. Persist to "DB"
    // If guest, we might not be able to save unless rules allow it. 
    // For now assuming rules allow writes if token is valid (handled in storage service/rules)
    const success = await storageService.saveProject(updatedProject);
    if (!success) {
      alert("Warning: Changes could not be saved to the cloud. Please check your connection.");
      // Revert? For now, we'll just warn.
    }
  };

  const handleCaptureThumbnail = async () => {
    if (!activeProject) return;

    try {
      // Detect file type
      const activeVer = activeProject.versions.find(v => v.id === activeProject.currentVersionId);
      if (!activeVer) return;

      const fileName = activeVer.fileName.toLowerCase();
      const isPDF = fileName.endsWith('.pdf');

      let blob: Blob;

      if (isPDF) {
        // For PDFs, use the canvas element
        const canvas = document.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
        if (!canvas) {
          setToast({ message: 'Could not capture thumbnail. Please try again.', type: 'error' });
          return;
        }

        // Convert canvas to blob
        blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
          }, 'image/jpeg', 0.8);
        });
      } else {
        // For images, find the img element with the specific class
        const img = document.querySelector('img.ImageWorkspace') as HTMLImageElement;
        if (!img || !img.complete) {
          console.error('Image element not found or not loaded');
          setToast({ message: 'Could not capture thumbnail. Please try again.', type: 'error' });
          return;
        }

        // Create a canvas and draw the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setToast({ message: 'Could not create thumbnail.', type: 'error' });
          return;
        }

        // Set canvas size (max 800px width, maintain aspect ratio)
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.naturalWidth);
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;

        // Draw image to canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert canvas to blob
        blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
          }, 'image/jpeg', 0.8);
        });
      }

      // Upload to Firebase Storage
      const storageRef = ref(storage, `thumbnails/${activeProject.id}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const thumbnailUrl = await getDownloadURL(storageRef);

      // Update project with thumbnail URL
      const updatedProject = {
        ...activeProject,
        thumbnailUrl
      };

      await updateProjectState(updatedProject);
      setToast({ message: 'Thumbnail set successfully!', type: 'success' });
    } catch (error) {
      console.error('Error capturing thumbnail:', error);
      setToast({ message: 'Failed to capture thumbnail', type: 'error' });
    }
  };

  const handleUpdateShareSettings = async (settings: ShareSettings) => {
    if (!projectToShare) return;

    const success = await storageService.updateProjectShareSettings(projectToShare.id, settings);
    if (success) {
      // Update local state
      const updatedProject = { ...projectToShare, shareSettings: settings };
      setProjects(prev => prev.map(p => p.id === projectToShare.id ? updatedProject : p));
      setToast({ message: 'Share settings updated', type: 'success' });
    } else {
      setToast({ message: 'Failed to update settings', type: 'error' });
    }
  };

  const handleDeleteProject = async (project: Project) => {
    const success = await storageService.deleteProject(project.id);
    if (success) {
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setToast({ message: 'Project deleted successfully', type: 'success' });
    } else {
      setToast({ message: 'Failed to delete project', type: 'error' });
    }
  };

  // --- Actions ---

  const handleAuthSuccess = (user: User, isNewUser: boolean) => {
    // Auth state is handled by the subscription, but we can handle redirection here
    if (isNewUser) {
      setView('checkout');
    } else {
      setView('dashboard');
    }
  };

  const handleCheckoutSuccess = async (planId: string) => {
    if (currentUser) {
      // Update plan in DB
      // Ensure planId is a valid plan type
      const validPlan = (planId === 'free' || planId === 'pro' || planId === 'business') ? planId : 'free';

      // Set subscription status based on plan
      // Pro users start with trial (free to experience, pay to invite)
      // Free users have no subscription status
      const subscriptionStatus = validPlan === 'pro' ? 'trialing' : undefined;

      await storageService.updateUserPlan(currentUser.id, validPlan, subscriptionStatus);
      // Update local state (will eventually be synced by auth listener if we re-fetched, but manual update is faster)
      setCurrentUser({ ...currentUser, plan: validPlan, subscriptionStatus });
    }
    setView('thank-you');
  };

  const handleCreateProjectWithData = async (file: File, name: string, clientName: string) => {
    if (!currentUser) return;

    // Check Limits
    const plan = currentUser.plan || 'free';
    const limits = PLAN_LIMITS[plan];

    // Count owned projects (projects created by this user)
    const ownedProjects = projects.filter(p => p.ownerId === currentUser.id);
    const ownedCount = ownedProjects.length;

    // Check owned projects limit
    if (ownedCount >= limits.ownedProjects) {
      if (confirm(`You have reached the limit of ${limits.ownedProjects} owned project${limits.ownedProjects > 1 ? 's' : ''} for the ${plan} plan.Upgrade to create more ? `)) {
        setView('pricing');
      }
      return;
    }

    // Also check total projects limit (owned + shared)
    if (projects.length >= limits.totalProjects) {
      if (confirm(`You have reached the limit of ${limits.totalProjects} total projects for the ${plan} plan.Upgrade for unlimited projects ? `)) {
        setView('pricing');
      }
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      alert(`File is too large(${fileSizeMB.toFixed(1)}MB).Please choose a file under ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    // Upload to Firebase Storage
    const newProjectId = uuidv4();
    const path = `projects / ${currentUser.id} /${newProjectId}/v1_${file.name} `;

    // Show uploading indicator (simple alert for now, or we could add state)
    // Since we don't have a UI for uploading state in this function easily without refactoring,
    // we will just proceed. Ideally we'd have a loading spinner.

    const downloadURL = await storageService.uploadFile(file, path);
    if (!downloadURL) {
      alert("Failed to upload file.");
      return;
    }

    const newProject: Project = {
      id: newProjectId,
      ownerId: currentUser.id,
      ownerEmail: currentUser.email,
      collaborators: [],
      name: name,
      clientName: clientName,
      lastModified: Date.now(),
      createdAt: Date.now(),
      currentVersionId: 'v1',
      versions: [{
        id: 'v1',
        versionNumber: 1,
        fileUrl: downloadURL,
        fileName: file.name,
        uploadedBy: currentUser.role,
        timestamp: Date.now(),
        comments: []
      }]
    };

    // Save to DB
    const success = await storageService.saveProject(newProject);
    if (success) {
      setProjects(prev => [newProject, ...prev]);
      setActiveProjectId(newProject.id);
      setView('workspace');
    } else {
      alert("Could not save project to the cloud.");
    }
  };

  const handleCreateProject = () => {
    setIsCreateProjectModalOpen(true);
  };

  const handleImportProject = (file: File) => {
    if (!currentUser) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonStr = e.target?.result as string;
        const project = JSON.parse(jsonStr) as Project;

        // Basic validation
        if (!project.id || !project.name || !project.versions) {
          alert("Invalid project file format.");
          return;
        }

        // Force the current user as a collaborator if they aren't the owner
        if (project.ownerId !== currentUser.id && !project.collaborators.includes(currentUser.email)) {
          project.collaborators.push(currentUser.email);
        }

        // Save
        const success = await storageService.saveProject(project);
        if (success) {
          setProjects(prev => {
            // Remove duplicate if it exists
            const filtered = prev.filter(p => p.id !== project.id);
            return [project, ...filtered];
          });
          alert("Project imported successfully!");
        } else {
          alert("Could not import project to the cloud.");
        }

      } catch (err) {
        console.error(err);
        alert("Failed to parse project file.");
      }
    };
    reader.readAsText(file);
  };

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    setView('workspace');
  };

  // Modal State
  const [shareModalProjectId, setShareModalProjectId] = useState<string | null>(null);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);

  const handleShareClick = (project: Project) => {
    setShareModalProjectId(project.id);
    setIsShareModalOpen(true);
  };

  // Derived project for modal
  const projectToShare = projects.find(p => p.id === shareModalProjectId) || null;

  const handleInviteUser = async (email: string) => {
    console.log('[handleInviteUser] START - email:', email, 'projectToShare:', projectToShare?.id);
    if (!projectToShare) {
      console.log('[handleInviteUser] ABORT - no projectToShare');
      return;
    }

    if (!currentUser) {
      console.log('[handleInviteUser] ABORT - no currentUser');
      return;
    }

    // Check if user can invite collaborators
    const plan = currentUser.plan || 'free';
    const status = currentUser.subscriptionStatus;

    // Free users cannot invite
    if (plan === 'free') {
      if (confirm('Inviting collaborators requires a Pro subscription. Upgrade now?')) {
        setView('pricing');
      }
      return;
    }

    // Pro trial users cannot invite - need to upgrade to paid
    if (plan === 'pro' && status === 'trialing') {
      if (confirm('Inviting collaborators requires a paid Pro subscription. Your trial gives you full access to experience the product, but you need to upgrade to invite others. Upgrade now?')) {
        setView('pricing');
      }
      return;
    }

    // Optimistic Update
    const optimisticProject = {
      ...projectToShare,
      collaborators: [...(projectToShare.collaborators || []), email]
    };
    console.log('[handleInviteUser] Optimistic update - new collaborators:', optimisticProject.collaborators);
    setProjects(prev => prev.map(p => p.id === projectToShare.id ? optimisticProject : p));

    // Persist to Firestore
    console.log('[handleInviteUser] Calling storageService.addCollaborator');
    const updatedProject = await storageService.addCollaborator(projectToShare.id, email);
    console.log('[handleInviteUser] Result from addCollaborator:', updatedProject?.id);
    if (updatedProject) {
      setProjects(prev => prev.map(p => p.id === projectToShare.id ? updatedProject : p));

      // Send invitation email
      try {
        const sendInvitation = httpsCallable(functions, 'sendInvitationEmail');
        const shareUrl = projectToShare.shareSettings?.enabled
          ? `${window.location.origin}?project=${projectToShare.id}&token=${projectToShare.shareSettings.shareToken}&inviterName=${encodeURIComponent(currentUser?.name || 'A colleague')}&projectName=${encodeURIComponent(projectToShare.name)}`
          : `${window.location.origin}?project=${projectToShare.id}&inviterName=${encodeURIComponent(currentUser?.name || 'A colleague')}&projectName=${encodeURIComponent(projectToShare.name)}`;

        await sendInvitation({
          email,
          projectName: projectToShare.name,
          url: shareUrl,
          inviterName: currentUser?.name || 'A colleague'
        });
        console.log('[handleInviteUser] Invitation email sent');

        // Show success toast
        setToast({ message: `${email} added successfully!`, type: 'success' });
      } catch (error) {
        console.error('Failed to send invitation email:', error);
        // Still show success for adding user, just note email failed
        setToast({ message: `${email} added (email notification failed)`, type: 'info' });
      }
    } else {
      console.error('[handleInviteUser] Failed to add collaborator');
      setToast({ message: 'Failed to add collaborator', type: 'error' });
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    console.log('[handleRemoveCollaborator] START - email:', email, 'projectToShare:', projectToShare?.id);
    if (!projectToShare) {
      console.log('[handleRemoveCollaborator] ABORT - no projectToShare');
      return;
    }

    // Optimistic Update
    const optimisticProject = {
      ...projectToShare,
      collaborators: (projectToShare.collaborators || []).filter(c => c !== email)
    };
    console.log('[handleRemoveCollaborator] Optimistic update - remaining collaborators:', optimisticProject.collaborators);
    setProjects(prev => prev.map(p => p.id === projectToShare.id ? optimisticProject : p));

    console.log('[handleRemoveCollaborator] Calling storageService.removeCollaborator');
    const updatedProject = await storageService.removeCollaborator(projectToShare.id, email);
    console.log('[handleRemoveCollaborator] Result from removeCollaborator:', updatedProject?.id);
    if (updatedProject) {
      setProjects(prev => prev.map(p => p.id === projectToShare.id ? updatedProject : p));
    }
  };

  const handleRevokeAll = async () => {
    if (!projectToShare) return;

    // Optimistic Update
    const optimisticProject = {
      ...projectToShare,
      collaborators: [],
      shareSettings: {
        ...projectToShare.shareSettings!,
        shareToken: 'regenerating...' // Placeholder
      }
    };
    setProjects(prev => prev.map(p => p.id === projectToShare.id ? optimisticProject : p));

    const updatedProject = await storageService.resetProjectAccess(projectToShare.id);
    if (updatedProject) {
      setProjects(prev => prev.map(p => p.id === projectToShare.id ? updatedProject : p));
    } else {
      // If failed, revert (or just alert)
      alert("Failed to revoke access. Please try again.");
      // We should probably reload projects here to be safe
    }
  };

  // --- Workspace Actions ---

  const handleAddComment = async (newCommentData: Omit<Comment, 'id' | 'timestamp' | 'resolved' | 'audience'>) => {
    if (!activeProject || !activeVersion || !currentUser) return;

    // Check if guest has comment permission
    if (isGuest && activeProject.shareSettings?.accessLevel === 'view') {
      alert('You do not have permission to add comments.');
      return;
    }

    // Determine project role and audience
    const projectRole = getProjectRole(activeProject, currentUser, isGuest);
    const audience = getCommentAudience(projectRole);

    const newComment: Comment = {
      id: uuidv4(),
      timestamp: Date.now(),
      resolved: false,
      replies: [],
      audience,
      authorName: isGuest ? 'Guest' : currentUser.email,
      ...newCommentData
    };

    const updatedProject = {
      ...activeProject,
      versions: activeProject.versions.map(v => {
        if (v.id === activeProject.currentVersionId) {
          return { ...v, comments: [...v.comments, newComment] };
        }
        return v;
      })
    };

    await updateProjectState(updatedProject);
    setActiveCommentId(newComment.id);
  };

  const handleReplyComment = async (commentId: string, text: string) => {
    if (!activeProject || !activeVersion || !currentUser) return;

    const newReply: CommentReply = {
      id: uuidv4(),
      text,
      author: currentUser.role,
      timestamp: Date.now()
    };

    const updatedProject = {
      ...activeProject,
      versions: activeProject.versions.map(v => {
        if (v.id === activeProject.currentVersionId) {
          return {
            ...v,
            comments: v.comments.map(c => {
              if (c.id === commentId) {
                return { ...c, replies: [...(c.replies || []), newReply] };
              }
              return c;
            })
          };
        }
        return v;
      })
    };

    await updateProjectState(updatedProject);
  };

  const handleResolveComment = async (id: string) => {
    if (!activeProject || !activeVersion) return;

    const updatedProject = {
      ...activeProject,
      versions: activeProject.versions.map(v => {
        if (v.id === activeProject.currentVersionId) {
          return { ...v, comments: v.comments.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c) };
        }
        return v;
      })
    };

    await updateProjectState(updatedProject);
  };

  const handleDeleteComment = async (id: string) => {
    if (!activeProject || !activeVersion) return;

    const updatedProject = {
      ...activeProject,
      versions: activeProject.versions.map(v => {
        if (v.id === activeProject.currentVersionId) {
          return { ...v, comments: v.comments.filter(c => c.id !== id) };
        }
        return v;
      })
    };

    await updateProjectState(updatedProject);
    if (activeCommentId === id) setActiveCommentId(null);
  };

  const handlePushToProfessional = async (commentId: string) => {
    if (!activeProject || !activeVersion || !currentUser) return;

    // Find the guest comment
    const guestComment = activeVersion.comments.find(c => c.id === commentId);
    if (!guestComment || guestComment.audience !== 'guest-owner') return;

    // Create a new comment for professionals with same content
    const newProfComment: Comment = {
      ...guestComment,
      id: uuidv4(),
      audience: 'pro-owner',
      author: currentUser.role,
      authorName: currentUser.email,
      pushedFromGuestComment: commentId,
      timestamp: Date.now()
    };

    const updatedProject = {
      ...activeProject,
      versions: activeProject.versions.map(v => {
        if (v.id === activeProject.currentVersionId) {
          return { ...v, comments: [...v.comments, newProfComment] };
        }
        return v;
      })
    };

    await updateProjectState(updatedProject);
  };

  // --- View Router ---

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (view === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => {
          setAuthMode('register');
          setView('auth');
        }}
        onLogin={() => {
          setAuthMode('login');
          setView('auth');
        }}
      />
    );
  }

  if (view === 'auth') {
    return (
      <AuthPage
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
        onBack={() => setView('landing')}
        inviterName={inviteDetails?.inviterName}
        projectName={inviteDetails?.projectName}
      />
    );
  }

  if (view === 'checkout' && currentUser) {
    return (
      <CheckoutPage
        userRole={currentUser.role}
        onSuccess={handleCheckoutSuccess}
        onBack={() => setView('auth')}
      />
    );
  }

  if (view === 'dashboard' && currentUser) {
    return (
      <>
        <Dashboard
          user={currentUser}
          projects={projects}
          onCreateProject={handleCreateProject}
          onImportProject={handleImportProject}
          onOpenProject={handleOpenProject}
          onShareProject={handleShareClick}
          onLogout={() => {
            authService.logoutUser();
            // View change handled by effect
          }}
          onUpgrade={() => setView('pricing')}
          onDeleteProject={handleDeleteProject}
        />
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          onInvite={handleInviteUser}
          onUpdateShareSettings={handleUpdateShareSettings}
          project={projectToShare}
        />
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onCreate={handleCreateProjectWithData}
        />
      </>
    );
  }

  if (view === 'pricing' && currentUser) {
    return (
      <PricingPage
        user={currentUser}
        onBack={() => setView('dashboard')}
      />
    );
  }

  // Add ThankYouPage route
  if (view === 'thank-you') {
    return (
      <ThankYouPage onGoToDashboard={() => setView('dashboard')} />
    );
  }

  // Workspace View
  if (view === 'workspace' && activeProject && currentUser) {
    if (!activeVersion) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="text-center p-8 max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Version Not Found</h2>
            <p className="text-slate-600 mb-6">
              The active version of this project could not be loaded. It might have been deleted or the data is corrupted.
            </p>
            <Button onClick={() => setView('dashboard')}>Back to Dashboard</Button>
          </div>
        </div>
      );
    }

    const canShare = activeProject?.ownerId === currentUser.id;
    return (
      <React.Fragment>
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-30" style={{ transform: 'none' }}>
            <div className="flex items-center gap-4">
              <img src="/revyze-logo.png" alt="Revyze" className="h-16 w-auto object-contain" />
              <button onClick={() => setView('dashboard')} className="text-slate-500 hover:text-slate-800">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="h-6 w-px bg-slate-200 mx-2"></div>
              <div className="flex flex-col">
                <h1 className="font-semibold text-slate-800 text-sm">{activeProject?.name}</h1>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {activeVersion.fileName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Role Indicator */}
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 flex items-center gap-2">
                Viewing as: {getProjectRoleDisplay(getProjectRole(activeProject, currentUser, isGuest, impersonatedRole))}
                {currentUser?.isAdmin && (
                  <button
                    onClick={toggleAdminMode}
                    className="ml-2 text-indigo-600 hover:text-indigo-800 font-bold"
                  >
                    Admin
                  </button>
                )}
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2 bg-slate-100 rounded-full px-2 py-1">
                <button
                  onClick={() => setPdfScale(s => Math.max(0.5, s - 0.1))}
                  className="p-1 hover:bg-slate-200 rounded-full text-slate-600"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium text-slate-600 tabular-nums min-w-[3rem] text-center">
                  {Math.round(pdfScale * 100)}%
                </span>
                <button
                  onClick={() => setPdfScale(s => Math.min(2.5, s + 0.1))}
                  className="p-1 hover:bg-slate-200 rounded-full text-slate-600"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {canShare && activeProject && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Camera className="w-4 h-4" />}
                    onClick={handleCaptureThumbnail}
                    title="Set page as project thumbnail"
                  >
                    Set as Thumbnail
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Share2 className="w-4 h-4" />}
                    onClick={() => handleShareClick(activeProject)}
                  >
                    Share
                  </Button>
                </>
              )}
            </div>
          </header>

          {/* Main workspace area - flex layout */}
          <main className="flex-1 flex overflow-hidden">
            {/* PDF Viewer - grows to fill available space */}
            <div className="flex-1 overflow-hidden">
              {(() => {
                // Detect file type from fileName
                const fileName = activeVersion.fileName.toLowerCase();
                const isPDF = fileName.endsWith('.pdf');

                const currentProjectRole = getProjectRole(activeProject, currentUser, isGuest, impersonatedRole);
                const filteredComments = activeVersion.comments.filter(c => canSeeComment(c, currentProjectRole));

                return isPDF ? (
                  <PDFWorkspace
                    fileUrl={activeVersion.fileUrl}
                    comments={filteredComments}
                    onAddComment={handleAddComment}
                    activeCommentId={activeCommentId}
                    setActiveCommentId={setActiveCommentId}
                    currentUserRole={currentUser.role}
                    pageNumber={pageNumber}
                    setPageNumber={setPageNumber}
                    scale={pdfScale}
                    setScale={setPdfScale}
                  />
                ) : (
                  <ImageWorkspace
                    fileUrl={activeVersion.fileUrl}
                    comments={filteredComments}
                    onAddComment={handleAddComment}
                    activeCommentId={activeCommentId}
                    setActiveCommentId={setActiveCommentId}
                    currentUserRole={currentUser.role}
                    scale={pdfScale}
                    setScale={setPdfScale}
                  />
                );
              })()}
            </div>

            {/* Collaboration Panel - shrinks/grows based on collapse state */}
            <CollaborationPanel
              comments={activeVersion.comments}
              onResolveComment={handleResolveComment}
              onDeleteComment={handleDeleteComment}
              onReplyComment={handleReplyComment}
              onPushToProfessional={
                !isGuest && activeProject?.ownerId === currentUser?.id
                  ? handlePushToProfessional
                  : undefined
              }
              activeCommentId={activeCommentId}
              setActiveCommentId={setActiveCommentId}
              currentUserRole={currentUser.role}
              projectRole={getProjectRole(activeProject, currentUser, isGuest, impersonatedRole)}
              pageNumber={pageNumber}
              currentUser={currentUser}
            />
          </main>
        </div>

        {/* Re-use share modal for workspace */}
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => {
            console.log('[ShareModal] Closing modal');
            setIsShareModalOpen(false);
          }}
          project={projectToShare}
          onInvite={(email) => {
            console.log('[ShareModal] onInvite called with email:', email);
            handleInviteUser(email);
          }}
          onRemoveCollaborator={(email) => {
            console.log('[ShareModal] onRemoveCollaborator called with email:', email);
            handleRemoveCollaborator(email);
          }}
          onUpdateShareSettings={(projectId, settings) => {
            console.log('[ShareModal] onUpdateShareSettings called:', projectId, settings);
            handleUpdateShareSettings(projectId, settings);
          }}
          onRevokeAll={() => {
            console.log('[ShareModal] onRevokeAll called');
            handleRevokeAll();
          }}
        />
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onCreate={handleCreateProjectWithData}
        />

        {/* Toast Notifications */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {/* Admin Dashboard */}
        {isAdminMode && <AdminDashboard onClose={toggleAdminMode} />}
      </React.Fragment>
    );
  }

  // Fallback
  return null;
};

export default App;