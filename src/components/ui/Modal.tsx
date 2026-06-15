import React, { useEffect, useRef } from 'react';
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

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div
      className="modal-overlay p-4"
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
          <div className="border-b border-[var(--color-divider)] px-6 py-4">
            <h2
              id="modal-title"
              className="text-lg font-bold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        {(message !== undefined || children !== undefined) && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
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
          <div className="border-t border-[var(--color-divider)] px-6 py-4">
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
};

export default Modal;
