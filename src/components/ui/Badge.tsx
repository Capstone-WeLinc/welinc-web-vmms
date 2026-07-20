import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'danger' | 'warning' | 'success';
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'primary', icon, size = 'md', className = '', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center gap-2 font-medium rounded-full';

    const variantStyles = {
      primary: 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]',
      danger: 'bg-[var(--color-brand-danger)]/10 text-[var(--color-brand-danger)]',
      warning: 'bg-[var(--color-brand-warning)]/10 text-[var(--color-brand-warning)]',
      success: 'bg-[var(--color-brand-success)]/10 text-[var(--color-brand-success)]',
    };

    const sizeStyles = {
      sm: 'px-2 py-1 text-xs font-medium',
      md: 'px-3 py-1 text-xs font-medium',
    };

    const finalClassName = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${className}
    `.trim();

    return (
      <span ref={ref} className={finalClassName} {...props}>
        {icon}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
