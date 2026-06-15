import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Truck,
  Wrench,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { getDashboardStats } from "../../api/fleetService";

type DashboardStat = {
  label: string;
  value: string;
  change?: string;
  icon: typeof Truck;
  color?: string;
  bgColor?: string;
};

type BackendStatFromApi = {
  label: string;
  value: string;
  change?: string;
  icon?: string;
  color?: string;
  bgColor?: string;
};

const mapBackendStats = (stats: BackendStatFromApi[]): DashboardStat[] =>
  stats.map((stat) => {
    const iconMap = {
      Truck,
      Wrench,
      AlertTriangle,
      CheckCircle2,
    } as const;

    return {
      ...stat,
      icon: iconMap[stat.icon as keyof typeof iconMap] ?? Truck,
    };
  });

const cardBaseClasses = 'rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card';

// Layout & interaction classes
const containerClasses = 'space-y-6';
const gridClasses = 'grid gap-4 xl:grid-cols-4 lg:grid-cols-2';
const cardClasses = 'animate-pulse';
const loadingIconContainerClasses = 'mb-4 flex items-center justify-between';
const statCardClasses = 'group cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-card-bg-hover)] hover:shadow-[0_8px_24px_rgba(14,165,233,0.06)]';
const iconContainerClasses = 'flex h-10 w-10 items-center justify-center rounded-xl';
const statValueClasses = 'text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]';
const statLabelClasses = 'mt-2 text-sm text-[var(--color-text-secondary)]';
const statChangeClasses = 'mt-3 text-sm font-medium';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then((data) => setStats(mapBackendStats(data)))
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={containerClasses}>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Vehicle Maintenance Management Overview"
      />

      <div className={gridClasses}>
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className={`${cardBaseClasses} ${cardClasses}`}>
                <div className={loadingIconContainerClasses}>
                  <div className="rounded-md bg-[var(--color-input-bg)] h-10 w-10" />
                </div>
                <div className="rounded-md bg-[var(--color-input-bg)] h-10 w-24" />
                <div className="mt-2 rounded-md bg-[var(--color-input-bg)] h-4 w-32" />
                <div className="mt-3 rounded-md bg-[var(--color-input-bg)] h-4 w-16" />
              </div>
            ))
          : stats.map((stat) => (
              <div
                key={stat.label}
                className={`${cardBaseClasses} ${statCardClasses}`}
              >
                <div className={loadingIconContainerClasses}>
                  <div
                    className={iconContainerClasses}
                    style={{ background: stat.bgColor, color: stat.color }}
                  >
                    <stat.icon size={20} strokeWidth={1.8} />
                  </div>
                </div>
                <div className={statValueClasses}>
                  {stat.value}
                </div>
                <div className={statLabelClasses}>{stat.label}</div>
                <div
                  className={statChangeClasses}
                  style={{ color: stat.color }}
                >
                  {stat.change ?? ""}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
