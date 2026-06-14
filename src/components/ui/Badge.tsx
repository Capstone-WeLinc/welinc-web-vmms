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
      primary: 'bg-[#1a1f6e]/10 text-[#1a1f6e] dark:text-blue-400',
      danger: 'bg-[#c0392b]/10 text-[#c0392b]',
      warning: 'bg-[#e8b800]/10 text-[#e8b800]',
      success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };

    const sizeStyles = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1 text-sm',
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
