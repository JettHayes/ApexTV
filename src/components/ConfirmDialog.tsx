'use client';

import { AlertTriangle, X } from 'lucide-react';
import { createPortal } from 'react-dom';

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

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  variant = 'warning',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-700 text-white hover:bg-red-800',
    },
    warning: {
      icon: 'text-yellow-500',
      button: 'bg-yellow-400 text-yellow-950 hover:bg-yellow-500',
    },
    info: {
      icon: 'text-blue-500',
      button: 'bg-blue-700 text-white hover:bg-blue-800',
    },
  };

  const styles = variantStyles[variant];

  return createPortal(
    <div className='fixed inset-0 z-[10000] flex items-center justify-center p-4'>
      <div
        className='absolute inset-0 bg-black/50'
        onClick={onCancel}
      />
      <div className='ptv-dialog relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden bg-white dark:bg-gray-900 rounded-lg shadow-xl'>
        {/* Header */}
        <div className='flex shrink-0 items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center gap-3'>
            <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
            <h2 className='text-lg font-semibold text-gray-800 dark:text-gray-200'>
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className='flex h-11 w-11 shrink-0 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors'
          >
            <X className='w-5 h-5 text-gray-600 dark:text-gray-400' />
          </button>
        </div>

        {/* Content */}
        <div className='min-h-0 overflow-y-auto p-4'>
          <p className='text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line'>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className='flex shrink-0 flex-wrap items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700'>
          <button
            onClick={onCancel}
            className='min-h-11 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors'
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`min-h-11 px-4 py-2 text-sm rounded transition-colors ${styles.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
