import React, { useState, useEffect } from 'react';
import { Comment, UserRole, ProjectRole, User } from '../types';
import { Button } from './ui/Button';
import { MessageSquare, CheckCircle, Bot, Sparkles, Trash2, Send, ThumbsUp, CornerDownRight, ChevronLeft, ChevronRight, Share } from 'lucide-react';
import * as geminiService from '../services/geminiService';
import * as featureVoteService from '../services/featureVoteService';
import { canSeeComment } from '../utils/projectRoleHelper';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { FeatureVoteModal } from './FeatureVoteModal';

interface CollaborationPanelProps {
  comments: Comment[];
  onResolveComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onReplyComment: (id: string, text: string) => void;
  onPushToProfessional?: (commentId: string) => void; // NEW
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  currentUserRole: UserRole;
  projectRole: ProjectRole; // NEW
  pageNumber: number;
  currentUser: User; // For feature voting
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  comments,
  onResolveComment,
  onDeleteComment,
  onReplyComment,
  onPushToProfessional,
  activeCommentId,
  setActiveCommentId,
  currentUserRole,
  projectRole,
  pageNumber,
  currentUser // Destructure currentUser
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFeatureVoteModal, setShowFeatureVoteModal] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; show: boolean }>({ id: '', show: false });

  // Check if user has already voted
  useEffect(() => {
    const checkVote = async () => {
      const vote = await featureVoteService.getUserVote(currentUser.id, 'ai-summary');
      setHasVoted(!!vote);
    };
    checkVote();
  }, [currentUser]);

  // Filter comments for the current page AND by visibility
  const visibleComments = comments.filter(c => {
    if (c.pageNumber && c.pageNumber !== pageNumber) return false;
    return canSeeComment(c, projectRole);
  });

  // Sort: unresolved first, then by timestamp
  const sortedComments = [...visibleComments].sort((a, b) => {
    if (a.resolved === b.resolved) return b.timestamp - a.timestamp;
    return a.resolved ? 1 : -1;
  });

  return (
    <div className={`relative flex flex-col h-full bg-white border-l border-slate-200 shadow-xl z-20 shrink-0 transition-all duration-300 ${isCollapsed ? 'w-12' : 'w-96'}`}>
      {/* Expand Button - only visible when collapsed */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute left-2 top-4 bg-white border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition-colors shadow-md z-30"
          title="Expand comments"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
      )}

      {!isCollapsed && (
        <>
          <div className="p-4 border-b border-slate-100 flex flex-row justify-between items-center bg-slate-50">
            {/* Collapse button - left side of header */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="bg-white border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition-colors shadow-sm"
              title="Collapse comments"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>

            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Feedback
              <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                {comments.filter(c => !c.resolved).length}
              </span>
            </h2>
          </div>

          {/* Coming Soon Panel */}
          {comments.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900">AI Design Summary</p>
                    <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
                      COMING SOON
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    Get instant AI-powered summaries of all feedback and comments
                  </p>
                  {hasVoted ? (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      <span>Thanks for your feedback!</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFeatureVoteModal(true)}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 underline"
                    >
                      Vote for this feature →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {sortedComments.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No comments yet.</p>
                <p className="text-sm mt-1">Click anywhere on the PDF to add one.</p>
              </div>
            ) : (
              sortedComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  isActive={activeCommentId === comment.id}
                  onResolve={onResolveComment}
                  onDelete={(id) => setDeleteConfirm({ id, show: true })}
                  onReply={onReplyComment}
                  onPushToProfessional={onPushToProfessional}
                  onClick={() => setActiveCommentId(comment.id)}
                  currentUserRole={currentUserRole}
                  projectRole={projectRole}
                />
              ))
            )}
          </div>

          {/* Feature Vote Modal */}
          {showFeatureVoteModal && (
            <FeatureVoteModal
              featureId="ai-summary"
              user={currentUser}
              onClose={() => setShowFeatureVoteModal(false)}
              onVoteSubmitted={() => {
                setHasVoted(true);
                setShowFeatureVoteModal(false);
              }}
            />
          )}
        </>
      )}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirm.id) {
            onDeleteComment(deleteConfirm.id);
            setDeleteConfirm({ id: '', show: false });
          }
        }}
        onCancel={() => setDeleteConfirm({ id: '', show: false })}
        isDestructive
      />
    </div>
  );
};

// Comment Card Component
const CommentCard: React.FC<{
  comment: Comment;
  isActive: boolean;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (id: string, text: string) => void;
  onPushToProfessional?: (commentId: string) => void;
  onClick: () => void;
  currentUserRole: UserRole;
  projectRole: ProjectRole;
}> = ({ comment, isActive, onResolve, onDelete, onReply, onPushToProfessional, onClick, currentUserRole, projectRole }) => {
  const [replyText, setReplyText] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!comment.resolved); // Resolved comments start collapsed

  const handleReplySubmit = () => {
    if (replyText.trim()) {
      onReply(comment.id, replyText);
      setReplyText('');
      setShowReplyBox(false);
    }
  };

  return (
    <div
      id={`comment-${comment.id}`}
      className={`group rounded-xl border transition-all duration-200 ${isActive
        ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md bg-indigo-50/30'
        : comment.resolved
          ? 'border-slate-200 bg-slate-50/50'
          : 'border-slate-200 bg-white hover:border-indigo-300'
        }`}
    >
      <div
        className="p-3 cursor-pointer"
        onClick={() => {
          if (comment.resolved) {
            setIsExpanded(!isExpanded);
          } else {
            onClick();
          }
        }}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${comment.author === UserRole.DESIGNER ? 'bg-purple-500' : 'bg-blue-500'}`} />
            <span className="text-xs font-semibold text-slate-700">{comment.authorName || comment.author}</span>
            <span className="text-[10px] text-slate-400">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {comment.pushedFromGuestComment && (
              <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded-full flex items-center gap-1" title="Promoted from Guest comment">
                <Share className="w-2 h-2" />
                Promoted
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!comment.resolved && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(comment.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-green-50"
                title="Mark as resolved"
              >
                <CheckCircle className="w-4 h-4 text-green-600" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(comment.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50"
              title="Delete comment"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>

        <div className="text-sm text-slate-700 mb-2">{comment.text}</div>

        {comment.aiAnalysis && (
          <div className="mt-2 p-2 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-start gap-2">
              <Bot className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-purple-900 leading-relaxed">{comment.aiAnalysis}</div>
            </div>
          </div>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-2 pl-4 border-l-2 border-slate-200">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${reply.author === UserRole.DESIGNER ? 'bg-purple-400' : 'bg-blue-400'}`} />
                  <span className="font-medium text-slate-600">{reply.author}</span>
                  <span className="text-[10px] text-slate-400">{new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-slate-600 ml-3.5">{reply.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {projectRole === 'owner' && comment.audience === 'guest-owner' && onPushToProfessional && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onPushToProfessional) {
                  onPushToProfessional(comment.id);
                }
              }}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-md hover:bg-green-100 transition-colors border border-green-200"
              title="Promote this guest comment to professional view"
            >
              <Share className="w-3 h-3" />
              Promote to Professional
            </button>
          )}

          {!showReplyBox ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReplyBox(true);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <CornerDownRight className="w-3 h-3" />
              Reply
            </button>
          ) : (
            <div className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReplySubmit();
                  if (e.key === 'Escape') setShowReplyBox(false);
                }}
                placeholder="Write a reply..."
                className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-400 bg-white text-slate-900"
                autoFocus
              />
              <button
                onClick={handleReplySubmit}
                className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                title="Send reply"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};