import { OnboardingStep } from "../components/OnboardingTooltip";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: "body", // Fallback/General welcome
    title: "Welcome to Revyze!",
    description:
      "Let's take a quick tour of your new workspace. You'll be reviewing designs like a pro in no time.",
    position: "center",
    action: "Click Next to start",
  },
  {
    target: "#page-navigation",
    title: "Navigate Pages",
    description: "Use these controls to move between pages in your document.",
    position: "bottom",
  },
  {
    target: "#zoom-controls",
    title: "Zoom In & Out",
    description:
      "Get a closer look at the details. You can also use your mouse wheel to zoom.",
    position: "bottom",
  },
  {
    target: "#plan-preferences",
    title: "Plan Options",
    description:
      "Set the default view or capture a thumbnail for this project.",
    position: "bottom",
  },
  {
    target: ".react-pdf__Page", // Target the PDF page itself
    title: "Add Comments",
    description:
      "Click anywhere on the plan to pin a comment. You can even use AI to help analyze the design!",
    position: "center",
    action: "Try clicking on the plan later",
  },
];
