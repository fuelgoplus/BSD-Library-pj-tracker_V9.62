import React from 'react';
import { ProjectItem, FilterState, Language } from '../types';
import { TEXT } from '../constants/theme';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { toSelectedArray } from '../utils/filterHelpers';

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

  const owners = [...new Set(rawData.map(d => d.owner))].filter(Boolean).sort();
  const statuses = [...new Set(rawData.map(d => d.status))].filter(Boolean).sort();
  const categories = [...new Set(rawData.map(d => d.category))].filter(Boolean).sort();
  const clusters = [...new Set(rawData.map(d => d.cluster))].filter(Boolean).sort();
  const monthOptions = ['All', ...months];

  return (
    <div className="dashboard-card">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-sub)' }}>
          {lang === 'en' ? 'Global Filters (KPIs & Charts)' : '全域篩選 (KPI 與圖表)'}
        </span>
        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-block">
          <i className="fa-solid fa-circle-info mr-1"></i>
          {lang === 'en' ? 'Multi-select enabled for Owner, Status, Category & Cluster' : '負責人、狀態、類別與群組皆支援複選'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="md:col-span-1">
          <MultiSelectDropdown
            id="filter-owner"
            label={t.owner}
            options={owners}
            selectedValues={toSelectedArray(filters.owner)}
            onChange={(selected) => setFilters(prev => ({ ...prev, owner: selected.length === 0 ? 'All' : selected }))}
            allLabel={lang === 'en' ? 'All Owners' : '全部負責人'}
          />
        </div>

        <div className="md:col-span-1">
          <MultiSelectDropdown
            id="filter-status"
            label={t.status}
            options={statuses}
            selectedValues={toSelectedArray(filters.status)}
            onChange={(selected) => setFilters(prev => ({ ...prev, status: selected.length === 0 ? 'All' : selected }))}
            allLabel={lang === 'en' ? 'All Status' : '全部狀態'}
          />
        </div>

        <div className="md:col-span-1">
          <MultiSelectDropdown
            id="filter-category"
            label={t.category}
            options={categories}
            selectedValues={toSelectedArray(filters.category)}
            onChange={(selected) => setFilters(prev => ({ ...prev, category: selected.length === 0 ? 'All' : selected }))}
            allLabel={lang === 'en' ? 'All Categories' : '全部類別'}
          />
        </div>

        <div className="md:col-span-1">
          <MultiSelectDropdown
            id="filter-cluster"
            label={t.cluster}
            options={clusters}
            selectedValues={toSelectedArray(filters.cluster)}
            onChange={(selected) => setFilters(prev => ({ ...prev, cluster: selected.length === 0 ? 'All' : selected }))}
            allLabel={lang === 'en' ? 'All Clusters' : '全部群組'}
          />
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
