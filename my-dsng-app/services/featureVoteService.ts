import { db } from '../firebaseConfig';
import { collection, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { FeatureVote, FeatureId, VoteInterest, UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

const FEATURE_VOTES_COLLECTION = 'featureVotes';

export const submitFeatureVote = async (
    userId: string,
    featureId: FeatureId,
    interest: VoteInterest,
    valueRating: number,
    userRole: UserRole,
    userEmail?: string
): Promise<boolean> => {
    try {
        const voteId = uuidv4(); // Use unique ID to ensure all votes are recorded for now
        // const voteId = `${userId}_${featureId}`; // Original composite key
        const vote: FeatureVote = {
            id: voteId,
            userId,
            featureId,
            interest,
            valueRating,
            timestamp: Date.now(),
            userRole,
            userEmail
        };

        await setDoc(doc(db, FEATURE_VOTES_COLLECTION, voteId), vote);
        return true;
    } catch (error) {
        console.error('Error submitting feature vote:', error);
        return false;
    }
};

export const getUserVote = async (
    userId: string,
    featureId: FeatureId
): Promise<FeatureVote | null> => {
    try {
        const voteId = `${userId}_${featureId}`;
        const voteDoc = await getDoc(doc(db, FEATURE_VOTES_COLLECTION, voteId));

        if (voteDoc.exists()) {
            return voteDoc.data() as FeatureVote;
        }
        return null;
    } catch (error) {
        console.error('Error getting user vote:', error);
        return null;
    }
};

export interface FeatureVoteStats {
    totalVotes: number;
    interestCounts: {
        'not-interested': number;
        'interested': number;
        'very-interested': number;
    };
    averageValueRating: number;
    roleBreakdown: {
        [key in UserRole]?: number;
    };
    votes: FeatureVote[];
}

export const getFeatureVoteStats = async (
    featureId: FeatureId
): Promise<FeatureVoteStats> => {
    try {
        const q = query(
            collection(db, FEATURE_VOTES_COLLECTION),
            where('featureId', '==', featureId)
        );

        const snapshot = await getDocs(q);
        const votes: FeatureVote[] = [];

        snapshot.forEach(doc => {
            votes.push(doc.data() as FeatureVote);
        });

        const stats: FeatureVoteStats = {
            totalVotes: votes.length,
            interestCounts: {
                'not-interested': 0,
                'interested': 0,
                'very-interested': 0
            },
            averageValueRating: 0,
            roleBreakdown: {},
            votes
        };

        if (votes.length === 0) return stats;

        // Count interest levels
        votes.forEach(vote => {
            stats.interestCounts[vote.interest]++;

            // Count by role
            if (!stats.roleBreakdown[vote.userRole]) {
                stats.roleBreakdown[vote.userRole] = 0;
            }
            stats.roleBreakdown[vote.userRole]!++;
        });

        // Calculate average value rating
        const totalRating = votes.reduce((sum, vote) => sum + vote.valueRating, 0);
        stats.averageValueRating = totalRating / votes.length;

        return stats;
    } catch (error) {
        console.error('Error getting feature vote stats:', error);
        return {
            totalVotes: 0,
            interestCounts: {
                'not-interested': 0,
                'interested': 0,
                'very-interested': 0
            },
            averageValueRating: 0,
            roleBreakdown: {},
            votes: []
        };
    }
};
