import { db } from '../firebaseConfig';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { updateUserEngagementScore } from './analyticsAggregationService';

export interface ActivityLog {
    id?: string;
    userId: string;
    eventName: string;
    metadata?: any;
    timestamp: number; // Unix timestamp
    createdAt?: any; // Firestore timestamp
}

const COLLECTION_NAME = 'user_activity';

const SCORE_UPDATE_EVENTS = [
    'login',
    'create_project',
    'upload_version',
    'comment',
    'invite_user',
    'share_project',
    'feedback_campaign_answered'
];

/**
 * Logs a user activity event to Firestore.
 * @param userId The ID of the user performing the action
 * @param eventName The name of the event (e.g., 'login', 'create_project')
 * @param metadata Optional additional data about the event
 */
export const logEvent = async (userId: string, eventName: string, metadata: any = {}) => {
    try {
        await addDoc(collection(db, COLLECTION_NAME), {
            userId,
            eventName,
            metadata,
            timestamp: Date.now(),
            createdAt: Timestamp.now()
        });

        // Trigger engagement score update for key events via Cloud Function
        if (SCORE_UPDATE_EVENTS.includes(eventName)) {
            // Import functions dynamically to avoid circular dependencies
            import('../firebaseConfig').then(({ functions }) => {
                import('firebase/functions').then(({ httpsCallable }) => {
                    const updateScore = httpsCallable(functions, 'updateEngagementScore');
                    updateScore({}).catch(err =>
                        console.error('Failed to update engagement score:', err)
                    );
                });
            });
        }
    } catch (error) {
        console.error('Error logging event:', error);
        // We don't want analytics errors to break the app flow, so we just log it
    }
};

/**
 * Fetches the recent activity logs for a specific user.
 * @param userId The ID of the user to fetch logs for
 * @param limitCount The maximum number of logs to fetch (default 20)
 */
export const getUserActivity = async (userId: string, limitCount: number = 20): Promise<ActivityLog[]> => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ActivityLog));
    } catch (error) {
        console.error('Error fetching user activity:', error);
        return [];
    }
};
