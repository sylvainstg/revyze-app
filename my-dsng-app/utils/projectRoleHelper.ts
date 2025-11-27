import { Project, User, Comment, ProjectRole, CommentAudience } from '../types';

/**
 * Determine the user's role in the context of a specific project
 */
export function getProjectRole(
    project: Project | null,
    user: User | null,
    isGuest: boolean,
    impersonatedRole?: ProjectRole | null
): ProjectRole {
    if (impersonatedRole) return impersonatedRole;
    if (isGuest) return 'guest';
    if (!user || !project) return 'guest';
    if (project.ownerId === user.id) return 'owner';
    return 'professional'; // Collaborator/Designer
}

/**
 * Determine if a user can see a specific comment based on their project role
 */
export function canSeeComment(
    comment: Comment,
    projectRole: ProjectRole
): boolean {
    // Owner sees everything
    if (projectRole === 'owner') return true;

    // Backward compatibility: old comments without audience are treated as public
    if (!comment.audience) return true;

    // Public comments visible to all
    if (comment.audience === 'public') return true;

    // Guests only see guest-owner conversation
    if (projectRole === 'guest') {
        return comment.audience === 'guest-owner';
    }

    // Professionals only see pro-owner conversation
    if (projectRole === 'professional') {
        return comment.audience === 'pro-owner';
    }

    return false;
}

/**
 * Get display name for project role
 */
export function getProjectRoleDisplay(role: ProjectRole): string {
    switch (role) {
        case 'owner': return 'Owner';
        case 'guest': return 'Guest';
        case 'professional': return 'Professional';
    }
}

/**
 * Determine the appropriate audience for a new comment
 */
export function getCommentAudience(projectRole: ProjectRole): CommentAudience {
    if (projectRole === 'guest') return 'guest-owner';
    if (projectRole === 'professional') return 'pro-owner';
    return 'public'; // Owner can create public comments
}
