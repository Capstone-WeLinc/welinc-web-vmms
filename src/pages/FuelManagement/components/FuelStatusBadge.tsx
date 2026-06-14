import { AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';

type FuelStatus = 'Normal' | 'Below Avg' | 'Anomaly';

interface FuelStatusBadgeProps {
  status: FuelStatus;
  size?: 'sm' | 'md';
}

export default function FuelStatusBadge({ status, size = 'md' }: FuelStatusBadgeProps) {
  const baseClasses = 'inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-full border px-3 py-1.5';

  const sizeClasses: Record<string, string> = {
    sm: 'text-xs',
    md: 'text-sm',
  };

  const statusClasses: Record<FuelStatus, string> = {
    Normal: 'border-[var(--color-brand-success)]/30 bg-[var(--color-brand-success)]/10 text-[var(--color-brand-success)]',
    'Below Avg': 'border-[var(--color-brand-warning)]/30 bg-[var(--color-brand-warning)]/10 text-[var(--color-brand-warning)]',
    Anomaly: 'border-[var(--color-brand-danger)]/30 bg-[var(--color-brand-danger)]/10 text-[var(--color-brand-danger)]',
  };

  const icons = {
    Normal: <CheckCircle2 size={14} />,
    'Below Avg': <TrendingDown size={14} />,
    Anomaly: <AlertTriangle size={14} />,
  };

  return (
    <span className={`${baseClasses} ${sizeClasses[size]} ${statusClasses[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
}
