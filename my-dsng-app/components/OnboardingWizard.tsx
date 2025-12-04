import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import {
    ArrowRight,
    ArrowLeft,
    X,
    MousePointer,
    ZoomIn,
    MessageSquare,
    Reply,
    User,
    Sparkles,
    FileText,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

interface OnboardingWizardProps {
    isInvited: boolean;
    inviterName?: string;
    projectName?: string;
    onComplete: (guestName?: string) => void;
    onSkip: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
    isInvited,
    inviterName,
    projectName,
    onComplete,
    onSkip
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [guestName, setGuestName] = useState('');

    const steps = [
        {
            title: isInvited ? 'Welcome to the Team!' : 'Welcome to Revyze!',
            content: isInvited ? (
                <div className="space-y-4">
                    <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                        <p className="text-slate-700 leading-relaxed">
                            <span className="font-semibold text-indigo-900">{inviterName}</span> has invited you to collaborate on{' '}
                            <span className="font-semibold text-indigo-900">{projectName}</span>.
                        </p>
                        <p className="text-slate-600 mt-3 text-sm">
                            We'll guide you through the basics so you can start contributing right away.
                        </p>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-700">
                            After this quick tour, you'll be able to view the design, add comments, and collaborate with the team.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
                        <p className="text-slate-700 leading-relaxed">
                            Revyze is your collaborative design review platform. Share designs, gather feedback, and iterate faster.
                        </p>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-700">
                            Let's take a quick tour to get you started. You'll learn the essentials in just a few steps.
                        </p>
                    </div>
                </div>
            ),
            icon: <Sparkles className="w-8 h-8 text-indigo-600" />
        },
        {
            title: 'Navigate Your Designs',
            content: (
                <div className="space-y-4">
                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <ChevronLeft className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">Navigate Pages</h4>
                                    <p className="text-sm text-slate-600">
                                        Use the arrow buttons or keyboard arrows to move between pages in multi-page documents.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                                    <ZoomIn className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">Zoom Controls</h4>
                                    <p className="text-sm text-slate-600">
                                        Use the zoom buttons or scroll wheel to get a closer look at design details.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <MousePointer className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-900">
                            <span className="font-semibold">Pro tip:</span> Click and drag to pan around the design when zoomed in.
                        </p>
                    </div>
                </div>
            ),
            icon: <FileText className="w-8 h-8 text-indigo-600" />
        },
        {
            title: 'Add Comments',
            content: (
                <div className="space-y-4">
                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <MessageSquare className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">Pin Comments</h4>
                                    <p className="text-sm text-slate-600">
                                        Click anywhere on the design to add a comment. Your feedback will be pinned to that exact spot.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <Reply className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">Reply & Discuss</h4>
                                    <p className="text-sm text-slate-600">
                                        Have a conversation! Reply to comments to discuss changes and refine ideas together.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                        <MessageSquare className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-green-900">
                            <span className="font-semibold">Pro tip:</span> Comments are visible to everyone on the project, making collaboration seamless.
                        </p>
                    </div>
                </div>
            ),
            icon: <MessageSquare className="w-8 h-8 text-indigo-600" />
        },
        {
            title: 'Introduce Yourself',
            content: (
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
                        <p className="text-slate-700 leading-relaxed mb-4">
                            Help your team know who's providing feedback by adding your name. This will appear on all your comments.
                        </p>
                        <Input
                            label="Your Name"
                            type="text"
                            placeholder="e.g., Sarah Johnson"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            className="bg-white"
                        />
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <User className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600">
                            You can update this anytime in your profile settings.
                        </p>
                    </div>
                </div>
            ),
            icon: <User className="w-8 h-8 text-indigo-600" />
        },
        {
            title: isInvited ? 'Ready to Collaborate!' : 'Ready to Get Started!',
            content: isInvited ? (
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                        <p className="text-slate-700 leading-relaxed">
                            You're all set! We'll now open <span className="font-semibold text-green-900">{projectName}</span> so you can start reviewing and adding your feedback.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-white rounded-lg border border-slate-200">
                            <MessageSquare className="w-6 h-6 text-indigo-600 mb-2" />
                            <p className="text-xs font-semibold text-slate-900">Add Comments</p>
                            <p className="text-xs text-slate-600 mt-1">Share your thoughts</p>
                        </div>
                        <div className="p-4 bg-white rounded-lg border border-slate-200">
                            <Reply className="w-6 h-6 text-purple-600 mb-2" />
                            <p className="text-xs font-semibold text-slate-900">Join Discussion</p>
                            <p className="text-xs text-slate-600 mt-1">Reply to feedback</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
                        <p className="text-slate-700 leading-relaxed">
                            You're ready to go! Your next step is to create your first project and start collaborating.
                        </p>
                    </div>
                    <div className="p-4 bg-white rounded-lg border-2 border-indigo-200 border-dashed">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">Create Your First Project</p>
                                <p className="text-sm text-slate-600 mt-0.5">Upload a design and invite collaborators</p>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            icon: <Sparkles className="w-8 h-8 text-green-600" />
        }
    ];

    const handleNext = () => {
        // Check if we're on the name input step (step 3, index 3)
        if (currentStep === 3 && !guestName.trim()) {
            // Don't allow progression without a name
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete(guestName || undefined);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const currentStepData = steps[currentStep];
    const progress = ((currentStep + 1) / steps.length) * 100;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                                {currentStepData.icon}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{currentStepData.title}</h2>
                                <p className="text-sm text-slate-500">Step {currentStep + 1} of {steps.length}</p>
                            </div>
                        </div>
                        <button
                            onClick={onSkip}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
                            aria-label="Skip onboarding"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {currentStepData.content}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between gap-4">
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            disabled={currentStep === 0}
                            icon={<ArrowLeft className="w-4 h-4" />}
                        >
                            Back
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                onClick={onSkip}
                                className="text-slate-600"
                            >
                                Skip Tour
                            </Button>
                            <Button
                                onClick={handleNext}
                                disabled={currentStep === 3 && !guestName.trim()}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                            >
                                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
