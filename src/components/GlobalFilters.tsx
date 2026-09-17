import React from 'react';
import { ProjectItem, FilterState, Language } from '../types';
import { TEXT } from '../constants/theme';

interface GlobalFiltersProps {
  rawData: ProjectItem[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  months: string[];
  lang: Language;
}

export const GlobalFilters: React.FC<GlobalFiltersProps> = ({
  rawData,
  filters,
  setFilters,
  months,
  lang,
}) => {
  const t = TEXT[lang];

  const owners = ['All', ...new Set(rawData.map(d => d.owner))].sort();
  const statuses = ['All', ...new Set(rawData.map(d => d.status))].sort();
  const categories = ['All', ...new Set(rawData.map(d => d.category))].sort();
  const clusters = ['All', ...new Set(rawData.map(d => d.cluster))].sort();
  const monthOptions = ['All', ...months];

  return (
    <div className="dashboard-card">
      <div className="flex justify-between mb-2">
        <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-sub)' }}>
          {lang === 'en' ? 'Global Filters (KPIs & Charts)' : '全域篩選 (KPI 與圖表)'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="md:col-span-1">
          <label id="lblOwner" className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
            {t.owner}
          </label>
          <select
            value={filters.owner}
            onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
            className="std-input"
          >
            {owners.map(o => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label id="lblStatus" className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
            {t.status}
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="std-input"
          >
            {statuses.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label id="lblCategory" className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
            {t.category}
          </label>
          <select
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            className="std-input"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label id="lblCluster" className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
            {t.cluster}
          </label>
          <select
            value={filters.cluster}
            onChange={(e) => setFilters(prev => ({ ...prev, cluster: e.target.value }))}
            className="std-input"
          >
            {clusters.map(cl => (
              <option key={cl} value={cl}>
                {cl}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label id="lblMonth" className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
            {t.month}
          </label>
          <div className="flex items-center gap-2">
            <select
              value={filters.startMonth}
              onChange={(e) => setFilters(prev => ({ ...prev, startMonth: e.target.value }))}
              className="std-input"
            >
              {monthOptions.map(m => (
                <option key={`f-start-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-sub)', fontSize: '12px' }}>
              {lang === 'en' ? 'to' : '至'}
            </span>
            <select
              value={filters.endMonth}
              onChange={(e) => setFilters(prev => ({ ...prev, endMonth: e.target.value }))}
              className="std-input"
            >
              {monthOptions.map(m => (
                <option key={`f-end-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
