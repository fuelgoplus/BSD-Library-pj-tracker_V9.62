import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ProjectItem, ThemeColors, Language, FilterState } from '../types';
import { TEXT } from '../constants/theme';
import {
  shortName,
  cleanProjectDesc,
  getStatusColor,
  isDateOverlapping,
  generateAndDownloadHTMLReport,
  exportWizSummaryCSV,
} from '../utils/dataProcessor';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { matchesFilterValue, isFilterActive, toSelectedArray } from '../utils/filterHelpers';
import { ProjectDetailModal } from './ProjectDetailModal';
import {
  GanttDisplayOptions,
  GanttDisplayOption,
  formatGanttBarLabel,
} from './GanttDisplayOptions';

interface WizGanttModalProps {
  isOpen: boolean;
  onClose: () => void;
  wizData: ProjectItem[];
  palette: ThemeColors;
  lang: Language;
  initialMode?: 'category' | 'project';
  initialCategory?: string;
  initialCluster?: string;
  periodText?: string;
  ganttFilters?: FilterState;
}

export const WizGanttModal: React.FC<WizGanttModalProps> = ({
  isOpen,
  onClose,
  wizData,
  palette,
  lang,
  initialMode = 'category',
  initialCategory = 'all',
  initialCluster = 'all',
  ganttFilters,
}) => {
  const [viewType, setViewType] = useState<'category' | 'project'>(initialMode);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [displayOptions, setDisplayOptions] = useState<GanttDisplayOption[]>(['duration', 'period']);

  // Initialize filters with Wiz filters or defaults
  const [filters, setFilters] = useState<FilterState>({
    owner: ganttFilters?.owner || 'All',
    status: ganttFilters?.status || 'All',
    category: initialCategory !== 'all' ? initialCategory : ganttFilters?.category || 'All',
    cluster: initialCluster !== 'all' ? initialCluster : ganttFilters?.cluster || 'All',
    startMonth: ganttFilters?.startMonth || 'All',
    endMonth: ganttFilters?.endMonth || 'All',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const t = TEXT[lang];

  // Derive unique filter options from wizData
  const owners = useMemo(() => [...new Set(wizData.map(d => d.owner))].filter(Boolean).sort(), [wizData]);
  const statuses = useMemo(() => [...new Set(wizData.map(d => d.status))].filter(Boolean).sort(), [wizData]);
  const categories = useMemo(() => [...new Set(wizData.map(d => d.category))].filter(Boolean).sort(), [wizData]);
  const clusters = useMemo(() => [...new Set(wizData.map(d => d.cluster))].filter(Boolean).sort(), [wizData]);

  const months = useMemo(() => {
    return [...new Set(wizData.flatMap(d => [d.startMonthStr, d.endMonthStr]))]
      .filter(m => m && m !== 'Unknown')
      .sort();
  }, [wizData]);

  const monthOptions = ['All', ...months];

  // Update initialMode and cluster when opened
  useEffect(() => {
    if (isOpen) {
      setViewType(initialMode);
      const isSpecificTarget =
        (initialCluster && initialCluster !== 'all') ||
        (initialCategory && initialCategory !== 'all');

      setFilters({
        owner: ganttFilters?.owner || 'All',
        status: 'All',
        category: initialCategory && initialCategory !== 'all' ? initialCategory : 'All',
        cluster: initialCluster && initialCluster !== 'all' ? initialCluster : 'All',
        startMonth: isSpecificTarget ? 'All' : (ganttFilters?.startMonth || 'All'),
        endMonth: isSpecificTarget ? 'All' : (ganttFilters?.endMonth || 'All'),
      });
    }
  }, [isOpen, initialMode, initialCategory, initialCluster, ganttFilters]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selectedProject) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedProject]);

  // Filter gantt items
  const anyFilterActive =
    isFilterActive(filters.owner) ||
    isFilterActive(filters.status) ||
    isFilterActive(filters.category) ||
    isFilterActive(filters.cluster) ||
    filters.startMonth !== 'All' ||
    filters.endMonth !== 'All';

  const ganttDataRows = useMemo(() => {
    return wizData.filter(d => {
      if (!matchesFilterValue(d.owner, filters.owner)) return false;
      if (!matchesFilterValue(d.status, filters.status)) return false;
      if (!matchesFilterValue(d.category, filters.category)) return false;
      if (!matchesFilterValue(d.cluster, filters.cluster)) return false;
      if (!isDateOverlapping(d, filters.startMonth, filters.endMonth)) return false;
      return true;
    });
  }, [wizData, filters]);

  // Sort data - Category mode groups by Category & Cluster, then chronological
  const sortedGanttData = useMemo(() => {
    return [...ganttDataRows]
      .filter(d => d.due || d.rev)
      .sort((a, b) => {
        if (viewType === 'category') {
          const catA = a.category || '';
          const catB = b.category || '';
          if (catA !== catB) return catA.localeCompare(catB);

          const clA = a.cluster || '';
          const clB = b.cluster || '';
          if (clA !== clB) return clA.localeCompare(clB);
        }
        return ((a.rev || a.due)?.getTime() || 0) - ((b.rev || b.due)?.getTime() || 0);
      });
  }, [ganttDataRows, viewType]);

  const hasData = anyFilterActive && sortedGanttData.length > 0;
  const containerHeight = Math.max(340, sortedGanttData.length * 36 + 60);

  // Exact same Chart.js format, style, and plugins as Project Schedule (Gantt)
  useEffect(() => {
    if (!isOpen || !hasData || !canvasRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ganttLabels = sortedGanttData.map(d => shortName(d.desc, 30));

    const ganttData = sortedGanttData.map(d => {
      const end = (d.rev || d.due)!;
      const durDays = d.duration || 0;
      const start = new Date(end);
      start.setDate(start.getDate() - durDays);
      return [start.getTime(), end.getTime()] as [number, number];
    });

    const ganttColors = sortedGanttData.map(d => getStatusColor(d.status, palette));

    const todayPlugin = {
      id: 'ganttTodayHighlight',
      afterDraw: (chart: any) => {
        const todayNode = new Date();
        const todayT = todayNode.getTime();
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;

        if (todayT >= xAxis.min && todayT <= xAxis.max) {
          const ctx = chart.ctx;
          const x = xAxis.getPixelForValue(todayT);
          const accentColor = palette.accent;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, yAxis.top);
          ctx.lineTo(x, yAxis.bottom);
          ctx.lineWidth = 2;
          ctx.strokeStyle = accentColor;
          ctx.setLineDash([6, 4]);
          ctx.stroke();

          const todayRef = new Date();
          const text =
            todayRef.getFullYear() +
            '/' +
            String(todayRef.getMonth() + 1).padStart(2, '0') +
            '/' +
            String(todayRef.getDate()).padStart(2, '0');
          ctx.font = 'bold 11px "Microsoft JhengHei UI", Quicksand, sans-serif';
          const tWidth = ctx.measureText(text).width;
          const bHeight = 18;
          const yOffset = yAxis.top - bHeight - 2;

          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;

          ctx.fillStyle = accentColor;
          ctx.fillRect(x - tWidth / 2 - 6, yOffset, tWidth + 12, bHeight);

          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          ctx.fillStyle = '#1A1A1A';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, x, yOffset + bHeight / 2);
          ctx.restore();
        }
      },
    };

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ganttLabels,
        datasets: [
          {
            label: viewType === 'category' ? 'Category Timeline' : 'Timeline',
            data: ganttData as any,
            backgroundColor: ganttColors,
            borderRadius: 4,
            barPercentage: 0.75,
            categoryPercentage: 0.85,
            hoverBorderWidth: 3,
            hoverBorderColor: 'white',
          },
        ],
      },
      options: {
        layout: {
          padding: {
            top: 25,
            right: displayOptions.length >= 5
              ? 500
              : displayOptions.length >= 3
              ? 360
              : displayOptions.includes('brief')
              ? 240
              : displayOptions.length >= 1
              ? 180
              : 65,
          },
        },
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        onClick: (_evt, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const clicked = sortedGanttData[idx];
            if (clicked) setSelectedProject(clicked);
          }
        },
        scales: {
          x: {
            min: ganttData.length > 0 ? Math.min(...ganttData.map(d => d[0])) : undefined,
            grid: { color: palette.border },
            ticks: {
              color: palette.textMain,
              callback: (val: any) =>
                new Date(val).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                }),
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              color: palette.textMain,
              font: {
                size: 12.5,
                family: "'Microsoft JhengHei UI', 'Quicksand', sans-serif",
              },
            },
          },
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: palette.textMain } },
          subtitle: {
            display: true,
            text: lang === 'en' ? '(Unit: Day)' : '(單位：Day)',
            align: 'end',
            color: palette.textSub,
            font: {
              size: 11,
              style: 'italic',
              weight: 'bold',
              family: "'Microsoft JhengHei UI', 'Quicksand', sans-serif",
            },
            padding: { bottom: 5 },
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const item = sortedGanttData[ctx.dataIndex];
                const start = new Date(ctx.raw[0]).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', {
                  timeZone: 'UTC',
                });
                const end = new Date(ctx.raw[1]).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', {
                  timeZone: 'UTC',
                });
                return [
                  `Status: ${item.status || '-'}`,
                  `Category: ${item.category || '-'}`,
                  `Cluster: ${item.cluster || '-'}`,
                  `Project Brief: ${cleanProjectDesc(item.desc)}`,
                  `Duration: ${item.duration} days`,
                  `MH/Days: ${item.dailyMH}`,
                  `Period: ${start} ~ ${end}`,
                ];
              },
            },
          },
          datalabels: {
            display: (ctx: any) => {
              if (displayOptions.length === 0) return false;
              const val = formatGanttBarLabel(sortedGanttData[ctx.dataIndex], displayOptions, lang);
              return val !== '';
            },
            anchor: 'end',
            align: 'end',
            offset: 6,
            color: palette.textMain,
            font: {
              size: 11,
              weight: 'bold',
              family: "'Microsoft JhengHei UI', 'Quicksand', sans-serif",
            },
            formatter: (_value: any, ctx: any) => {
              const item = sortedGanttData[ctx.dataIndex];
              return formatGanttBarLabel(item, displayOptions, lang);
            },
          },
        },
      },
      plugins: [ChartDataLabels, todayPlugin],
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [isOpen, hasData, sortedGanttData, viewType, palette, lang, displayOptions]);

  if (!isOpen) return null;

  const handleExportHTML = () => {
    generateAndDownloadHTMLReport(wizData, filters, lang);
  };

  const handleExportCSV = () => {
    exportWizSummaryCSV(ganttDataRows);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="dashboard-card border-2 w-full max-w-7xl max-h-[94vh] overflow-y-auto custom-scrollbar shadow-2xl relative"
          style={{
            borderColor: 'var(--brand-main)',
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-main)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header matching Project Schedule (Gantt) */}
          <div className="mb-4">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h3 id="lblGantt" className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                  {viewType === 'category'
                    ? (lang === 'en' ? 'Category Gantt Chart' : '類別甘特圖')
                    : (lang === 'en' ? 'Project Schedule (Gantt)' : '專案甘特圖')}
                </h3>
                <p id="lblGanttSub" className="text-xs" style={{ color: 'var(--text-sub)' }}>
                  {viewType === 'category'
                    ? (lang === 'en' ? 'Timeline grouped by Category & Cluster' : '依類別與群組排列之時程甘特圖')
                    : t.ganttSub}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Switcher */}
                <div
                  className="flex rounded p-0.5"
                  style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}
                >
                  <button
                    onClick={() => setViewType('category')}
                    className="px-2.5 py-1 text-xs font-semibold rounded transition-all"
                    style={
                      viewType === 'category'
                        ? { backgroundColor: 'var(--brand-main)', color: '#FFF' }
                        : { color: 'var(--text-sub)' }
                    }
                  >
                    {lang === 'en' ? 'Category' : '類別'}
                  </button>
                  <button
                    onClick={() => setViewType('project')}
                    className="px-2.5 py-1 text-xs font-semibold rounded transition-all"
                    style={
                      viewType === 'project'
                        ? { backgroundColor: 'var(--brand-main)', color: '#FFF' }
                        : { color: 'var(--text-sub)' }
                    }
                  >
                    {lang === 'en' ? 'By Project' : '依專案'}
                  </button>
                </div>

                <div className="h-4 w-px bg-gray-300 mx-1"></div>

                <button
                  onClick={handleExportHTML}
                  className="text-xs hover:opacity-70 flex items-center gap-1 font-semibold px-2 py-1 rounded border border-transparent hover:border-gray-300 transition-all"
                  style={{ color: 'var(--brand-text)' }}
                  title={t.tipExportHtml}
                >
                  <i className="fa-solid fa-file-code"></i> <span>{t.btnExportHtml}</span>
                </button>

                <div className="h-4 w-px bg-gray-300 mx-1"></div>

                <button
                  onClick={handleExportCSV}
                  className="text-xs hover:opacity-70 flex items-center gap-1 font-semibold px-2 py-1 rounded border border-transparent hover:border-gray-300 transition-all"
                  style={{ color: 'var(--text-sub)' }}
                  title="Export Summary Report"
                >
                  <i className="fa-solid fa-file-export"></i> Export (CSV)
                </button>

                <div className="h-4 w-px bg-gray-300 mx-1"></div>

                <span
                  className="px-2 py-1 text-[10px] font-semibold rounded text-white"
                  style={{ backgroundColor: 'var(--brand-main)' }}
                >
                  WIZARD
                </span>

                <button
                  onClick={onClose}
                  className="text-xs hover:opacity-70 px-2 py-1 ml-1"
                  style={{ color: 'var(--text-sub)' }}
                  title={lang === 'en' ? 'Close' : '關閉'}
                >
                  <i className="fa-solid fa-times text-base"></i>
                </button>
              </div>
            </div>

            {/* Independent Filters - exact same layout and style as Project Schedule (Gantt) */}
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-4 bg-opacity-10 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--bg-color)' }}
            >
              <div>
                <MultiSelectDropdown
                  id="wiz-gantt-filter-owner"
                  label={t.owner}
                  options={owners}
                  selectedValues={toSelectedArray(filters.owner)}
                  onChange={selected =>
                    setFilters(prev => ({ ...prev, owner: selected.length === 0 ? 'All' : selected }))
                  }
                  allLabel={lang === 'en' ? 'All Owners' : '全部負責人'}
                />
              </div>

              <div>
                <MultiSelectDropdown
                  id="wiz-gantt-filter-status"
                  label={t.status}
                  options={statuses}
                  selectedValues={toSelectedArray(filters.status)}
                  onChange={selected =>
                    setFilters(prev => ({ ...prev, status: selected.length === 0 ? 'All' : selected }))
                  }
                  allLabel={lang === 'en' ? 'All Status' : '全部狀態'}
                />
              </div>

              <div>
                <MultiSelectDropdown
                  id="wiz-gantt-filter-category"
                  label={t.category}
                  options={categories}
                  selectedValues={toSelectedArray(filters.category)}
                  onChange={selected =>
                    setFilters(prev => ({ ...prev, category: selected.length === 0 ? 'All' : selected }))
                  }
                  allLabel={lang === 'en' ? 'All Categories' : '全部類別'}
                />
              </div>

              <div>
                <MultiSelectDropdown
                  id="wiz-gantt-filter-cluster"
                  label={t.cluster}
                  options={clusters}
                  selectedValues={toSelectedArray(filters.cluster)}
                  onChange={selected =>
                    setFilters(prev => ({ ...prev, cluster: selected.length === 0 ? 'All' : selected }))
                  }
                  allLabel={lang === 'en' ? 'All Clusters' : '全部群組'}
                />
              </div>

              <div className="col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2">
                <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
                  {t.month}
                </label>
                <div className="flex items-center gap-1">
                  <select
                    value={filters.startMonth}
                    onChange={e => setFilters(prev => ({ ...prev, startMonth: e.target.value }))}
                    className="std-input text-xs"
                  >
                    {monthOptions.map(m => (
                      <option key={`start-${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span style={{ color: 'var(--text-sub)' }}>-</span>
                  <select
                    value={filters.endMonth}
                    onChange={e => setFilters(prev => ({ ...prev, endMonth: e.target.value }))}
                    className="std-input text-xs"
                  >
                    {monthOptions.map(m => (
                      <option key={`end-${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid on right hand side of period (month) as multi-options to show project brief, duration, MH/Days and period */}
              <div className="col-span-2 sm:col-span-1 md:col-span-2 lg:col-span-1">
                <GanttDisplayOptions
                  selectedOptions={displayOptions}
                  onChange={setDisplayOptions}
                  lang={lang}
                  palette={palette}
                />
              </div>
            </div>
          </div>

          {/* Gantt Chart Canvas Container - exact same layout and style as Project Schedule (Gantt) */}
          <div className="overflow-y-auto custom-scrollbar w-full" style={{ maxHeight: '600px' }}>
            <div
              className="gantt-wrapper"
              style={{ height: hasData ? `${containerHeight}px` : '300px', minHeight: '300px', width: '100%' }}
            >
              {!hasData ? (
                <div className="gantt-empty">
                  <i className="fa-solid fa-filter mb-2 text-2xl"></i>
                  <br />
                  {!anyFilterActive
                    ? (lang === 'en'
                        ? 'Select filters above to generate the schedule.'
                        : '請在上方選擇篩選條件以產生時程表。')
                    : (lang === 'en'
                        ? `No timeline data available for ${filters.startMonth} ~ ${filters.endMonth}.`
                        : `在 ${filters.startMonth} ~ ${filters.endMonth} 區間內無可用時程資料。`)}
                </div>
              ) : (
                <canvas ref={canvasRef} className="w-full h-full block"></canvas>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded ProjectDetailModal on click */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          palette={palette}
          lang={lang}
        />
      )}
    </>
  );
};
