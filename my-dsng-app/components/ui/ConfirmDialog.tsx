import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'warning'
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: 'bg-red-50 border-red-200',
        warning: 'bg-amber-50 border-amber-200',
        info: 'bg-blue-50 border-blue-200'
    };

    const iconColors = {
        danger: 'text-red-600',
        warning: 'text-amber-600',
        info: 'text-blue-600'
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md animate-in zoom-in-95 duration-200">
                <div className="bg-white rounded-lg shadow-2xl border border-slate-200">
                    {/* Header */}
                    <div className={`flex items-start gap-3 p-4 border-b ${variantStyles[variant]}`}>
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${iconColors[variant]}`} />
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-900">{title}</h3>
                        </div>
                        <button
                            onClick={onCancel}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        <p className="text-slate-600 text-sm">{message}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 p-4 bg-slate-50 rounded-b-lg">
                        <Button
                            variant="ghost"
                            onClick={onCancel}
                        >
                            {cancelText}
                        </Button>
                        <Button
                            variant={variant === 'danger' ? 'primary' : 'primary'}
                            onClick={() => {
                                onConfirm();
                                onCancel();
                            }}
                            className={variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};
