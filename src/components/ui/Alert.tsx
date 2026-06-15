import React from 'react';
import { X } from 'lucide-react';

interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: React.ReactNode;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  dismissible?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      icon,
      onDismiss,
      dismissible = true,
      className = '',
      children,
      role = 'alert',
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      info: 'bg-[var(--color-brand-primary)]/10 border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] dark:text-blue-400',
      success: 'bg-[var(--color-brand-success)]/10 border-[var(--color-brand-success)] text-[var(--color-brand-success)] dark:text-emerald-400',
      warning: 'bg-[var(--color-brand-warning)]/10 border-[var(--color-brand-warning)] text-[var(--color-brand-warning)]',
      danger: 'bg-[var(--color-brand-danger)]/10 border-[var(--color-brand-danger)] text-[var(--color-brand-danger)]',
    };

    const baseStyles = 'rounded-xl border p-4 transition-colors';

    const finalClassName = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${className}
    `.trim();

    return (
      <div
        ref={ref}
        className={finalClassName}
        role={role}
        aria-live="polite"
        aria-atomic="true"
        {...props}
      >
        <div className="flex items-start gap-3">
          {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
          <div className="flex-1 min-w-0">
            {title && <h4 className="font-semibold mb-1">{title}</h4>}
            {children && <div className="text-sm">{children}</div>}
          </div>
          {dismissible && onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 ml-2 p-1 hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 rounded"
              aria-label="Dismiss alert"
              type="button"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export default Alert;
