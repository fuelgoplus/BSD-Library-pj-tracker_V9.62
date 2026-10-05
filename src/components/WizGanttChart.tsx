import React, { useState, useMemo, useRef } from 'react';
import { ProjectItem, ThemeColors, Language } from '../types';
import { getStatusColor, shortName } from '../utils/dataProcessor';

interface WizGanttChartProps {
  wizData: ProjectItem[];
  mode: 'project' | 'category';
  palette: ThemeColors;
  lang: Language;
  onSelectProject?: (project: ProjectItem) => void;
  onClose?: () => void;
}

// Cluster curated distinct colors for coherence visualization
const CLUSTER_COLORS = [
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#059669', // Emerald
  '#D97706', // Amber
  '#DB2777', // Pink/Rose
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#16A34A', // Green
  '#9333EA', // Violet
];

export const WizGanttChart: React.FC<WizGanttChartProps> = ({
  wizData,
  mode,
  palette,
  lang,
  onSelectProject,
  onClose,
}) => {
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('All');
  const [hoveredProject, setHoveredProject] = useState<ProjectItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Time boundaries and parsed items
  const now = useMemo(() => new Date(), []);
  const todayTime = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  // Compute tasks with timestamps
  const tasksWithTimes = useMemo(() => {
    return wizData
      .map(d => {
        const end = d.rev || d.due;
        if (!end) return null;
        const dur = Math.max(1, d.duration || 1);
        const endT = end.getTime();
        const startT = endT - (dur - 1) * 86400000;
        const category = d.category || (lang === 'en' ? 'Uncategorized' : '未分類');
        const cluster = d.cluster || (lang === 'en' ? 'No Cluster' : '無群組');
        return {
          ...d,
          startT,
          endT,
          category,
          cluster,
          dur,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [wizData, lang]);

  // Derive unique clusters and assign palette
  const { clusterColorMap, allClusters } = useMemo(() => {
    const clusterSet = new Set<string>();
    tasksWithTimes.forEach(t => {
      if (t.cluster) clusterSet.add(String(t.cluster));
    });
    const clusters: string[] = Array.from(clusterSet).sort();
    const map: Record<string, string> = {};
    clusters.forEach((c, idx) => {
      map[c] = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
    });
    return { clusterColorMap: map, allClusters: clusters };
  }, [tasksWithTimes]);

  // Filter tasks based on cluster filter (if applied)
  const filteredTasks = useMemo(() => {
    if (selectedClusterFilter === 'All') return tasksWithTimes;
    return tasksWithTimes.filter(t => t.cluster === selectedClusterFilter);
  }, [tasksWithTimes, selectedClusterFilter]);

  // Calculate timeline range
  const { minTime, maxTime, totalSpanDays, dateTicks } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const start = new Date(todayTime);
      const end = new Date(todayTime + 30 * 86400000);
      return {
        minTime: start.getTime(),
        maxTime: end.getTime(),
        totalSpanDays: 30,
        dateTicks: [],
      };
    }

    let minT = Math.min(...filteredTasks.map(t => t.startT));
    let maxT = Math.max(...filteredTasks.map(t => t.endT));

    // Pad buffer of 2 days on each end for visual comfort
    minT -= 2 * 86400000;
    maxT += 3 * 86400000;

    const spanDays = Math.max(7, Math.ceil((maxT - minT) / 86400000));

    // Generate date ticks (every 3 to 7 days depending on span)
    const stepDays = spanDays <= 20 ? 2 : spanDays <= 45 ? 5 : spanDays <= 90 ? 7 : 14;
    const ticks: { time: number; label: string; isToday?: boolean }[] = [];

    const curr = new Date(minT);
    curr.setHours(0, 0, 0, 0);

    while (curr.getTime() <= maxT) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const label = `${pad(curr.getMonth() + 1)}/${pad(curr.getDate())}`;
      ticks.push({ time: curr.getTime(), label });
      curr.setDate(curr.getDate() + stepDays);
    }

    return {
      minTime: minT,
      maxTime: maxT,
      totalSpanDays: spanDays,
      dateTicks: ticks,
    };
  }, [filteredTasks, todayTime]);

  // Grouping structure for 'category' mode
  const categoryClusterGroups = useMemo(() => {
    if (mode !== 'category') return [];

    const groups: {
      category: string;
      clusters: {
        cluster: string;
        color: string;
        earliestStart: number;
        latestEnd: number;
        totalMH: number;
        tasks: typeof filteredTasks;
        hasConcurrent: boolean;
      }[];
    }[] = [];

    const catMap: Record<string, Record<string, typeof filteredTasks>> = {};

    filteredTasks.forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = {};
      if (!catMap[t.category][t.cluster]) catMap[t.category][t.cluster] = [];
      catMap[t.category][t.cluster].push(t);
    });

    Object.keys(catMap)
      .sort()
      .forEach(cat => {
        const clusterList: (typeof groups)[0]['clusters'] = [];
        Object.keys(catMap[cat])
          .sort()
          .forEach(clust => {
            const projs = catMap[cat][clust].sort((a, b) => a.startT - b.startT);
            const earliest = Math.min(...projs.map(p => p.startT));
            const latest = Math.max(...projs.map(p => p.endT));
            const totalMH = Number(
              projs.reduce((sum, p) => sum + (p.dailyMH || 0) * (p.duration || 1), 0).toFixed(1)
            );

            // Detect concurrent tasks within cluster
            let hasConcurrent = false;
            for (let i = 0; i < projs.length; i++) {
              for (let j = i + 1; j < projs.length; j++) {
                if (projs[i].startT <= projs[j].endT && projs[i].endT >= projs[j].startT) {
                  hasConcurrent = true;
                  break;
                }
              }
              if (hasConcurrent) break;
            }

            clusterList.push({
              cluster: clust,
              color: clusterColorMap[clust] || '#3B82F6',
              earliestStart: earliest,
              latestEnd: latest,
              totalMH,
              tasks: projs,
              hasConcurrent,
            });
          });

        groups.push({ category: cat, clusters: clusterList });
      });

    return groups;
  }, [mode, filteredTasks, clusterColorMap]);

  // Position helper percentage
  const getPercentOffset = (time: number) => {
    const totalSpan = maxTime - minTime;
    if (totalSpan <= 0) return 0;
    const clamped = Math.max(minTime, Math.min(time, maxTime));
    return ((clamped - minTime) / totalSpan) * 100;
  };

  const todayPercent = getPercentOffset(todayTime);
  const isTodayInView = todayTime >= minTime && todayTime <= maxTime;

  // Format date helper
  const formatDateBadge = (st: number, en: number) => {
    const s = new Date(st);
    const e = new Date(en);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(s.getMonth() + 1)}/${pad(s.getDate())} ~ ${pad(e.getMonth() + 1)}/${pad(e.getDate())}`;
  };

  return (
    <div className="flex flex-col w-full space-y-3 bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden transition-all duration-300" style={{ borderColor: 'var(--border-color)' }}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs flex-shrink-0"
            style={{ backgroundColor: mode === 'category' ? 'var(--brand-sub)' : 'var(--brand-main)' }}
          >
            <i className={`fa-solid ${mode === 'category' ? 'fa-diagram-project' : 'fa-chart-gantt'} text-sm`}></i>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm leading-[1.2] text-slate-800">
                {mode === 'category'
                  ? (lang === 'en' ? 'Category-Cluster Coherence & Relation Gantt' : '類別與群組關聯時程甘特圖')
                  : (lang === 'en' ? 'Project Schedule Gantt Chart' : '專案時程甘特圖')}
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs text-white" style={{ backgroundColor: 'var(--brand-text)' }}>
                {mode === 'category' ? (lang === 'en' ? 'Coherence View' : '關聯連貫性') : (lang === 'en' ? 'Timeline View' : '時間軸視角')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-[1.2]">
              {mode === 'category'
                ? (lang === 'en'
                    ? 'Visualizes hierarchical workstreams by Category & Cluster with phase coherence, concurrency, and timeline relations'
                    : '以類別與群組階層視角呈現專案時程，視覺化群組工作流之關聯連貫性與並行推進')
                : (lang === 'en'
                    ? 'Chronological Gantt timeline with duration, resource load, and due-dates'
                    : '按時間軸排列所有專案之執行時程、每日工時與到期日')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs font-bold rounded border shadow-2xs flex items-center gap-1.5 transition-all bg-white hover:bg-slate-50 text-slate-700"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <i className="fa-solid fa-table-list"></i>
              <span>{lang === 'en' ? 'Switch to List' : '切換清單檢視'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Cluster Coherence & Filter Pills (for Category-Cluster mode) */}
      {mode === 'category' && (
        <div className="p-2.5 rounded-lg border bg-slate-50/60 shadow-2xs space-y-2" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5">
              <i className="fa-solid fa-layer-group text-blue-500"></i>
              <span>{lang === 'en' ? 'Cluster Coherence Overview:' : '群組工作流與關聯總覽:'}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {lang === 'en' ? 'Click a cluster to highlight/filter' : '點擊群組標籤可單獨聚焦'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedClusterFilter('All')}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-2xs ${
                selectedClusterFilter === 'All'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <i className="fa-solid fa-cubes text-[10px]"></i>
              <span>{lang === 'en' ? 'All Clusters' : '全部群組'}</span>
              <span className="text-[10px] opacity-80">({allClusters.length})</span>
            </button>

            {allClusters.map(c => {
              const color = clusterColorMap[c] || '#3B82F6';
              const isSelected = selectedClusterFilter === c;
              const clusterTasks = tasksWithTimes.filter(t => t.cluster === c);
              const totalMH = clusterTasks.reduce((sum, p) => sum + (p.dailyMH || 0) * (p.duration || 1), 0).toFixed(1);

              return (
                <button
                  key={c}
                  onClick={() => setSelectedClusterFilter(isSelected ? 'All' : c)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-2xs ${
                    isSelected
                      ? 'text-white border-transparent'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  style={isSelected ? { backgroundColor: color } : {}}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                  <span className="truncate max-w-[140px]">{c}</span>
                  <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {clusterTasks.length} ({totalMH}h)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Gantt Grid Container */}
      <div
        ref={containerRef}
        className="w-full border rounded-lg overflow-x-auto custom-scrollbar bg-white"
        style={{ borderColor: 'var(--border-color)', minHeight: '320px', maxHeight: '480px' }}
      >
        <div className="min-w-[850px] relative">
          {/* Header Axis: Date Timeline */}
          <div className="sticky top-0 z-30 bg-slate-100 border-b flex items-stretch text-xs select-none shadow-2xs" style={{ borderColor: 'var(--border-color)' }}>
            {/* Left Header label: Project Description */}
            <div
              className="w-[300px] sm:w-[340px] p-2.5 font-bold uppercase text-slate-600 border-r flex items-center justify-between flex-shrink-0 bg-slate-100"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <span>{lang === 'en' ? 'Project Description (Y-Axis)' : '專案描述 (Y 軸)'}</span>
              <span className="text-[10px] text-slate-400 font-normal">
                {filteredTasks.length} {lang === 'en' ? 'tasks' : '項'}
              </span>
            </div>

            {/* Right Header label: Timeline (X-Axis) */}
            <div className="flex-grow relative h-10 overflow-hidden flex items-center">
              {dateTicks.map((tick, idx) => {
                const pct = getPercentOffset(tick.time);
                return (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 flex flex-col justify-center transform -translate-x-1/2 text-center"
                    style={{ left: `${pct}%` }}
                  >
                    <span className="font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap">
                      {tick.label}
                    </span>
                    <div className="w-px h-1.5 bg-slate-300 mx-auto"></div>
                  </div>
                );
              })}

              {/* Today Header Marker */}
              {isTodayInView && (
                <div
                  className="absolute top-1 transform -translate-x-1/2 z-40 flex flex-col items-center"
                  style={{ left: `${todayPercent}%` }}
                >
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs bg-amber-400 text-black uppercase">
                    Today
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Grid Area with Background Lines */}
          <div className="relative">
            {/* Vertical Gridlines across full height */}
            <div className="absolute inset-0 pointer-events-none left-[300px] sm:left-[340px] right-0 overflow-hidden">
              {dateTicks.map((tick, idx) => {
                const pct = getPercentOffset(tick.time);
                return (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 w-px border-r border-dashed border-slate-200"
                    style={{ left: `${pct}%` }}
                  ></div>
                );
              })}

              {/* Vertical TODAY line */}
              {isTodayInView && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 z-20 border-r-2 border-dashed border-amber-400 shadow-sm"
                  style={{ left: `${todayPercent}%` }}
                ></div>
              )}
            </div>

            {/* Content Rows */}
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <i className="fa-regular fa-folder-open text-3xl mb-2 block"></i>
                {lang === 'en' ? 'No projects match current period or cluster filter.' : '此期間或群組條件下無排程專案。'}
              </div>
            ) : mode === 'category' ? (
              /* CATEGORY-CLUSTER GROUPED ROWS */
              categoryClusterGroups.map((catGroup, catIdx) => (
                <div key={`cat-${catIdx}`} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  {/* Category Header Row */}
                  <div
                    className="sticky z-20 px-3 py-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider"
                    style={{ backgroundColor: 'var(--bg-color)', color: 'var(--brand-text)' }}
                  >
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-folder-open text-xs"></i>
                      <span>{catGroup.category}</span>
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-white/70 border border-slate-200">
                        {catGroup.clusters.reduce((sum, c) => sum + c.tasks.length, 0)} {lang === 'en' ? 'projects' : '項專案'}
                      </span>
                    </div>
                  </div>

                  {/* Clusters under this Category */}
                  {catGroup.clusters.map((clust, clustIdx) => {
                    const clusterSpanLeft = getPercentOffset(clust.earliestStart);
                    const clusterSpanRight = getPercentOffset(clust.latestEnd);
                    const clusterSpanWidth = Math.max(2, clusterSpanRight - clusterSpanLeft);

                    return (
                      <div key={`clust-${clustIdx}`} className="relative border-b last:border-b-0 border-slate-100">
                        {/* Cluster Subheader */}
                        <div className="flex items-stretch bg-slate-50/70 border-b border-slate-100">
                          <div
                            className="w-[300px] sm:w-[340px] px-3 py-1.5 flex items-center justify-between border-r border-slate-200 flex-shrink-0"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: clust.color }}></span>
                              <span className="font-bold text-xs text-slate-800 truncate" title={clust.cluster}>
                                {clust.cluster}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                              {clust.tasks.length} items • {clust.totalMH} MH
                            </span>
                          </div>

                          {/* Cluster Coherence Bracket on Timeline */}
                          <div className="flex-grow relative h-7 overflow-hidden flex items-center">
                            <div
                              className="absolute h-4 rounded-md border flex items-center px-1.5 text-[9px] font-bold shadow-2xs whitespace-nowrap overflow-hidden transition-all"
                              style={{
                                left: `${clusterSpanLeft}%`,
                                width: `${clusterSpanWidth}%`,
                                backgroundColor: `${clust.color}15`,
                                borderColor: clust.color,
                                color: clust.color,
                              }}
                              title={`Cluster Timeline: ${formatDateBadge(clust.earliestStart, clust.latestEnd)}`}
                            >
                              <i className="fa-solid fa-arrows-left-right mr-1 text-[8px]"></i>
                              <span className="truncate">{formatDateBadge(clust.earliestStart, clust.latestEnd)}</span>
                              {clust.hasConcurrent && (
                                <span className="ml-1 text-[8px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-extrabold flex-shrink-0">
                                  ⚡ {lang === 'en' ? 'Concurrent' : '並行'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Task rows within this cluster */}
                        {clust.tasks.map((task, tIdx) => {
                          const barLeft = getPercentOffset(task.startT);
                          const barWidth = Math.max(1.8, getPercentOffset(task.endT) - barLeft);
                          const isHovered = hoveredProject?.desc === task.desc;
                          const accumMH = ((task.dailyMH || 0) * (task.duration || 1)).toFixed(1);
                          const dateBadge = formatDateBadge(task.startT, task.endT);

                          return (
                            <div
                              key={`t-${tIdx}`}
                              onClick={() => onSelectProject?.(task)}
                              onMouseEnter={(e) => {
                                setHoveredProject(task);
                                setTooltipPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => setHoveredProject(null)}
                              className={`flex items-stretch hover:bg-sky-50/60 transition-colors cursor-pointer group border-b last:border-b-0 border-slate-50 ${
                                isHovered ? 'bg-sky-50/80' : ''
                              }`}
                            >
                              {/* Y-Axis: Project Description & Metadata */}
                              <div
                                className="w-[300px] sm:w-[340px] p-2 pl-6 flex flex-col justify-center border-r border-slate-200 flex-shrink-0 select-none"
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span
                                    className="font-bold text-[12.5px] text-slate-800 group-hover:text-blue-600 transition-colors truncate"
                                    title={task.desc}
                                  >
                                    {task.desc}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                  <span>
                                    <i className="fa-regular fa-user mr-0.5"></i> {task.owner}
                                  </span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-600">{dateBadge}</span>
                                  <span>•</span>
                                  <span className="font-bold text-slate-700">{task.dur}d</span>
                                </div>
                              </div>

                              {/* X-Axis: Gantt Bar on Timeline */}
                              <div className="flex-grow relative h-11 flex items-center overflow-hidden">
                                <div
                                  className="absolute h-6 rounded-md shadow-xs transition-all flex items-center justify-between px-2 text-white font-bold text-[10px] group-hover:shadow-md group-hover:brightness-105"
                                  style={{
                                    left: `${barLeft}%`,
                                    width: `${barWidth}%`,
                                    backgroundColor: clust.color,
                                    border: isHovered ? '2px solid #FFFFFF' : '1px solid rgba(0,0,0,0.1)',
                                  }}
                                >
                                  <span className="truncate mr-1 drop-shadow-xs">{task.dur}d</span>
                                  <span className="text-[9px] opacity-90 font-mono whitespace-nowrap bg-black/25 px-1 rounded drop-shadow-xs">
                                    {task.dailyMH} MH/d
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              /* CHRONOLOGICAL PROJECT ROWS (for 'project' mode) */
              filteredTasks
                .sort((a, b) => a.startT - b.startT)
                .map((task, tIdx) => {
                  const barLeft = getPercentOffset(task.startT);
                  const barWidth = Math.max(1.8, getPercentOffset(task.endT) - barLeft);
                  const isHovered = hoveredProject?.desc === task.desc;
                  const statusBg = getStatusColor(task.status, palette);
                  const dateBadge = formatDateBadge(task.startT, task.endT);

                  return (
                    <div
                      key={`proj-row-${tIdx}`}
                      onClick={() => onSelectProject?.(task)}
                      onMouseEnter={(e) => {
                        setHoveredProject(task);
                        setTooltipPos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHoveredProject(null)}
                      className={`flex items-stretch hover:bg-sky-50/60 transition-colors cursor-pointer group border-b border-slate-100 ${
                        isHovered ? 'bg-sky-50/80' : ''
                      }`}
                    >
                      {/* Y-Axis: Project Description & Metadata */}
                      <div
                        className="w-[300px] sm:w-[340px] p-2.5 flex flex-col justify-center border-r border-slate-200 flex-shrink-0 select-none"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className="font-bold text-[13px] text-slate-800 group-hover:text-blue-600 transition-colors truncate"
                            title={task.desc}
                          >
                            {tIdx + 1}. {task.desc}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-1 flex-wrap">
                          <span className="font-semibold text-slate-700">
                            <i className="fa-regular fa-user mr-0.5"></i> {task.owner}
                          </span>
                          <span>•</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                            {task.cluster}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-slate-700">{task.dur}d</span>
                        </div>
                      </div>

                      {/* X-Axis: Gantt Bar */}
                      <div className="flex-grow relative h-12 flex items-center overflow-hidden">
                        <div
                          className="absolute h-7 rounded-md shadow-xs transition-all flex items-center justify-between px-2.5 text-white font-bold text-[10.5px] group-hover:shadow-md group-hover:brightness-105"
                          style={{
                            left: `${barLeft}%`,
                            width: `${barWidth}%`,
                            backgroundColor: statusBg,
                            border: isHovered ? '2px solid #FFFFFF' : '1px solid rgba(0,0,0,0.1)',
                          }}
                        >
                          <span className="truncate mr-1 drop-shadow-xs">{task.dur} days</span>
                          <span className="text-[9.5px] opacity-95 font-mono whitespace-nowrap bg-black/25 px-1.5 py-0.5 rounded drop-shadow-xs">
                            {task.dailyMH} MH/d
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredProject && (
        <div className="p-3 bg-slate-900 text-white rounded-lg shadow-xl text-xs flex flex-col gap-1.5 border border-slate-700 animate-fadeIn">
          <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5">
            <span className="font-bold text-amber-300 text-[13px]">{hoveredProject.desc}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-600">
              {hoveredProject.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
            <div>
              <span className="text-slate-400 mr-1">{lang === 'en' ? 'Owner:' : '負責人:'}</span>
              <span className="font-semibold text-white">{hoveredProject.owner}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-1">{lang === 'en' ? 'Category:' : '類別:'}</span>
              <span className="font-semibold text-white">{hoveredProject.category}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-1">{lang === 'en' ? 'Cluster:' : '群組:'}</span>
              <span className="font-semibold text-white">{hoveredProject.cluster}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-1">{lang === 'en' ? 'Duration:' : '天數:'}</span>
              <span className="font-semibold text-white">{hoveredProject.duration} days</span>
            </div>
            <div>
              <span className="text-slate-400 mr-1">{lang === 'en' ? 'Daily Load:' : '每日工時:'}</span>
              <span className="font-semibold text-white">{hoveredProject.dailyMH} MH/d</span>
            </div>
            <div>
              <span className="text-slate-400 mr-1">{lang === 'en' ? 'Total Workload:' : '累計工時:'}</span>
              <span className="font-semibold text-white">
                {((hoveredProject.dailyMH || 0) * (hoveredProject.duration || 1)).toFixed(1)} MH
              </span>
            </div>
          </div>
          {hoveredProject.highlights && hoveredProject.highlights.trim().length > 3 && (
            <div className="pt-1.5 border-t border-slate-700 text-[11px] text-slate-300">
              <span className="text-amber-400 font-semibold mr-1">{lang === 'en' ? 'Deliverables:' : '交付物:'}</span>
              <span>{shortName(hoveredProject.highlights.replace(/[•*-]/g, '').trim(), 120)}</span>
            </div>
          )}
          <div className="text-[10px] text-slate-400 italic text-right pt-0.5">
            {lang === 'en' ? 'Click row to open detailed modal' : '點擊該列以開啟完整視窗'}
          </div>
        </div>
      )}

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">
            {lang === 'en' ? 'Legend:' : '圖例說明:'}
          </span>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Closed</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>Processing</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Pending</span>
          </div>
          {mode === 'category' && (
            <div className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              <i className="fa-solid fa-arrows-left-right text-blue-500"></i>
              <span>{lang === 'en' ? 'Cluster Span Bracket' : '群組跨度關聯框'}</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          <i className="fa-regular fa-hand-pointer mr-1"></i>
          {lang === 'en' ? 'Interactive Gantt • Click any task for pop-up details' : '互動式甘特圖 • 點擊任意專案檢視詳細資訊'}
        </div>
      </div>
    </div>
  );
};
