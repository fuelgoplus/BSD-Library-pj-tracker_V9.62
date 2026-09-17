import React from 'react';
import { ProjectItem, Language } from '../types';
import { TEXT } from '../constants/theme';

interface KpiCardsProps {
  filteredData: ProjectItem[];
  lang: Language;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ filteredData, lang }) => {
  const t = TEXT[lang];

  const total = filteredData.length;
  const closed = filteredData.filter(d => d.status.toLowerCase() === 'closed').length;
  const onTimeCount = filteredData.filter(d => d.isOnTime).length;
  const rate = total ? Math.round((onTimeCount / total) * 100) : 0;

  let onTimeColor = 'var(--brand-negative)';
  if (rate >= 90) onTimeColor = 'var(--brand-positive)';
  else if (rate >= 75) onTimeColor = 'var(--brand-accent)';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="dashboard-card kpi-main relative overflow-hidden">
        <h3 id="lblTotalItems" className="text-xs font-semibold uppercase" style={{ color: 'var(--text-sub)' }}>
          {t.total}
        </h3>
        <p id="kTotal" className="text-5xl font-bold mt-2 tracking-tight" style={{ color: 'var(--brand-text)' }}>
          {total.toLocaleString()}
        </p>
        <p id="lblTotalDesc" className="text-xs mt-2" style={{ color: 'var(--text-sub)' }}>
          {t.totalDesc}
        </p>
        <i
          className="fa-solid fa-layer-group absolute right-4 top-6 text-8xl opacity-10 pointer-events-none"
          style={{ color: 'var(--brand-main)' }}
        ></i>
      </div>

      <div className="dashboard-card kpi-sub relative overflow-hidden">
        <h3 id="lblCompleted" className="text-xs font-semibold uppercase" style={{ color: 'var(--text-sub)' }}>
          {t.completed}
        </h3>
        <p id="kClosed" className="text-5xl font-bold mt-2 tracking-tight" style={{ color: 'var(--brand-sub)' }}>
          {closed.toLocaleString()}
        </p>
        <p id="lblCompletedDesc" className="text-xs mt-2" style={{ color: 'var(--text-sub)' }}>
          {t.completedDesc}
        </p>
        <i
          className="fa-solid fa-check-circle absolute right-4 top-6 text-8xl opacity-10 pointer-events-none"
          style={{ color: 'var(--brand-sub)' }}
        ></i>
      </div>

      <div className="dashboard-card kpi-positive relative overflow-hidden">
        <h3 id="lblOnTimeRate" className="text-xs font-semibold uppercase" style={{ color: 'var(--text-sub)' }}>
          {t.onTime}
        </h3>
        <p id="kOnTime" className="text-5xl font-bold mt-2 tracking-tight" style={{ color: onTimeColor }}>
          {rate}%
        </p>
        <p id="lblOnTimeDesc" className="text-xs mt-2" style={{ color: 'var(--text-sub)' }}>
          {t.onTimeDesc}
        </p>
        <i
          className="fa-solid fa-stopwatch absolute right-4 top-6 text-8xl opacity-10 pointer-events-none"
          style={{ color: 'var(--brand-positive)' }}
        ></i>
      </div>
    </div>
  );
};
