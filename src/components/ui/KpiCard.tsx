import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  hint?: string;
  color?: string;
  iconBackgroundColor?: string;
  onClick?: () => void;
}

export default function KpiCard({
  label,
  value,
  icon,
  hint,
  color = "#1a1f6e",
  iconBackgroundColor = `${color}16`,
  onClick,
}: KpiCardProps) {
  const contents = (
    <>
      <div className="flex min-h-10 items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ color, backgroundColor: iconBackgroundColor }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0 break-words text-2xl font-bold leading-none text-[var(--color-text-primary)]">
          {value}
        </div>
      </div>
      <div className="mt-3 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </div>
      {hint ? (
        <div className="mt-2 text-xs text-[var(--color-text-secondary)]">{hint}</div>
      ) : (
        <div className="mt-2 min-h-[1rem]" aria-hidden="true" />
      )}
    </>
  );
  const cardClassName =
    "flex h-full w-full flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 text-left";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cardClassName} transition hover:-translate-y-0.5 hover:border-[var(--color-brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]`}
      >
        {contents}
      </button>
    );
  }

  return <article className={cardClassName}>{contents}</article>;
}
