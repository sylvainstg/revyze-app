import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User, UserRole } from '../types';

// Collection reference
const USERS_COLLECTION = 'users';

export const registerUser = async (name: string, email: string, password: string, role: UserRole): Promise<{ success: boolean; user?: User; message?: string }> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Save display name to Auth profile
        await updateProfile(firebaseUser, { displayName: name });

        const newUser: User = {
            id: firebaseUser.uid,
            name,
            email: email.toLowerCase(),
            role,
            plan: 'free'
        };

        // Save user profile to Firestore
        await setDoc(doc(db, USERS_COLLECTION, newUser.id), newUser);

        return { success: true, user: newUser };
    } catch (error: any) {
        console.error("Registration error:", error);
        let message = "Registration failed.";
        if (error.code === 'auth/email-already-in-use') {
            message = "Email already in use.";
        }
        return { success: false, message };
    }
};

export const loginUser = async (email: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid));

        if (userDoc.exists()) {
            return { success: true, user: userDoc.data() as User };
        } else {
            // HEALING: User exists in Auth but not in Firestore. Create default profile.
            const newUser: User = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'User',
                email: email.toLowerCase(),
                role: UserRole.HOMEOWNER, // Default role
                plan: 'free'
            };

            try {
                await setDoc(doc(db, USERS_COLLECTION, newUser.id), newUser);
                return { success: true, user: newUser };
            } catch (e) {
                console.error("Failed to create missing profile:", e);
                return { success: false, message: "User profile missing and could not be created." };
            }
        }
    } catch (error: any) {
        console.error("Login error:", error);
        return { success: false, message: "Invalid email or password." };
    }
};

export const logoutUser = async (): Promise<void> => {
    await signOut(auth);
};

export const resetPassword = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: "Password reset email sent!" };
    } catch (error: any) {
        console.error("Reset password error:", error);
        return { success: false, message: error.message || "Failed to send reset email." };
    }
};

export const updateUserProfile = async (userId: string, updates: Partial<User>): Promise<boolean> => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        await updateDoc(userRef, updates);

        // Also update Auth profile if name is changed
        if (updates.name && auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: updates.name });
        }

        return true;
    } catch (e) {
        console.error("Error updating profile:", e);
        return false;
    }
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        // Unsubscribe from previous snapshot listener if exists
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }

        if (firebaseUser) {
            const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);

            // Set up real-time listener
            unsubscribeSnapshot = onSnapshot(userRef, async (docSnapshot) => {
                if (docSnapshot.exists()) {
                    callback(docSnapshot.data() as User);
                } else {
                    // HEALING: User exists in Auth but not in Firestore. Create default profile.
                    console.log("Healing missing profile in subscription...");
                    const newUser: User = {
                        id: firebaseUser.uid,
                        name: firebaseUser.displayName || 'User',
                        email: firebaseUser.email || '',
                        role: UserRole.HOMEOWNER, // Default role
                        plan: 'free'
                    };

                    try {
                        await setDoc(doc(db, USERS_COLLECTION, newUser.id), newUser);
                        // No need to callback here, the snapshot listener will fire again with the new data
                    } catch (e) {
                        console.error("Error creating default profile:", e);
                        callback(null);
                    }
                }
            }, (error) => {
                console.error("Error in auth subscription:", error);
                callback(null);
            });
        } else {
            callback(null);
        }
    });

    // Return a function that unsubscribes from both
    return () => {
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
        }
        unsubscribeAuth();
    };
};
