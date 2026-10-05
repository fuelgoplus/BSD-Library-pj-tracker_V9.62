import React, { useState, useRef, useEffect } from 'react';
import { ProjectItem, Language, ThemeColors } from '../types';
import { TEXT } from '../constants/theme';
import { shortName } from '../utils/dataProcessor';

export type GanttDisplayOption =
  | 'status'
  | 'category'
  | 'cluster'
  | 'brief'
  | 'duration'
  | 'mh'
  | 'period';

interface GanttDisplayOptionsProps {
  selectedOptions: GanttDisplayOption[];
  onChange: (options: GanttDisplayOption[]) => void;
  lang: Language;
  palette: ThemeColors;
}

export const ALL_DISPLAY_OPTIONS: GanttDisplayOption[] = [
  'status',
  'category',
  'cluster',
  'brief',
  'duration',
  'mh',
  'period',
];

export function formatGanttBarLabel(
  item: ProjectItem,
  selectedOptions: GanttDisplayOption[],
  _lang?: Language
): string {
  if (selectedOptions.length === 0) return '';
  const parts: string[] = [];

  // 1. Status
  if (selectedOptions.includes('status')) {
    if (item.status) parts.push(item.status);
  }

  // 2. Category
  if (selectedOptions.includes('category')) {
    if (item.category) parts.push(item.category);
  }

  // 3. Cluster
  if (selectedOptions.includes('cluster')) {
    if (item.cluster) parts.push(item.cluster);
  }

  // 4. Project Brief
  if (selectedOptions.includes('brief')) {
    const brief = shortName(item.desc, 22);
    if (brief) parts.push(brief);
  }

  // 5. Duration
  if (selectedOptions.includes('duration')) {
    parts.push(`${item.duration || 0}d`);
  }

  // 6. MH/Days
  if (selectedOptions.includes('mh')) {
    parts.push(`${item.dailyMH || 0} MH/d`);
  }

  // 7. Period (Start ~ End)
  if (selectedOptions.includes('period')) {
    const end = item.rev || item.due;
    if (end) {
      const dur = Math.max(1, item.duration || 1);
      const start = new Date(end.getTime() - (dur - 1) * 86400000);
      const sStr = `${String(start.getUTCMonth() + 1).padStart(2, '0')}/${String(start.getUTCDate()).padStart(2, '0')}`;
      const eStr = `${String(end.getUTCMonth() + 1).padStart(2, '0')}/${String(end.getUTCDate()).padStart(2, '0')}`;
      parts.push(`${sStr}~${eStr}`);
    }
  }

  return parts.join(' | ');
}

export const GanttDisplayOptions: React.FC<GanttDisplayOptionsProps> = ({
  selectedOptions,
  onChange,
  lang,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const t = TEXT[lang];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllSelected = selectedOptions.length === ALL_DISPLAY_OPTIONS.length;

  const toggleOption = (opt: GanttDisplayOption) => {
    if (selectedOptions.includes(opt)) {
      onChange(selectedOptions.filter(o => o !== opt));
    } else {
      onChange([...selectedOptions, opt]);
    }
  };

  const handleSelectAll = () => {
    onChange([...ALL_DISPLAY_OPTIONS]);
  };

  const handleClear = () => {
    onChange([]);
  };

  const getOptionLabel = (opt: GanttDisplayOption) => {
    switch (opt) {
      case 'status':
        return t.ganttOptStatus;
      case 'category':
        return t.ganttOptCategory;
      case 'cluster':
        return t.ganttOptCluster;
      case 'brief':
        return t.ganttOptBrief;
      case 'duration':
        return t.ganttOptDuration;
      case 'mh':
        return t.ganttOptMh;
      case 'period':
        return t.ganttOptPeriod;
    }
  };

  const getOptionIcon = (opt: GanttDisplayOption) => {
    switch (opt) {
      case 'status':
        return <i className="fa-solid fa-tags text-rose-500 text-xs mr-2"></i>;
      case 'category':
        return <i className="fa-solid fa-shapes text-indigo-500 text-xs mr-2"></i>;
      case 'cluster':
        return <i className="fa-solid fa-diagram-project text-teal-500 text-xs mr-2"></i>;
      case 'brief':
        return <i className="fa-solid fa-align-left text-sky-500 text-xs mr-2"></i>;
      case 'duration':
        return <i className="fa-regular fa-clock text-amber-500 text-xs mr-2"></i>;
      case 'mh':
        return <i className="fa-solid fa-user-clock text-emerald-500 text-xs mr-2"></i>;
      case 'period':
        return <i className="fa-regular fa-calendar-days text-purple-500 text-xs mr-2"></i>;
    }
  };

  const displaySummary = () => {
    if (selectedOptions.length === 0) return lang === 'en' ? 'None' : '無';
    if (isAllSelected) return lang === 'en' ? `All (${ALL_DISPLAY_OPTIONS.length})` : `全部 (${ALL_DISPLAY_OPTIONS.length})`;
    const names = selectedOptions.map(getOptionLabel);
    if (names.length === 1) return names[0];
    return names.join(', ');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label
        className="block text-[10px] font-semibold uppercase mb-1 flex items-center justify-between"
        style={{ color: 'var(--brand-text)' }}
      >
        <span>{t.ganttDisplayFields}</span>
        {selectedOptions.length > 0 && (
          <span className="text-[9px] font-normal text-slate-400 lowercase">
            ({selectedOptions.length})
          </span>
        )}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="std-input w-full flex items-center justify-between text-left cursor-pointer text-xs py-1.5 px-2.5 h-[34px] rounded transition-all focus:outline-none focus:ring-1 focus:ring-sky-500"
        title={displaySummary()}
      >
        <div className="flex items-center gap-1.5 truncate pr-1">
          <i className="fa-solid fa-list-check text-blue-600 text-[11px] flex-shrink-0"></i>
          <span className="truncate font-medium" style={{ color: 'var(--text-main)' }}>
            {displaySummary()}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedOptions.length > 0 && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: 'var(--brand-main)' }}
            >
              {selectedOptions.length}
            </span>
          )}
          <i
            className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-sub)' }}
          ></i>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-full min-w-[210px] max-w-[280px] z-50 rounded-lg shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--border-color)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Header Action Buttons */}
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b text-[10.5px] font-semibold"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}
          >
            <button
              type="button"
              onClick={handleSelectAll}
              className={`hover:underline cursor-pointer flex items-center gap-1 ${isAllSelected ? 'font-bold' : ''}`}
              style={{ color: isAllSelected ? 'var(--brand-text)' : 'var(--text-sub)' }}
            >
              <i className="fa-solid fa-check-double text-[10px]"></i>
              <span>{lang === 'en' ? 'Select All' : '全選'}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="hover:underline text-rose-500 cursor-pointer flex items-center gap-1"
            >
              <i className="fa-solid fa-xmark text-[10px]"></i>
              <span>{lang === 'en' ? 'Clear' : '清除'}</span>
            </button>
          </div>

          {/* Options List */}
          <div className="p-1 flex flex-col gap-0.5">
            {ALL_DISPLAY_OPTIONS.map(opt => {
              const checked = selectedOptions.includes(opt);
              return (
                <label
                  key={opt}
                  className="dropdown-option flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-xs select-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  style={{
                    backgroundColor: checked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(opt)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer accent-blue-600"
                  />
                  {getOptionIcon(opt)}
                  <span
                    className={`dropdown-option-text truncate flex-grow ${checked ? 'font-bold' : 'font-medium'}`}
                    style={{ color: checked ? 'var(--brand-text)' : 'var(--text-main)' }}
                  >
                    {getOptionLabel(opt)}
                  </span>
                  {checked && (
                    <i className="fa-solid fa-check text-[10px] text-blue-600"></i>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
