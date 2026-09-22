import * as XLSX from 'xlsx';
import { ProjectItem, ThemeColors, FilterState } from '../types';
import { TEXT } from '../constants/theme';
import { matchesFilterValue, formatFilterDisplay } from './filterHelpers';

export function parseDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(d: Date | null): string {
  return d ? d.toISOString().split('T')[0] : '-';
}

export function shortName(text: string, len = 25): string {
  if (!text) return '';
  return text.length > len ? text.substring(0, len) + '...' : text;
}

export function formatBullets(text: string): string[] {
  if (!text) return [];
  let items = text.split(/\r?\n/).map(i => i.trim()).filter(i => i !== '');
  if (items.length <= 1) {
    items = text.split(/[•\-*]/).map(i => i.trim()).filter(i => i !== '');
  }
  return items.length > 0 ? items : [text];
}

export function processData(json: any[]): ProjectItem[] {
  return json
    .map(row => {
      const owner = (row['Owner'] || 'Unassigned').toString().trim();
      if (owner.toLowerCase() === 'unassigned') return null;

      const due = parseDate(row['Due Date']);
      const rev = parseDate(row['Revision_1']);

      let isOnTime = true;
      if (rev && due) {
        if (rev.getTime() > due.getTime()) isOnTime = false;
      }

      const highlights = (row['Highlight & Deliverables'] || '').toString().trim();
      let duration = 0;
      const rawDur = row['Duration'];
      if (rawDur !== undefined && rawDur !== null && rawDur !== '') {
        duration = parseFloat(rawDur);
        if (isNaN(duration)) duration = 0;
      }

      const end = rev || due;
      let start = end;
      if (end && duration > 0) {
        start = new Date(end.getTime() - ((duration - 1) * 86400000));
      }

      const startMonthStr = start ? start.toISOString().slice(0, 7) : 'Unknown';
      const endMonthStr = end ? end.toISOString().slice(0, 7) : 'Unknown';

      let dailyMH = 0;
      let rawDailyMH: any = undefined;
      let rawTotalMH: any = undefined;

      for (const key in row) {
        const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (k === 'mhperday' || k === 'mhd' || k === 'dailymh' || k === 'manhoursperday' || k === 'manhourperday') {
          rawDailyMH = row[key];
        } else if (k === 'mh' || k === 'mhs' || k === 'manhours' || k === 'manhour' || k === 'totalmh' || k === 'totalmanhours') {
          rawTotalMH = row[key];
        }
      }

      if (rawDailyMH !== undefined && rawDailyMH !== null && rawDailyMH !== '') {
        dailyMH = parseFloat(rawDailyMH);
      } else if (rawTotalMH !== undefined && rawTotalMH !== null && rawTotalMH !== '') {
        const totalMH = parseFloat(rawTotalMH);
        if (!isNaN(totalMH) && duration > 0) {
          dailyMH = totalMH / duration;
        } else if (!isNaN(totalMH)) {
          dailyMH = totalMH;
        }
      }
      if (isNaN(dailyMH)) dailyMH = 0;
      dailyMH = Number(dailyMH.toFixed(3));

      const deviation = row['Deviation'] !== undefined ? row['Deviation'] : '';
      const desc = (row['P.J Description'] || row['Description'] || '').toString();

      if (desc.includes('MCU-Driven CDU strategy')) {
        duration = 5;
        dailyMH = 0.5;
      }

      let progressDisplay = '';
      if (row['Progress'] !== undefined && row['Progress'] !== null) {
        const rawP = String(row['Progress']).trim();
        if (rawP !== '') progressDisplay = rawP;
      }

      if (progressDisplay === '') {
        const s = (row['Status'] || '').toString().trim().toLowerCase();
        if (s === 'closed') progressDisplay = 'Completed';
        else if (s === 'processing') progressDisplay = 'In Progress';
        else if (s === 'pending') progressDisplay = 'Pending';
        else progressDisplay = '-';
      }

      return {
        owner,
        status: (row['Status'] || 'Unknown').toString().trim(),
        category: (row['Category'] || 'Other').toString().trim(),
        cluster: (row['Cluster'] || 'Other').toString().trim(),
        due,
        rev,
        isOnTime,
        desc,
        highlights,
        duration,
        deviation,
        dailyMH,
        progressDisplay,
        startMonthStr,
        endMonthStr,
        month: endMonthStr,
      } as ProjectItem;
    })
    .filter((item): item is ProjectItem => item !== null);
}

export function isDateOverlapping(d: ProjectItem, filterStart: string, filterEnd: string): boolean {
  if (filterStart === 'All' && filterEnd === 'All') return true;
  if (d.startMonthStr === 'Unknown' || d.endMonthStr === 'Unknown') return false;

  if (filterStart !== 'All' && d.endMonthStr < filterStart) return false;
  if (filterEnd !== 'All' && d.startMonthStr > filterEnd) return false;

  return true;
}

export function getStatusColor(status: string, palette: ThemeColors): string {
  const s = (status || '').toLowerCase();
  if (s === 'closed') return palette.positive;
  if (s === 'processing') return palette.blue;
  if (s === 'pending') return palette.negative;
  if (s === 'draft') return palette.accent;

  const pool = [palette.main, palette.sub, palette.accent, palette.blue, palette.positive, palette.negative];
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return pool[Math.abs(hash) % pool.length];
}

export function getCustomColor(name: string, palette: ThemeColors, customMap: Record<string, string> = {}): string {
  if (customMap[name]) return customMap[name];
  const pool = [palette.main, palette.sub, palette.accent, palette.blue, palette.positive, palette.negative];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return pool[Math.abs(hash) % pool.length];
}

export function getGenericPalette(count: number, palette: ThemeColors): string[] {
  const pool = [palette.main, palette.sub, palette.accent, palette.blue, palette.positive, palette.negative];
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[i % pool.length]);
  }
  return result;
}

export function exportWizSummaryCSV(wizData: ProjectItem[]) {
  if (wizData.length === 0) return false;

  const csvRows: string[][] = [];
  csvRows.push(["Project Name", "Duration (Days)", "Owner", "Status", "Category", "Cluster", "Deliverables", "Total Accumulated MH"]);

  wizData.forEach(d => {
    const totalMH = ((d.dailyMH || 0) * (d.duration || 0)).toFixed(1);
    const row = [
      d.desc,
      String(d.duration),
      d.owner,
      d.status,
      d.category,
      d.cluster,
      d.highlights ? d.highlights.replace(/[\r\n]+/g, ' ') : '',
      totalMH
    ].map(val => {
      const str = String(val || '').replace(/"/g, '""');
      return `"${str}"`;
    });
    csvRows.push(row);
  });

  const csvContent = csvRows.map(e => e.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Wiz_Summary_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function exportEvidenceCSV(data: ProjectItem[]) {
  if (data.length === 0) return false;

  const headers = ["Owner", "Description", "Status", "Progress", "Category", "Cluster", "Duration", "Deviation", "Revision 1", "On Time", "Highlights & Deliverables"];
  const rows = data.map(d => [
    d.owner,
    d.desc,
    d.status,
    d.progressDisplay,
    d.category,
    d.cluster,
    String(d.duration),
    String(d.deviation),
    formatDate(d.rev),
    d.isOnTime ? "Yes" : "No",
    d.highlights ? d.highlights.replace(/[\r\n]+/g, ' ') : ''
  ].map(val => `"${String(val || '').replace(/"/g, '""')}"`));

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Evidence_List_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function exportColorMarkdown(colors: Record<string, string>) {
  const mdContent = `# Annual Assessment Dashboard - Custom Color Profile
> Exported on: ${new Date().toLocaleDateString()}

## 1. Backgrounds & Borders
* **Page Background:** \`${colors.bg?.toUpperCase() || ''}\`
* **Card Background:** \`${colors.card?.toUpperCase() || ''}\`
* **Border Color:** \`${colors.border?.toUpperCase() || ''}\`

## 2. Typography
* **Main Text:** \`${colors.textMain?.toUpperCase() || ''}\`
* **Sub/Label Text:** \`${colors.textSub?.toUpperCase() || ''}\`
* **Link/Highlight Text:** \`${colors.blue?.toUpperCase() || ''}\`

## 3. Brand & Chart Palette
* **Chart Base (Brand Main):** \`${colors.main?.toUpperCase() || ''}\`
* **Chart Color 2 (Brand Sub):** \`${colors.sub?.toUpperCase() || ''}\`
* **Chart Color 3 (Accent/Gold):** \`${colors.accent?.toUpperCase() || ''}\`

## 4. Status Indication
* **Positive (Green):** \`${colors.positive?.toUpperCase() || ''}\`
* **Negative (Red):** \`${colors.negative?.toUpperCase() || ''}\`
`;
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dashboard_Color_Profile_${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateAndDownloadHTMLReport(
  rawData: ProjectItem[],
  ganttFilters: FilterState,
  lang: 'en' | 'zh'
) {
  const t = TEXT[lang];
  let wizData = rawData.filter(d => {
    if (!matchesFilterValue(d.owner, ganttFilters.owner)) return false;
    if (!matchesFilterValue(d.status, ganttFilters.status)) return false;
    if (!matchesFilterValue(d.category, ganttFilters.category)) return false;
    if (!matchesFilterValue(d.cluster, ganttFilters.cluster)) return false;
    if (!isDateOverlapping(d, ganttFilters.startMonth, ganttFilters.endMonth)) return false;
    return true;
  });

  if (wizData.length === 0) {
    return false;
  }

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
    const pStart = pEnd - ((dur - 1) * 86400000);

    const effectiveStart = Math.max(pStart, startBound);
    const effectiveEnd = Math.min(pEnd, endBound);

    let overlapDays = 0;
    if (effectiveStart <= effectiveEnd) {
      overlapDays = Math.floor((effectiveEnd - effectiveStart) / 86400000) + 1;
      overlapDays = Math.min(overlapDays, dur);
    }

    const boundedMH = overlapDays > 0 ? (d.dailyMH || 0) * overlapDays : 0;
    return { ...d, boundedMH };
  }).filter(d => d.boundedMH > 0);

  wizData = strictWizData;
  const totalPeriodMH = wizData.reduce((acc, d) => acc + (d.boundedMH || 0), 0);

  const categoryMap: Record<string, { mh: number; projects: { desc: string; mh: number }[] }> = {};
  wizData.forEach(d => {
    const cat = d.category || (lang === 'en' ? 'Uncategorized' : '未分類');
    const mh = d.boundedMH || 0;
    if (!categoryMap[cat]) categoryMap[cat] = { mh: 0, projects: [] };
    categoryMap[cat].mh += mh;
    categoryMap[cat].projects.push({ desc: d.desc, mh });
  });

  const categorySummary = Object.keys(categoryMap).map(cat => {
    const data = categoryMap[cat];
    return {
      category: cat,
      mh: data.mh,
      pct: totalPeriodMH > 0 ? (data.mh / totalPeriodMH) * 100 : 0,
      projects: data.projects.sort((a, b) => b.mh - a.mh)
    };
  }).sort((a, b) => b.mh - a.mh);

  const projectSummary = [...wizData].map(d => {
    const mh = d.boundedMH || 0;
    return { ...d, totalMh: mh, pct: totalPeriodMH > 0 ? (mh / totalPeriodMH) * 100 : 0 };
  }).sort((a, b) => b.totalMh - a.totalMh);

  const top3Projects = projectSummary.slice(0, 3);
  const top3MhSum = top3Projects.reduce((sum, p) => sum + p.totalMh, 0);
  const top3Pct = totalPeriodMH > 0 ? Math.round((top3MhSum / totalPeriodMH) * 100) : 0;
  const ownerLabel = formatFilterDisplay(ganttFilters.owner, lang === 'en' ? 'the team' : '團隊');
  const ownerTarget = ownerLabel;
  const topProjName = top3Projects.length > 0 ? top3Projects[0].desc : 'N/A';

  const delayedProjects = projectSummary.filter(p => !p.isOnTime);

  const actionRequired = projectSummary.filter(p => {
    const highlight = (p.highlights || '').trim().toLowerCase();
    const progress = (p.progressDisplay || '').trim().toLowerCase();
    const isHEmpty = highlight.length < 3 || highlight === 'tbd' || highlight === 'n/a';
    const isPEmpty = progress === '-' || progress === '';
    return isHEmpty || isPEmpty;
  });

  const riskRegex = /(issue|support|risk|abnormal|remind|warning|blocker|urgent|critical|attention|delay|fail|問題|支援|風險|提醒|異常|注意|緊急|阻礙|協助|瓶頸|求救|延遲|失敗)/i;
  const highlightedProjects = projectSummary.filter(p => {
    const combinedText = ((p.desc || '') + ' ' + (p.progressDisplay || '') + ' ' + (p.highlights || '')).toLowerCase();
    return riskRegex.test(combinedText);
  });

  const reportTitle = lang === 'en' ? "Project Diagnostic Report" : "專案診斷報告";
  const sec1Title = lang === 'en' ? "1. Summary by Category" : "1. 類別貢獻摘要";
  const sec1Desc = lang === 'en' ? "Distribution of total working hours mapped against major strategic categories." : "反映目前產能在主要戰略類別上的資源分佈。";
  const sec2Title = lang === 'en' ? "2. Workload Highlight Summary" : "2. 工作負載亮點與執行摘要";

  const narrativeIntro = lang === 'en'
    ? `<strong>${top3Pct}%</strong> of ${ownerTarget}'s capacity in this period is concentrated on these top ${top3Projects.length} projects, primarily focusing on delivering <strong>${topProjName}</strong>.`
    : `在此期間內，${ownerTarget} 有高達 <strong>${top3Pct}%</strong> 的產能集中於這 ${top3Projects.length} 個關鍵專案，主要聚焦於交付 <strong>${topProjName}</strong>。`;

  const sec3Title = lang === 'en' ? "3. Goal Oriented Report (Action Required)" : "3. 目標導向行動清單 (需更新)";
  const sec3Desc = lang === 'en'
    ? "The following projects lack concrete deliverables or progress updates. To maintain strict goal-oriented alignment, please update the source data immediately."
    : "以下專案缺乏具體的交付物或進度說明。為確保專案符合目標導向管理，請負責人盡速回歸系統更新資料。";

  const emptyDataRow = lang === 'en' ? "No data to display." : "無資料可顯示。";

  let contextText = '';
  if (lang === 'en') {
    contextText = `Across the selected period, total resource allocation is <strong style="color: #1495CC;">${totalPeriodMH.toFixed(1)}h</strong>. <strong>${top3Pct}%</strong> of ${ownerTarget}'s capacity is concentrated on the top ${top3Projects.length} projects (primarily delivering <strong>${topProjName}</strong>).`;
  } else {
    contextText = `在選定期間內，總資源配置為 <strong style="color: #1495CC;">${totalPeriodMH.toFixed(1)}h</strong>。${ownerTarget} 有高達 <strong>${top3Pct}%</strong> 的產能集中於前 ${top3Projects.length} 大專案（主要交付 <strong>${topProjName}</strong>）。`;
  }

  const scheduleText = delayedProjects.length > 0
    ? t.wizDiagScheduleBad + delayedProjects.map(p => `<strong>[${p.desc}]</strong>`).join(', ')
    : t.wizDiagScheduleGood;

  const qualityText = actionRequired.length > 0
    ? t.wizDiagQualityBad + actionRequired.map(p => `<strong>[${p.desc}]</strong>`).join(', ')
    : t.wizDiagQualityGood;

  const highlightText = highlightedProjects.length > 0
    ? t.wizDiagHighlightBad + highlightedProjects.map(p => `<strong>[${p.desc}]</strong>`).join(', ')
    : t.wizDiagHighlightGood;

  const htmlContent = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
    <style>
        html { font-size: 112.5%; }
        body { font-family: 'Microsoft JhengHei UI', Quicksand, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 40px; -webkit-font-smoothing: antialiased; letter-spacing: 0.015em; line-height: 1.2; }
        p, li { line-height: 1.2; }
        .card { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 24px; border: 1px solid #e2e8f0; }
        .bar-bg { background-color: #e2e8f0; border-radius: 999px; height: 8px; width: 100%; overflow: hidden; margin-top: 6px; }
        .bar-fill { height: 100%; background-color: #1495cc; border-radius: 999px; }
        .tag { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11.5px; font-weight: bold; background: #f1f5f9; color: #475569; }
        @media print { 
            body { padding: 0; background: white; font-size: 100%; } 
            .no-print { display: none !important; } 
            .card { box-shadow: none; border: 1px solid #cbd5e1; page-break-inside: avoid; } 
            .page-break { page-break-before: always; }
        }
    </style>
</head>
<body>
    <div class="max-w-5xl mx-auto">
        <div class="flex justify-between items-end border-b-2 border-slate-800 pb-6 mb-8">
            <div>
                <h1 class="text-3xl font-bold tracking-tight text-slate-800"><i class="fa-solid fa-file-invoice mr-3 text-blue-600"></i>${reportTitle}</h1>
                <div class="flex gap-4 mt-3 text-sm font-semibold text-slate-500">
                    <span><i class="fa-solid fa-user mr-1"></i> ${t.owner}: <span class="text-slate-800">${formatFilterDisplay(ganttFilters.owner, 'All')}</span></span>
                    <span><i class="fa-solid fa-calendar mr-1"></i> Period: <span class="text-slate-800">${ganttFilters.startMonth} ~ ${ganttFilters.endMonth}</span></span>
                    <span><i class="fa-solid fa-clock mr-1"></i> Generated: <span class="text-slate-800">${new Date().toLocaleString()}</span></span>
                </div>
            </div>
            <button onclick="window.print()" class="no-print px-5 py-2.5 rounded shadow text-white font-bold transition-all hover:opacity-90 flex items-center gap-2 bg-blue-600">
                <i class="fa-solid fa-print"></i> Print PDF
            </button>
        </div>

        <div class="card border-t-4 border-blue-600" style="background-color: #f0f9ff;">
            <h2 class="text-xl font-bold mb-4" style="color: #0369a1;"><i class="fa-solid fa-stethoscope mr-2"></i>${t.wizMhBriefTitle}</h2>
            <div class="space-y-4">
                <div class="bg-white p-4 rounded border border-blue-100 shadow-sm">
                    <h3 class="text-sm font-bold text-blue-800 mb-1"><i class="fa-solid fa-layer-group mr-1"></i>${t.wizDiagContextTitle}</h3>
                    <p class="text-[14.5px] text-slate-700 leading-[1.2]">${contextText}</p>
                </div>
                <div class="bg-white p-4 rounded border ${delayedProjects.length > 0 ? 'border-rose-200' : 'border-emerald-200'} shadow-sm">
                    <h3 class="text-sm font-bold ${delayedProjects.length > 0 ? 'text-rose-700' : 'text-emerald-700'} mb-1"><i class="fa-solid fa-calendar-check mr-1"></i>${t.wizDiagScheduleTitle}</h3>
                    <p class="text-[14.5px] text-slate-700 leading-[1.2]">${scheduleText}</p>
                </div>
                <div class="bg-white p-4 rounded border ${actionRequired.length > 0 ? 'border-orange-200' : 'border-emerald-200'} shadow-sm">
                    <h3 class="text-sm font-bold ${actionRequired.length > 0 ? 'text-orange-700' : 'text-emerald-700'} mb-1"><i class="fa-solid fa-magnifying-glass-chart mr-1"></i>${t.wizDiagQualityTitle}</h3>
                    <p class="text-[14.5px] text-slate-700 leading-[1.2]">${qualityText}</p>
                </div>
                <div class="bg-white p-4 rounded border ${highlightedProjects.length > 0 ? 'border-amber-200' : 'border-emerald-200'} shadow-sm">
                    <h3 class="text-sm font-bold ${highlightedProjects.length > 0 ? 'text-amber-700' : 'text-emerald-700'} mb-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${t.wizDiagHighlightTitle}</h3>
                    <p class="text-[14.5px] text-slate-700 leading-[1.2]">${highlightText}</p>
                </div>
            </div>
        </div>
        
        <div class="card border-t-4 border-blue-600">
            <h2 class="text-xl font-bold mb-2 text-slate-800">${sec1Title}</h2>
            <p class="text-sm text-slate-500 mb-6 leading-[1.2]">${sec1Desc}</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                ${categorySummary.length > 0 ? categorySummary.map(c => `
                    <div>
                        <div class="flex justify-between items-end mb-1">
                            <span class="font-bold text-slate-700 text-lg leading-[1.2]">${c.category}</span>
                            <span class="font-bold text-blue-600 leading-[1.2]">${c.pct.toFixed(0)}% <span class="text-xs text-slate-400 font-normal">(${c.mh.toFixed(1)}h)</span></span>
                        </div>
                        <div class="bar-bg mb-3"><div class="bar-fill" style="width: ${c.pct}%;"></div></div>
                        <ul class="list-disc pl-5 text-[13px] text-slate-600 space-y-1">
                            ${c.projects.slice(0, 4).map(p => `<li><span class="font-medium text-slate-800">${p.desc}</span> <span class="text-slate-400 ml-1">(${p.mh.toFixed(1)}h)</span></li>`).join('')}
                            ${c.projects.length > 4 ? `<li class="text-blue-500 italic font-semibold">... and ${c.projects.length - 4} more projects</li>` : ''}
                        </ul>
                    </div>
                `).join('') : `<p class="text-slate-500 leading-[1.2]">${emptyDataRow}</p>`}
            </div>
        </div>

        <div class="card border-t-4 border-teal-500">
            <h2 class="text-xl font-bold mb-2 text-slate-800">${sec2Title}</h2>
            <p class="text-[14.5px] text-slate-600 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200 leading-[1.2]">
                <i class="fa-solid fa-lightbulb text-yellow-500 mr-2"></i>${narrativeIntro}
            </p>
            
            <div class="space-y-6">
                ${top3Projects.length > 0 ? top3Projects.map((p, idx) => `
                    <div class="border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="font-bold text-lg text-slate-800 leading-[1.2]"><span class="text-teal-600 mr-2">#${idx + 1}</span>${p.desc}</h3>
                            <div class="text-right">
                                <span class="block font-bold text-teal-600 text-lg leading-[1.2]">${p.totalMh.toFixed(1)}h</span>
                                <span class="block text-xs font-semibold text-slate-400 leading-[1.2]">${p.pct.toFixed(0)}% of total</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2 mb-4">
                            <span class="tag"><i class="fa-solid fa-layer-group mr-1"></i>${p.category}</span>
                            <span class="tag"><i class="fa-solid fa-user mr-1"></i>${p.owner}</span>
                            <span class="tag ${p.status.toLowerCase() === 'closed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}"><i class="fa-solid fa-spinner mr-1"></i>${p.status}</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                            <div>
                                <h4 class="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Current Progress</h4>
                                <p class="text-[14px] text-slate-700 font-medium leading-[1.2]">${p.progressDisplay || 'No progress recorded.'}</p>
                            </div>
                            <div>
                                <h4 class="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Key Deliverables</h4>
                                <p class="text-[14px] text-slate-700 font-medium leading-[1.2]">${p.highlights || '<span class="italic text-red-400">Missing specific deliverables</span>'}</p>
                            </div>
                        </div>
                    </div>
                `).join('') : `<p class="text-slate-500 leading-[1.2]">${emptyDataRow}</p>`}
            </div>
        </div>

        <div class="card border-t-4 border-rose-500 page-break">
            <h2 class="text-xl font-bold mb-2 text-rose-700"><i class="fa-solid fa-triangle-exclamation mr-2"></i>${sec3Title}</h2>
            <p class="text-[14px] text-slate-600 mb-6 leading-[1.2]">${sec3Desc}</p>
            
            ${actionRequired.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse border border-slate-200 rounded-lg overflow-hidden">
                        <thead class="bg-rose-50 border-b border-slate-200">
                            <tr>
                                <th class="p-3 text-xs font-bold text-rose-800 uppercase">Project Name</th>
                                <th class="p-3 text-xs font-bold text-rose-800 uppercase">Owner</th>
                                <th class="p-3 text-xs font-bold text-rose-800 uppercase">Missing Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${actionRequired.map(p => {
                              const highlight = (p.highlights || '').trim().toLowerCase();
                              const progress = (p.progressDisplay || '').trim().toLowerCase();
                              const isHEmpty = highlight.length < 3 || highlight === 'tbd' || highlight === 'n/a';
                              const isPEmpty = progress === '-' || progress === '';

                              let missingTags = [];
                              if (isHEmpty) missingTags.push('<span class="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold mr-2">Deliverables</span>');
                              if (isPEmpty) missingTags.push('<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">Progress</span>');

                              return `
                                <tr class="border-b border-slate-100 hover:bg-slate-50">
                                    <td class="p-3 text-[13.5px] font-semibold text-slate-700 leading-[1.2]">${p.desc}</td>
                                    <td class="p-3 text-[13px] text-slate-600 leading-[1.2]">${p.owner}</td>
                                    <td class="p-3 leading-[1.2]">${missingTags.join('')}</td>
                                </tr>
                            `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div class="flex items-center justify-center p-8 bg-green-50 rounded-lg border border-green-200">
                    <p class="text-green-700 font-bold text-lg leading-[1.2]"><i class="fa-solid fa-check-circle mr-2 text-2xl"></i>All active projects have properly documented deliverables and progress. Excellent alignment!</p>
                </div>
            `}
        </div>

        <div class="text-center text-xs text-slate-400 font-semibold mt-8 mb-4">
            &copy; ${new Date().getFullYear()} Annual Assessment System - V9.62 Diagnostic Engine
        </div>
    </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Diagnostic_Report_${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
