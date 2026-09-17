import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ProjectItem, ThemeColors, Language, FilterState } from '../types';
import { TEXT } from '../constants/theme';
import { shortName, getStatusColor, isDateOverlapping, generateAndDownloadHTMLReport, exportWizSummaryCSV } from '../utils/dataProcessor';

interface GanttChartProps {
  rawData: ProjectItem[];
  palette: ThemeColors;
  lang: Language;
  ganttFilters: FilterState;
  setGanttFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  months: string[];
  onToggleWiz: () => void;
  isWizOpen: boolean;
  onShowNotice: (title: string, msg: string) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  rawData,
  palette,
  lang,
  ganttFilters,
  setGanttFilters,
  months,
  onToggleWiz,
  isWizOpen,
  onShowNotice,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const t = TEXT[lang];

  // Derive unique filter options
  const owners = ['All', ...new Set(rawData.map(d => d.owner))].sort();
  const statuses = ['All', ...new Set(rawData.map(d => d.status))].sort();
  const categories = ['All', ...new Set(rawData.map(d => d.category))].sort();
  const clusters = ['All', ...new Set(rawData.map(d => d.cluster))].sort();
  const monthOptions = ['All', ...months];

  // Filter gantt items
  const anyFilterActive =
    ganttFilters.owner !== 'All' ||
    ganttFilters.status !== 'All' ||
    ganttFilters.category !== 'All' ||
    ganttFilters.cluster !== 'All' ||
    ganttFilters.startMonth !== 'All' ||
    ganttFilters.endMonth !== 'All';

  const ganttDataRows = rawData.filter(d => {
    if (ganttFilters.owner !== 'All' && d.owner !== ganttFilters.owner) return false;
    if (ganttFilters.status !== 'All' && d.status !== ganttFilters.status) return false;
    if (ganttFilters.category !== 'All' && d.category !== ganttFilters.category) return false;
    if (ganttFilters.cluster !== 'All' && d.cluster !== ganttFilters.cluster) return false;
    if (!isDateOverlapping(d, ganttFilters.startMonth, ganttFilters.endMonth)) return false;
    return true;
  });

  const sortedGanttData = [...ganttDataRows]
    .filter(d => d.due || d.rev)
    .sort((a, b) => ((a.rev || a.due)?.getTime() || 0) - ((b.rev || b.due)?.getTime() || 0));

  const hasData = anyFilterActive && sortedGanttData.length > 0;
  const containerHeight = Math.max(300, sortedGanttData.length * 22);

  useEffect(() => {
    if (!hasData || !canvasRef.current) {
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

    const ganttLabels = sortedGanttData.map(d => shortName(d.desc, 25));
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
            label: 'Timeline',
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
        layout: { padding: { top: 25, right: 50 } },
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
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
                  `${item.desc}`,
                  `Duration: ${item.duration} days`,
                  `MH/Day: ${item.dailyMH}`,
                  `${start} - ${end}`,
                ];
              },
            },
          },
          datalabels: {
            display: 'auto',
            anchor: 'end',
            align: 'end',
            offset: (ctx: any) => (ctx.dataIndex % 2 === 0 ? 4 : 26),
            color: palette.textMain,
            font: { weight: 'bold' },
            formatter: (_value: any, ctx: any) => {
              const item = sortedGanttData[ctx.dataIndex];
              return item.duration;
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
  }, [rawData, ganttFilters, palette, lang]);

  const handleExportHTML = () => {
    const success = generateAndDownloadHTMLReport(rawData, ganttFilters, lang);
    if (!success) {
      onShowNotice(
        lang === 'en' ? 'Notice' : '提醒',
        lang === 'en' ? 'No active data to generate diagnostic report.' : '無活躍專案可供產生診斷報告。'
      );
    }
  };

  const handleExportCSV = () => {
    const success = exportWizSummaryCSV(ganttDataRows);
    if (!success) {
      onShowNotice(
        lang === 'en' ? 'Notice' : '提醒',
        lang === 'en' ? 'No data to export' : '沒有可匯出的資料'
      );
    }
  };

  return (
    <div className="dashboard-card border-2" style={{ borderColor: 'var(--brand-main)' }}>
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 id="lblGantt" className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
              {t.gantt}
            </h3>
            <p id="lblGanttSub" className="text-xs" style={{ color: 'var(--text-sub)' }}>
              {t.ganttSub}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              id="btnWiz"
              onClick={onToggleWiz}
              className="px-3 py-1 text-xs font-semibold rounded flex items-center gap-2 hover:opacity-90 shadow-sm transition-all"
              style={{
                backgroundColor: 'var(--brand-accent)',
                color: '#1A1A1A',
                transform: isWizOpen ? 'scale(1.03)' : 'none',
              }}
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i> <span>{t.wizBtn}</span>
            </button>
            <span
              className="px-2 py-1 text-[10px] font-semibold rounded text-white"
              style={{ backgroundColor: 'var(--brand-main)' }}
            >
              INDEPENDENT
            </span>
          </div>
        </div>

        {/* Independent Filters */}
        <div
          className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-4 bg-opacity-10 p-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-color)' }}
        >
          <div>
            <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
              {t.owner}
            </label>
            <select
              value={ganttFilters.owner}
              onChange={(e) => setGanttFilters(prev => ({ ...prev, owner: e.target.value }))}
              className="std-input text-xs"
            >
              {owners.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
              {t.status}
            </label>
            <select
              value={ganttFilters.status}
              onChange={(e) => setGanttFilters(prev => ({ ...prev, status: e.target.value }))}
              className="std-input text-xs"
            >
              {statuses.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
              {t.category}
            </label>
            <select
              value={ganttFilters.category}
              onChange={(e) => setGanttFilters(prev => ({ ...prev, category: e.target.value }))}
              className="std-input text-xs"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
              {t.cluster}
            </label>
            <select
              value={ganttFilters.cluster}
              onChange={(e) => setGanttFilters(prev => ({ ...prev, cluster: e.target.value }))}
              className="std-input text-xs"
            >
              {clusters.map(cl => (
                <option key={cl} value={cl}>
                  {cl}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
              {t.month}
            </label>
            <div className="flex items-center gap-1">
              <select
                value={ganttFilters.startMonth}
                onChange={(e) => setGanttFilters(prev => ({ ...prev, startMonth: e.target.value }))}
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
                value={ganttFilters.endMonth}
                onChange={(e) => setGanttFilters(prev => ({ ...prev, endMonth: e.target.value }))}
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
        </div>
      </div>

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
                ? (lang === 'en' ? 'Select filters above to generate the schedule.' : '請在上方選擇篩選條件以產生時程表。')
                : (lang === 'en' ? `No timeline data available for ${ganttFilters.startMonth} ~ ${ganttFilters.endMonth}.` : `在 ${ganttFilters.startMonth} ~ ${ganttFilters.endMonth} 區間內無可用時程資料。`)}
            </div>
          ) : (
            <canvas ref={canvasRef} className="w-full h-full block"></canvas>
          )}
        </div>
      </div>
    </div>
  );
};
