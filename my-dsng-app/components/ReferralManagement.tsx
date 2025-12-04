import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Gift, DollarSign, Settings, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { functions } from '../firebaseConfig';
import { httpsCallable } from 'firebase/functions';

interface FeatureCost {
    id: string;
    featureName: string;
    description: string;
    tokenCost: number;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}

interface ReferralConstants {
    tokensPerReferral: number;
    referralExpirationDays: number;
    minimumRedemption: number;
}

interface Props {
    onClose: () => void;
}

export const ReferralManagement: React.FC<Props> = ({ onClose }) => {
    const [features, setFeatures] = useState<FeatureCost[]>([]);
    const [constants, setConstants] = useState<ReferralConstants | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingFeature, setEditingFeature] = useState<Partial<FeatureCost> | null>(null);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Get feature costs
            const getFeatureCosts = httpsCallable(functions, 'getFeatureCosts');
            const featuresResult = await getFeatureCosts({});
            const featuresData = featuresResult.data as { features: FeatureCost[] };
            setFeatures(featuresData.features || []);

            // Get constants
            const getAdminReferralData = httpsCallable(functions, 'getAdminReferralData');
            const adminData = await getAdminReferralData({});
            const adminDataResult = adminData.data as { constants: ReferralConstants };
            setConstants(adminDataResult.constants);
        } catch (error) {
            console.error('Error loading referral data:', error);
            setMessage({ text: 'Failed to load referral data', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFeature = async () => {
        if (!editingFeature || !editingFeature.id || editingFeature.tokenCost === undefined) {
            setMessage({ text: 'Please fill in all required fields', type: 'error' });
            return;
        }

        try {
            const updateFeatureCost = httpsCallable(functions, 'updateFeatureCost');
            await updateFeatureCost({
                featureId: editingFeature.id,
                featureName: editingFeature.featureName,
                description: editingFeature.description,
                tokenCost: editingFeature.tokenCost,
                enabled: editingFeature.enabled !== false,
            });

            setMessage({ text: 'Feature cost updated successfully', type: 'success' });
            setEditingFeature(null);
            await loadData();
        } catch (error: any) {
            console.error('Error saving feature:', error);
            setMessage({ text: error.message || 'Failed to save feature', type: 'error' });
        }
    };

    const handleNewFeature = () => {
        setEditingFeature({
            id: '',
            featureName: '',
            description: '',
            tokenCost: 0,
            enabled: true,
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Gift className="w-6 h-6 text-indigo-600" />
                        Referral Program Management
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Configure token rewards and feature costs
                    </p>
                </div>
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            {/* Constants Display */}
            {constants && (
                <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                    <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Referral Constants
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg">
                            <div className="text-sm text-slate-500">Tokens per Referral</div>
                            <div className="text-2xl font-bold text-indigo-600">{constants.tokensPerReferral}</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                            <div className="text-sm text-slate-500">Expiration (Days)</div>
                            <div className="text-2xl font-bold text-indigo-600">{constants.referralExpirationDays}</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                            <div className="text-sm text-slate-500">Min. Redemption</div>
                            <div className="text-2xl font-bold text-indigo-600">{constants.minimumRedemption}</div>
                        </div>
                    </div>
                    <p className="text-xs text-indigo-700 mt-4">
                        To modify these constants, update REFERRAL_CONSTANTS in functions/src/referralService.ts and redeploy.
                    </p>
                </div>
            )}

            {/* Feature Costs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Feature Costs
                    </h3>
                    <Button onClick={handleNewFeature} icon={<Plus className="w-4 h-4" />}>
                        Add Feature
                    </Button>
                </div>

                {/* Feature List */}
                <div className="divide-y divide-slate-100">
                    {features.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            No features configured yet. Click "Add Feature" to create one.
                        </div>
                    ) : (
                        features.map((feature) => (
                            <div key={feature.id} className="p-4 hover:bg-slate-50 flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">{feature.featureName}</div>
                                    <div className="text-sm text-slate-500">{feature.description}</div>
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className="text-sm font-medium text-indigo-600">
                                            {feature.tokenCost} tokens
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${feature.enabled ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {feature.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingFeature(feature)}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Edit Feature Modal */}
            {editingFeature && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">
                                {editingFeature.createdAt ? 'Edit Feature' : 'New Feature'}
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Feature ID *
                                </label>
                                <Input
                                    value={editingFeature.id || ''}
                                    onChange={(e) => setEditingFeature({ ...editingFeature, id: e.target.value })}
                                    placeholder="e.g., premium-export"
                                    disabled={!!editingFeature.createdAt}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Unique identifier (cannot be changed after creation)
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Feature Name *
                                </label>
                                <Input
                                    value={editingFeature.featureName || ''}
                                    onChange={(e) => setEditingFeature({ ...editingFeature, featureName: e.target.value })}
                                    placeholder="e.g., Premium Export"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Description
                                </label>
                                <Input
                                    value={editingFeature.description || ''}
                                    onChange={(e) => setEditingFeature({ ...editingFeature, description: e.target.value })}
                                    placeholder="Brief description of the feature"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Token Cost *
                                </label>
                                <Input
                                    type="number"
                                    value={editingFeature.tokenCost || 0}
                                    onChange={(e) => setEditingFeature({ ...editingFeature, tokenCost: parseInt(e.target.value) || 0 })}
                                    min="0"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="enabled"
                                    checked={editingFeature.enabled !== false}
                                    onChange={(e) => setEditingFeature({ ...editingFeature, enabled: e.target.checked })}
                                    className="rounded border-slate-300"
                                />
                                <label htmlFor="enabled" className="text-sm font-medium text-slate-700">
                                    Enabled for redemption
                                </label>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setEditingFeature(null)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveFeature} icon={<Save className="w-4 h-4" />}>
                                Save Feature
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
