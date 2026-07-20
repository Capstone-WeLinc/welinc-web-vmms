import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';
import PageHeader from '../../components/PageHeader/PageHeader';

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

const pageContainerClasses = 'space-y-6';
const centeredPaneClasses = 'flex min-h-100 items-center justify-center';
const cardClasses = 'w-full max-w-xl rounded-[28px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-12 text-center shadow-[0_30px_70px_rgba(0,0,0,0.12)]';
const iconCircleClasses = 'mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[20px] border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] shadow-[0_0_40px_rgba(255,255,255,0.05)] animate-pulse';
const titleClasses = 'text-2xl font-bold text-[var(--color-text-primary)]';
const highlightedTextClasses = 'text-[var(--color-text-primary)] font-bold';
const loaderRowClasses = 'mt-8 flex items-center justify-center gap-2';
const loaderDotClasses = 'h-1.5 w-1.5 rounded-full bg-[var(--color-border)] animate-bounce';

export default function PlaceholderPage({ title, subtitle, icon }: PlaceholderPageProps) {
  return (
    <div className={pageContainerClasses}>
      <PageHeader icon={icon} title={title} subtitle={subtitle} />
      <div className={centeredPaneClasses}>
        <div className={cardClasses}>
          <div className={iconCircleClasses}>
            <Construction size={40} strokeWidth={1.4} />
          </div>
          <h2 className={titleClasses}>
            The <strong className={highlightedTextClasses}>{title}</strong> module is currently under development.
          </h2>
          <div className={loaderRowClasses}>
            <span className={loaderDotClasses} />
            <span className={loaderDotClasses} style={{ animationDelay: '0.2s' }} />
            <span className={loaderDotClasses} style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
