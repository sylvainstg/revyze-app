import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PDFWorkspace } from './components/PDFWorkspace';
import { ImageWorkspace } from './components/ImageWorkspace';
import { CollaborationPanel } from './components/CollaborationPanel';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { MoodBoardWorkspace } from './components/MoodBoardWorkspace';

import { Dashboard } from './components/Dashboard';
import { Button } from './components/ui/Button';
import { PricingPage } from './components/PricingPage';
import { ThankYouPage } from './components/ThankYouPage';
import { WelcomeLandingPage } from './components/WelcomeLandingPage';
import { OnboardingTooltip } from './components/OnboardingTooltip';
import { ONBOARDING_STEPS } from './constants/onboardingSteps';
import { UserRole, Comment, Project, ViewState, User, CommentReply, ShareSettings, ProjectVersion, CommentAudience, MoodBoardElement } from './types';
import { Layout, Upload, FileText, UserPlus, ArrowLeft, ZoomIn, ZoomOut, AlertCircle, Camera } from 'lucide-react';
import { SAMPLE_PROJECT_ID, MAX_FILE_SIZE_MB, PLAN_LIMITS, STANDARD_CATEGORIES } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { ShareModal } from './components/ShareModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import * as storageService from './services/storageService';
import { db, storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as authService from './services/authService';
import { getPDFObjectURL, revokePDFObjectURL } from './utils/pdfUtils';
import { getProjectRole, getProjectRoleDisplay, getCommentAudience, canSeeComment } from './utils/projectRoleHelper';
import { getCategories, getVersionsByCategory, getNextCategoryVersion, DEFAULT_CATEGORY, migrateVersionsToCategories } from './utils/categoryHelpers';
import { fetchStripePricing, enrichPlansWithPricing } from './services/pricingService';
import { PLAN_METADATA } from './constants';

import { AdminPage } from './components/AdminPage';
import { useAdmin } from './contexts/AdminContext';
import { functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { Toast, ToastType } from './components/ui/Toast';
import { VersionUploadModal } from './components/VersionUploadModal';
import { VersionSelectorDetailed } from './components/VersionSelector';
import { CategorySelector } from './components/CategorySelector';
import { ManageVersionModal } from './components/ManageVersionModal';
import { EnhancedDeleteDialog } from './components/EnhancedDeleteDialog';
import { CemeteryView } from './components/CemeteryView';
import { FeedbackModal } from './components/FeedbackModal';
import { useEngagement } from './hooks/useEngagement';
import { doc, updateDoc, increment } from 'firebase/firestore';


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
  const [activeCategory, setActiveCategory] = useState<string>(DEFAULT_CATEGORY); // Active document category
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);

  // Track last optimistic update to prevent realtime listener from overwriting it
  const lastOptimisticUpdateRef = useRef<number>(0);

  // Track view state (pan/zoom) per category
  const [categoryViewStates, setCategoryViewStates] = useState<Record<string, { scale: number, panOffset: { x: number, y: number } }>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // Ref to track current pan offset without causing re-renders in App
  const currentPanOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const [commentFilter, setCommentFilter] = useState({
    active: true,
    resolved: false,
    deleted: false
  });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);


  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Referral State
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Invite Details State
  const [inviteDetails, setInviteDetails] = useState<{
    inviterName?: string;
    projectName?: string;
    role?: 'guest' | 'pro';
    inviteeName?: string;
    inviteeEmail?: string;
  } | null>(null);

  // Derived State
  const activeProject = projects.find(p => p.id === activeProjectId);
  // Robust version finding: try ID match, fallback to latest
  const activeVersion = activeProject?.versions.find(v => v.id === activeProject.currentVersionId)
    || (activeProject?.versions && activeProject.versions.length > 0 ? activeProject.versions[activeProject.versions.length - 1] : undefined);


  // Workspace State
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pdfScale, _setPdfScale] = useState(1.0);
  const [moodBoardScale, setMoodBoardScale] = useState(1.0);
  const isUserZooming = useRef(false);
  const [showPreviousVersionComments, setShowPreviousVersionComments] = useState(false);

  useEffect(() => {
    // Reset known page count when switching documents/versions
    setPageCount(null);
  }, [activeProjectId, activeProject?.currentVersionId, activeCategory]);

  useEffect(() => {
    if (!activeProject?.currentVersionId) return;
    const currentVersion = activeProject.versions.find(v => v.id === activeProject.currentVersionId);
    if (!currentVersion) return;
    const isPDF = currentVersion.fileName.toLowerCase().endsWith('.pdf');
    if (!isPDF) {
      setPageCount(1);
    }
  }, [activeProject?.currentVersionId, activeProject?.versions]);

  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Pricing & Limits
  const [enrichedPlans, setEnrichedPlans] = useState<any>(null);
  const [fetchedLimits, setFetchedLimits] = useState<any>(PLAN_LIMITS); // Default to hardcoded limits
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Feedback Campaign
  const { campaign: engagementCampaign, submit: submitEngagementAnswer, dismiss: dismissEngagement } = useEngagement(!!currentUser && !authLoading);
  const sessionStartRef = useRef<number | null>(null);
  const isGuestRef = useRef(isGuest);
  const viewRef = useRef(view);

  const recordSessionDuration = useCallback(async () => {
    if (!currentUser || !sessionStartRef.current) return;
    const duration = Date.now() - sessionStartRef.current;
    sessionStartRef.current = Date.now(); // reset so we don't double count
    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        lastSessionDuration: duration
      });
    } catch (err) {
      console.error('Failed to update session duration', err);
    }
  }, [currentUser]);

  // Collaborators helper
  const collaborators: string[] = activeProject
    ? Array.from(new Set([...(activeProject.collaborators || []), activeProject.ownerEmail])).filter(Boolean) as string[]
    : [];

  const incrementUserField = useCallback(async (field: string, amount: number = 1) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        [field]: increment(amount)
      });
    } catch (err) {
      console.error(`Failed to increment ${field} `, err);
    }
  }, [currentUser]);

  const setPdfScale = (newScale: number | ((prev: number) => number)) => {
    isUserZooming.current = true;
    _setPdfScale(newScale);
  };

  // --- Effects ---

  // 0. Fetch Stripe Pricing and Plan Limits on Mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setPricingLoading(true);

        // 1. Fetch Plan Limits
        let currentLimits = PLAN_LIMITS;
        try {
          const getPlanLimitsFunc = httpsCallable(functions, 'getPlanLimits');
          const limitsResult = await getPlanLimitsFunc();
          const limitsData = limitsResult.data as { limits: any };
          if (limitsData?.limits) {
            currentLimits = limitsData.limits;
            setFetchedLimits(currentLimits);
            console.log('Fetched dynamic plan limits:', currentLimits);
          }
        } catch (limitError) {
          console.error('Failed to fetch plan limits, using defaults:', limitError);
        }

        // 2. Fetch Stripe Pricing
        const stripePricing = await fetchStripePricing();

        // Construct dynamic metadata with fetched limits
        const dynamicMetadata = {
          ...PLAN_METADATA,
          free: { ...PLAN_METADATA.free, limits: currentLimits.free },
          pro: { ...PLAN_METADATA.pro, limits: currentLimits.pro },
          business: { ...PLAN_METADATA.business, limits: currentLimits.business }
        };

        const enriched = enrichPlansWithPricing(dynamicMetadata, stripePricing);
        setEnrichedPlans(enriched);
        setPricingError(null);
      } catch (error) {
        console.error('Failed to load pricing from Stripe:', error);
        console.warn('Using plan metadata without Stripe pricing. Update functions/.env with production Stripe key.');
        setPricingError('Could not load pricing from Stripe. Using default prices.');

        // Fallback: use metadata with default prices
        const currentLimits = fetchedLimits || PLAN_LIMITS; // Best effort to use what we have
        const fallbackPlans = {
          ...PLAN_METADATA,
          free: { ...PLAN_METADATA.free, limits: currentLimits.free, price: { monthly: '$0', yearly: '$0' }, priceIds: { monthly: null, yearly: null } },
          pro: { ...PLAN_METADATA.pro, limits: currentLimits.pro, price: { monthly: '$10', yearly: '$100' }, priceIds: { monthly: null, yearly: null } },
          business: { ...PLAN_METADATA.business, limits: currentLimits.business, price: { monthly: '$50', yearly: '$500' }, priceIds: { monthly: null, yearly: null } }
        };
        setEnrichedPlans(fallbackPlans);
      } finally {
        setPricingLoading(false);
      }
    };

    fetchData();
  }, []);

  // 1. Handle Shared Link and Referral Code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    const token = params.get('token');
    const inviterName = params.get('inviterName');
    const projectName = params.get('projectName');
    const inviteeName = params.get('inviteeName') || params.get('name');
    const role = params.get('role') as 'guest' | 'pro' | null;
    const ref = params.get('ref');

    // Capture project ID for deep linking even if not logged in
    if (projectId && !token && !pendingProjectId) {
      console.log('[Deep Linking] Capturing pending project ID:', projectId);
      setPendingProjectId(projectId);
    }

    // Handle referral code
    if (ref && !currentUser && !authLoading) {
      setReferralCode(ref);
      setView('landing'); // Show welcome landing page
      return;
    }

    if (inviterName || projectName || role || projectId) {
      setInviteDetails({
        inviterName: inviterName || undefined,
        projectName: projectName || undefined,
        role: role || undefined,
        inviteeName: inviteeName || undefined,
        inviteeEmail: params.get('inviteeEmail') || params.get('email') || undefined
      });
      // Show welcome landing page for project invitations and deep links too
      if (!currentUser && !authLoading) {
        if (view === 'auth' || view === 'landing') return;
        setView('landing');
        return;
      }
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
  }, [currentUser, authLoading]);

  // Handle Payment Success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setView('thank-you');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Keep refs updated
  useEffect(() => {
    isGuestRef.current = isGuest;
    viewRef.current = view;
  }, [isGuest, view]);

  // 1. Handle Auth Session
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuth((user) => {
      // Only update if not in guest mode or if user actually logs in
      if (!isGuestRef.current || user) {
        setCurrentUser(user);
        setAuthLoading(false);
        // Don't auto-redirect logged-in users from landing page
        // Let them view the marketing content if they want
        if (!user && !isGuestRef.current) {
          setActiveProjectId(null);
          setProjects([]);
          if (viewRef.current !== 'landing' && viewRef.current !== 'auth') {
            setView('landing');
          }
        }
      }
    });
    return () => unsubscribe();
  }, []); // Only set up auth listener once on mount

  // 1b. Track session duration (lightweight)
  useEffect(() => {
    if (!currentUser) return;

    if (!sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordSessionDuration();
      }
    };
    const handleBeforeUnload = () => {
      recordSessionDuration();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      recordSessionDuration();
    };
  }, []); // Only set up once - currentUser in deps causes loop when recordSessionDuration updates user doc

  // 2. Load Projects when User changes
  useEffect(() => {
    const loadProjects = async () => {
      if (currentUser && !isGuest) {
        const userProjects = await storageService.getProjectsForUser(currentUser);
        // Migrate versions to ensure they have category fields
        const migratedProjects = userProjects.map(project => {
          const migratedVersions = migrateVersionsToCategories(project.versions);
          // Check if migration actually changed anything
          const needsMigration = migratedVersions.some((v, i) =>
            v.category !== project.versions[i]?.category ||
            v.categoryVersionNumber !== project.versions[i]?.categoryVersionNumber
          );

          // If migration added fields, save to Firestore
          if (needsMigration) {
            console.log('[Migration] Saving migrated versions to Firestore for project:', project.id);
            storageService.updateProjectPartial(project.id, { versions: migratedVersions });
          }

          return {
            ...project,
            versions: migratedVersions
          };
        });
        setProjects(migratedProjects);
      } else if (!isGuest) {
        setProjects([]);
      }
    };
    loadProjects();
  }, [currentUser, isGuest]);

  // 3. Subscribe to active project changes (Realtime Updates)
  useEffect(() => {
    if (!activeProjectId || !currentUser || isGuest) return;

    const unsubscribe = storageService.subscribeToProject(activeProjectId, (updatedProject) => {
      console.log('[Realtime Listener] Received update for project:', updatedProject.id);

      // If project was deleted, remove it from state and navigate to dashboard
      if (updatedProject.deletedAt) {
        console.log('[Realtime Listener] Project was deleted, removing from state');
        setProjects(prev => prev.filter(p => p.id !== updatedProject.id));
        setView('dashboard');
        return;
      }

      // Migrate versions to ensure they have category fields
      const migratedProject = {
        ...updatedProject,
        versions: migrateVersionsToCategories(updatedProject.versions)
      };

      console.log('[Realtime Listener] Versions in update:',
        migratedProject.versions.map(v => ({ id: v.id, category: v.category, catVer: v.categoryVersionNumber }))
      );

      // Ignore updates that come within 2 seconds of an optimistic update
      const timeSinceOptimistic = Date.now() - lastOptimisticUpdateRef.current;
      if (timeSinceOptimistic < 2000) {
        console.log('[Realtime Listener] Ignoring update - too soon after optimistic update (', timeSinceOptimistic, 'ms)');
        return;
      }

      setProjects(prev => {
        // Check if project actually changed to avoid unnecessary re-renders
        const current = prev.find(p => p.id === migratedProject.id);

        if (current) {
          console.log('[Realtime Listener] Current versions:',
            current.versions.map(v => ({ id: v.id, category: v.category, catVer: v.categoryVersionNumber }))
          );
        }

        if (JSON.stringify(current) === JSON.stringify(migratedProject)) {
          console.log('[Realtime Listener] No changes detected, skipping update');
          return prev;
        }

        console.log('[Realtime Listener] Applying update to projects state');
        return prev.map(p => p.id === migratedProject.id ? migratedProject : p);
      });
    });

    return () => unsubscribe();
  }, [activeProjectId, isGuest]); // currentUser removed - causes loop when incrementUserField updates user doc

  // 4. Handle Deep Linking (?project=ID or pendingProjectId) for authenticated users
  useEffect(() => {
    if (authLoading || !currentUser || projects.length === 0 || isGuest) return;

    const params = new URLSearchParams(window.location.search);
    const projectIdParam = params.get('project') || pendingProjectId;
    const tokenParam = params.get('token');

    // Skip if it's a share link (handled by handle Shared Link effect)
    if (params.get('project') && tokenParam) return;

    if (projectIdParam) {
      // If we're already on this project, just clean up and return
      if (activeProjectId === projectIdParam && view === 'workspace') {
        if (pendingProjectId) setPendingProjectId(null);
        // Clean URL after delay
        const timer = setTimeout(() => {
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }, 500);
        return () => clearTimeout(timer);
      }

      console.log('[Deep Linking] Attempting to open project:', projectIdParam);
      const targetProject = projects.find(p => p.id === projectIdParam);

      if (targetProject) {
        console.log('[Deep Linking] Found matching project, opening workspace');
        setActiveProjectId(targetProject.id);

        // Prefer DEFAULT_CATEGORY ('Main Plans') or first available category over whatever was last active
        // especially to avoid showing the Mood Board first to invitees
        const categories = getCategories(targetProject.versions);
        const initialCategory = categories.includes(DEFAULT_CATEGORY)
          ? DEFAULT_CATEGORY
          : (categories.find(c => c !== 'Mood Board') || categories[0] || DEFAULT_CATEGORY);

        setActiveCategory(initialCategory);
        setView('workspace');
        setPendingProjectId(null);

        // Clean URL after a short delay
        setTimeout(() => {
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }, 800);
      } else {
        console.warn('[Deep Linking] Project not found or no access:', projectIdParam);
        setPendingProjectId(null);
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        if (view === 'landing' || view === 'auth') {
          setView('dashboard');
        }
      }
    }
  }, [currentUser, projects, authLoading, isGuest, activeProjectId, view, pendingProjectId]);


  // 3. Scroll to top whenever view changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);


  // Save zoom level to Firestore when it changes (debounced)
  // Save zoom level to Firestore when it changes (debounced)
  useEffect(() => {
    if (!activeProject || !currentUser) return;

    // Only save if the change came from user interaction
    if (!isUserZooming.current) {
      console.log('[Zoom Persistence] Skipping save - change not initiated by user');
      return;
    }

    // Robust check: handle undefined and float precision
    const currentDbZoom = activeProject.zoomLevel ?? 1.0;
    const diff = Math.abs(currentDbZoom - pdfScale);

    // If difference is negligible, don't save
    if (diff < 0.001) return;

    const timer = setTimeout(async () => {
      // Double check inside timeout with latest activeProject ref (if we had it)
      // But we removed activeProject from deps, so we use the one from closure.
      // This is risky if activeProject changes significantly (e.g. ID change).
      // But we only care about zoom here.

      // We should probably check if the project ID is still the same active one
      // But for now, let's just save.

      console.log('[Zoom Persistence] Saving zoom:', pdfScale, 'Previous:', currentDbZoom);
      await storageService.updateProjectZoom(activeProject.id, pdfScale);

    }, 1000); // Debounce for 1s

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfScale]);


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
    // Only owners can set the shared thumbnail
    if (!currentUser || activeProject.ownerId !== currentUser.id) {
      setToast({ message: 'Only the project owner can set the thumbnail.', type: 'error' });
      return;
    }

    try {
      // Detect file type
      const activeVer = activeProject.versions.find(v => v.id === activeProject.currentVersionId);
      if (!activeVer) return;

      const fileName = activeVer.fileName.toLowerCase();
      const isPDF = fileName.endsWith('.pdf');
      const isMoodBoard = activeVer.category === 'Mood Board';

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
      } else if (isMoodBoard) {
        // For Mood Boards, capture the mood board container
        const moodBoardContainer = document.querySelector('.mood-board-container') as HTMLElement;
        if (!moodBoardContainer) {
          setToast({ message: 'Could not capture thumbnail. Mood board container not found.', type: 'error' });
          return;
        }

        // Use html2canvas or similar library to capture the div
        // For now, we'll just use a placeholder or a generic image
        // This part would require a library like html2canvas
        // For simplicity, let's create a dummy blob for now
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 200;
        dummyCanvas.height = 150;
        const ctx = dummyCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, dummyCanvas.width, dummyCanvas.height);
          ctx.fillStyle = '#666';
          ctx.font = '16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Mood Board', dummyCanvas.width / 2, dummyCanvas.height / 2);
        }
        blob = await new Promise<Blob>((resolve) => {
          dummyCanvas.toBlob((blob) => {
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

  // Enhanced Delete Dialog State
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const handleDeleteProject = async (project: Project) => {
    // Show enhanced delete dialog instead of immediate delete
    console.log('[Delete] Setting projectToDelete:', project.name);
    console.log('[Delete] Current view:', view);
    setProjectSettingsProject(null);
    setProjectToDelete(project);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete || !currentUser) return;

    const success = await storageService.deleteProject(projectToDelete.id, currentUser.id);
    if (success) {
      // If we are deleting the currently active project, go back to dashboard
      if (activeProject && projectToDelete.id === activeProject.id) {
        setView('dashboard');
        setActiveProjectId(null);
      }

      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setToast({ message: 'Project moved to trash', type: 'success' });
      setProjectToDelete(null);
    } else {
      setToast({ message: 'Failed to delete project', type: 'error' });
    }
  };

  const handleRestoreProject = (project: Project) => {
    // Add restored project back to projects list
    setProjects(prev => [...prev, project].sort((a, b) => b.lastModified - a.lastModified));
    setToast({ message: 'Project restored successfully', type: 'success' });
    setView('dashboard');
  };

  // Debug: Log when projectToDelete changes
  useEffect(() => {
    console.log('[projectToDelete state changed]:', projectToDelete?.name || 'null', 'view:', view);
  }, [projectToDelete, view]);

  const handleSetDefaultPage = async (page: number) => {
    if (!activeProject || !activeCategory) return;

    const updatedSettings = {
      ...activeProject.categorySettings,
      [activeCategory]: {
        ...activeProject.categorySettings?.[activeCategory],
        defaultPage: page
      }
    };

    const updatedProject = {
      ...activeProject,
      categorySettings: updatedSettings,
      lastModified: Date.now()
    };

    await updateProjectState(updatedProject);
    setToast({ message: `Page ${page} set as default for ${activeCategory}`, type: 'success' });
  };

  const handleRelaunchOnboarding = async () => {
    if (!currentUser) return;

    try {
      // Update DB
      await authService.updateUserProfile(currentUser.id, { hasCompletedOnboarding: false });

      // Clear active project/session state so onboarding starts clean
      setCurrentUser({ ...currentUser, hasCompletedOnboarding: false });
      setActiveProjectId(null);
      setActiveCategory(DEFAULT_CATEGORY);
      setActiveCommentId(null);
      setShareModalProjectId(null);
      setProjectSettingsProject(null);
      setIsSidebarOpen(true);
      setPageNumber(1);
      setPageCount(null);
      setPdfScale(1.0);

      // Redirect to onboarding view
      setView('onboarding');

      setToast({ message: 'Onboarding relaunched!', type: 'success' });
    } catch (error) {
      console.error('Error relaunching onboarding:', error);
      setToast({ message: 'Failed to relaunch onboarding', type: 'error' });
    }
  };

  // --- Actions ---

  const handleAuthSuccess = (user: User, isNewUser: boolean) => {
    // Check if we have a deep link pending
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    const token = params.get('token');

    if (projectId && !token) {
      console.log('[Auth] Deep link detected, letting deep link effect handle it');
      // Just set view to a loading state or stay on current until projects load
      return;
    }

    // Auth state is handled by the subscription; always land on dashboard to start free
    setView('dashboard');
  };

  const handleCheckoutSuccess = async (planId: string) => {
    try {
      console.log('[handleCheckoutSuccess] Starting with planId:', planId);

      if (!currentUser) {
        console.error('[handleCheckoutSuccess] No current user');
        throw new Error('No user logged in');
      }

      // Update plan in DB
      // Ensure planId is a valid plan type
      const validPlan = (planId === 'free' || planId === 'pro' || planId === 'business') ? planId : 'free';
      console.log('[handleCheckoutSuccess] Valid plan:', validPlan);

      // Set subscription status based on plan
      // Pro users start with trial (free to experience, pay to invite)
      // Free users have no subscription status
      const subscriptionStatus = validPlan === 'pro' ? 'trialing' : undefined;

      console.log('[handleCheckoutSuccess] Updating user plan in DB...');
      await storageService.updateUserPlan(currentUser.id, validPlan, subscriptionStatus);

      // Update local state (will eventually be synced by auth listener if we re-fetched, but manual update is faster)
      setCurrentUser({ ...currentUser, plan: validPlan, subscriptionStatus });
      console.log('[handleCheckoutSuccess] User state updated');

      // After selecting plan, show onboarding if not completed
      if (!currentUser.hasCompletedOnboarding) {
        console.log('[handleCheckoutSuccess] Redirecting to onboarding');
        setView('onboarding');
        return;
      }

      console.log('[handleCheckoutSuccess] Redirecting to thank-you');
      setView('thank-you');
    } catch (error) {
      console.error('[handleCheckoutSuccess] Error:', error);
      throw error; // Re-throw to let CheckoutPage handle it
    }
  };

  const handleCreateProjectWithData = async (file: File, name: string, clientName: string) => {
    if (!currentUser) return;

    // Check Limits
    // Check Limits
    const plan = currentUser.plan || 'free';
    const limits = fetchedLimits[plan] || PLAN_LIMITS[plan]; // Use dynamic limits, fallback to static

    // Count owned projects (projects created by this user)
    const ownedProjects = projects.filter(p => p.ownerId === currentUser.id);
    const ownedCount = ownedProjects.length;

    // Check owned projects limit
    const isOwnedUnlimited = limits.ownedProjects === -1 || limits.ownedProjects === Infinity;
    if (!isOwnedUnlimited && ownedCount >= limits.ownedProjects) {
      if (confirm(`You have reached the limit of ${limits.ownedProjects} owned project${limits.ownedProjects > 1 ? 's' : ''} for the ${plan} plan. Upgrade to create more?`)) {
        setView('pricing');
      }
      return;
    }

    // Also check total projects limit (owned + shared)
    const isTotalUnlimited = limits.totalProjects === -1 || limits.totalProjects === Infinity;
    if (!isTotalUnlimited && projects.length >= limits.totalProjects) {
      if (confirm(`You have reached the limit of ${limits.totalProjects} total projects for the ${plan} plan. Upgrade for unlimited projects?`)) {
        setView('pricing');
      }
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      alert(`File is too large (${fileSizeMB.toFixed(1)}MB). Please choose a file under ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    // Upload to Firebase Storage
    const newProjectId = uuidv4();
    const path = `projects/${currentUser.id}/${newProjectId}/v1_${file.name}`;

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
      ownerName: currentUser.name,
      collaborators: [],
      name: name,
      clientName: clientName,
      lastModified: Date.now(),
      createdAt: Date.now(),
      currentVersionId: 'v1',
      activeCategory: DEFAULT_CATEGORY, // Set initial category
      versions: [{
        id: 'v1',
        versionNumber: 1,
        category: DEFAULT_CATEGORY,
        categoryVersionNumber: 1,
        fileUrl: downloadURL,
        fileName: file.name,
        uploadedBy: currentUser.role,
        uploaderEmail: currentUser.email,
        timestamp: Date.now(),
        comments: []
      }]
    };

    // Save to DB
    const success = await storageService.saveProject(newProject);
    if (success) {
      setProjects(prev => [newProject, ...prev]);
      setActiveProjectId(newProject.id);
      setActiveCategory(DEFAULT_CATEGORY); // Set active category state
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
    const project = projects.find(p => p.id === id);
    if (!project) return;

    setActiveProjectId(id);

    // Load saved zoom level or default to 1.0
    // IMPORTANT: Set isUserZooming to false to prevent this load from triggering a save
    isUserZooming.current = false;
    _setPdfScale(project.zoomLevel || 1.0);

    // Set active category
    const projectActiveCategory = project.activeCategory || getCategories(project.versions)[0] || DEFAULT_CATEGORY;
    setActiveCategory(projectActiveCategory);

    setView('workspace');

    // Check for default page in the active category
    const defaultPage = project.categorySettings?.[projectActiveCategory]?.defaultPage;
    if (defaultPage) {
      setPageNumber(defaultPage);
    } else {
      setPageNumber(1);
    }
  };


  // Modal State
  const [shareModalProjectId, setShareModalProjectId] = useState<string | null>(null);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [showVersionUploadModal, setShowVersionUploadModal] = useState(false);
  const [projectSettingsProject, setProjectSettingsProject] = useState<Project | null>(null);

  // Edit Version State
  const [editVersionModalOpen, setEditVersionModalOpen] = useState(false);
  const [versionToEdit, setVersionToEdit] = useState<ProjectVersion | null>(null);

  const handleShareClick = (project: Project) => {
    setShareModalProjectId(project.id);
    setIsShareModalOpen(true);
  };

  const handleOpenProjectSettings = (project: Project) => {
    setProjectSettingsProject(project);
  };

  const handleOpenInvitesFromSettings = () => {
    if (!projectSettingsProject) return;
    setShareModalProjectId(projectSettingsProject.id);
    setIsShareModalOpen(true);
    setProjectSettingsProject(null);
  };

  const handleSaveProjectSettings = async (updates: { name: string; description?: string }) => {
    if (!projectSettingsProject) return;
    await storageService.updateProjectPartial(projectSettingsProject.id, updates);
    setProjects(prev => prev.map(p => p.id === projectSettingsProject.id ? { ...p, ...updates } : p));
    // activeProject is derived from projects and setActiveProjectId, so no need to update it here
    // if (activeProject?.id === projectSettingsProject.id) {
    //   setActiveProject({ ...activeProject, ...updates });
    // }
  };

  // Version Management Functions
  const handleUploadNewVersion = async (file: File, category: string) => {
    if (!activeProject || !currentUser) return;

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setToast({ message: `File is too large(${fileSizeMB.toFixed(1)}MB).Please choose a file under ${MAX_FILE_SIZE_MB} MB.`, type: 'error' });
      return;
    }

    try {
      // Upload file to Firebase Storage
      const globalVersionNumber = activeProject.versions.length + 1;
      const categoryVersionNumber = getNextCategoryVersion(activeProject.versions, category);

      const storageRef = ref(storage, `projects / ${activeProject.id}/v${globalVersionNumber}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Create new version object
      const newVersion: ProjectVersion = {
        id: uuidv4(),
        versionNumber: globalVersionNumber,
        category,
        categoryVersionNumber,
        fileUrl: downloadURL,
        fileName: file.name,
        uploadedBy: currentUser.role,
        uploaderEmail: currentUser.email,
        timestamp: Date.now(),
        comments: []
      };

      // Update project
      const updatedProject = {
        ...activeProject,
        versions: [...activeProject.versions, newVersion],
        currentVersionId: newVersion.id,
        activeCategory: category, // Switch to this category
        lastModified: Date.now()
      };

      await updateProjectState(updatedProject);
      setActiveCategory(category);
      setShowVersionUploadModal(false);

      // Show success message
      setToast({ message: `Version ${categoryVersionNumber} uploaded to ${category}!`, type: 'success' });

    } catch (error) {
      console.error('Error uploading new version:', error);
      setToast({ message: 'Failed to upload new version. Please try again.', type: 'error' });
    }
  };

  const handleEditVersionClick = (version: ProjectVersion) => {
    setVersionToEdit(version);
    setEditVersionModalOpen(true);
  };

  const handleUpdateVersion = async (updates: { name: string; category: string }) => {
    if (!activeProject || !versionToEdit) return;

    const { name, category } = updates;
    const oldCategory = versionToEdit.category;

    // 1. Calculate new version number for this category if it changed
    let nextCatVer = versionToEdit.categoryVersionNumber;
    if (category !== oldCategory) {
      nextCatVer = getNextCategoryVersion(activeProject.versions, category);
    }

    console.log('[handleUpdateVersion] Starting update:', {
      versionId: versionToEdit.id,
      oldCategory,
      newCategory: category,
      newName: name,
      nextCatVer
    });

    // 2. Update the version
    const updatedVersion = {
      ...versionToEdit,
      name: name.trim() || undefined,
      category: category,
      categoryVersionNumber: nextCatVer
    };

    // 3. Update project versions
    const updatedVersions = activeProject.versions.map(v => v.id === versionToEdit.id ? updatedVersion : v);

    const updatedProject = {
      ...activeProject,
      versions: updatedVersions,
      lastModified: Date.now()
    };

    // If we moved the currently active version, switch the active category view to the new one
    if (versionToEdit.id === activeProject.currentVersionId) {
      updatedProject.activeCategory = category;
      setActiveCategory(category);
    }

    // 4. Save
    lastOptimisticUpdateRef.current = Date.now();
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));

    const success = await storageService.updateProjectPartial(activeProject.id, {
      versions: updatedVersions,
      activeCategory: updatedProject.activeCategory
    });

    if (success) {
      setToast({ message: `Version updated successfully`, type: 'success' });
      setEditVersionModalOpen(false);
      setVersionToEdit(null);
    } else {
      setToast({ message: 'Failed to update version', type: 'error' });
    }
  };

  const handleDeleteVersion = async () => {
    if (!activeProject || !versionToEdit || !currentUser) return;

    // Minimum 1 version required per project? 
    // Actually, mood board versions might be special, but let's assume we can't delete the last version overall.
    if (activeProject.versions.length <= 1) {
      setToast({ message: 'Cannot delete the only version of a project', type: 'error' });
      return;
    }

    const versionIdToDelete = versionToEdit.id;
    const categoryOfDeleted = versionToEdit.category;

    // Filter out the version
    const updatedVersions = activeProject.versions.filter(v => v.id !== versionIdToDelete);

    // Determine new active version if the deleted one was active
    let newActiveVersionId = activeProject.currentVersionId;
    let newActiveCategory = activeCategory;

    if (versionIdToDelete === activeProject.currentVersionId) {
      // Find another version in same category first
      const sameCategoryVersions = updatedVersions.filter(v => v.category === categoryOfDeleted);
      if (sameCategoryVersions.length > 0) {
        newActiveVersionId = sameCategoryVersions[0].id;
      } else {
        // Find latest version overall
        const sorted = [...updatedVersions].sort((a, b) => b.timestamp - a.timestamp);
        newActiveVersionId = sorted[0].id;
        newActiveCategory = sorted[0].category;
      }
    }

    const updatedProject: Project = {
      ...activeProject,
      versions: updatedVersions,
      currentVersionId: newActiveVersionId,
      activeCategory: newActiveCategory,
      lastModified: Date.now()
    };

    // Persist
    const success = await storageService.saveProject(updatedProject);
    if (success) {
      setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));
      setActiveCategory(newActiveCategory);
      setToast({ message: 'Version deleted successfully', type: 'success' });
      setEditVersionModalOpen(false);
      setVersionToEdit(null);
    } else {
      setToast({ message: 'Failed to delete version', type: 'error' });
    }
  };



  const handleChangeVersion = async (versionId: string) => {
    if (!activeProject) return;

    const updatedProject = {
      ...activeProject,
      currentVersionId: versionId,
      lastModified: Date.now()
    };

    await updateProjectState(updatedProject);
  };

  const getUnresolvedCommentsCount = (): number => {
    if (!activeVersion) return 0;
    return activeVersion.comments.filter(c => !c.resolved && !c.deleted).length;
  };

  // Derived project for modal
  const projectToShare = projects.find(p => p.id === shareModalProjectId) || null;

  const getInviterDisplayName = (project: Project | null) => {
    const candidate = currentUser?.name || '';
    const isEmail = candidate.includes('@');
    if (candidate && !isEmail) return candidate;

    const emailSource = currentUser?.email || project?.ownerEmail || '';
    if (emailSource) {
      const local = emailSource.split('@')[0];
      const friendly = local.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      if (friendly) return friendly;
    }
    return 'Project Owner';
  };

  const handleInviteUser = async (email: string, role: 'guest' | 'pro', name?: string) => {
    console.log('[handleInviteUser] START - email:', email, 'role:', role, 'name:', name, 'projectToShare:', projectToShare?.id);
    if (!projectToShare) {
      console.log('[handleInviteUser] ABORT - no projectToShare');
      return;
    }

    if (!currentUser) {
      console.log('[handleInviteUser] ABORT - no currentUser');
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
        const inviterDisplayName = getInviterDisplayName(projectToShare);

        // Construct base URL parameters
        const params = new URLSearchParams();
        params.append('project', projectToShare.id);
        params.append('inviterName', inviterDisplayName);
        params.append('projectName', projectToShare.name);
        params.append('role', role);
        if (name) params.append('inviteeName', name);

        if (projectToShare.shareSettings?.enabled) {
          params.append('token', projectToShare.shareSettings.shareToken);
        }

        const shareUrl = `${window.location.origin}?${params.toString()}`;

        await sendInvitation({
          email,
          projectName: projectToShare.name,
          url: shareUrl,
          inviterName: inviterDisplayName,
          inviteeName: name
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

  const handleUpdateShareSettings = async (projectId: string, settings: ShareSettings) => {
    // Optimistic Update
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          shareSettings: settings
        };
      }
      return p;
    }));

    const success = await storageService.updateProjectShareSettings(projectId, settings);
    if (!success) {
      console.error('Failed to update share settings');
      // Revert optimistic update (optional, but good practice)
      // For now, we rely on the user refreshing if it fails, or we could fetch the project again.
      alert('Failed to update share settings');
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
      authorName: isGuest ? 'Guest' : currentUser.name,
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
    incrementUserField('commentCount');
  };

  const handleReplyComment = async (commentId: string, text: string, mentions?: string[]) => {
    if (!activeProject || !activeVersion || !currentUser) return;

    const newReply: CommentReply = {
      id: uuidv4(),
      text,
      author: currentUser.role,
      authorName: currentUser.name,
      timestamp: Date.now(),
      mentions
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
    incrementUserField('commentCount');
  };

  const handleResolveComment = async (id: string) => {
    if (!activeProject || !activeVersion || !currentUser) return;

    // Only project owner can resolve/unresolve
    if (activeProject.ownerId !== currentUser.id) {
      console.warn('[App.tsx] Unauthorized resolve attempt:', { id, userId: currentUser.id });
      return;
    }

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
    if (!activeProject || !activeVersion || !currentUser) return;

    // Find the comment and check permissions
    const comment = activeVersion.comments.find(c => c.id === id);
    if (!comment) return;

    const isOwner = activeProject.ownerId === currentUser.id;
    const isAuthor = comment.authorName === currentUser.email;

    if (!isOwner && !isAuthor) {
      console.warn('[App.tsx] Unauthorized delete attempt:', { id, userId: currentUser.id });
      return;
    }

    const updatedProject = {
      ...activeProject,
      versions: activeProject.versions.map(v => {
        if (v.id === activeProject.currentVersionId) {
          // Soft delete: mark as deleted instead of removing
          return { ...v, comments: v.comments.map(c => c.id === id ? { ...c, deleted: true } : c) };
        }
        return v;
      })
    };

    await updateProjectState(updatedProject);
    if (activeCommentId === id) setActiveCommentId(null);
  };

  const handleUpdateMoodBoardElements = async (elements: MoodBoardElement[]) => {
    if (!activeProject || !activeVersion) return;

    const updatedProject = {
      ...activeProject,
      versions: activeProject.versions.map(v =>
        v.id === activeVersion.id
          ? { ...v, moodBoardElements: elements }
          : v
      )
    };

    await updateProjectState(updatedProject);
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

  // Render views

  // Enhanced Delete Dialog - render at absolute top level
  const renderDeleteDialog = () => {
    if (projectToDelete) {
      console.log('[App.tsx] About to render EnhancedDeleteDialog');
      return (
        <EnhancedDeleteDialog
          project={projectToDelete}
          onConfirm={confirmDeleteProject}
          onCancel={() => setProjectToDelete(null)}
        />
      );
    }
    return null;
  };

  if (view === 'landing') {
    // Show welcome landing page for referrals or project invitations
    if (referralCode || inviteDetails) {
      return (
        <>
          <WelcomeLandingPage
            referralCode={referralCode || undefined}
            inviterName={inviteDetails?.inviterName}
            projectName={inviteDetails?.projectName}
            inviteRole={inviteDetails?.role}
            inviteeName={inviteDetails?.inviteeName}
            onGetStarted={() => {
              setAuthMode('register');
              setView('auth');
            }}
          />
        </>
      );
    }

    // Show regular landing page
    return (
      <LandingPage
        enrichedPlans={enrichedPlans}
        pricingLoading={pricingLoading}
        currentUser={currentUser}
        onGetStarted={() => {
          if (currentUser) {
            setView('dashboard');
          } else {
            setAuthMode('register');
            setView('auth');
          }
        }}
        onLogin={() => {
          if (currentUser) {
            setView('dashboard');
          } else {
            setAuthMode('login');
            setView('auth');
          }
        }}
        onPricingClick={() => setView('checkout')}
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
        inviteRole={inviteDetails?.role}
        inviteeName={inviteDetails?.inviteeName}
        inviteeEmail={inviteDetails?.inviteeEmail}
        referralCode={referralCode || undefined}
      />
    );
  }

  if (view === 'checkout') {
    return (
      <PricingPage
        enrichedPlans={enrichedPlans}
        pricingLoading={pricingLoading}
        user={currentUser}
        onBack={() => {
          if (currentUser) {
            setView('dashboard');
          } else {
            setAuthMode('register');
            setView('auth');
          }
        }}
      />
    );
  }

  if (view === 'admin' && currentUser) {
    return (
      <AdminPage
        onBack={() => setView('dashboard')}
        currentUser={currentUser}
      />
    );
  }

  if (view === 'cemetery' && currentUser) {
    return (
      <CemeteryView
        currentUser={currentUser}
        onRestore={handleRestoreProject}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'dashboard' && currentUser) {
    return (
      <>
        {renderDeleteDialog()}
        <Dashboard
          user={currentUser}
          projects={projects}
          limits={fetchedLimits}
          onCreateProject={() => setIsCreateProjectModalOpen(true)}
          onImportProject={handleImportProject}
          onOpenProject={handleOpenProject}
          onShareProject={handleShareClick}
          onGoToLanding={() => setView('landing')}
          onLogout={() => {
            authService.logoutUser();
            // View change handled by effect
          }}
          onUpgrade={() => setView('pricing')}
          onDeleteProject={handleDeleteProject}
          onOpenProjectSettings={handleOpenProjectSettings}
          onOpenAdmin={() => setView('admin')}
          onOpenCemetery={() => setView('cemetery')}
          onRelaunchOnboarding={handleRelaunchOnboarding}
        />
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          onInvite={handleInviteUser}
          onRemoveCollaborator={handleRemoveCollaborator}
          onRevokeAll={handleRevokeAll}
          onUpdateShareSettings={handleUpdateShareSettings}
          onTransferOwnership={async (newOwnerEmail) => {
            if (!projectToShare || !currentUser) return;

            try {
              const result = await storageService.transferProjectOwnership(projectToShare.id, currentUser.id, newOwnerEmail);
              if (result.success) {
                alert('Ownership transferred successfully.');
                setIsShareModalOpen(false);
                // Optionally reload project or redirect
                // Since we are now a guest, the realtime listener should update the project role
              } else {
                alert(`Transfer failed: ${result.message}`);
              }
            } catch (error) {
              console.error('Transfer ownership error:', error);
              alert('An error occurred during ownership transfer.');
            }
          }}
          onUpgradeRequest={() => setView('pricing')}
          currentUser={currentUser}
          project={projectToShare}
        />
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onCreate={handleCreateProjectWithData}
          userRole={currentUser?.role}
          userName={currentUser?.name}
        />
        <ProjectSettingsModal
          isOpen={!!projectSettingsProject}
          project={projectSettingsProject}
          onClose={() => setProjectSettingsProject(null)}
          onSave={handleSaveProjectSettings}
          onOpenInvites={handleOpenInvitesFromSettings}
          onDelete={() => {
            if (projectSettingsProject) {
              handleDeleteProject(projectSettingsProject);
            }
          }}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </>
    );
  }

  if (view === 'pricing' && currentUser) {
    return (
      <PricingPage
        enrichedPlans={enrichedPlans}
        pricingLoading={pricingLoading}
        user={currentUser}
        onBack={() => setView('dashboard')}
      />
    );
  }

  // Add ThankYouPage route
  if (view === 'thank-you') {
    return (
      <ThankYouPage
        onGoToDashboard={() => setView('dashboard')}
        plan={currentUser?.plan}
      />
    );
  }

  // Onboarding Logic (handlers)
  const showOnboarding = currentUser && !currentUser.hasCompletedOnboarding && view === 'workspace';

  const handleOnboardingNext = async () => {
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      setOnboardingStep(prev => prev + 1);
    } else {
      // Complete
      await authService.updateUserProfile(currentUser!.id, { hasCompletedOnboarding: true });
      setCurrentUser({ ...currentUser!, hasCompletedOnboarding: true });
    }
  };

  const handleOnboardingSkip = async () => {
    await authService.updateUserProfile(currentUser!.id, { hasCompletedOnboarding: true });
    setCurrentUser({ ...currentUser!, hasCompletedOnboarding: true });
  };

  // Workspace View
  const handlePanChange = (offset: { x: number; y: number }) => {
    setCategoryViewStates(prev => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        panOffset: offset
      }
    }));
  };

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
        {renderDeleteDialog()}
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-30" style={{ transform: 'none' }}>
            <div className="flex items-center gap-4">
              <button onClick={() => setView('landing')} className="hover:opacity-80 transition-opacity">
                <img src="/revyze-logo.png" alt="Revyze" className="h-16 w-auto object-contain" />
              </button>
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

              {canShare && activeProject && (
                <Button
                  variant="primary"
                  size="sm"
                  className="shadow-sm"
                  icon={<UserPlus className="w-4 h-4" />}
                  onClick={() => handleShareClick(activeProject)}
                >
                  Invite
                </Button>
              )}
            </div>
          </header>

          {/* Category Selector */}
          {activeProject && (
            <CategorySelector
              versions={activeProject.versions}
              activeCategory={activeCategory}
              onCategoryChange={(category) => {
                setActiveCategory(category);
                // Switch to latest version of the new category
                const categoryVersions = getVersionsByCategory(activeProject.versions, category);
                if (categoryVersions.length > 0) {
                  const latestVersion = categoryVersions[0];
                  const updatedProject = {
                    ...activeProject,
                    currentVersionId: latestVersion.id,
                    activeCategory: category
                  };
                  updateProjectState(updatedProject);

                  // Set page to default if exists, otherwise 1
                  const defaultPage = activeProject.categorySettings?.[category]?.defaultPage;
                  setPageNumber(defaultPage || 1);
                } else if (category === 'Mood Board') {
                  // Auto-create initial Mood Board version
                  const newMoodBoardVersion: ProjectVersion = {
                    id: uuidv4(),
                    versionNumber: activeProject.versions.length + 1,
                    category: 'Mood Board',
                    categoryVersionNumber: 1,
                    fileUrl: 'mood-board-placeholder', // Special flag for mood board
                    fileName: 'Mood Board',
                    uploadedBy: currentUser.role,
                    uploaderEmail: currentUser.email,
                    timestamp: Date.now(),
                    comments: [],
                    moodBoardElements: []
                  };
                  const updatedProject = {
                    ...activeProject,
                    versions: [...activeProject.versions, newMoodBoardVersion],
                    currentVersionId: newMoodBoardVersion.id,
                    activeCategory: category
                  };
                  updateProjectState(updatedProject);
                }
              }}
            />
          )}

          {/* Main workspace area - flex layout */}
          <main className="flex-1 flex overflow-hidden">
            {/* PDF Viewer - grows to fill available space */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {(() => {
                // Detect file type from fileName
                const fileName = activeVersion.fileName.toLowerCase();
                const isPDF = fileName.endsWith('.pdf');

                const currentProjectRole = getProjectRole(activeProject, currentUser, isGuest, impersonatedRole);

                const filteredComments = activeVersion.comments.filter(c => canSeeComment(c, currentProjectRole) && !c.deleted);

                const handleFocusComment = (commentId: string) => {
                  setIsSidebarOpen(true);
                  setActiveCommentId(commentId);
                  // The sidebar list item will handle scrolling into view when activeCommentId changes
                };

                // Filter versions by active category for version selector
                const categoryVersions = getVersionsByCategory(activeProject.versions, activeCategory);

                // If no versions in this category, show upload prompt
                if (categoryVersions.length === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
                      <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full">
                        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          {activeCategory} is empty
                        </h3>
                        <p className="text-slate-500 mb-6">
                          There are no documents in this category yet. Upload the first version to get started.
                        </p>
                        <Button
                          onClick={() => setShowVersionUploadModal(true)}
                          icon={<Upload className="w-4 h-4" />}
                        >
                          Upload Version
                        </Button>
                      </div>
                    </div>
                  );
                }

                // Debug logging for onEditVersion
                console.log('[DEBUG] Rendering workspace:', {
                  isPDF,
                  ownerId: activeProject.ownerId,
                  currentUserId: currentUser.id,
                  isOwner: activeProject.ownerId === currentUser.id,
                  onEditVersionDefined: !!(activeProject.ownerId === currentUser.id ? handleEditVersionClick : undefined),
                  categoryVersionsCount: categoryVersions.length
                });

                // Determine if this is the latest version in the category
                // Sort versions by timestamp descending to find the latest
                const sortedCategoryVersions = [...categoryVersions].sort((a, b) => b.timestamp - a.timestamp);
                const latestVersionId = sortedCategoryVersions.length > 0 ? sortedCategoryVersions[0].id : null;
                const isLatestVersion = activeVersion.id === latestVersionId;

                return (
                  <div className="h-full flex flex-col">
                    {!isLatestVersion && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>You are viewing an older version. Editing and commenting are disabled.</span>
                        </div>
                        {latestVersionId && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleChangeVersion(latestVersionId)}
                          >
                            Go to latest
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="flex-1">
                      {activeCategory === 'Mood Board' ? (
                        <MoodBoardWorkspace
                          elements={activeVersion.moodBoardElements || []}
                          onUpdateElements={handleUpdateMoodBoardElements}
                          currentUser={currentUser}
                          scale={moodBoardScale}
                          setScale={setMoodBoardScale}
                        />
                      ) : isPDF ? (
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
                          filter={commentFilter}
                          versions={categoryVersions}
                          currentVersionId={activeProject.currentVersionId}
                          onVersionChange={handleChangeVersion}
                          onUploadNewVersion={() => setShowVersionUploadModal(true)}
                          canUploadVersion={activeProject.ownerId === currentUser.id}
                          onEditVersion={activeProject.ownerId === currentUser.id ? handleEditVersionClick : undefined}
                          initialPanOffset={categoryViewStates[activeCategory]?.panOffset || { x: 0, y: 0 }}
                          onPanChange={handlePanChange}
                          onFocusComment={handleFocusComment}
                          canAddComment={isLatestVersion}
                          onCaptureThumbnail={handleCaptureThumbnail}
                          onSetDefaultPage={handleSetDefaultPage}
                          isDefaultPage={activeProject.categorySettings?.[activeCategory]?.defaultPage === pageNumber}
                          isOwner={activeProject.ownerId === currentUser.id}
                          showPreviousVersionComments={showPreviousVersionComments}
                          onTogglePreviousComments={setShowPreviousVersionComments}
                          onPageCountChange={setPageCount}
                          collaborators={collaborators}
                          currentUserEmail={currentUser.email}
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
                          filter={commentFilter}
                          versions={categoryVersions}
                          currentVersionId={activeProject.currentVersionId}
                          onVersionChange={handleChangeVersion}
                          onUploadNewVersion={() => setShowVersionUploadModal(true)}
                          canUploadVersion={activeProject.ownerId === currentUser.id}
                          onEditVersion={activeProject.ownerId === currentUser.id ? handleEditVersionClick : undefined}
                          initialPanOffset={categoryViewStates[activeCategory]?.panOffset || { x: 0, y: 0 }}
                          onPanChange={handlePanChange}
                          onFocusComment={handleFocusComment}
                          canAddComment={isLatestVersion}
                          isOwner={activeProject.ownerId === currentUser.id}
                          onCaptureThumbnail={handleCaptureThumbnail}
                          showPreviousVersionComments={showPreviousVersionComments}
                          onTogglePreviousComments={setShowPreviousVersionComments}
                        />
                      )}
                    </div>
                  </div>
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
              onPageChange={(page) => setPageNumber(page)}
              pageCount={pageCount}
              currentUser={currentUser}
              filter={commentFilter}
              onUpdateFilter={setCommentFilter}
              isCollapsed={!isSidebarOpen}
              onToggleCollapse={(collapsed) => setIsSidebarOpen(!collapsed)}
              collaborators={collaborators}
              currentUserEmail={currentUser.email}
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
          onInvite={(email, role, name) => {
            console.log('[ShareModal] onInvite called with email:', email, 'role:', role, 'name:', name);
            handleInviteUser(email, role, name);
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
          onUpgradeRequest={() => setView('pricing')}
          currentUser={currentUser}
        />
        <ProjectSettingsModal
          isOpen={!!projectSettingsProject}
          project={projectSettingsProject}
          onClose={() => setProjectSettingsProject(null)}
          onSave={handleSaveProjectSettings}
          onOpenInvites={handleOpenInvitesFromSettings}
          onDelete={() => {
            if (projectSettingsProject) {
              handleDeleteProject(projectSettingsProject);
            }
          }}
        />
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onCreate={handleCreateProjectWithData}
        />

        {/* Manage Version Modal */}
        {activeProject && versionToEdit && (
          <ManageVersionModal
            isOpen={editVersionModalOpen}
            onClose={() => {
              setEditVersionModalOpen(false);
              setVersionToEdit(null);
            }}
            onSave={handleUpdateVersion}
            onDelete={handleDeleteVersion}
            currentName={versionToEdit.name || ''}
            currentCategory={versionToEdit.category || DEFAULT_CATEGORY}
            existingCategories={getCategories(activeProject.versions)}
            versionDisplay={`Version ${versionToEdit.versionNumber} - ${versionToEdit.fileName}`}
          />
        )}

        {/* Toast Notifications */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {/* Version Upload Modal */}
        {showVersionUploadModal && activeProject && activeVersion && (
          <VersionUploadModal
            isOpen={showVersionUploadModal}
            onClose={() => setShowVersionUploadModal(false)}
            onUpload={handleUploadNewVersion}
            unresolvedCommentsCount={getUnresolvedCommentsCount()}
            currentFileName={activeVersion.fileName}
            existingCategories={Array.from(new Set([...getCategories(activeProject.versions), ...STANDARD_CATEGORIES, activeCategory])).sort()}
            activeCategory={activeCategory}
          />
        )}

        {/* Admin Dashboard */}
        {isAdminMode && currentUser && (
          <div className="fixed inset-0 z-50 bg-white overflow-auto">
            <AdminPage onBack={toggleAdminMode} currentUser={currentUser} />
          </div>
        )}


        {/* Onboarding Tooltip */}
        {showOnboarding && (
          <OnboardingTooltip
            step={ONBOARDING_STEPS[onboardingStep]}
            currentStep={onboardingStep}
            totalSteps={ONBOARDING_STEPS.length}
            onNext={handleOnboardingNext}
            onSkip={handleOnboardingSkip}
          />
        )}

        {/* Engagement Campaign Modal */}
        {engagementCampaign && (
          <FeedbackModal
            campaign={engagementCampaign}
            onSubmit={submitEngagementAnswer}
            onDismiss={dismissEngagement}
          />
        )}

      </React.Fragment>
    );
  }

  // Fallback
  return null;
};

export default App;
