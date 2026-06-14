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
const cardClasses = 'w-full max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-12 text-center shadow-[0_30px_70px_rgba(0,0,0,0.12)]';
const iconCircleClasses = 'mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[20px] border border-white/10 bg-white/5 text-slate-300 shadow-[0_0_40px_rgba(255,255,255,0.05)] animate-pulse';
const titleClasses = 'text-2xl font-semibold text-slate-400';
const subtitleClasses = 'mt-4 text-sm leading-7 text-slate-400';
const highlightedTextClasses = 'text-slate-400 font-semibold';
const loaderRowClasses = 'mt-8 flex items-center justify-center gap-2';
const loaderDotClasses = 'h-1.5 w-1.5 rounded-full bg-white/10 animate-bounce';

export default function PlaceholderPage({ title, subtitle, icon }: PlaceholderPageProps) {
  return (
    <div className={pageContainerClasses}>
      <PageHeader icon={icon} title={title} subtitle={subtitle} />
      <div className={centeredPaneClasses}>
        <div className={cardClasses}>
          <div className={iconCircleClasses}>
            <Construction size={40} strokeWidth={1.4} />
          </div>
          <h2 className={titleClasses}>Coming Soon</h2>
          <p className={subtitleClasses}>
            The <strong className={highlightedTextClasses}>{title}</strong> module is currently under development.
            <br />
            Check back soon for updates.
          </p>
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
