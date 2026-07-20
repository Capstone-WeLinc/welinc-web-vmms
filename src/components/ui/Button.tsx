import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      loading = false,
      fullWidth = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'rounded-md text-sm font-medium transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed';
    
    const sizeStyles = {
      sm: 'py-2 px-3',
      md: 'py-3 px-4',
      lg: 'py-4 px-6 text-base',
    };

    const variantStyles = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      danger: 'btn-danger',
      warning: 'btn-warning',
      icon: 'btn-icon',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    const flexStyles = icon ? 'flex items-center justify-center gap-2' : '';

    const finalClassName = `
      ${baseStyles}
      ${sizeStyles[size]}
      ${variantStyles[variant]}
      ${widthStyle}
      ${flexStyles}
      ${className}
    `.trim();

    return (
      <button
        ref={ref}
        className={finalClassName}
        disabled={disabled || loading}
        {...props}
      >
        {icon && iconPosition === 'left' && icon}
        {loading ? <span className="animate-spin">⟳</span> : children}
        {icon && iconPosition === 'right' && icon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
