import React from 'react';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  bordered?: boolean;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      title,
      subtitle,
      icon,
      bordered = true,
      elevation = 'sm',
      padding = 'md',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'rounded-xl bg-[var(--color-card-bg)] transition-theme';

    const borderStyle = bordered ? 'border border-[var(--color-border)]' : '';

    const elevationStyles = {
      none: '',
      sm: 'shadow-card',
      md: 'shadow-md',
      lg: 'shadow-lg',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-6',
      lg: 'p-8',
    };

    const finalClassName = `
      ${baseStyles}
      ${borderStyle}
      ${elevationStyles[elevation]}
      ${paddingStyles[padding]}
      ${className}
    `.trim();

    return (
      <div ref={ref} className={finalClassName} {...props}>
        {(title || subtitle || icon) && (
          <div className="flex items-start gap-4 mb-4">
            {icon && <div className="flex-shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-[var(--color-text-secondary)] truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
