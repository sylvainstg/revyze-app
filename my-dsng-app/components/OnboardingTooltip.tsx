import React, { useEffect, useRef } from "react";
import { Button } from "./ui/Button";
import { X, ArrowRight } from "lucide-react";

export interface OnboardingStep {
  target: string; // CSS selector for the element to highlight
  title: string;
  description: string;
  action?: string; // Optional action prompt
  position?: "top" | "bottom" | "left" | "right" | "center";
}

interface OnboardingTooltipProps {
  step: OnboardingStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

export const OnboardingTooltip: React.FC<OnboardingTooltipProps> = ({
  step,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);

  useEffect(() => {
    // Find the target element and get its position
    const targetElement = document.querySelector(step.target);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      // Scroll element into view if needed
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [step.target]);

  if (!targetRect) return null;

  // Calculate tooltip position based on target and preferred position
  const getTooltipPosition = () => {
    const padding = 20;
    const tooltipWidth = 360;
    const tooltipHeight = 200; // Approximate

    switch (step.position) {
      case "top":
        return {
          top: targetRect.top - tooltipHeight - padding,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case "bottom":
        return {
          top: targetRect.bottom + padding,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case "left":
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.left - tooltipWidth - padding,
        };
      case "right":
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.right + padding,
        };
      default: // center
        return {
          top: window.innerHeight / 2 - tooltipHeight / 2,
          left: window.innerWidth / 2 - tooltipWidth / 2,
        };
    }
  };

  const tooltipPosition = getTooltipPosition();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Spotlight overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - 8}
              y={targetRect.top - 8}
              width={targetRect.width + 16}
              height={targetRect.height + 16}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Pulsing glow around target */}
      <div
        className="absolute rounded-xl animate-pulse"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          boxShadow: "0 0 0 4px rgba(99, 102, 241, 0.5)",
          pointerEvents: "none",
        }}
      />

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="absolute bg-white rounded-2xl shadow-2xl p-6 pointer-events-auto animate-in fade-in zoom-in-95 duration-300"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          maxWidth: "360px",
          width: "360px",
        }}
      >
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress indicator */}
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full flex-1 transition-all ${
                i <= currentStep ? "bg-indigo-600" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
        <p className="text-slate-600 mb-4 leading-relaxed">
          {step.description}
        </p>

        {step.action && (
          <div className="bg-indigo-50 rounded-lg p-3 mb-4 border border-indigo-100">
            <p className="text-sm text-indigo-900 font-medium">
              👉 {step.action}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onSkip} size="sm">
              Skip Tour
            </Button>
            <Button onClick={onNext} size="sm">
              {currentStep === totalSteps - 1 ? "Finish" : "Next"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
