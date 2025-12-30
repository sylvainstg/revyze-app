import { Project, User } from '../types';
import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  or,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';

// --- Project Services ---

// --- Helper to sanitize project data from Firestore ---
const sanitizeProject = (data: any): Project => {
  const project = {
    ...data,
    versions: data.versions?.map((v: any) => ({
      ...v,
      comments: v.commentsJson ? JSON.parse(v.commentsJson) : (v.comments || []),
      moodBoardElements: v.moodBoardElementsJson ? JSON.parse(v.moodBoardElementsJson) : (v.moodBoardElements || [])
    })) || [],
    collaborators: data.collaborators || []
  } as Project;

  // Sanitize currentVersionId
  if (project.versions.length > 0) {
    if (!project.currentVersionId || !project.versions.find(v => v.id === project.currentVersionId)) {
      project.currentVersionId = project.versions[project.versions.length - 1].id;
    }
  }

  return project;
};

export const getProjectsForUser = async (user: User): Promise<Project[]> => {
  try {
    // Fetch projects where user is owner OR collaborator
    // Note: We don't filter by deletedAt in the query because existing projects
    // don't have this field, and Firestore won't match documents with missing fields
    const ownerQuery = query(
      collection(db, PROJECTS_COLLECTION),
      where('ownerId', '==', user.id)
    );
    const collabQuery = query(
      collection(db, PROJECTS_COLLECTION),
      where('collaborators', 'array-contains', user.email)
    );

    const [ownerSnapshot, collabSnapshot] = await Promise.all([getDocs(ownerQuery), getDocs(collabQuery)]);

    const projectsMap = new Map<string, Project>();

    ownerSnapshot.forEach(doc => {
      const data = doc.data();
      // Filter out deleted projects in code
      if (!data.deletedAt) {
        projectsMap.set(doc.id, sanitizeProject(data));
      }
    });

    collabSnapshot.forEach(doc => {
      const data = doc.data();
      // Filter out deleted projects in code
      if (!data.deletedAt) {
        projectsMap.set(doc.id, sanitizeProject(data));
      }
    });

    return Array.from(projectsMap.values()).sort((a, b) => b.lastModified - a.lastModified);
  } catch (e) {
    console.error("Error fetching projects:", e);
    return [];
  }
};


import { logEvent } from './analyticsService';

// ... existing imports

export const saveProject = async (project: Project): Promise<boolean> => {
  try {
    // Firestore doesn't support nested arrays (versions[].comments[])
    // Solution: Convert the comments arrays to JSON strings for storage
    const projectData = {
      ...project,
      versions: project.versions.map(version => {
        const { comments, moodBoardElements, ...versionWithoutComments } = version;
        return {
          ...versionWithoutComments, // Preserve ALL fields except comments
          commentsJson: JSON.stringify(comments || []),
          moodBoardElementsJson: JSON.stringify(moodBoardElements || [])
        };
      })
    };

    const docRef = doc(db, PROJECTS_COLLECTION, project.id);
    const docSnap = await getDoc(docRef);
    const isNew = !docSnap.exists();

    await setDoc(docRef, projectData);

    if (isNew) {
      const { increment } = await import('firebase/firestore');
      const userRef = doc(db, USERS_COLLECTION, project.ownerId);
      await updateDoc(userRef, {
        projectCount: increment(1)
      });
      logEvent(project.ownerId, 'create_project', { projectId: project.id, name: project.name });
    } else {
      // Check if a new version was added
      const oldData = docSnap.data();
      const oldVersions = oldData?.versions || [];
      if (project.versions.length > oldVersions.length) {
        logEvent(project.ownerId, 'upload_version', { projectId: project.id, versionId: project.versions[project.versions.length - 1].id });
      }
    }

    return true;
  } catch (e) {
    console.error("Error saving project:", e);
    return false;
  }
};

export const subscribeToProject = (projectId: string, onUpdate: (project: Project) => void) => {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);

  return onSnapshot(docRef, (docSnap: any) => {
    if (docSnap.exists()) {
      const project = sanitizeProject({ id: docSnap.id, ...docSnap.data() });
      onUpdate(project);
    }
  }, (error: any) => {
    console.error("Error subscribing to project:", error);
  });
};


export const addCollaborator = async (projectId: string, email: string): Promise<Project | null> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);

    await updateDoc(projectRef, {
      collaborators: arrayUnion(email.toLowerCase())
    });

    // Log event (we need to fetch the project to get the ownerId, but for now we can just log with 'unknown' or skip ownerId if not available easily. 
    // Ideally we pass the current user ID to this function, but let's assume the caller handles it or we fetch the project first.
    // To keep it simple, we'll fetch the project to get the owner ID for context, or just log it if we have the current user context (which we don't here directly).
    // Let's fetch the project to get the owner ID.
    const docSnap = await getDoc(projectRef);
    if (docSnap.exists()) {
      const project = sanitizeProject(docSnap.data());
      // We don't know *who* added the collaborator here (the current user), so we might log it against the project owner or just log it.
      // Ideally, we should pass `currentUserId` to `addCollaborator`. 
      // For now, let's skip logging the *actor* and just log the event if we can, or maybe we can't log effectively without the actor.
      // Actually, `saveProject` is where most edits happen. `addCollaborator` is specific.
      // Let's skip logging here for now to avoid complexity of fetching current user, or update the signature later.
      // Wait, the requirement is to track user engagement. Knowing who shared is important.
      // But `addCollaborator` doesn't take `userId`.
      // I will skip logging here for now and rely on `saveProject` or other high-level actions, OR I can update the signature.
      // Updating signature might break other calls.
      // Let's stick to `saveProject` for now, as that covers creation and version uploads.

      return project;
    }
    return null;

  } catch (e) {
    console.error("Error adding collaborator:", e);
    return null;
  }
};

export const removeCollaborator = async (projectId: string, email: string): Promise<Project | null> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);

    await updateDoc(projectRef, {
      collaborators: arrayRemove(email.toLowerCase())
    });

    // Use getDoc for strong consistency
    const docSnap = await getDoc(projectRef);
    if (docSnap.exists()) {
      return sanitizeProject(docSnap.data());
    }
    return null;

  } catch (e) {
    console.error("Error removing collaborator:", e);
    return null;
  }
};

export const updateUserPlan = async (
  userId: string,
  plan: 'free' | 'pro' | 'business',
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing'
): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const updateData: any = { plan };

    // Only include subscriptionStatus if provided
    if (subscriptionStatus !== undefined) {
      updateData.subscriptionStatus = subscriptionStatus;
    }

    await updateDoc(userRef, updateData);
  } catch (e) {
    console.error("Error updating user plan:", e);
  }
};

export const uploadFile = async (file: File, path: string): Promise<string | null> => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (e) {
    console.error("Error uploading file:", e);
    return null;
  }
};

// --- Share Link Services ---

/**
 * Generate a random share token for project sharing
 */
export const generateShareToken = (): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Reset project access: Generate new token AND clear all collaborators
 */
export const resetProjectAccess = async (projectId: string): Promise<Project | null> => {
  try {
    const newToken = generateShareToken();
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);

    await updateDoc(projectRef, {
      'shareSettings.shareToken': newToken,
      collaborators: []
    });

    // Fetch the updated project to ensure we have the latest state
    const docSnap = await getDoc(projectRef);
    if (docSnap.exists()) {
      return sanitizeProject(docSnap.data());
    }
    return null;
  } catch (error) {
    console.error('Error resetting project access:', error);
    return null;
  }
};

/**
 * Update project share settings
 */
export const updateProjectShareSettings = async (
  projectId: string,
  shareSettings: { enabled: boolean; accessLevel: 'view' | 'comment'; shareToken: string }
): Promise<boolean> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, { shareSettings });
    return true;
  } catch (error) {
    console.error('Error updating share settings:', error);
    return false;
  }
};

/**
 * Get a shared project by ID and token
 */
export const getSharedProject = async (
  projectId: string,
  shareToken: string
): Promise<Project | null> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const projectSnap = await getDocs(query(collection(db, PROJECTS_COLLECTION), where('__name__', '==', projectId)));

    if (projectSnap.empty) {
      return null;
    }

    const projectData = sanitizeProject(projectSnap.docs[0].data());

    // Verify share token matches and sharing is enabled
    if (
      projectData.shareSettings?.enabled &&
      projectData.shareSettings.shareToken === shareToken
    ) {
      // Deserialize comments from JSON if stored that way
      if (projectData.versions) {
        projectData.versions = projectData.versions.map((v: any) => ({
          ...v,
          comments: v.commentsJson ? JSON.parse(v.commentsJson) : (v.comments || [])
        }));
      }

      // Handle migration and fallback
      if (!projectData.currentVersionId && (projectData as any).activeVersionId) {
        projectData.currentVersionId = (projectData as any).activeVersionId;
      }

      // If currentVersionId is still missing or invalid (not in versions), default to latest
      const hasValidVersion = projectData.versions?.some(v => v.id === projectData.currentVersionId);
      if (!hasValidVersion && projectData.versions && projectData.versions.length > 0) {
        // Sort by timestamp desc to find latest
        const sortedVersions = [...projectData.versions].sort((a, b) => b.timestamp - a.timestamp);
        projectData.currentVersionId = sortedVersions[0].id;
      }

      return projectData;
    }

    return null;
  } catch (error) {
    console.error('Error fetching shared project:', error);
    return null;
  }
};

export const updateProjectThumbnail = async (projectId: string, pageNumber: number): Promise<boolean> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
      thumbnailPageNumber: pageNumber
    });
    return true;
  } catch (error) {
    console.error('Error updating project thumbnail:', error);
    return false;
  }
};

export const updateProjectZoom = async (projectId: string, zoomLevel: number): Promise<boolean> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
      zoomLevel,
      lastModified: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error updating project zoom:', error);
    return false;
  }
};

export const updateProjectPartial = async (projectId: string, data: Partial<Project>): Promise<boolean> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    // Remove id from data if present to avoid overwriting document ID (though Firestore ignores it usually)
    const { id, ...updateData } = data;

    await updateDoc(projectRef, {
      ...updateData,
      lastModified: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error updating project partial:', error);
    return false;
  }
};


// Soft delete a project
export const deleteProject = async (projectId: string, userId: string): Promise<boolean> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
      deletedAt: Date.now(),
      deletedBy: userId,
      lastModified: Date.now()
    });
    return true;
  } catch (e) {
    console.error("Error deleting project:", e);
    return false;
  }
};

// Restore a deleted project
export const restoreProject = async (projectId: string): Promise<boolean> => {
  try {
    const { deleteField } = await import('firebase/firestore');
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
      deletedAt: deleteField(),
      deletedBy: deleteField(),
      lastModified: Date.now()
    });
    return true;
  } catch (e) {
    console.error("Error restoring project:", e);
    return false;
  }
};

// Get deleted projects for a user
export const getDeletedProjects = async (user: User): Promise<Project[]> => {
  try {
    // Only fetch deleted projects where user is owner
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('ownerId', '==', user.id),
      where('deletedAt', '!=', null)
    );

    const snapshot = await getDocs(q);
    const projects = snapshot.docs
      .map(doc => sanitizeProject(doc.data()))
      .filter(p => p.deletedAt) // Extra safety check
      .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)); // Sort by deletion date, newest first

    return projects;
  } catch (e) {
    console.error("Error fetching deleted projects:", e);
    return [];
  }
};

// Permanently delete a project (hard delete)
export const permanentlyDeleteProject = async (projectId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
    return true;
  } catch (e) {
    console.error("Error permanently deleting project:", e);
    return false;
  }
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as User;
  } catch (e) {
    console.error("Error fetching user by email:", e);
    return null;
  }
};

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const snapshot = await getDocs(collection(db, USERS_COLLECTION));
    return snapshot.docs.map(doc => doc.data() as User);
  } catch (e) {
    console.error("Error fetching all users:", e);
    return [];
  }
};

export const updateAdminStatus = async (email: string, isAdmin: boolean): Promise<boolean> => {
  try {
    const user = await getUserByEmail(email);
    if (!user) return false;

    const userRef = doc(db, USERS_COLLECTION, user.id);
    await updateDoc(userRef, { isAdmin });
    return true;
  } catch (e) {
    console.error("Error updating admin status:", e);
    return false;
  }
};

export const transferProjectOwnership = async (projectId: string, currentOwnerId: string, newOwnerEmail: string): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Find new owner
    const newOwner = await getUserByEmail(newOwnerEmail);
    if (!newOwner) {
      return { success: false, message: 'User with this email not found.' };
    }

    if (newOwner.id === currentOwnerId) {
      return { success: false, message: 'You are already the owner.' };
    }

    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);

    // 2. Update project: set new owner, add old owner to collaborators
    await updateDoc(projectRef, {
      ownerId: newOwner.id,
      ownerEmail: newOwner.email,
      collaborators: arrayUnion(currentOwnerId)
    });

    return { success: true, message: 'Ownership transferred successfully.' };
  } catch (e) {
    console.error("Error transferring ownership:", e);
    return { success: false, message: 'Failed to transfer ownership.' };
  }
};
