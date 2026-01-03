import React, { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import {
  Check,
  Sparkles,
  Users,
  Zap,
  FolderOpen,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { functions } from "../firebaseConfig";
import { httpsCallable } from "firebase/functions";

interface Props {
  referralCode?: string;
  inviterName?: string;
  projectName?: string;
  inviteRole?: "guest" | "pro";
  inviteeName?: string;
  onGetStarted: () => void;
}

export const WelcomeLandingPage: React.FC<Props> = ({
  referralCode,
  inviterName,
  projectName,
  inviteRole,
  inviteeName,
  onGetStarted,
}) => {
  const [displayName, setDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Determine the type of invitation
  const isProjectInvite = !!inviterName || !!projectName;
  const isReferral = !!referralCode && !isProjectInvite;

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        if (isReferral && referralCode) {
          const getReferrerInfo = httpsCallable(
            functions,
            "getReferrerInfoFunction",
          );
          const result = await getReferrerInfo({ referralCode });
          const data = result.data as {
            success: boolean;
            referrerName?: string;
          };

          if (data.success && data.referrerName) {
            setDisplayName(data.referrerName);
          } else {
            setDisplayName("a friend");
          }
        } else if (isProjectInvite && inviterName) {
          setDisplayName(inviterName);
        } else {
          setDisplayName("someone");
        }
      } catch (error) {
        console.error("Error fetching info:", error);
        setDisplayName(isProjectInvite ? inviterName || "someone" : "a friend");
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [referralCode, inviterName, isReferral, isProjectInvite]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Minimalist Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <img
            src="/revyze-logo.png"
            alt="Revyze"
            className="h-12 w-auto object-contain"
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-4xl mx-auto w-full">
        {/* Personal Welcome */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3 h-3" />
            Exclusive Invitation
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            {inviteeName ? `Hi ${inviteeName}! 👋` : "You've Been Invited! 🎉"}
          </h1>

          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            <span className="font-semibold text-indigo-600">{displayName}</span>{" "}
            invited you to share your thoughts on the design of{" "}
            <span className="font-semibold text-indigo-600">
              {projectName || "their home"}
            </span>
            .
          </p>
        </div>

        {/* The 3-Step Journey */}
        <div className="grid md:grid-cols-3 gap-8 w-full mb-12">
          {[
            {
              step: 1,
              title: "Secure Access",
              desc: "Create your workspace account in seconds. It's safe and private.",
              icon: <ShieldCheck className="w-6 h-6 text-indigo-600" />,
              color: "bg-indigo-50",
            },
            {
              step: 2,
              title: "Explore the Plan",
              desc: "Visualize the latest design in high resolution from any device.",
              icon: <FolderOpen className="w-6 h-6 text-purple-600" />,
              color: "bg-purple-50",
            },
            {
              step: 3,
              title: "Pin Your Feedback",
              desc: "Click anywhere on the plan to leave a pinned comment or idea.",
              icon: <MessageSquare className="w-6 h-6 text-emerald-600" />,
              color: "bg-emerald-50",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100"
            >
              <div
                className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-4`}
              >
                {item.icon}
              </div>
              <div className="absolute top-6 right-6 text-slate-200 font-bold text-xl">
                0{item.step}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {item.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Final CTA */}
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <Button
            onClick={onGetStarted}
            size="lg"
            className="px-12 py-6 text-lg rounded-2xl shadow-xl shadow-indigo-500/20 group h-auto"
          >
            Join {displayName}'s Project
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="mt-4 text-slate-400 text-sm">
            Takes less than 30 seconds • No credit card required
          </p>
        </div>
      </main>

      <footer className="py-8 text-center text-slate-400 text-xs border-t border-slate-100 bg-white">
        © 2025 Revyze. Secure collaboration for design projects.
      </footer>
    </div>
  );
};

export const ReferralLandingPage = WelcomeLandingPage;
