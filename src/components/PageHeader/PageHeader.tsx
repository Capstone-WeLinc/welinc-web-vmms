import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-divider)] pb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
          <Icon size={24} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)] truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </header>
  );
}
