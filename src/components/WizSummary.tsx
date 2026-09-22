import React, { useState, useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { ProjectItem, ThemeColors, Language, FilterState, WizViewMode } from '../types';
import { TEXT } from '../constants/theme';
import { shortName, isDateOverlapping, getCustomColor, getGenericPalette } from '../utils/dataProcessor';
import { matchesFilterValue, formatFilterDisplay } from '../utils/filterHelpers';

interface WizSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  rawData: ProjectItem[];
  palette: ThemeColors;
  lang: Language;
  ganttFilters: FilterState;
}

export const WizSummary: React.FC<WizSummaryProps> = ({
  isOpen,
  onClose,
  rawData,
  palette,
  lang,
  ganttFilters,
}) => {
  const [viewMode, setViewMode] = useState<WizViewMode>('project');
  const [chartMode, setChartMode] = useState<'cluster' | 'project'>('cluster');
  const [chartStatusFilter, setChartStatusFilter] = useState<'all' | 'processing' | 'pending' | 'closed'>('all');
  const [weeklyColState, setWeeklyColState] = useState({ prev: true, curr: true, next: true });
  const [openReminders, setOpenReminders] = useState<Record<string, boolean>>({});
  const [copiedReminders, setCopiedReminders] = useState<Record<string, boolean>>({});

  const workloadCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workloadChartRef = useRef<Chart | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const t = TEXT[lang];

  // Filter rawData according to ganttFilters
  const wizData = rawData.filter(d => {
    if (!matchesFilterValue(d.owner, ganttFilters.owner)) return false;
    if (!matchesFilterValue(d.status, ganttFilters.status)) return false;
    if (!matchesFilterValue(d.category, ganttFilters.category)) return false;
    if (!matchesFilterValue(d.cluster, ganttFilters.cluster)) return false;
    if (!isDateOverlapping(d, ganttFilters.startMonth, ganttFilters.endMonth)) return false;
    return true;
  });

  const getTaskDates = (task: ProjectItem) => {
    const end = task.rev || task.due;
    if (!end) return 'TBD';
    const dur = Math.max(1, task.duration || 1);
    const startLocal = new Date(end.getTime());
    startLocal.setDate(startLocal.getDate() - (dur - 1));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(startLocal.getMonth() + 1)}/${pad(startLocal.getDate())} - ${pad(end.getMonth() + 1)}/${pad(end.getDate())}`;
  };

  const uniqueOwners = [...new Set(wizData.map(d => d.owner))];
  const closedCount = wizData.filter(d => d.status.toLowerCase() === 'closed').length;
  const processingCount = wizData.filter(d => d.status.toLowerCase() === 'processing').length;

  let periodText = '';
  if (ganttFilters.startMonth !== 'All' && ganttFilters.endMonth !== 'All') {
    periodText = `${ganttFilters.startMonth} ~ ${ganttFilters.endMonth}`;
  } else {
    const dates = wizData.map(d => d.month).filter(m => m && m !== 'Unknown').sort();
    periodText = dates.length > 0 ? `${dates[0]} ~ ${dates[dates.length - 1]}` : (lang === 'en' ? 'All Periods' : '所有期間');
  }

  // Workload chart rendering effect
  useEffect(() => {
    if (!isOpen || !workloadCanvasRef.current) return;

    if (workloadChartRef.current) {
      workloadChartRef.current.destroy();
      workloadChartRef.current = null;
    }

    let globalMin = Infinity;
    let globalMax = -Infinity;
    const validProjects: (ProjectItem & { startT: number; endT: number })[] = [];

    wizData.forEach(d => {
      const s = (d.status || '').toLowerCase();
      if (chartStatusFilter !== 'all') {
        if (chartStatusFilter === 'processing' && s !== 'processing') return;
        if (chartStatusFilter === 'pending' && s !== 'pending') return;
        if (chartStatusFilter === 'closed' && s !== 'closed') return;
      }

      const end = d.rev || d.due;
      if (!end) return;

      const endLocal = new Date(end);
      endLocal.setHours(0, 0, 0, 0);
      const dur = Math.max(1, d.duration || 1);
      const startLocal = new Date(endLocal);
      startLocal.setDate(startLocal.getDate() - (dur - 1));

      const startT = startLocal.getTime();
      const endT = endLocal.getTime();

      if (startT < globalMin) globalMin = startT;
      if (endT > globalMax) globalMax = endT;

      validProjects.push({ ...d, startT, endT });
    });

    if (validProjects.length === 0 || globalMin === Infinity) {
      return;
    }

    let chartStartT = globalMin;
    let chartEndT = globalMax;

    if (ganttFilters.startMonth !== 'All') {
      const [sy, sm] = ganttFilters.startMonth.split('-');
      chartStartT = new Date(parseInt(sy, 10), parseInt(sm, 10) - 1, 1).getTime();
    }
    if (ganttFilters.endMonth !== 'All') {
      const [ey, em] = ganttFilters.endMonth.split('-');
      chartEndT = new Date(parseInt(ey, 10), parseInt(em, 10), 0, 23, 59, 59).getTime();
    }

    if (chartStartT > chartEndT) {
      chartEndT = chartStartT + 86400000;
    }

    const todayNode = new Date();
    todayNode.setHours(0, 0, 0, 0);
    const todayT = todayNode.getTime();
    const todayMonthStr = `${todayNode.getFullYear()}-${String(todayNode.getMonth() + 1).padStart(2, '0')}`;

    let isTodayInFilter = true;
    if (ganttFilters.startMonth !== 'All' && todayMonthStr < ganttFilters.startMonth) isTodayInFilter = false;
    if (ganttFilters.endMonth !== 'All' && todayMonthStr > ganttFilters.endMonth) isTodayInFilter = false;

    if (isTodayInFilter) {
      if (chartStartT === Infinity || todayT < chartStartT) chartStartT = todayT - 86400000;
      if (chartEndT === -Infinity || todayT > chartEndT) chartEndT = todayT + 86400000;
    }

    const currentDay = new Date(chartStartT);
    currentDay.setHours(12, 0, 0, 0);
    const endDay = new Date(chartEndT);
    endDay.setHours(12, 0, 0, 0);

    const labels: string[] = [];
    const labelTimes: number[] = [];

    while (currentDay.getTime() <= endDay.getTime() + 43200000) {
      labels.push(currentDay.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', { month: 'short', day: 'numeric' }));
      const accurateMidnight = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), 0, 0, 0, 0);
      labelTimes.push(accurateMidnight.getTime());
      currentDay.setDate(currentDay.getDate() + 1);
    }

    const datasets: any[] = [];
    datasets.push({
      type: 'line',
      label: lang === 'en' ? t.wizMaxCap : t.wizMaxCap,
      data: labels.map(() => 5.0),
      borderColor: '#EF4444',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      order: 0,
      datalabels: { display: false },
    });

    if (chartMode === 'cluster') {
      const clusters = [...new Set(validProjects.map(p => p.cluster || 'Uncategorized'))].sort();
      clusters.forEach(clusterName => {
        const clusterProjects = validProjects.filter(p => (p.cluster || 'Uncategorized') === clusterName);
        const dailyData = labelTimes.map(time => {
          let sumMH = 0;
          clusterProjects.forEach(p => {
            if (time >= p.startT && time <= p.endT) sumMH += p.dailyMH || 0;
          });
          return sumMH;
        });

        if (dailyData.some(v => v > 0)) {
          datasets.push({
            type: 'bar',
            label: clusterName,
            clusterProjects: clusterProjects,
            data: dailyData,
            backgroundColor: getCustomColor(clusterName, palette),
            stack: 'Stack 0',
            order: 1,
            hoverBorderWidth: 2,
            hoverBorderColor: '#8036c9',
            datalabels: { display: false },
          });
        }
      });
    } else {
      const genericPal = getGenericPalette(validProjects.length, palette);
      validProjects.forEach((p, i) => {
        const dailyData = labelTimes.map(time => {
          if (time >= p.startT && time <= p.endT) return p.dailyMH || 0;
          return 0;
        });

        if (dailyData.some(v => v > 0)) {
          datasets.push({
            type: 'bar',
            label: p.desc,
            projectStatus: p.status || 'Processing',
            data: dailyData,
            backgroundColor: genericPal[i % genericPal.length],
            stack: 'Stack 0',
            order: 1,
            hoverBorderWidth: 2,
            hoverBorderColor: '#8036c9',
            datalabels: { display: false },
          });
        }
      });
    }

    const todayHighlightPlugin = {
      id: 'todayHighlight',
      afterDraw: (chart: any) => {
        const todayRef = new Date();
        const todayYMD = `${todayRef.getFullYear()}-${todayRef.getMonth()}-${todayRef.getDate()}`;

        const index = labelTimes.findIndex(t => {
          const d = new Date(t);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayYMD;
        });

        if (index !== -1) {
          const ctx = chart.ctx;
          const yAxis = chart.scales.y;
          const meta = chart.getDatasetMeta(0);
          if (!meta.data || !meta.data[index]) return;
          const x = meta.data[index].x;
          const accentColor = palette.accent;

          ctx.save();
          const slotWidth = chart.scales.x.width / Math.max(labelTimes.length, 1);
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = accentColor;
          ctx.fillRect(x - slotWidth / 2, yAxis.top, slotWidth, yAxis.bottom - yAxis.top);

          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(x, yAxis.top);
          ctx.lineTo(x, yAxis.bottom);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = accentColor;
          ctx.setLineDash([6, 4]);
          ctx.stroke();

          ctx.globalAlpha = 1.0;
          const text =
            todayRef.getFullYear() +
            '/' +
            String(todayRef.getMonth() + 1).padStart(2, '0') +
            '/' +
            String(todayRef.getDate()).padStart(2, '0');
          ctx.font = 'bold 11px Quicksand, sans-serif';
          const tWidth = ctx.measureText(text).width;
          const bHeight = 18;
          const yOffset = yAxis.top - 18;

          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;

          ctx.fillStyle = accentColor;
          ctx.fillRect(x - tWidth / 2 - 8, yOffset, tWidth + 16, bHeight);

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

    const ctx = workloadCanvasRef.current.getContext('2d');
    if (!ctx) return;

    workloadChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 35 } },
        clip: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: palette.textMain, maxTicksLimit: 15 } },
          y: {
            stacked: true,
            grid: { color: palette.border },
            ticks: { color: palette.textMain, stepSize: 1 },
            beginAtZero: true,
            suggestedMax: 8.0,
            title: { display: true, text: 'Man-Hours / Day', color: palette.textMain },
          },
        },
        plugins: {
          legend: {
            display: chartMode === 'cluster',
            position: 'bottom',
            align: 'start',
            labels: {
              color: palette.textMain,
              usePointStyle: true,
              boxWidth: 8,
              padding: 15,
              font: { size: 11, family: "'Microsoft JhengHei UI', 'Quicksand', sans-serif", weight: 'bold' },
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            footerColor: '#E6AC5B',
            borderColor: '#8036c9',
            borderWidth: 1,
            titleFont: { family: "'Microsoft JhengHei UI', Quicksand, sans-serif", size: 13, weight: 'bold' },
            bodyFont: { family: "'Microsoft JhengHei UI', Quicksand, sans-serif", size: 12 },
            footerFont: { family: "'Microsoft JhengHei UI', Quicksand, sans-serif", size: 13, weight: 'bold' },
            padding: 12,
            boxPadding: 6,
            cornerRadius: 8,
            filter: (item: any) => item.dataset.type === 'bar' && item.parsed.y > 0,
            callbacks: {
              label: (context: any) => {
                const val = context.parsed.y;
                if (val <= 0) return '';
                if (chartMode === 'project') {
                  const status = context.dataset.projectStatus || 'Processing';
                  return ` [${status}] ${context.dataset.label}: ${val.toFixed(1)} MH/d`;
                } else {
                  const time = labelTimes[context.dataIndex];
                  const activeInCluster = (context.dataset.clusterProjects || []).filter(
                    (p: any) => time >= p.startT && time <= p.endT
                  );
                  if (activeInCluster.length > 0) {
                    const lines = [` ${context.dataset.label}: ${val.toFixed(1)} MH/d`];
                    activeInCluster.forEach((p: any) => {
                      lines.push(`   ↳ [${p.status || 'Processing'}] ${p.desc}: ${(p.dailyMH || 0).toFixed(1)} MH/d`);
                    });
                    return lines;
                  }
                  return ` ${context.dataset.label}: ${val.toFixed(1)} MH/d`;
                }
              },
              labelTextColor: (context: any) => {
                if (chartMode === 'project') {
                  const status = (context.dataset.projectStatus || '').toLowerCase();
                  if (status === 'closed') return '#F87171'; // Red text for closed projects
                  if (status === 'processing') return '#38BDF8'; // Blue text for processing projects
                  if (status === 'pending') return '#FBBF24'; // Amber for pending
                  return '#F1F5F9';
                } else {
                  const time = labelTimes[context.dataIndex];
                  const activeInCluster = (context.dataset.clusterProjects || []).filter(
                    (p: any) => time >= p.startT && time <= p.endT
                  );
                  const hasClosed = activeInCluster.some((p: any) => (p.status || '').toLowerCase() === 'closed');
                  const hasProcessing = activeInCluster.some((p: any) => (p.status || '').toLowerCase() === 'processing');
                  if (hasClosed && !hasProcessing) return '#F87171';
                  if (hasProcessing && !hasClosed) return '#38BDF8';
                  return '#F1F5F9';
                }
              },
              labelColor: (context: any) => {
                if (chartMode === 'project') {
                  const status = (context.dataset.projectStatus || '').toLowerCase();
                  if (status === 'closed') {
                    return {
                      borderColor: '#EF4444',
                      backgroundColor: '#EF4444',
                    };
                  }
                  if (status === 'processing') {
                    return {
                      borderColor: '#0284C7',
                      backgroundColor: '#38BDF8',
                    };
                  }
                }
                return {
                  borderColor: context.dataset.backgroundColor,
                  backgroundColor: context.dataset.backgroundColor,
                };
              },
              footer: (tooltipItems: any[]) => {
                let total = 0;
                tooltipItems.forEach(item => {
                  if (item.dataset.type === 'bar') total += item.parsed.y;
                });
                const overloadNote = total > 5.0 ? (lang === 'en' ? ' ⚠️ [OVERLOAD > 5.0]' : ' ⚠️ [超載 > 5.0]') : '';
                return (lang === 'en' ? 'TOTAL LOAD: ' : '當日總負載: ') + total.toFixed(1) + ' MH/d' + overloadNote;
              },
            },
          },
          datalabels: { display: false },
        },
      },
      plugins: [todayHighlightPlugin],
    });

    return () => {
      if (workloadChartRef.current) {
        workloadChartRef.current.destroy();
        workloadChartRef.current = null;
      }
    };
  }, [isOpen, wizData, chartMode, chartStatusFilter, palette, lang, ganttFilters]);

  if (!isOpen) return null;

  const copyReminderText = (remId: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReminders(prev => ({ ...prev, [remId]: true }));
      setTimeout(() => {
        setCopiedReminders(prev => ({ ...prev, [remId]: false }));
      }, 2000);
    });
  };

  // Render view mode content
  const renderRightContent = () => {
    if (viewMode === 'project') {
      return (
        <div className="overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '350px' }}>
          {wizData.map((d, index) => {
            const pDur = d.duration || 0;
            const pMH = d.dailyMH || 0;
            const accumMH = (pMH * pDur).toFixed(1);
            const cleanHighlight = d.highlights ? d.highlights.replace(/[•*-]/g, '').trim() : '';
            const dateStr = getTaskDates(d);

            return (
              <div key={`${d.desc}-${index}`} className="mb-3 p-3 rounded-lg shadow-sm wiz-task-card cursor-pointer group">
                <div className="flex justify-between items-start mb-1">
                  <span
                    className="font-semibold text-[15px] task-title transition-colors flex items-start gap-1 leading-[1.2]"
                    style={{ color: 'var(--text-main)', wordBreak: 'break-word' }}
                  >
                    <i className="fa-solid fa-arrow-pointer mt-0.5 text-sm task-icon"></i>
                    <span>
                      {index + 1}. {d.desc}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0 flex-wrap justify-end">
                    <span
                      className="text-[10px] font-medium whitespace-nowrap px-1.5 py-0.5 rounded border shadow-sm text-slate-600 bg-slate-50 border-slate-200 leading-[1.2] flex items-center gap-1"
                      title="Execution Period"
                    >
                      <i className="fa-regular fa-calendar-days text-[9px]"></i> {dateStr}
                    </span>
                    <span
                      className="text-[10px] font-semibold whitespace-nowrap px-2 py-1 rounded shadow-sm task-dur-badge transition-colors leading-[1.2]"
                      style={{ backgroundColor: 'var(--brand-sub)', color: '#FFFFFF' }}
                      title="Duration"
                    >
                      {pDur} days
                    </span>
                    <span
                      className="text-[10px] font-bold whitespace-nowrap px-2 py-0.5 rounded shadow-xs leading-[1.2] flex items-center gap-1"
                      style={{ backgroundColor: 'var(--text-blue)', color: '#FFFFFF' }}
                      title="Man-Hours / Per Day"
                    >
                      {pMH} MH/d
                    </span>
                    <span
                      className="text-[10px] font-bold whitespace-nowrap px-2 py-0.5 rounded shadow-xs text-white leading-[1.2] flex items-center gap-1"
                      style={{ backgroundColor: 'var(--brand-text)', color: '#FFFFFF' }}
                      title="Total Accumulated Man-Hours"
                    >
                      <i className="fa-regular fa-clock text-[9px]"></i>
                      {accumMH} Total MH
                    </span>
                  </div>
                </div>
                {cleanHighlight.length > 2 && cleanHighlight.toLowerCase() !== 'tbd' && cleanHighlight.toLowerCase() !== 'n/a' ? (
                  <div className="text-[13px] font-medium text-slate-700 mt-1 leading-[1.2]">
                    {shortName(cleanHighlight, 120)}
                  </div>
                ) : (
                  <textarea
                    className="w-full text-[12px] p-2 mt-2 border border-dashed rounded focus:bg-white outline-none transition-all resize-none custom-scrollbar shadow-inner leading-[1.2]"
                    style={{
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-main)',
                      backgroundColor: 'rgba(0,0,0,0.02)',
                    }}
                    rows={2}
                    placeholder={`✍️ ${t.wizNoDeliv}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (viewMode === 'category') {
      const grouped: Record<string, Record<string, ProjectItem[]>> = {};
      wizData.forEach(d => {
        const cat = d.category || (lang === 'en' ? 'Uncategorized' : '未分類');
        const clust = d.cluster || (lang === 'en' ? 'No Cluster' : '無群組');
        if (!grouped[cat]) grouped[cat] = {};
        if (!grouped[cat][clust]) grouped[cat][clust] = [];
        grouped[cat][clust].push(d);
      });

      return (
        <div className="overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '350px' }}>
          {Object.keys(grouped)
            .sort()
            .map(cat => (
              <div key={cat} className="mb-5">
                <h5
                  className="font-bold text-sm border-b-2 pb-1 mb-3 leading-[1.2]"
                  style={{ color: 'var(--brand-text)', borderColor: 'var(--border-color)' }}
                >
                  {cat}
                </h5>
                {Object.keys(grouped[cat])
                  .sort()
                  .map(clust => {
                    const projs = grouped[cat][clust];
                    return (
                      <div key={clust} className="mb-3 ml-2">
                        <h6
                          className="font-semibold text-[13px] mb-1.5 leading-[1.2]"
                          style={{ color: 'var(--brand-sub)' }}
                        >
                          <i className="fa-solid fa-layer-group mr-1"></i>
                          {clust}
                          <span
                            className="text-[10px] font-normal px-1.5 py-0.5 rounded ml-1"
                            style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-sub)' }}
                          >
                            {projs.length} items
                          </span>
                        </h6>
                        <ul className="hl-list mt-1 ml-2 mb-3">
                          {projs.map((p, idx) => {
                            const cleanHighlight = p.highlights ? p.highlights.replace(/[•*-]/g, '').trim() : '';
                            const accumMH = ((p.dailyMH || 0) * (p.duration || 0)).toFixed(1);
                            const dateStr = getTaskDates(p);

                            return (
                              <li
                                key={`${p.desc}-${idx}`}
                                className="mb-2 p-1.5 rounded-r wiz-list-item cursor-pointer group list-none flex flex-col leading-[1.2]"
                              >
                                <span
                                  className="font-semibold text-[14.5px] task-title transition-colors flex items-start gap-1 leading-[1.2]"
                                  style={{ color: 'var(--text-main)', wordBreak: 'break-word' }}
                                >
                                  <i className="fa-solid fa-caret-right mt-0.5 text-[13px] task-icon flex-shrink-0"></i>
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    <span>{p.desc}</span>
                                    <span
                                      className="text-[10px] font-bold px-2 py-0.5 rounded shadow-xs whitespace-nowrap text-white flex items-center gap-1 leading-[1.2]"
                                      style={{ backgroundColor: 'var(--brand-text)', color: '#FFFFFF' }}
                                      title="Total Man-Hours"
                                    >
                                      <i className="fa-regular fa-clock text-[9px]"></i>
                                      {accumMH} MH
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap flex items-center gap-1">
                                      <i className="fa-regular fa-calendar-days"></i> {dateStr}
                                    </span>
                                  </span>
                                </span>
                                {cleanHighlight.length > 2 &&
                                cleanHighlight.toLowerCase() !== 'tbd' &&
                                cleanHighlight.toLowerCase() !== 'n/a' ? (
                                  <span className="block pl-4 mt-1 text-[13px] font-medium text-slate-700 leading-[1.2]">
                                    {shortName(cleanHighlight, 70)}
                                  </span>
                                ) : (
                                  <textarea
                                    className="block ml-4 mt-1 w-[90%] text-[12px] p-1 border border-dashed rounded focus:bg-white outline-none resize-none custom-scrollbar leading-[1.2]"
                                    style={{
                                      borderColor: 'var(--border-color)',
                                      color: 'var(--text-main)',
                                      backgroundColor: 'rgba(0,0,0,0.02)',
                                    }}
                                    rows={1}
                                    placeholder={`✍️ ${t.wizNoDeliv}`}
                                  />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            ))}
        </div>
      );
    }

    if (viewMode === 'weekly') {
      const now = new Date();
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
      startOfWeek.setHours(0, 0, 0, 0);

      const startTCurr = startOfWeek.getTime();
      const endTCurr = startTCurr + 6 * 86400000 + 86399999;

      const startTPrev = startTCurr - 7 * 86400000;
      const endTPrev = startTPrev + 6 * 86400000 + 86399999;

      const startTNext = startTCurr + 7 * 86400000;
      const endTNext = startTNext + 6 * 86400000 + 86399999;

      const getWkProjs = (st: number, en: number) =>
        wizData.filter(d => {
          const end = d.rev || d.due;
          if (!end) return false;
          const dur = Math.max(1, d.duration || 1);
          const pEnd = end.getTime();
          const pStart = pEnd - (dur - 1) * 86400000;
          return pStart <= en && pEnd >= st;
        });

      const prevProjs = getWkProjs(startTPrev, endTPrev);
      const currProjs = getWkProjs(startTCurr, endTCurr);
      const nextProjs = getWkProjs(startTNext, endTNext);

      const getBtnStyle = (isActive: boolean) =>
        isActive
          ? { backgroundColor: 'var(--brand-main)', color: '#FFF', borderColor: 'var(--brand-main)' }
          : { backgroundColor: 'transparent', color: 'var(--text-sub)', borderColor: 'var(--border-color)' };

      const renderWkCol = (
        projs: ProjectItem[],
        title: string,
        icon: string,
        colKey: 'prev' | 'curr' | 'next',
        st: number,
        en: number
      ) => {
        if (!weeklyColState[colKey]) return null;
        const dateStr = `${new Date(st).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', { month: 'short', day: 'numeric' })} ~ ${new Date(en).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', { month: 'short', day: 'numeric' })}`;

        const grouped: Record<string, ProjectItem[]> = {};
        projs.forEach(p => {
          const c = p.cluster || (lang === 'en' ? 'Uncategorized' : '未分類');
          if (!grouped[c]) grouped[c] = [];
          grouped[c].push(p);
        });

        return (
          <div
            className="flex-1 min-w-0 flex flex-col bg-white border rounded-lg shadow-sm overflow-hidden transition-all duration-300"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="p-2 flex justify-between items-center text-[13px] font-semibold leading-[1.2]"
              style={{
                backgroundColor: 'rgba(0,0,0,0.03)',
                color: 'var(--brand-text)',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <i className={icon}></i> {title}: {dateStr}
              </div>
            </div>
            <div className="p-2 h-full overflow-y-auto custom-scrollbar">
              {projs.length === 0 ? (
                <div className="text-center py-6 text-[13px] leading-[1.2]" style={{ color: 'var(--text-sub)' }}>
                  <i className="fa-solid fa-mug-hot text-xl mb-2"></i>
                  <br />
                  {lang === 'en' ? 'No tasks scheduled.' : '沒有排定的任務。'}
                </div>
              ) : (
                Object.keys(grouped)
                  .sort()
                  .map(c => (
                    <div key={c} className="mb-4">
                      <h5
                        className="font-bold text-[13px] border-b pb-1 mb-2 leading-[1.2]"
                        style={{ color: 'var(--brand-text)', borderColor: 'var(--border-color)' }}
                      >
                        <i className="fa-solid fa-layer-group mr-1"></i>
                        {c}
                      </h5>
                      <ul className="hl-list ml-2">
                        {grouped[c].map((p, idx) => {
                          const cleanHighlight = p.highlights ? p.highlights.replace(/[•*-]/g, '').trim() : '';
                          const accumMH = ((p.dailyMH || 0) * (p.duration || 0)).toFixed(1);
                          const dateBadge = getTaskDates(p);

                          return (
                            <li
                              key={`${p.desc}-${idx}`}
                              className="mb-2 p-1.5 rounded-r wiz-list-item cursor-pointer group list-none flex flex-col leading-[1.2]"
                            >
                              <div
                                className="flex items-start gap-1 font-semibold text-[13.5px] leading-[1.2]"
                                style={{ color: 'var(--text-main)' }}
                              >
                                <i className="fa-solid fa-bolt mt-0.5 text-[12px] task-icon flex-shrink-0"></i>
                                <div className="flex flex-col gap-1">
                                  <span className="task-title transition-colors" style={{ wordBreak: 'break-word' }}>
                                    {p.desc}
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className="text-[10px] font-bold px-2 py-0.5 rounded shadow-xs whitespace-nowrap text-white flex items-center gap-1 leading-[1.2]"
                                      style={{ backgroundColor: 'var(--brand-text)', color: '#FFFFFF' }}
                                      title="Total Man-Hours"
                                    >
                                      <i className="fa-regular fa-clock text-[9px]"></i>
                                      {accumMH} MH
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap flex items-center gap-1">
                                      <i className="fa-regular fa-calendar-days"></i> {dateBadge}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {cleanHighlight.length > 2 &&
                              cleanHighlight.toLowerCase() !== 'tbd' &&
                              cleanHighlight.toLowerCase() !== 'n/a' ? (
                                <span className="block pl-4 mt-1 text-[12px] font-normal text-slate-600 leading-[1.2]">
                                  {shortName(cleanHighlight, 70)}
                                </span>
                              ) : (
                                <textarea
                                  className="block ml-4 mt-1 w-[90%] text-[11px] p-1 border border-dashed rounded focus:bg-white outline-none resize-none custom-scrollbar leading-[1.2]"
                                  style={{
                                    borderColor: 'var(--border-color)',
                                    color: 'var(--text-main)',
                                    backgroundColor: 'rgba(0,0,0,0.02)',
                                  }}
                                  rows={1}
                                  placeholder={`✍️ ${t.wizNoDeliv}`}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
              )}
            </div>
          </div>
        );
      };

      return (
        <div className="overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '350px' }}>
          <div
            className="mb-4 bg-gray-50 border p-2 rounded-lg flex justify-between items-center shadow-sm flex-wrap gap-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="font-bold text-[13px] uppercase" style={{ color: 'var(--brand-text)' }}>
              <i className="fa-solid fa-layer-group mr-1"></i>{' '}
              {lang === 'en' ? 'Weekly Workload Summary' : '每週工作負載摘要'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setWeeklyColState(s => ({ ...s, prev: !s.prev }))}
                className="px-2 py-1 text-xs font-semibold rounded border transition-colors shadow-sm"
                style={getBtnStyle(weeklyColState.prev)}
              >
                {lang === 'en' ? 'Previous' : '上週'}
              </button>
              <button
                onClick={() => setWeeklyColState(s => ({ ...s, curr: !s.curr }))}
                className="px-2 py-1 text-xs font-semibold rounded border transition-colors shadow-sm"
                style={getBtnStyle(weeklyColState.curr)}
              >
                {lang === 'en' ? 'Current' : '本週'}
              </button>
              <button
                onClick={() => setWeeklyColState(s => ({ ...s, next: !s.next }))}
                className="px-2 py-1 text-xs font-semibold rounded border transition-colors shadow-sm"
                style={getBtnStyle(weeklyColState.next)}
              >
                {lang === 'en' ? 'Next' : '下週'}
              </button>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 w-full items-stretch">
            {renderWkCol(prevProjs, lang === 'en' ? 'Previous' : '上週', 'fa-solid fa-backward-step', 'prev', startTPrev, endTPrev)}
            {renderWkCol(currProjs, lang === 'en' ? 'Current' : '本週', 'fa-solid fa-calendar-day', 'curr', startTCurr, endTCurr)}
            {renderWkCol(nextProjs, lang === 'en' ? 'Next' : '下週', 'fa-solid fa-forward-step', 'next', startTNext, endTNext)}
          </div>
        </div>
      );
    }

    if (viewMode === 'mh_breakdown') {
      let startBound = -Infinity;
      let endBound = Infinity;
      if (ganttFilters.startMonth !== 'All') {
        const [sy, sm] = ganttFilters.startMonth.split('-');
        startBound = new Date(parseInt(sy, 10), parseInt(sm, 10) - 1, 1).getTime();
      }
      if (ganttFilters.endMonth !== 'All') {
        const [ey, em] = ganttFilters.endMonth.split('-');
        endBound = new Date(parseInt(ey, 10), parseInt(em, 10), 0, 23, 59, 59, 999).getTime();
      }

      const strictWizData = wizData.map(d => {
        const end = d.rev || d.due;
        if (!end) return { ...d, boundedMH: 0 };
        const dur = Math.max(1, d.duration || 1);
        const pEnd = end.getTime();
        const pStart = pEnd - (dur - 1) * 86400000;

        const effectiveStart = Math.max(pStart, startBound);
        const effectiveEnd = Math.min(pEnd, endBound);

        let overlapDays = 0;
        if (effectiveStart <= effectiveEnd) {
          overlapDays = Math.floor((effectiveEnd - effectiveStart) / 86400000) + 1;
          overlapDays = Math.min(overlapDays, dur);
        }

        const boundedMH = overlapDays > 0 ? (d.dailyMH || 0) * overlapDays : 0;
        return { ...d, boundedMH };
      }).filter(d => (d.boundedMH || 0) > 0);

      const totalPeriodMH = strictWizData.reduce((acc, d) => acc + (d.boundedMH || 0), 0);

      const projHours = strictWizData.map(d => ({
        desc: d.desc,
        mh: d.boundedMH || 0,
        pct: totalPeriodMH > 0 ? ((d.boundedMH || 0) / totalPeriodMH) * 100 : 0,
        dateStr: getTaskDates(d),
      })).sort((a, b) => b.mh - a.mh);

      const clusterMap: Record<string, number> = {};
      strictWizData.forEach(d => {
        const cluster = d.cluster || (lang === 'en' ? 'Uncategorized' : '未分類');
        clusterMap[cluster] = (clusterMap[cluster] || 0) + (d.boundedMH || 0);
      });
      const clusterHours = Object.keys(clusterMap).map(c => {
        const mh = clusterMap[c];
        return { cluster: c, mh, pct: totalPeriodMH > 0 ? (mh / totalPeriodMH) * 100 : 0 };
      }).sort((a, b) => b.mh - a.mh);

      const top3Projects = projHours.slice(0, 3);
      const top3MhSum = top3Projects.reduce((sum, p) => sum + p.mh, 0);
      const top3Pct = totalPeriodMH > 0 ? Math.round((top3MhSum / totalPeriodMH) * 100) : 0;
      const topProjName = top3Projects.length > 0 ? top3Projects[0].desc : 'N/A';
      const ownerLabel = formatFilterDisplay(ganttFilters.owner, lang === 'en' ? 'the team' : '團隊');
      const ownerTarget = ownerLabel;

      const delayedProjects = strictWizData.filter(p => !p.isOnTime);
      const actionRequired = strictWizData.filter(p => {
        const highlight = (p.highlights || '').trim().toLowerCase();
        const progress = (p.progressDisplay || '').trim().toLowerCase();
        const isHEmpty = highlight.length < 3 || highlight === 'tbd' || highlight === 'n/a';
        const isPEmpty = progress === '-' || progress === '';
        return isHEmpty || isPEmpty;
      });

      const riskRegex = /(issue|support|risk|abnormal|remind|warning|blocker|urgent|critical|attention|delay|fail|問題|支援|風險|提醒|異常|注意|緊急|阻礙|協助|瓶頸|求救|延遲|失敗)/i;
      const highlightedProjects = strictWizData.filter(p => {
        const combinedText = ((p.desc || '') + ' ' + (p.progressDisplay || '') + ' ' + (p.highlights || '')).toLowerCase();
        return riskRegex.test(combinedText);
      });

      let contextText: React.ReactNode = '';
      if (lang === 'en') {
        contextText = (
          <span>
            Across the selected period, total resource allocation is{' '}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-white text-[11px] shadow-xs" style={{ backgroundColor: 'var(--brand-text)' }}>
              <i className="fa-regular fa-clock text-[9px]"></i>
              {totalPeriodMH.toFixed(1)}h
            </span>
            . {top3Pct}% of {ownerTarget}'s capacity is concentrated on the top {top3Projects.length} projects (primarily delivering {topProjName}).
          </span>
        );
      } else {
        contextText = (
          <span>
            在選定期間內，總資源配置為{' '}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-white text-[11px] shadow-xs" style={{ backgroundColor: 'var(--brand-text)' }}>
              <i className="fa-regular fa-clock text-[9px]"></i>
              {totalPeriodMH.toFixed(1)}h
            </span>
            。{ownerTarget} 有高達 {top3Pct}% 的產能集中於前 {top3Projects.length} 大專案（主要交付 {topProjName}）。
          </span>
        );
      }

      return (
        <div className="overflow-y-auto pr-2 custom-scrollbar p-1" style={{ maxHeight: '350px' }}>
          {/* 4-Point Diagnostic Metrics Briefing Card */}
          <div
            className="flex flex-col bg-white bg-opacity-60 border rounded-lg p-4 mb-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-[13px] font-bold leading-[1.2]" style={{ color: 'var(--brand-text)' }}>
                <i className="fa-solid fa-stethoscope mr-1"></i> {t.wizMhBriefTitle}
              </h4>
            </div>
            <div className="space-y-2.5 text-[12.5px] mt-1 leading-[1.2]" style={{ color: 'var(--text-sub)' }}>
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 flex-shrink-0 mt-0.5">
                  Context
                </span>
                <span>{contextText}</span>
              </div>
              <div className="flex items-start gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    delayedProjects.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  } flex-shrink-0 mt-0.5`}
                >
                  Schedule
                </span>
                <span>
                  {delayedProjects.length > 0
                    ? `${t.wizDiagScheduleBad} ${delayedProjects.map(p => `[${p.desc}]`).join(', ')}`
                    : t.wizDiagScheduleGood}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    actionRequired.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                  } flex-shrink-0 mt-0.5`}
                >
                  Quality
                </span>
                <span>
                  {actionRequired.length > 0
                    ? `${t.wizDiagQualityBad} ${actionRequired.map(p => `[${p.desc}]`).join(', ')}`
                    : t.wizDiagQualityGood}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    highlightedProjects.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  } flex-shrink-0 mt-0.5`}
                >
                  Highlight
                </span>
                <span>
                  {highlightedProjects.length > 0
                    ? `${t.wizDiagHighlightBad} ${highlightedProjects.map(p => `[${p.desc}]`).join(', ')}`
                    : t.wizDiagHighlightGood}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className="flex flex-col border rounded-lg p-4 bg-white bg-opacity-40"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <h5
                className="text-xs font-bold uppercase mb-3 flex justify-between items-center leading-[1.2]"
                style={{ color: 'var(--brand-text)' }}
              >
                <span>
                  <i className="fa-solid fa-folder-tree mr-1.5"></i> {t.wizMhProjectTitle}
                </span>
              </h5>
              <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                {projHours.map((p, idx) => (
                  <div key={`${p.desc}-${idx}`} className="text-[12.5px] leading-[1.2]">
                    <div className="flex justify-between font-semibold mb-1 items-start gap-2">
                      <div className="flex flex-wrap items-center gap-1.5" title={p.desc}>
                        <span>
                          {idx + 1}. {p.desc}
                        </span>
                        <span className="text-[9px] px-1.5 py-[1px] rounded border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap flex-shrink-0 flex items-center font-normal">
                          <i className="fa-regular fa-calendar-days mr-1"></i>
                          {p.dateStr}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded shadow-xs text-white flex items-center gap-1"
                        style={{ backgroundColor: 'var(--brand-text)', color: '#FFFFFF', flexShrink: 0 }}
                        title="Project Hours"
                      >
                        <i className="fa-regular fa-clock text-[9px]"></i>
                        {p.mh.toFixed(1)}h ({p.pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${p.pct}%`, backgroundColor: 'var(--brand-main)' }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="flex flex-col border rounded-lg p-4 bg-white bg-opacity-40"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <h5
                className="text-xs font-bold uppercase mb-3 flex justify-between items-center leading-[1.2]"
                style={{ color: 'var(--brand-text)' }}
              >
                <span>
                  <i className="fa-solid fa-cubes mr-1.5"></i> {t.wizMhClusterTitle}
                </span>
              </h5>
              <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                {clusterHours.map((c, idx) => (
                  <div key={`${c.cluster}-${idx}`} className="text-[12.5px] leading-[1.2]">
                    <div className="flex justify-between font-semibold mb-1">
                      <span>
                        {idx + 1}. {c.cluster}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded shadow-xs text-white flex items-center gap-1"
                        style={{ backgroundColor: '#1E293B', color: '#FFFFFF', flexShrink: 0 }}
                        title="Cluster Hours"
                      >
                        <i className="fa-solid fa-layer-group text-[9px] text-[#FACC15]"></i>
                        {c.mh.toFixed(1)}h ({c.pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.pct}%`, backgroundColor: 'var(--brand-sub)' }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (viewMode === 'tracking') {
      const todayNode = new Date();
      todayNode.setHours(0, 0, 0, 0);
      const todayTime = todayNode.getTime();
      const twoWeeksTime = todayTime + 14 * 86400000;

      const activeProjects = wizData.filter(d => d.status.toLowerCase() !== 'closed');

      const overdueProjs = activeProjects
        .filter(d => {
          const end = d.rev || d.due;
          if (!end) return false;
          return end.getTime() <= todayTime;
        })
        .sort((a, b) => ((a.rev || a.due)?.getTime() || 0) - ((b.rev || b.due)?.getTime() || 0));

      const upcomingProjs = activeProjects
        .filter(d => {
          const end = d.rev || d.due;
          if (!end) return false;
          const tTime = end.getTime();
          return tTime > todayTime && tTime <= twoWeeksTime;
        })
        .sort((a, b) => ((a.rev || a.due)?.getTime() || 0) - ((b.rev || b.due)?.getTime() || 0));

      const tTitle = lang === 'en' ? 'Project Tracking & Deadlines' : '專案追蹤與期限';
      const tOverdue = lang === 'en' ? 'Action Required (Overdue / Due Today)' : '需立即處理 (已逾期 / 今日到期)';
      const tUpcoming = lang === 'en' ? 'Upcoming (Next 14 Days)' : '即將到期 (未來 14 天)';

      return (
        <div className="overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '350px' }}>
          <div
            className="mb-4 bg-gray-50 border p-2 rounded-lg flex justify-between items-center shadow-sm"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="font-bold text-[13px] uppercase" style={{ color: 'var(--brand-text)' }}>
              <i className="fa-solid fa-bullseye mr-1 text-rose-500"></i> {tTitle}
            </span>
          </div>

          <h5 className="font-bold text-[13px] mb-2 text-rose-600 flex items-center gap-1.5 border-b border-rose-100 pb-1 mt-1">
            <i className="fa-solid fa-triangle-exclamation"></i> {tOverdue} ({overdueProjs.length})
          </h5>

          {overdueProjs.length === 0 ? (
            <div className="p-4 mb-4 text-center bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-[12.5px] font-semibold">
              <i className="fa-solid fa-check-circle text-lg mb-1 block"></i>
              {lang === 'en' ? 'No overdue projects! Everything is on track.' : '目前無逾期專案，進度良好！'}
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              {overdueProjs.map((p, pIdx) => {
                const end = (p.rev || p.due)!;
                const dateStr = end.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', {
                  month: 'short',
                  day: 'numeric',
                });
                const daysOver = Math.floor((todayTime - end.getTime()) / 86400000);
                const cleanHighlight = p.highlights ? p.highlights.replace(/[•*-]/g, '').trim() : '';

                const remId = `rem_${pIdx}`;
                const reminderMsg =
                  lang === 'en'
                    ? `Hi ${p.owner}, just a quick reminder that "${p.desc}" was due on ${dateStr}. Please update the status and deliverables when you get a chance. Thanks!`
                    : `Hi ${p.owner}, 貼心提醒您負責的「${p.desc}」已於 ${dateStr} 到期。再請抽空至系統更新進度與交付物，謝謝！`;

                return (
                  <div
                    key={`${p.desc}-${pIdx}`}
                    className="border-l-4 border-rose-500 bg-white p-3 rounded shadow-sm flex flex-col gap-1 transition-all hover:shadow-md"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <span
                        className="font-bold text-[14px] text-slate-800 leading-[1.2]"
                        style={{ wordBreak: 'break-word' }}
                      >
                        {p.desc}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 whitespace-nowrap flex-shrink-0 border border-rose-200">
                        {daysOver > 0 ? `${daysOver} days overdue` : 'Due Today'}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 font-semibold mt-1">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        <i className="fa-solid fa-user mr-1"></i>
                        {p.owner}
                      </span>
                      <span>
                        <i className="fa-solid fa-folder mr-1"></i>
                        {p.cluster}
                      </span>
                      <span className="text-rose-600">
                        <i className="fa-solid fa-calendar-xmark mr-1"></i>
                        {dateStr}
                      </span>
                    </div>

                    {cleanHighlight.length > 2 &&
                    cleanHighlight.toLowerCase() !== 'tbd' &&
                    cleanHighlight.toLowerCase() !== 'n/a' ? (
                      <div className="mt-2 bg-rose-50 border border-rose-100 p-2.5 rounded text-[12.5px] text-rose-800 leading-[1.4] shadow-inner">
                        <span className="font-bold block mb-1 text-rose-900">
                          <i className="fa-solid fa-box-open mr-1"></i>Deliverables Target:
                        </span>
                        {cleanHighlight}
                      </div>
                    ) : (
                      <div className="mt-2 bg-gray-50 border border-gray-200 p-2 rounded text-[12px] text-gray-500 italic">
                        <i className="fa-solid fa-circle-exclamation mr-1"></i>
                        {t.wizNoDeliv}
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2">
                      <button
                        onClick={() => setOpenReminders(prev => ({ ...prev, [remId]: !prev[remId] }))}
                        className="text-left text-[11px] font-bold transition-opacity hover:opacity-70 flex items-center gap-1.5 w-max"
                        style={{ color: 'var(--brand-text)' }}
                      >
                        <i className="fa-regular fa-comment-dots text-[12px]"></i>{' '}
                        {lang === 'en' ? 'Generate Reminder' : '產生提醒訊息'}
                      </button>
                      {openReminders[remId] && (
                        <div className="bg-slate-50 border border-slate-200 rounded p-2.5 relative shadow-inner pr-8 transition-all">
                          <p className="text-[12.5px] text-slate-700 leading-[1.4] select-all">{reminderMsg}</p>
                          <button
                            onClick={() => copyReminderText(remId, reminderMsg)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-blue-600 transition-colors text-sm"
                            title="Copy to clipboard"
                          >
                            {copiedReminders[remId] ? (
                              <i className="fa-solid fa-check text-emerald-500"></i>
                            ) : (
                              <i className="fa-regular fa-copy"></i>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h5 className="font-bold text-[13px] mb-2 text-amber-600 flex items-center gap-1.5 border-b border-amber-100 pb-1 mt-2">
            <i className="fa-solid fa-clock-rotate-left"></i> {tUpcoming} ({upcomingProjs.length})
          </h5>

          {upcomingProjs.length === 0 ? (
            <div className="p-4 text-center bg-gray-50 text-gray-500 rounded-lg border border-gray-200 text-[12.5px]">
              <i className="fa-solid fa-mug-hot text-lg mb-1 block"></i>
              {lang === 'en' ? 'No projects due in the next 2 weeks.' : '未來兩週內無即將到期的專案。'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingProjs.map((p, idx) => {
                const end = (p.rev || p.due)!;
                const dateStr = end.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', {
                  month: 'short',
                  day: 'numeric',
                });
                const daysLeft = Math.floor((end.getTime() - todayTime) / 86400000);

                return (
                  <div
                    key={`${p.desc}-${idx}`}
                    className="border-l-4 border-amber-400 bg-white p-2.5 rounded shadow-sm flex justify-between items-center gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <span
                        className="font-semibold text-[13.5px] text-slate-800 leading-[1.2] truncate"
                        title={p.desc}
                      >
                        {p.desc}
                      </span>
                      <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-medium mt-0.5">
                        <span className="bg-gray-100 px-1.5 rounded text-gray-600">
                          <i className="fa-solid fa-user mr-1"></i>
                          {p.owner}
                        </span>
                        <span className="text-amber-600">
                          <i className="fa-regular fa-calendar mr-1"></i>
                          {dateStr}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-800 whitespace-nowrap flex-shrink-0 border border-amber-200">
                      {daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      ref={containerRef}
      id="wizBlock"
      className="dashboard-card border-l-4 transition-all duration-500 shadow-md"
      style={{ borderLeftColor: 'var(--brand-accent)' }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: 'var(--brand-accent)' }}
          >
            <i className="fa-solid fa-robot" style={{ color: '#1A1A1A' }}></i>
          </div>
          <div>
            <h3 id="lblWizTitle" className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
              {t.wizTitle}
            </h3>
            <p id="lblWizSub" className="text-xs" style={{ color: 'var(--text-sub)' }}>
              {t.wizSub}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-xs hover:opacity-70" style={{ color: 'var(--text-sub)' }}>
          <i className="fa-solid fa-times text-base"></i>
        </button>
      </div>

      {wizData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: 'var(--text-sub)' }}>
          <i className="fa-solid fa-folder-open text-4xl mb-3 opacity-50"></i>
          <p className="text-sm font-semibold">
            {lang === 'en'
              ? 'No active projects found for this owner/filter combination.'
              : '在目前的篩選條件下，無任何活躍專案。'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-sm w-full">
          {/* Left summary column */}
          <div className="md:col-span-4 lg:col-span-3 w-full">
            <div className="flex flex-col gap-3 w-full">
              <div>
                <h4
                  className="font-bold mb-1 uppercase text-xs flex flex-wrap items-center gap-2 leading-[1.2]"
                  style={{ color: 'var(--brand-text)' }}
                >
                  {t.wizProjects}
                  <span
                    className="text-[10px] px-2 py-0.5 rounded border border-gray-300 bg-opacity-50"
                    style={{ color: 'var(--text-main)', backgroundColor: 'var(--bg-color)' }}
                  >
                    <i className="fa-regular fa-calendar mr-1"></i> {periodText}
                  </span>
                </h4>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold leading-[1.2]" style={{ color: 'var(--text-main)' }}>
                    {wizData.length}
                  </p>
                  <div className="text-[11px] leading-[1.2]" style={{ color: 'var(--text-sub)' }}>
                    <span style={{ color: 'var(--brand-positive)', fontWeight: 'bold' }}>{closedCount}</span> Completed,{' '}
                    <span style={{ color: 'var(--brand-text)', fontWeight: 'bold' }}>{processingCount}</span> In Progress
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-1 uppercase text-xs leading-[1.2]" style={{ color: 'var(--brand-text)' }}>
                  {t.wizOwners}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {uniqueOwners.map(o => (
                    <span
                      key={o}
                      className="px-2 py-0.5 rounded text-[10px] border leading-[1.2]"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-sub)' }}
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right deliverables and breakdown column */}
          <div className="md:col-span-8 lg:col-span-9 flex flex-col w-full overflow-hidden">
            <div
              className="flex flex-wrap justify-between items-end gap-3 mb-3 border-b pb-2"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <h4 className="font-bold uppercase text-xs leading-[1.2]" style={{ color: 'var(--brand-text)' }}>
                {t.wizDeliv}
              </h4>
              <div
                className="flex flex-wrap rounded p-0.5 shadow-sm"
                style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}
              >
                <button
                  onClick={() => setViewMode('project')}
                  className="btn-tooltip px-3 py-1 text-[10px] font-semibold rounded transition-all"
                  data-tooltip={t.tipWizViewProj}
                  style={
                    viewMode === 'project'
                      ? { backgroundColor: 'var(--brand-main)', color: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
                      : { color: 'var(--text-sub)' }
                  }
                >
                  {t.wizViewProj}
                </button>
                <button
                  onClick={() => setViewMode('category')}
                  className="btn-tooltip px-3 py-1 text-[10px] font-semibold rounded transition-all"
                  data-tooltip={t.tipWizViewCat}
                  style={
                    viewMode === 'category'
                      ? { backgroundColor: 'var(--brand-main)', color: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
                      : { color: 'var(--text-sub)' }
                  }
                >
                  {t.wizViewCat}
                </button>
                <button
                  onClick={() => setViewMode('weekly')}
                  className="btn-tooltip px-3 py-1 text-[10px] font-semibold rounded transition-all"
                  data-tooltip={t.tipWizViewWeekly}
                  style={
                    viewMode === 'weekly'
                      ? {
                          backgroundColor: 'var(--brand-accent)',
                          color: '#1A1A1A',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }
                      : { color: 'var(--text-sub)' }
                  }
                >
                  <i className="fa-solid fa-calendar-day mr-1"></i> {t.wizViewWeekly}
                </button>
                <button
                  onClick={() => setViewMode('mh_breakdown')}
                  className="btn-tooltip px-3 py-1 text-[10px] font-semibold rounded transition-all"
                  data-tooltip={t.tipWizViewMh}
                  style={
                    viewMode === 'mh_breakdown'
                      ? { backgroundColor: 'var(--brand-text)', color: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
                      : { color: 'var(--text-sub)' }
                  }
                >
                  <i className="fa-solid fa-clock-rotate-left mr-1"></i> {t.wizViewMh}
                </button>
                <button
                  onClick={() => setViewMode('tracking')}
                  className="btn-tooltip px-3 py-1 text-[10px] font-semibold rounded transition-all"
                  data-tooltip={lang === 'en' ? 'Track overdue and upcoming projects' : '追蹤逾期與即將到期專案'}
                  style={
                    viewMode === 'tracking'
                      ? {
                          backgroundColor: 'var(--brand-negative)',
                          color: '#FFF',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }
                      : { color: 'var(--text-sub)' }
                  }
                >
                  <i className="fa-solid fa-bullseye mr-1"></i> Tracking
                </button>
              </div>
            </div>

            {renderRightContent()}
          </div>

          {/* Workload Daily MH/d section */}
          <div
            className="md:col-span-12 mt-2 border-t pt-4 p-2 rounded-lg glow-card-hover transition-all duration-300 w-full"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <h4
              className="font-bold mb-2 uppercase text-xs flex justify-between items-center leading-[1.2]"
              style={{ color: 'var(--brand-text)' }}
            >
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span>
                  <i className="fa-solid fa-chart-area mr-1"></i> {t.wizWorkload}
                </span>
                <div
                  className="flex p-0.5 rounded shadow-sm"
                  style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}
                >
                  <button
                    onClick={() => setChartMode('cluster')}
                    className="btn-tooltip px-2 py-0.5 text-[10px] font-semibold rounded transition-all"
                    data-tooltip={t.tipViewCluster}
                    style={
                      chartMode === 'cluster'
                        ? { backgroundColor: 'var(--brand-main)', color: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
                        : { color: 'var(--text-sub)' }
                    }
                  >
                    {t.lblViewCluster}
                  </button>
                  <button
                    onClick={() => setChartMode('project')}
                    className="btn-tooltip px-2 py-0.5 text-[10px] font-semibold rounded transition-all"
                    data-tooltip={t.tipViewProject}
                    style={
                      chartMode === 'project'
                        ? { backgroundColor: 'var(--brand-main)', color: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
                        : { color: 'var(--text-sub)' }
                    }
                  >
                    {t.lblViewProject}
                  </button>
                </div>
                <div
                  className="flex p-0.5 rounded shadow-sm btn-tooltip"
                  data-tooltip={t.tipStatusFilter}
                  style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}
                >
                  <select
                    value={chartStatusFilter}
                    onChange={(e) => setChartStatusFilter(e.target.value as any)}
                    className="px-1 py-0.5 text-[10px] font-semibold rounded outline-none cursor-pointer bg-transparent transition-all leading-[1.2]"
                    style={{ color: 'var(--brand-text)' }}
                  >
                    <option value="all">{t.wizFilterAll}</option>
                    <option value="processing">{t.wizFilterProc}</option>
                    <option value="pending">{t.wizFilterPend}</option>
                    <option value="closed">{t.wizFilterClosed}</option>
                  </select>
                </div>
              </div>

              <div className="group relative flex items-center cursor-help">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 transition-all hover:bg-[#FECACA] leading-[1.2]"
                  style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }}
                >
                  {t.wizMaxCap}
                  <i className="fa-solid fa-circle-info opacity-60 group-hover:opacity-100"></i>
                </span>

                <div
                  className="absolute right-0 top-full mt-2 hidden group-hover:block w-72 sm:w-80 max-w-[90vw] p-4 rounded-xl shadow-2xl z-[100] pointer-events-none"
                  style={{
                    background: 'rgba(17, 24, 39, 0.98)',
                    backdropFilter: 'blur(8px)',
                    color: '#f3f4f6',
                    border: '1px solid rgba(255,255,255,0.15)',
                    textTransform: 'none',
                  }}
                >
                  <div
                    className="font-bold mb-2 pb-2 border-b border-gray-700 text-sm leading-[1.2]"
                    style={{ color: '#FECACA' }}
                  >
                    <i className="fa-solid fa-lightbulb mr-1 text-yellow-300"></i> {t.wizMaxCapTooltipTitle}
                  </div>
                  <ul className="list-disc pl-4 opacity-90 space-y-2 text-[13px] font-normal leading-[1.2]">
                    <li>{t.wizMaxCapTooltipDesc1}</li>
                    <li>{t.wizMaxCapTooltipDesc2}</li>
                  </ul>
                </div>
              </div>
            </h4>

            <div className="chart-wrapper mt-2 relative" style={{ height: '250px' }}>
              <canvas ref={workloadCanvasRef}></canvas>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
