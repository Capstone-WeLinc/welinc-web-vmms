import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  errorMessage?: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      helperText,
      error = false,
      errorMessage,
      icon,
      iconPosition = 'left',
      className = '',
      ...props
    },
    ref
  ) => {
    const baseInputStyles = 'w-full px-4 py-3 rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-input-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] transition-colors focus:outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20';

    const errorStyles = error ? 'border-[var(--color-brand-danger)] focus:border-[var(--color-brand-danger)] focus:ring-[var(--color-brand-danger)]/20' : '';

    const inputWrapperStyles = icon ? 'relative flex items-center' : '';

    const inputPaddingAdjustment = icon ? (iconPosition === 'left' ? 'pl-12' : 'pr-12') : '';

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {label}
            {props.required && <span className="text-[var(--color-brand-danger)] ml-1">*</span>}
          </label>
        )}

        <div className={inputWrapperStyles}>
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 text-[var(--color-text-secondary)] pointer-events-none flex items-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              ${baseInputStyles}
              ${errorStyles}
              ${inputPaddingAdjustment}
              ${className}
            `.trim()}
            aria-invalid={error}
            aria-describedby={error && errorMessage ? `${props.id}-error` : undefined}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 text-[var(--color-text-secondary)] pointer-events-none flex items-center">
              {icon}
            </div>
          )}
        </div>

        {error && errorMessage && (
          <p id={`${props.id}-error`} className="text-xs text-[var(--color-brand-danger)] font-medium">
            {errorMessage}
          </p>
        )}

        {!error && helperText && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
