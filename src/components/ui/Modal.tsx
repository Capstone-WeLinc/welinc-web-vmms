import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '../../lib/hooks/useBodyScrollLock';
import Button from './Button';

export interface ModalProps {
  isOpen: boolean;
  title?: React.ReactNode;
  message?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  children,
  footer,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  size = 'md',
  className = '',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const sizeStyles = {
    sm: 'max-w-lg',
    md: 'max-w-3xl',
    lg: 'max-w-6xl',
  };

  const modal = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`modal-content ${sizeStyles[size]} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
      >
        {/* Header */}
        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-divider)] px-5 py-4 sm:px-8 sm:py-6">
            <div>
              <h2
                id="modal-title"
                className="text-xl font-extrabold text-[var(--color-text-primary)]"
              >
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        {(message !== undefined || children !== undefined) && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 sm:py-6">
            {message !== undefined && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {message}
              </p>
            )}
            {children}
          </div>
        )}

        {/* Footer */}
        {(footer !== undefined || onConfirm) && (
          <div className="shrink-0 border-t border-[var(--color-divider)] px-5 py-4 sm:px-8 sm:py-6">
            {footer !== undefined ? (
              footer
            ) : (
              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={onClose}
                >
                  {cancelLabel}
                </Button>
                {onConfirm && (
                  <Button
                    variant={confirmVariant}
                    onClick={onConfirm}
                  >
                    {confirmLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default Modal;
