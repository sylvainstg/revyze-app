import React, { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { Loader2, Save, RefreshCw, Check, AlertCircle } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";

interface PlanLimits {
  totalProjects: number;
  ownedProjects: number;
  storageMB: number;
  collaborators: number;
  aiAnalysis: number;
}

interface AllPlanLimits {
  free: PlanLimits;
  pro: PlanLimits;
  business: PlanLimits;
}

export const PlanLimitsEditor: React.FC = () => {
  const [limits, setLimits] = useState<AllPlanLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [source, setSource] = useState<"firestore" | "defaults">("defaults");

  useEffect(() => {
    loadLimits();
  }, []);

  const loadLimits = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const getPlanLimitsFunc = httpsCallable(functions, "getPlanLimits");
      const result = await getPlanLimitsFunc();
      const data = result.data as {
        limits: AllPlanLimits;
        source: "firestore" | "defaults";
      };
      setLimits(data.limits);
      setSource(data.source);
    } catch (error: any) {
      console.error("Failed to load plan limits:", error);
      setMessage({ text: "Failed to load plan limits", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (planId: "free" | "pro" | "business") => {
    if (!limits) return;

    setSaving(true);
    setMessage(null);
    try {
      const updatePlanLimitsFunc = httpsCallable(functions, "updatePlanLimits");
      await updatePlanLimitsFunc({ planId, limits: limits[planId] });
      setMessage({
        text: `${planId.toUpperCase()} plan limits saved successfully`,
        type: "success",
      });
      // Reload to confirm changes
      await loadLimits();
    } catch (error: any) {
      console.error("Failed to save plan limits:", error);
      setMessage({
        text: error.message || "Failed to save plan limits",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInitialize = async () => {
    if (
      !confirm(
        "Initialize plan limits with defaults? This will overwrite any existing values.",
      )
    )
      return;

    setSaving(true);
    setMessage(null);
    try {
      const initFunc = httpsCallable(functions, "initializePlanLimits");
      await initFunc();
      setMessage({
        text: "Plan limits initialized successfully",
        type: "success",
      });
      await loadLimits();
    } catch (error: any) {
      console.error("Failed to initialize plan limits:", error);
      setMessage({
        text: error.message || "Failed to initialize plan limits",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateLimit = (
    plan: "free" | "pro" | "business",
    field: keyof PlanLimits,
    value: number,
  ) => {
    if (!limits) return;
    setLimits({
      ...limits,
      [plan]: {
        ...limits[plan],
        [field]: value,
      },
    });
  };

  const renderLimitField = (
    plan: "free" | "pro" | "business",
    field: keyof PlanLimits,
    label: string,
  ) => {
    if (!limits) return null;
    const value = limits[plan][field];

    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) =>
              updateLimit(plan, field, parseInt(e.target.value) || 0)
            }
            className="w-32 px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            min="-1"
          />
          <span className="text-xs text-slate-500 w-24">
            {value === -1
              ? "Unlimited"
              : field === "storageMB" && value >= 1024
                ? `${(value / 1024).toFixed(0)} GB`
                : value}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!limits) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        Failed to load plan limits
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Plan Limits Configuration
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Manage limits for each subscription plan. Use -1 for unlimited.
            {source === "defaults" && (
              <span className="ml-2 text-amber-600 font-medium">
                ⚠️ Using default values (not saved to Firestore)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadLimits}
            disabled={loading || saving}
            icon={
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            }
          >
            Reload
          </Button>
          {source === "defaults" && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleInitialize}
              disabled={saving}
              icon={<Save className="w-4 h-4" />}
            >
              Initialize in Firestore
            </Button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h4 className="font-bold text-slate-900">Free Plan</h4>
            <p className="text-xs text-slate-500 mt-1">
              Basic tier for individuals
            </p>
          </div>
          <div className="p-4 space-y-1">
            {renderLimitField("free", "totalProjects", "Total Projects")}
            {renderLimitField("free", "ownedProjects", "Owned Projects")}
            {renderLimitField("free", "storageMB", "Storage (MB)")}
            {renderLimitField("free", "collaborators", "Collaborators")}
            {renderLimitField("free", "aiAnalysis", "AI Analyses/mo")}
          </div>
          <div className="px-4 pb-4">
            <Button
              className="w-full"
              onClick={() => handleSave("free")}
              disabled={saving}
              icon={
                saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )
              }
            >
              Save Free
            </Button>
          </div>
        </div>

        {/* Pro Plan */}
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden ring-2 ring-indigo-500">
          <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-200">
            <h4 className="font-bold text-indigo-900">Pro Plan</h4>
            <p className="text-xs text-indigo-600 mt-1">
              For professional designers
            </p>
          </div>
          <div className="p-4 space-y-1">
            {renderLimitField("pro", "totalProjects", "Total Projects")}
            {renderLimitField("pro", "ownedProjects", "Owned Projects")}
            {renderLimitField("pro", "storageMB", "Storage (MB)")}
            {renderLimitField("pro", "collaborators", "Collaborators")}
            {renderLimitField("pro", "aiAnalysis", "AI Analyses/mo")}
          </div>
          <div className="px-4 pb-4">
            <Button
              className="w-full"
              onClick={() => handleSave("pro")}
              disabled={saving}
              icon={
                saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )
              }
            >
              Save Pro
            </Button>
          </div>
        </div>

        {/* Business Plan */}
        <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
          <div className="bg-purple-50 px-4 py-3 border-b border-purple-200">
            <h4 className="font-bold text-purple-900">Corporate Plan</h4>
            <p className="text-xs text-purple-600 mt-1">
              For teams and agencies
            </p>
          </div>
          <div className="p-4 space-y-1">
            {renderLimitField("business", "totalProjects", "Total Projects")}
            {renderLimitField("business", "ownedProjects", "Owned Projects")}
            {renderLimitField("business", "storageMB", "Storage (MB)")}
            {renderLimitField("business", "collaborators", "Collaborators")}
            {renderLimitField("business", "aiAnalysis", "AI Analyses/mo")}
          </div>
          <div className="px-4 pb-4">
            <Button
              className="w-full"
              onClick={() => handleSave("business")}
              disabled={saving}
              icon={
                saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )
              }
            >
              Save Corporate
            </Button>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-blue-900">
          <strong>Note:</strong> Use{" "}
          <code className="bg-blue-100 px-1 py-0.5 rounded">-1</code> to
          represent unlimited. Changes take effect immediately after saving.
        </div>
      </div>
    </div>
  );
};
