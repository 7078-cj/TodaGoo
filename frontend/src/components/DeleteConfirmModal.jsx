import React from 'react'
import { Trash2, X } from 'lucide-react'

export default function DeleteConfirmModal({ open, onClose, onConfirm, loading, itemName }) {
    if (!open) return null;

    return (
        <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        >
        <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Close button */}
            <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
            <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <Trash2 className="w-5 h-5 text-red-500" />
            </div>

            {/* Text */}
            <div className="text-center">
            <h2 className="text-base font-semibold text-gray-900">Delete{itemName ? ` "${itemName}"` : ''}?</h2>
            <p className="text-sm text-muted-foreground mt-1">
                This action cannot be undone.
            </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-1">
            <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition disabled:opacity-40"
            >
                Cancel
            </button>
            <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
                {loading ? (
                <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                </>
                ) : (
                <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                </>
                )}
            </button>
            </div>
        </div>
        </div>
    );
}