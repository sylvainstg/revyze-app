import { User } from '../types';

/**
 * Check if a user can invite collaborators to projects
 */
export const canInviteCollaborators = (user: User): boolean => {
    const plan = user.plan || 'free';
    const status = user.subscriptionStatus;

    // Free users cannot invite
    if (plan === 'free') return false;

    // Pro trial users cannot invite
    if (plan === 'pro' && status === 'trialing') return false;

    // Paid pro and business users can invite
    return true;
};

/**
 * Check if a user has an active paid subscription
 */
export const isPaidSubscription = (user: User): boolean => {
    return user.subscriptionStatus === 'active';
};

/**
 * Check if a user is on a trial subscription
 */
export const isTrialing = (user: User): boolean => {
    return user.subscriptionStatus === 'trialing';
};

/**
 * Get a display-friendly subscription status
 */
export const getSubscriptionStatusDisplay = (user: User): string => {
    if (!user.plan || user.plan === 'free') return 'Free';

    if (user.subscriptionStatus === 'trialing') {
        return `${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} (Trial)`;
    }

    if (user.subscriptionStatus === 'active') {
        return user.plan.charAt(0).toUpperCase() + user.plan.slice(1);
    }

    return user.plan.charAt(0).toUpperCase() + user.plan.slice(1);
};
