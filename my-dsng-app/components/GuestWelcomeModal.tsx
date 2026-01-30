import React from "react";
import { X, Eye, MessageSquare, UserPlus, Sparkles } from "lucide-react";

interface GuestWelcomeModalProps {
    inviterName?: string;
    projectName?: string;
    guestName?: string;
    accessLevel: "view" | "comment";
    onClose: () => void;
    onSignUp: () => void;
}

export const GuestWelcomeModal: React.FC<GuestWelcomeModalProps> = ({
    inviterName,
    projectName,
    guestName,
    accessLevel,
    onClose,
    onSignUp,
}) => {
    const displayName = guestName && guestName !== "Guest User" ? guestName : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header with gradient */}
                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 px-8 pt-10 pb-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        {displayName ? `Welcome, ${displayName}!` : "Welcome!"}
                    </h1>
                    {inviterName && projectName && (
                        <p className="text-indigo-100 text-sm">
                            <span className="font-semibold text-white">{inviterName}</span> invited you to view{" "}
                            <span className="font-semibold text-white">{projectName}</span>
                        </p>
                    )}
                </div>

                {/* Content */}
                <div className="px-8 py-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">
                        Here's what you can do:
                    </h2>

                    <div className="space-y-4">
                        {/* View capability */}
                        <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl border border-green-100">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Eye className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-green-900">View & Navigate</h3>
                                <p className="text-sm text-green-700">
                                    Browse all pages, zoom in on details, and explore the design freely.
                                </p>
                            </div>
                        </div>

                        {/* Comment capability or upgrade prompt */}
                        {accessLevel === "comment" ? (
                            <div className="flex items-start gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-indigo-900">Add Comments</h3>
                                    <p className="text-sm text-indigo-700">
                                        Create an account to leave feedback and collaborate with the team.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    <MessageSquare className="w-5 h-5 text-slate-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-600">View Only Mode</h3>
                                    <p className="text-sm text-slate-500">
                                        Comments are disabled for this project. Contact the owner for access.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 pb-8 space-y-3">
                    <button
                        onClick={onClose}
                        className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25"
                    >
                        Start Exploring →
                    </button>

                    {accessLevel === "comment" && (
                        <button
                            onClick={onSignUp}
                            className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            Create Free Account to Comment
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
