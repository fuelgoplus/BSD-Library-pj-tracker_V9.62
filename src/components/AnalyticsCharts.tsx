import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ProjectItem, ThemeColors, Language, StatusDistMode } from '../types';
import { TEXT } from '../constants/theme';
import { getStatusColor, getCustomColor, shortName } from '../utils/dataProcessor';

interface AnalyticsChartsProps {
  filteredData: ProjectItem[];
  palette: ThemeColors;
  lang: Language;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  filteredData,
  palette,
  lang,
}) => {
  const [catMetric, setCatMetric] = useState<'count' | 'mh'>('count');
  const [catGroupBy, setCatGroupBy] = useState<'Category' | 'Cluster'>('Category');
  const [statusDistView, setStatusDistView] = useState<StatusDistMode>('status');
  const [ownerMetric, setOwnerMetric] = useState<'count' | 'mh'>('count');

  const cCatRef = useRef<HTMLCanvasElement | null>(null);
  const cCatChart = useRef<Chart | null>(null);

  const cStatusRef = useRef<HTMLCanvasElement | null>(null);
  const cStatusChart = useRef<Chart | null>(null);

  const cOwnerRef = useRef<HTMLCanvasElement | null>(null);
  const cOwnerChart = useRef<Chart | null>(null);

  const t = TEXT[lang];

  // Common chart options base
  const commonOpts: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: palette.textMain, usePointStyle: true, boxWidth: 8 },
      },
      tooltip: { mode: 'index', intersect: false },
      datalabels: {
        display: 'auto',
        color: () => '#ffffff',
        textStrokeColor: '#333',
        textStrokeWidth: 2,
        font: { weight: 'bold', size: 10 },
        formatter: (value: any) => value,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: palette.textMain } },
      y: { grid: { color: palette.border }, ticks: { color: palette.textMain } },
    },
    hover: { mode: 'nearest', intersect: true },
  };

  // Status Distribution Chart
  useEffect(() => {
    if (!cStatusRef.current) return;
    if (cStatusChart.current) {
      cStatusChart.current.destroy();
      cStatusChart.current = null;
    }

    const statusCount: Record<string, number> = {};
    filteredData.forEach(d => {
      const key = d[statusDistView] || 'Unknown';
      statusCount[key] = (statusCount[key] || 0) + 1;
    });
    const statusLabels = Object.keys(statusCount);

    const ctx = cStatusRef.current.getContext('2d');
    if (!ctx) return;

    cStatusChart.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: statusLabels,
        datasets: [
          {
            data: Object.values(statusCount),
            backgroundColor: statusLabels.map(s =>
              statusDistView === 'status' ? getStatusColor(s, palette) : getCustomColor(s, palette)
            ),
            borderWidth: 2,
            borderColor: palette.card,
            hoverOffset: 15,
            hoverBorderWidth: 4,
            hoverBorderColor: palette.textMain,
          },
        ],
      },
      options: {
        ...commonOpts,
        cutout: '70%',
        plugins: {
          ...commonOpts.plugins,
          datalabels: {
            color: palette.textMain,
            textStrokeColor: palette.card,
            textStrokeWidth: 3,
            font: { size: 12, weight: 'bold' },
            formatter: (value: number, ctx: any) => {
              const total = ctx.chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
              const percentageNum = (value / total) * 100;
              if (percentageNum < 5) return '';
              const percentage = Math.round(percentageNum) + '%';
              return `${value}\n(${percentage})`;
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    });

    return () => {
      if (cStatusChart.current) {
        cStatusChart.current.destroy();
        cStatusChart.current = null;
      }
    };
  }, [filteredData, statusDistView, palette, lang]);

  // Category Analysis Chart
  useEffect(() => {
    if (!cCatRef.current) return;
    if (cCatChart.current) {
      cCatChart.current.destroy();
      cCatChart.current = null;
    }

    const key = catGroupBy === 'Category' ? 'category' : 'cluster';
    const labels = Array.from(new Set<string>(filteredData.map(d => String(d[key])))).sort();
    const owners = Array.from(new Set<string>(filteredData.map(d => d.owner))).sort();

    const datasets = owners.map(owner => ({
      label: String(owner),
      data: labels.map(label => {
        const subset = filteredData.filter(d => d[key] === label && d.owner === owner);
        if (catMetric === 'mh') {
          return subset.reduce((acc, curr) => acc + (curr.dailyMH || 0) * (curr.duration || 1), 0);
        }
        return subset.length;
      }),
      backgroundColor: getCustomColor(owner, palette),
      borderRadius: 4,
      hoverBorderWidth: 3,
      hoverBorderColor: 'white',
    }));

    const ctx = cCatRef.current.getContext('2d');
    if (!ctx) return;

    cCatChart.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        ...commonOpts,
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: palette.textMain } },
          y: { stacked: true, grid: { color: palette.border }, ticks: { color: palette.textMain } },
        },
        plugins: {
          ...commonOpts.plugins,
          datalabels: {
            color: '#ffffff',
            display: (context: any) => context.dataset.data[context.dataIndex] > 0,
            formatter: (value: number) => {
              if (value === 0) return '';
              return catMetric === 'mh' ? `${Math.round(value)}h` : value;
            },
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const ownerName = context.dataset.label;
                const value = context.parsed.y;
                const unit = catMetric === 'mh' ? 'hrs' : 'items';
                return `${ownerName}: ${catMetric === 'mh' ? value.toFixed(1) : value} ${unit}`;
              },
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    });

    return () => {
      if (cCatChart.current) {
        cCatChart.current.destroy();
        cCatChart.current = null;
      }
    };
  }, [filteredData, catGroupBy, catMetric, palette, lang]);

  // Owner Contribution Chart
  const owners: string[] = useMemo(
    () => Array.from(new Set(filteredData.map(d => d.owner))).sort(),
    [filteredData]
  );
  const ownerContainerHeight = Math.max(250, owners.length * 24);

  useEffect(() => {
    if (!cOwnerRef.current) return;
    if (cOwnerChart.current) {
      cOwnerChart.current.destroy();
      cOwnerChart.current = null;
    }

    const cats: string[] = Array.from(new Set(filteredData.map(d => d.category)));
    const ownerDatasets = cats.map(c => ({
      label: String(c),
      data: owners.map(o => {
        const subset = filteredData.filter(d => d.owner === o && d.category === c);
        if (ownerMetric === 'mh') {
          return subset.reduce((acc, curr) => acc + (curr.dailyMH || 0) * Math.max(1, curr.duration || 1), 0);
        }
        return subset.length;
      }),
      backgroundColor: getCustomColor(c, palette),
      hoverBorderWidth: 3,
      hoverBorderColor: 'white',
    }));

    const ctx = cOwnerRef.current.getContext('2d');
    if (!ctx) return;

    cOwnerChart.current = new Chart(ctx, {
      type: 'bar',
      data: { labels: owners, datasets: ownerDatasets },
      options: {
        ...commonOpts,
        indexAxis: 'y',
        scales: {
          x: { stacked: true, grid: { color: palette.border }, ticks: { color: palette.textMain } },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: palette.textMain,
              font: { size: 12.5, family: "'Microsoft JhengHei UI', 'Quicksand', sans-serif" },
            },
          },
        },
        plugins: {
          ...commonOpts.plugins,
          datalabels: {
            color: '#ffffff',
            display: (context: any) => context.dataset.data[context.dataIndex] > 0,
            formatter: (value: number) => {
              if (value === 0) return '';
              return ownerMetric === 'mh' ? Math.round(value) : value;
            },
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const catName = context.dataset.label;
                const value = context.parsed.x;
                const ownerName = context.label;
                const unit = ownerMetric === 'mh' ? 'MH' : 'items';
                const baseStr = `${catName}: ${ownerMetric === 'mh' ? value.toFixed(1) : value} ${unit}`;

                if (ownerMetric === 'mh' && value > 0) {
                  const subset = filteredData.filter(d => d.owner === ownerName && d.category === catName);
                  const projs = subset
                    .map(p => ({
                      desc: p.desc,
                      mh: (p.dailyMH || 0) * Math.max(1, p.duration || 1),
                    }))
                    .filter(p => p.mh > 0)
                    .sort((a, b) => b.mh - a.mh);

                  const top5 = projs.slice(0, 5);
                  const details = top5.map((p, i) => `  ${i + 1}. ${shortName(p.desc, 25)} (${p.mh.toFixed(1)} MH)`);

                  if (projs.length > 5) {
                    details.push(`  ... and ${projs.length - 5} ${t.tooltipMore}`);
                  }

                  if (details.length > 0) {
                    return [baseStr, '', t.tooltipTopProj, ...details];
                  }
                }
                return baseStr;
              },
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    });

    return () => {
      if (cOwnerChart.current) {
        cOwnerChart.current.destroy();
        cOwnerChart.current = null;
      }
    };
  }, [filteredData, ownerMetric, palette, lang, owners]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Analysis */}
        <div className="lg:col-span-8 dashboard-card flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 id="lblCatAnalysis" className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                {t.catAnalysis}
              </h3>
              <p id="lblCatSub" className="text-xs" style={{ color: 'var(--text-sub)' }}>
                {t.catSub}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div
                className="p-1 rounded-md flex gap-1 border"
                style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
              >
                <button
                  id="btnCatCount"
                  className="btn-tooltip px-3 py-1 text-xs font-semibold rounded transition-colors"
                  data-tooltip={t.tipCount}
                  style={{
                    backgroundColor: catMetric === 'count' ? 'var(--brand-main)' : 'transparent',
                    color: catMetric === 'count' ? '#FFFFFF' : 'var(--text-sub)',
                  }}
                  onClick={() => setCatMetric('count')}
                >
                  Count
                </button>
                <button
                  id="btnCatMH"
                  className="btn-tooltip px-3 py-1 text-xs font-semibold rounded transition-colors"
                  data-tooltip={t.tipMH}
                  style={{
                    backgroundColor: catMetric === 'mh' ? 'var(--brand-main)' : 'transparent',
                    color: catMetric === 'mh' ? '#FFFFFF' : 'var(--text-sub)',
                  }}
                  onClick={() => setCatMetric('mh')}
                >
                  Hours
                </button>
              </div>
              <div
                className="p-1 rounded-md flex gap-1 border"
                style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
              >
                <button
                  id="btnCat"
                  className="btn-tooltip px-3 py-1 text-xs font-semibold rounded transition-colors"
                  data-tooltip={t.tipCat}
                  style={{
                    backgroundColor: catGroupBy === 'Category' ? 'var(--brand-main)' : 'transparent',
                    color: catGroupBy === 'Category' ? '#FFFFFF' : 'var(--text-sub)',
                  }}
                  onClick={() => setCatGroupBy('Category')}
                >
                  Category
                </button>
                <button
                  id="btnClust"
                  className="btn-tooltip px-3 py-1 text-xs font-semibold rounded transition-colors"
                  data-tooltip={t.tipClust}
                  style={{
                    backgroundColor: catGroupBy === 'Cluster' ? 'var(--brand-main)' : 'transparent',
                    color: catGroupBy === 'Cluster' ? '#FFFFFF' : 'var(--text-sub)',
                  }}
                  onClick={() => setCatGroupBy('Cluster')}
                >
                  Cluster
                </button>
              </div>
            </div>
          </div>
          <div className="chart-wrapper">
            <canvas ref={cCatRef}></canvas>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="lg:col-span-4 dashboard-card flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 id="lblStatusDist" className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                {t.statusDist}
              </h3>
              <p id="lblStatusSub" className="text-xs" style={{ color: 'var(--text-sub)' }}>
                {t.statusSub}
              </p>
            </div>
            <div
              id="selStatusDistViewWrapper"
              className="btn-tooltip p-1 rounded-md flex gap-1 border"
              data-tooltip={t.tipStatusDist}
              style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
            >
              <select
                id="selStatusDistView"
                value={statusDistView}
                onChange={(e) => setStatusDistView(e.target.value as StatusDistMode)}
                className="px-2 py-1 text-[10px] font-semibold rounded outline-none cursor-pointer bg-transparent transition-all"
                style={{ color: 'var(--brand-text)' }}
              >
                <option value="status">{t.status}</option>
                <option value="category">{t.category}</option>
                <option value="cluster">{t.cluster}</option>
              </select>
            </div>
          </div>
          <div className="chart-wrapper">
            <canvas ref={cStatusRef}></canvas>
          </div>
        </div>
      </div>

      {/* Owner Contribution Chart */}
      <div className="dashboard-card">
        <div className="mb-4 flex justify-between items-start">
          <div>
            <h3 id="lblOwnerCont" className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
              {t.ownerCont}
            </h3>
            <p id="lblOwnerSub" className="text-xs" style={{ color: 'var(--text-sub)' }}>
              {t.ownerSub}
            </p>
          </div>
          <div
            className="flex p-1 rounded-md border"
            style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
          >
            <button
              id="btnOwnerCount"
              className="btn-tooltip px-3 py-1 text-xs font-semibold rounded"
              data-tooltip={t.tipCount}
              style={{
                backgroundColor: ownerMetric === 'count' ? 'var(--brand-main)' : 'transparent',
                color: ownerMetric === 'count' ? '#FFFFFF' : 'var(--text-sub)',
              }}
              onClick={() => setOwnerMetric('count')}
            >
              Count
            </button>
            <button
              id="btnOwnerDur"
              className="btn-tooltip px-3 py-1 text-xs font-semibold rounded"
              data-tooltip={t.tipMH}
              style={{
                backgroundColor: ownerMetric === 'mh' ? 'var(--brand-main)' : 'transparent',
                color: ownerMetric === 'mh' ? '#FFFFFF' : 'var(--text-sub)',
              }}
              onClick={() => setOwnerMetric('mh')}
            >
              MH
            </button>
          </div>
        </div>

        <div className="overflow-y-auto custom-scrollbar w-full" style={{ maxHeight: '500px' }}>
          <div
            className="chart-wrapper"
            style={{ height: `${ownerContainerHeight}px`, minHeight: '250px', width: '100%' }}
          >
            <canvas ref={cOwnerRef}></canvas>
          </div>
        </div>
      </div>
    </>
  );
};
