import { useState, useEffect } from 'react';
import { OnboardingStep } from '../components/OnboardingTooltip';

export const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        target: '[data-onboarding="page-nav"]',
        title: 'Navigate Pages',
        description: 'Use these arrows to move between pages in multi-page documents. You can also use your keyboard arrow keys.',
        action: 'Try clicking the navigation arrows',
        position: 'bottom'
    },
    {
        target: '[data-onboarding="zoom-controls"]',
        title: 'Zoom In & Out',
        description: 'Get a closer look at design details with the zoom controls. You can also use your mouse wheel to zoom.',
        action: 'Try zooming in on the design',
        position: 'bottom'
    },
    {
        target: '[data-onboarding="workspace"]',
        title: 'Add Comments',
        description: 'Click anywhere on the design to add your feedback. Your comments will be pinned to that exact location.',
        action: 'Click on the design to add a comment',
        position: 'center'
    },
    {
        target: '[data-onboarding="collaboration-panel"]',
        title: 'View & Reply to Comments',
        description: 'All comments appear in this panel. Click on any comment to view details and join the discussion.',
        action: 'Try replying to an existing comment',
        position: 'left'
    },
    {
        target: '[data-onboarding="version-selector"]',
        title: 'Version History',
        description: 'Track changes over time. Upload new versions and switch between them to see how your design evolved.',
        position: 'bottom'
    }
];

export const useOnboarding = (isEnabled: boolean) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isActive, setIsActive] = useState(isEnabled);

    useEffect(() => {
        setIsActive(isEnabled);
    }, [isEnabled]);

    const nextStep = () => {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            complete();
        }
    };

    const previousStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const skip = () => {
        setIsActive(false);
    };

    const complete = () => {
        setIsActive(false);
    };

    const reset = () => {
        setCurrentStep(0);
        setIsActive(true);
    };

    return {
        currentStep,
        isActive,
        currentStepData: ONBOARDING_STEPS[currentStep],
        totalSteps: ONBOARDING_STEPS.length,
        nextStep,
        previousStep,
        skip,
        complete,
        reset
    };
};
