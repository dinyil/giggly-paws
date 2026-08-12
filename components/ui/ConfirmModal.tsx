import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const iconMap = {
    danger: { emoji: '🗑️', bg: 'bg-red-50', border: 'border-red-100', btn: 'bg-red-600 hover:bg-red-700 shadow-red-200' },
    warning: { emoji: '⚠️', bg: 'bg-amber-50', border: 'border-amber-100', btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' },
    info: { emoji: 'ℹ️', bg: 'bg-blue-50', border: 'border-blue-100', btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' },
  };
  const style = iconMap[variant];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon header */}
        <div className={`${style.bg} border-b ${style.border} px-6 py-5 flex items-center gap-4`}>
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
            {style.emoji}
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-900">{title}</h3>
            <p className="text-sm text-zinc-500 mt-0.5 leading-snug">{message}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl font-semibold text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all shadow-lg ${style.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
