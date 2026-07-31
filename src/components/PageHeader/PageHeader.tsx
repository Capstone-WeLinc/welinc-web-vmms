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
    <header className="mb-8 flex min-h-32 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-8 py-6">
      <div className="flex w-full flex-col gap-4 self-center sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
            <Icon size={24} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-[var(--color-text-primary)]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
