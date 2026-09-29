import React, { useState, useMemo } from 'react';
import { ProjectItem, ThemeColors, Language, FilterState } from '../types';
import { formatBullets, shortName } from '../utils/dataProcessor';

interface WeeklyComprehensiveReportProps {
  wizData: ProjectItem[];
  rawData: ProjectItem[];
  palette: ThemeColors;
  lang: Language;
  ganttFilters: FilterState;
  periodText: string;
  onBackToColumns: () => void;
}

type PeriodMode = 'chosen' | 'current_week' | 'prev_week' | 'next_week' | 'all';
type SectionTab = 'all' | 'spotlight' | 'duedate' | 'progress' | 'execution' | 'deliverables';

export const WeeklyComprehensiveReport: React.FC<WeeklyComprehensiveReportProps> = ({
  wizData,
  rawData,
  palette,
  lang,
  ganttFilters,
  periodText,
  onBackToColumns,
}) => {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('chosen');
  const [activeTab, setActiveTab] = useState<SectionTab>('all');
  const [copied, setCopied] = useState(false);

  // Time boundaries for week calculations
  const now = useMemo(() => new Date(), []);
  const todayTime = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  // Current week: Monday 00:00 to Sunday 23:59:59
  const weekBounds = useMemo(() => {
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const startCurr = startOfWeek.getTime();
    const endCurr = startCurr + 6 * 86400000 + 86399999;

    const startPrev = startCurr - 7 * 86400000;
    const endPrev = startPrev + 6 * 86400000 + 86399999;

    const startNext = startCurr + 7 * 86400000;
    const endNext = startNext + 6 * 86400000 + 86399999;

    return {
      curr: { start: startCurr, end: endCurr },
      prev: { start: startPrev, end: endPrev },
      next: { start: startNext, end: endNext },
    };
  }, [now]);

  const formatDateRange = (st: number, en: number) => {
    const s = new Date(st);
    const e = new Date(en);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(s.getMonth() + 1)}/${pad(s.getDate())} - ${pad(e.getMonth() + 1)}/${pad(e.getDate())}`;
  };

  // Filter tasks based on selected period mode
  const activeReportData = useMemo(() => {
    const baseList = periodMode === 'all' ? rawData : wizData;

    if (periodMode === 'chosen' || periodMode === 'all') {
      return baseList;
    }

    let targetRange = weekBounds.curr;
    if (periodMode === 'prev_week') targetRange = weekBounds.prev;
    if (periodMode === 'next_week') targetRange = weekBounds.next;

    return baseList.filter(d => {
      const end = d.rev || d.due;
      if (!end) return false;
      const dur = Math.max(1, d.duration || 1);
      const pEnd = end.getTime();
      const pStart = pEnd - (dur - 1) * 86400000;
      return pStart <= targetRange.end && pEnd >= targetRange.start;
    });
  }, [periodMode, rawData, wizData, weekBounds]);

  const currentPeriodLabel = useMemo(() => {
    switch (periodMode) {
      case 'chosen':
        return `${lang === 'en' ? 'Chosen Period' : '選定篩選期間'}: ${periodText}`;
      case 'current_week':
        return `${lang === 'en' ? 'Current Week' : '本週'}: ${formatDateRange(weekBounds.curr.start, weekBounds.curr.end)}`;
      case 'prev_week':
        return `${lang === 'en' ? 'Previous Week' : '上週'}: ${formatDateRange(weekBounds.prev.start, weekBounds.prev.end)}`;
      case 'next_week':
        return `${lang === 'en' ? 'Next Week' : '下週'}: ${formatDateRange(weekBounds.next.start, weekBounds.next.end)}`;
      case 'all':
        return lang === 'en' ? 'All Loaded Period' : '全部專案期間';
    }
  }, [periodMode, periodText, weekBounds, lang]);

  // Task date helper
  const getTaskDates = (task: ProjectItem) => {
    const end = task.rev || task.due;
    if (!end) return 'TBD';
    const dur = Math.max(1, task.duration || 1);
    const startLocal = new Date(end.getTime());
    startLocal.setDate(startLocal.getDate() - (dur - 1));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(startLocal.getMonth() + 1)}/${pad(startLocal.getDate())} ~ ${pad(end.getMonth() + 1)}/${pad(end.getDate())}`;
  };

  // Section 1: Due Date Check calculations
  const dueDateAnalysis = useMemo(() => {
    const delayed: (ProjectItem & { delayDays: number; reason: string })[] = [];
    const upcoming: (ProjectItem & { daysRemaining: number })[] = [];
    const onSchedule: ProjectItem[] = [];

    activeReportData.forEach(d => {
      const end = d.rev || d.due;
      if (!end) return;

      const isClosed = d.status.toLowerCase() === 'closed';
      const endTime = end.getTime();
      const hasRevDelay = Boolean(d.rev && d.due && d.rev.getTime() > d.due.getTime());
      const isPastDue = endTime < todayTime && !isClosed;

      if (hasRevDelay || isPastDue) {
        let delayDays = 0;
        let reason = '';
        if (hasRevDelay && d.due && d.rev) {
          delayDays = Math.ceil((d.rev.getTime() - d.due.getTime()) / 86400000);
          reason = lang === 'en' ? `Revised date exceeds original by ${delayDays}d` : `修訂日較原定延遲 ${delayDays} 天`;
        } else if (isPastDue) {
          delayDays = Math.ceil((todayTime - endTime) / 86400000);
          reason = lang === 'en' ? `Past due by ${delayDays}d without completion` : `已逾期 ${delayDays} 天且未結案`;
        }
        delayed.push({ ...d, delayDays: Math.max(1, delayDays), reason });
      } else if (!isClosed && endTime >= todayTime && endTime <= todayTime + 14 * 86400000) {
        const daysRemaining = Math.max(0, Math.ceil((endTime - todayTime) / 86400000));
        upcoming.push({ ...d, daysRemaining });
      } else {
        onSchedule.push(d);
      }
    });

    const total = activeReportData.length;
    const onTimeRate = total > 0 ? Math.round(((total - delayed.length) / total) * 100) : 100;

    return { delayed, upcoming, onSchedule, onTimeRate, total };
  }, [activeReportData, todayTime, lang]);

  // Section 2: Progress Update calculations
  const progressAnalysis = useMemo(() => {
    const closed = activeReportData.filter(d => d.status.toLowerCase() === 'closed');
    const processing = activeReportData.filter(d => d.status.toLowerCase() === 'processing');
    const pending = activeReportData.filter(d => d.status.toLowerCase() === 'pending');
    const other = activeReportData.filter(d => {
      const s = d.status.toLowerCase();
      return s !== 'closed' && s !== 'processing' && s !== 'pending';
    });

    const total = activeReportData.length;
    const closedPct = total > 0 ? Math.round((closed.length / total) * 100) : 0;
    const procPct = total > 0 ? Math.round((processing.length / total) * 100) : 0;
    const pendPct = total > 0 ? Math.round((pending.length / total) * 100) : 0;

    return {
      closed,
      processing,
      pending,
      other,
      total,
      closedPct,
      procPct,
      pendPct,
    };
  }, [activeReportData]);

  // Section 3: Execution Plan & Workload calculations
  const executionAnalysis = useMemo(() => {
    let totalAccumMH = 0;
    const clusterMap: Record<string, { count: number; totalMH: number; projects: ProjectItem[] }> = {};
    const categoryMap: Record<string, { count: number; totalMH: number }> = {};
    const heavyProjects: (ProjectItem & { totalMH: number })[] = [];

    activeReportData.forEach(d => {
      const dur = Math.max(1, d.duration || 1);
      const dailyMH = d.dailyMH || 0;
      const projMH = Number((dur * dailyMH).toFixed(1));
      totalAccumMH += projMH;

      const cluster = d.cluster || (lang === 'en' ? 'Uncategorized' : '未分類');
      if (!clusterMap[cluster]) clusterMap[cluster] = { count: 0, totalMH: 0, projects: [] };
      clusterMap[cluster].count += 1;
      clusterMap[cluster].totalMH = Number((clusterMap[cluster].totalMH + projMH).toFixed(1));
      clusterMap[cluster].projects.push(d);

      const cat = d.category || (lang === 'en' ? 'Uncategorized' : '未分類');
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalMH: 0 };
      categoryMap[cat].count += 1;
      categoryMap[cat].totalMH = Number((categoryMap[cat].totalMH + projMH).toFixed(1));

      if (dailyMH >= 2.0 || projMH >= 15.0) {
        heavyProjects.push({ ...d, totalMH: projMH });
      }
    });

    const clusterRank = Object.entries(clusterMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalMH - a.totalMH);

    const categoryRank = Object.entries(categoryMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalMH - a.totalMH);

    heavyProjects.sort((a, b) => b.totalMH - a.totalMH);

    return {
      totalAccumMH: Number(totalAccumMH.toFixed(1)),
      clusterRank,
      categoryRank,
      heavyProjects,
    };
  }, [activeReportData, lang]);

  // Section 4: Deliverables Checklist calculations
  const deliverablesAnalysis = useMemo(() => {
    const withConcreteDeliverables: { item: ProjectItem; deliverables: string[] }[] = [];
    const missingDeliverables: ProjectItem[] = [];

    activeReportData.forEach(d => {
      const text = (d.highlights || '').trim();
      const isPlaceholder = !text || text.toLowerCase() === 'tbd' || text.toLowerCase() === 'n/a' || text.length < 3;

      if (isPlaceholder) {
        missingDeliverables.push(d);
      } else {
        const bullets = formatBullets(text);
        withConcreteDeliverables.push({ item: d, deliverables: bullets });
      }
    });

    return {
      withConcreteDeliverables,
      missingDeliverables,
      documentedRate: activeReportData.length > 0
        ? Math.round((withConcreteDeliverables.length / activeReportData.length) * 100)
        : 100,
    };
  }, [activeReportData]);

  // Section 5: Spotlight on Issues & Risks calculations
  const issueSpotlight = useMemo(() => {
    const riskRegex = /(issue|risk|blocker|blocked|support|waiting|abnormal|delay|failed|urgent|attention|bottleneck|crash|fail|bug|alert|pending review|clearance|依賴|阻塞|卡關|問題|支援|風險|異常|提醒|延遲|失敗|等待|求救|審核|瓶頸)/i;

    const riskKeywordItems: { item: ProjectItem; matchedKeywords: string[]; snippet: string }[] = [];

    activeReportData.forEach(d => {
      const combined = `${d.desc} ${d.progressDisplay} ${d.highlights}`;
      const match = combined.match(riskRegex);
      if (match) {
        const matches: string[] = [];
        const words = ['issue', 'risk', 'blocker', 'blocked', 'support', 'waiting', 'delay', 'failed', 'urgent', 'bottleneck', '問題', '風險', '延遲', '異常', '阻塞', '支援', '卡關', '瓶頸'];
        words.forEach(w => {
          if (new RegExp(w, 'i').test(combined)) {
            matches.push(w);
          }
        });

        // Extract relevant sentence snippet
        let snippet = d.highlights || d.progressDisplay || d.desc;
        if (d.highlights && riskRegex.test(d.highlights)) {
          snippet = d.highlights;
        } else if (d.progressDisplay && riskRegex.test(d.progressDisplay)) {
          snippet = d.progressDisplay;
        }

        riskKeywordItems.push({
          item: d,
          matchedKeywords: [...new Set(matches)],
          snippet,
        });
      }
    });

    const delayedIssues = dueDateAnalysis.delayed;
    const missingDeliverableIssues = deliverablesAnalysis.missingDeliverables.filter(d => d.status.toLowerCase() !== 'closed');
    const heavyLoadIssues = executionAnalysis.heavyProjects;

    const totalIssuesCount =
      delayedIssues.length +
      riskKeywordItems.length +
      missingDeliverableIssues.length;

    return {
      delayedIssues,
      riskKeywordItems,
      missingDeliverableIssues,
      heavyLoadIssues,
      totalIssuesCount,
    };
  }, [activeReportData, dueDateAnalysis.delayed, deliverablesAnalysis.missingDeliverables, executionAnalysis.heavyProjects]);

  // Actionable recommendations generator
  const recommendations = useMemo(() => {
    const recs: { title: string; desc: string; type: 'urgent' | 'warning' | 'info'; icon: string }[] = [];

    if (issueSpotlight.delayedIssues.length > 0) {
      const sampleNames = issueSpotlight.delayedIssues.slice(0, 2).map(p => `"${shortName(p.desc, 30)}"`).join(', ');
      recs.push({
        title: lang === 'en' ? 'Expedite Overdue Projects' : '加速處理落後逾期專案',
        desc: lang === 'en'
          ? `Immediate schedule realignment required for ${issueSpotlight.delayedIssues.length} projects (${sampleNames}). Coordinate with owners to reset target revisions or unblock deliverables.`
          : `需立即針對 ${issueSpotlight.delayedIssues.length} 項專案（如：${sampleNames}）進行時程重排或跨部門協調，確保交付物儘速落地。`,
        type: 'urgent',
        icon: 'fa-solid fa-triangle-exclamation',
      });
    }

    if (issueSpotlight.riskKeywordItems.length > 0) {
      recs.push({
        title: lang === 'en' ? 'Address Active Blockers & Dependencies' : '排除待支援與阻礙卡點',
        desc: lang === 'en'
          ? `${issueSpotlight.riskKeywordItems.length} projects have explicitly flagged external dependencies, clearances, or risk keywords. Convene a 15-minute triage with stakeholders.`
          : `有 ${issueSpotlight.riskKeywordItems.length} 項專案明列外部審查、權限或技術風險。建議主管召集 15 分鐘專案快會以迅速掃除障礙。`,
        type: 'warning',
        icon: 'fa-solid fa-shield-halved',
      });
    }

    if (issueSpotlight.missingDeliverableIssues.length > 0) {
      recs.push({
        title: lang === 'en' ? 'Document Missing Deliverables' : '補齊交付物與成果規格',
        desc: lang === 'en'
          ? `${issueSpotlight.missingDeliverableIssues.length} active projects have empty or "TBD" deliverables. Enforce deliverables clarity for year-end evidence validation.`
          : `尚有 ${issueSpotlight.missingDeliverableIssues.length} 項執行中專案尚未填寫具體交付物。建議負責人儘速補齊具體產出規格以利年度考核佐證。`,
        type: 'info',
        icon: 'fa-solid fa-file-pen',
      });
    }

    if (executionAnalysis.totalAccumMH > 40) {
      recs.push({
        title: lang === 'en' ? 'Resource Balancing Across Clusters' : '群組產能負載均衡調配',
        desc: lang === 'en'
          ? `High accumulated volume (${executionAnalysis.totalAccumMH} MH). Validate that individual daily bandwidth remains capped below 5.0 MH/d to allow strategic buffer.`
          : `選定期間累積工作量達 ${executionAnalysis.totalAccumMH} 工時。需注意確保每日個人總負載低於法定 5.0 MH/d 警戒線，以預留創新試錯緩衝。`,
        type: 'info',
        icon: 'fa-solid fa-scale-balanced',
      });
    }

    if (recs.length === 0) {
      recs.push({
        title: lang === 'en' ? 'Operations Healthy' : '整體運作健全穩定',
        desc: lang === 'en'
          ? 'All projects in this period are on track with clear deliverables and no detected schedule risks.'
          : '本週期內所有專案時程皆依規劃推進，交付物明確且未偵測到異常風險。',
        type: 'info',
        icon: 'fa-solid fa-circle-check',
      });
    }

    return recs;
  }, [issueSpotlight, executionAnalysis, lang]);

  // Export report to Markdown
  const generateMarkdownReport = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    let md = `# ${lang === 'en' ? 'Comprehensive Period & Weekly Assessment Report' : '週期與每週專案綜合評估報告'}\n\n`;
    md += `**${lang === 'en' ? 'Generated Date' : '產出日期'}:** ${todayStr}\n`;
    md += `**${lang === 'en' ? 'Target Audit Period' : '稽核期間'}:** ${currentPeriodLabel}\n`;
    md += `**${lang === 'en' ? 'Total Analyzed Projects' : '納入專案總數'}:** ${activeReportData.length}\n`;
    md += `**${lang === 'en' ? 'On-Time Compliance' : '到期日準時遵從率'}:** ${dueDateAnalysis.onTimeRate}%\n`;
    md += `**${lang === 'en' ? 'Total Planned Effort' : '累計計畫工時'}:** ${executionAnalysis.totalAccumMH} MH\n\n`;
    md += `---\n\n`;

    // Spotlight section
    md += `## 🚨 ${lang === 'en' ? 'Spotlight: Critical Issues & Highlights' : '焦點關注：異常與風險亮點'} (${issueSpotlight.totalIssuesCount})\n\n`;
    if (issueSpotlight.delayedIssues.length > 0) {
      md += `### 🔴 ${lang === 'en' ? 'Overdue / Schedule Slippage' : '時程延遲與逾期專案'} (${issueSpotlight.delayedIssues.length})\n`;
      issueSpotlight.delayedIssues.forEach(d => {
        md += `- **[${d.owner}] ${d.desc}**: ${d.reason} (Due: ${d.due ? d.due.toISOString().split('T')[0] : 'N/A'}, Rev: ${d.rev ? d.rev.toISOString().split('T')[0] : 'N/A'})\n`;
      });
      md += `\n`;
    }

    if (issueSpotlight.riskKeywordItems.length > 0) {
      md += `### ⚠️ ${lang === 'en' ? 'Blockers, Dependencies & Flagged Risks' : '待支援障礙與標示風險'} (${issueSpotlight.riskKeywordItems.length})\n`;
      issueSpotlight.riskKeywordItems.forEach(r => {
        md += `- **[${r.item.owner}] ${r.item.desc}**: [${r.matchedKeywords.join(', ')}] ${r.snippet}\n`;
      });
      md += `\n`;
    }

    if (issueSpotlight.missingDeliverableIssues.length > 0) {
      md += `### 📝 ${lang === 'en' ? 'Missing Deliverables Warning' : '未定義具體交付物警示'} (${issueSpotlight.missingDeliverableIssues.length})\n`;
      issueSpotlight.missingDeliverableIssues.forEach(m => {
        md += `- **[${m.owner}] ${m.desc}** (${m.status})\n`;
      });
      md += `\n`;
    }

    // Due-Date Check
    md += `## 📅 ${lang === 'en' ? '1. Due-Date Check & Timeliness Audit' : '一、到期日檢核與時程遵從度'}\n\n`;
    md += `- **${lang === 'en' ? 'On-Schedule Tasks' : '準時推進中專案'}:** ${dueDateAnalysis.onSchedule.length}\n`;
    md += `- **${lang === 'en' ? 'Approaching Deadline (Next 14 Days)' : '未來 14 天內即將到期'}:** ${dueDateAnalysis.upcoming.length}\n`;
    md += `- **${lang === 'en' ? 'Overdue / Delayed Tasks' : '已落後 / 逾期專案'}:** ${dueDateAnalysis.delayed.length}\n\n`;

    // Progress Update
    md += `## 📈 ${lang === 'en' ? '2. Progress Update & Milestone Achievement' : '二、進度更新與達成率'}\n\n`;
    md += `- **${lang === 'en' ? 'Completed (Closed)' : '已結案'}:** ${progressAnalysis.closed.length} (${progressAnalysis.closedPct}%)\n`;
    md += `- **${lang === 'en' ? 'In Progress (Processing)' : '執行中'}:** ${progressAnalysis.processing.length} (${progressAnalysis.procPct}%)\n`;
    md += `- **${lang === 'en' ? 'Pending / Blocked' : '待處理 / 暫停'}:** ${progressAnalysis.pending.length} (${progressAnalysis.pendPct}%)\n\n`;

    // Execution Plan
    md += `## ⚙️ ${lang === 'en' ? '3. Execution Plan & Resource Loading' : '三、執行計畫與工時配置'}\n\n`;
    md += `- **${lang === 'en' ? 'Total Period Workload' : '期間總投入工時'}:** ${executionAnalysis.totalAccumMH} MH\n`;
    md += `- **${lang === 'en' ? 'Top Effort Clusters' : '工時前幾大群組'}:**\n`;
    executionAnalysis.clusterRank.slice(0, 4).forEach(c => {
      md += `  - ${c.name}: ${c.totalMH} MH (${c.count} items)\n`;
    });
    md += `\n`;

    // Deliverables
    md += `## 📦 ${lang === 'en' ? '4. Deliverables Checklist' : '四、交付物盤點與產出成果'}\n\n`;
    deliverablesAnalysis.withConcreteDeliverables.slice(0, 8).forEach(w => {
      md += `- **${w.item.desc}** (${w.item.owner}):\n`;
      w.deliverables.forEach(b => {
        md += `  * ${b}\n`;
      });
    });
    md += `\n---\n`;
    md += `*Generated automatically by Annual Assessment Dashboard*\n`;

    return md;
  };

  const handleCopy = () => {
    const md = generateMarkdownReport();
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownReport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comprehensive_report_${periodMode}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full space-y-4 animate-fadeIn">
      {/* Top Action Toolbar */}
      <div
        className="p-3 rounded-lg border shadow-sm flex flex-wrap items-center justify-between gap-3 bg-white"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: 'var(--brand-main)' }}
          >
            <i className="fa-solid fa-file-waveform text-sm"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm leading-[1.2]" style={{ color: 'var(--text-main)' }}>
                {lang === 'en' ? 'Comprehensive Assessment Report' : '週期與每週綜合評估報告'}
              </h4>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded shadow-xs text-white"
                style={{ backgroundColor: 'var(--brand-accent)', color: '#1A1A1A' }}
              >
                {lang === 'en' ? 'Full Audit' : '深度稽核'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-[1.2]">
              {lang === 'en'
                ? 'Comprehensive check on Due-Dates, Progress, Execution Plans, Deliverables & Issue Spotlights'
                : '深度稽核到期日、進度更新、執行計畫、交付物盤點與異常風險亮點'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copy Report */}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 shadow-sm hover:opacity-85"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)', backgroundColor: 'var(--card-bg)' }}
            title={lang === 'en' ? 'Copy Markdown Summary' : '複製 Markdown 格式摘要'}
          >
            <i className={copied ? 'fa-solid fa-check text-emerald-500' : 'fa-regular fa-copy'}></i>
            <span>{copied ? (lang === 'en' ? 'Copied!' : '已複製！') : (lang === 'en' ? 'Copy' : '複製')}</span>
          </button>

          {/* Export Markdown */}
          <button
            onClick={handleDownloadMarkdown}
            className="px-2.5 py-1 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 shadow-sm hover:opacity-85"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-main)', backgroundColor: 'var(--card-bg)' }}
            title={lang === 'en' ? 'Download Markdown File' : '下載 Markdown 檔案'}
          >
            <i className="fa-solid fa-file-arrow-down"></i>
            <span>{lang === 'en' ? 'Export .md' : '匯出 .md'}</span>
          </button>

          {/* Return to standard columns button */}
          <button
            onClick={onBackToColumns}
            className="px-3 py-1 text-xs font-bold rounded shadow-sm flex items-center gap-1.5 transition-all text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--brand-main)' }}
          >
            <i className="fa-solid fa-table-columns"></i>
            <span>{lang === 'en' ? 'Weekly Columns View' : '返回三週欄位'}</span>
          </button>
        </div>
      </div>

      {/* Period Selection Bar */}
      <div
        className="p-2.5 rounded-lg border shadow-xs flex flex-wrap items-center justify-between gap-3"
        style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <i className="fa-regular fa-calendar-check text-blue-500"></i>
            {lang === 'en' ? 'Audit Period:' : '稽核期間基準:'}
          </span>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setPeriodMode('chosen')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition-all shadow-xs flex items-center gap-1 ${
                periodMode === 'chosen' ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
              style={periodMode === 'chosen' ? { backgroundColor: 'var(--brand-text)' } : {}}
            >
              <i className="fa-solid fa-bullseye text-[10px]"></i>
              <span>{lang === 'en' ? 'Chosen Period' : '選定篩選期間'}</span>
              <span className="text-[10px] font-normal opacity-90">({periodText})</span>
            </button>

            <button
              onClick={() => setPeriodMode('current_week')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition-all shadow-xs flex items-center gap-1 ${
                periodMode === 'current_week' ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
              style={periodMode === 'current_week' ? { backgroundColor: 'var(--brand-main)' } : {}}
            >
              <i className="fa-solid fa-calendar-day text-[10px]"></i>
              <span>{lang === 'en' ? 'Current Week' : '本週'}</span>
              <span className="text-[10px] font-normal opacity-90">({formatDateRange(weekBounds.curr.start, weekBounds.curr.end)})</span>
            </button>

            <button
              onClick={() => setPeriodMode('prev_week')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all shadow-xs flex items-center gap-1 ${
                periodMode === 'prev_week' ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
              style={periodMode === 'prev_week' ? { backgroundColor: 'var(--brand-main)' } : {}}
            >
              <i className="fa-solid fa-backward-step text-[10px]"></i>
              <span>{lang === 'en' ? 'Prev Week' : '上週'}</span>
            </button>

            <button
              onClick={() => setPeriodMode('next_week')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all shadow-xs flex items-center gap-1 ${
                periodMode === 'next_week' ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
              style={periodMode === 'next_week' ? { backgroundColor: 'var(--brand-main)' } : {}}
            >
              <i className="fa-solid fa-forward-step text-[10px]"></i>
              <span>{lang === 'en' ? 'Next Week' : '下週'}</span>
            </button>

            <button
              onClick={() => setPeriodMode('all')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all shadow-xs flex items-center gap-1 ${
                periodMode === 'all' ? 'text-white' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
              }`}
              style={periodMode === 'all' ? { backgroundColor: 'var(--brand-sub)' } : {}}
            >
              <i className="fa-solid fa-globe text-[10px]"></i>
              <span>{lang === 'en' ? 'All Period' : '全部'}</span>
            </button>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          <span>{lang === 'en' ? 'Filtered Projects:' : '納入分析專案:'} </span>
          <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
            {activeReportData.length} items
          </span>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Due-Date Compliance */}
        <div className="bg-white p-3 rounded-lg border shadow-xs flex flex-col justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase text-slate-500">
              {lang === 'en' ? 'Due-Date Compliance' : '到期遵從度'}
            </span>
            <i className={`fa-solid fa-calendar-check text-xs ${dueDateAnalysis.onTimeRate >= 85 ? 'text-emerald-500' : 'text-rose-500'}`}></i>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-800">{dueDateAnalysis.onTimeRate}%</span>
            <span className="text-[10px] text-slate-500">
              ({activeReportData.length - dueDateAnalysis.delayed.length}/{activeReportData.length})
            </span>
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1">
            {dueDateAnalysis.delayed.length > 0 ? (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                {dueDateAnalysis.delayed.length} {lang === 'en' ? 'tasks delayed' : '項延遲/落後'}
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">{lang === 'en' ? '100% on schedule' : '時程 100% 遵從'}</span>
            )}
          </div>
        </div>

        {/* Progress Completion Rate */}
        <div className="bg-white p-3 rounded-lg border shadow-xs flex flex-col justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase text-slate-500">
              {lang === 'en' ? 'Completion Rate' : '專案結案率'}
            </span>
            <i className="fa-solid fa-chart-pie text-xs text-blue-500"></i>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-800">{progressAnalysis.closedPct}%</span>
            <span className="text-[10px] text-slate-500">({progressAnalysis.closed.length} Closed)</span>
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-blue-600 font-semibold">{progressAnalysis.processing.length} In Progress</span>
            <span>•</span>
            <span className="text-amber-600 font-semibold">{progressAnalysis.pending.length} Pending</span>
          </div>
        </div>

        {/* Total Planned Workload */}
        <div className="bg-white p-3 rounded-lg border shadow-xs flex flex-col justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase text-slate-500">
              {lang === 'en' ? 'Planned Effort' : '累計規劃工時'}
            </span>
            <i className="fa-solid fa-clock text-xs text-amber-500"></i>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-800">{executionAnalysis.totalAccumMH}</span>
            <span className="text-[11px] font-bold text-slate-500">MH</span>
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1">
            <span>
              {lang === 'en' ? 'Across ' : '涵蓋 '}
              <b>{executionAnalysis.clusterRank.length}</b> {lang === 'en' ? 'Clusters' : '大群組'}
            </span>
          </div>
        </div>

        {/* Deliverables Rate */}
        <div className="bg-white p-3 rounded-lg border shadow-xs flex flex-col justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase text-slate-500">
              {lang === 'en' ? 'Deliverable Quality' : '交付物完整率'}
            </span>
            <i className="fa-solid fa-box-archive text-xs text-emerald-500"></i>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-800">{deliverablesAnalysis.documentedRate}%</span>
            <span className="text-[10px] text-slate-500">
              ({deliverablesAnalysis.withConcreteDeliverables.length}/{activeReportData.length})
            </span>
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1">
            {deliverablesAnalysis.missingDeliverables.length > 0 ? (
              <span className="text-amber-600 font-semibold">
                {deliverablesAnalysis.missingDeliverables.length} {lang === 'en' ? 'need documentation' : '待補齊產出'}
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">{lang === 'en' ? 'All documented' : '產出皆已完整'}</span>
            )}
          </div>
        </div>

        {/* Spotlight Issues Count */}
        <div
          className="bg-white p-3 rounded-lg border shadow-xs flex flex-col justify-between col-span-2 md:col-span-1"
          style={{ borderColor: issueSpotlight.totalIssuesCount > 0 ? 'var(--brand-negative)' : 'var(--border-color)' }}
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase text-slate-500">
              {lang === 'en' ? 'Spotlight Issues' : '異常亮點統計'}
            </span>
            <i className={`fa-solid fa-bullseye text-xs ${issueSpotlight.totalIssuesCount > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`}></i>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-black ${issueSpotlight.totalIssuesCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {issueSpotlight.totalIssuesCount}
            </span>
            <span className="text-[10px] text-slate-500">{lang === 'en' ? 'items flagged' : '項待關注重點'}</span>
          </div>
          <div className="text-[10.5px] mt-1 font-semibold text-rose-600 truncate">
            {issueSpotlight.totalIssuesCount > 0
              ? `${issueSpotlight.delayedIssues.length} Delayed, ${issueSpotlight.riskKeywordItems.length} Risks`
              : (lang === 'en' ? 'No active blockers' : '無異常卡點')}
          </div>
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex items-center gap-1 border-b pb-1 overflow-x-auto custom-scrollbar" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-b-2 text-blue-600 bg-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-transparent'
          }`}
          style={activeTab === 'all' ? { borderColor: 'var(--brand-main)', color: 'var(--brand-text)' } : {}}
        >
          <i className="fa-solid fa-list-check"></i>
          <span>{lang === 'en' ? 'All Sections' : '全覽報告'}</span>
        </button>

        <button
          onClick={() => setActiveTab('spotlight')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'spotlight'
              ? 'border-b-2 text-rose-600 bg-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-transparent'
          }`}
          style={activeTab === 'spotlight' ? { borderColor: 'var(--brand-negative)', color: 'var(--brand-negative)' } : {}}
        >
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>{lang === 'en' ? 'Issues Spotlight' : '異常亮點聚焦'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
            {issueSpotlight.totalIssuesCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('duedate')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'duedate'
              ? 'border-b-2 text-blue-600 bg-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-transparent'
          }`}
          style={activeTab === 'duedate' ? { borderColor: 'var(--brand-main)', color: 'var(--brand-text)' } : {}}
        >
          <i className="fa-regular fa-calendar-check"></i>
          <span>{lang === 'en' ? 'Due-Date Check' : '到期日檢核'}</span>
        </button>

        <button
          onClick={() => setActiveTab('progress')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'progress'
              ? 'border-b-2 text-blue-600 bg-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-transparent'
          }`}
          style={activeTab === 'progress' ? { borderColor: 'var(--brand-main)', color: 'var(--brand-text)' } : {}}
        >
          <i className="fa-solid fa-spinner"></i>
          <span>{lang === 'en' ? 'Progress Update' : '進度更新'}</span>
        </button>

        <button
          onClick={() => setActiveTab('execution')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'execution'
              ? 'border-b-2 text-blue-600 bg-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-transparent'
          }`}
          style={activeTab === 'execution' ? { borderColor: 'var(--brand-main)', color: 'var(--brand-text)' } : {}}
        >
          <i className="fa-solid fa-diagram-project"></i>
          <span>{lang === 'en' ? 'Execution Plan' : '執行計畫'}</span>
        </button>

        <button
          onClick={() => setActiveTab('deliverables')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'deliverables'
              ? 'border-b-2 text-blue-600 bg-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-transparent'
          }`}
          style={activeTab === 'deliverables' ? { borderColor: 'var(--brand-main)', color: 'var(--brand-text)' } : {}}
        >
          <i className="fa-solid fa-box-archive"></i>
          <span>{lang === 'en' ? 'Deliverables' : '交付物成果'}</span>
        </button>
      </div>

      {/* Main Report Body Container */}
      <div className="space-y-6 pb-2">
        {/* SPOTLIGHT ON ISSUES HIGHLIGHTS SECTION */}
        {(activeTab === 'all' || activeTab === 'spotlight') && (
          <section
            className="p-4 rounded-xl border-2 shadow-sm bg-white relative overflow-hidden"
            style={{ borderColor: issueSpotlight.totalIssuesCount > 0 ? '#E11D48' : 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">
                  <i className="fa-solid fa-bullseye"></i>
                </div>
                <h4 className="font-bold text-[14px] text-slate-800 leading-[1.2]">
                  {lang === 'en' ? 'Spotlight on Critical Issues & Risk Highlights' : '異常亮點聚焦與風險檢視'}
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {issueSpotlight.totalIssuesCount} {lang === 'en' ? 'Items Flagged' : '項待關注'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {lang === 'en' ? 'Prioritized for Weekly Sync' : '優先聚焦檢討項目'}
              </span>
            </div>

            {issueSpotlight.totalIssuesCount === 0 ? (
              <div className="p-4 text-center bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs font-semibold">
                <i className="fa-solid fa-circle-check text-lg mb-1 block text-emerald-500"></i>
                {lang === 'en'
                  ? 'All projects are proceeding smoothly without schedule slippage, risk triggers, or missing deliverables.'
                  : '太棒了！本週期內未發現任何逾期落後、風險卡關或缺乏交付物之專案。'}
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Schedule Slip & Overdue Deadline Spotlight */}
                {issueSpotlight.delayedIssues.length > 0 && (
                  <div>
                    <h5 className="font-bold text-xs text-rose-700 flex items-center gap-1.5 mb-2">
                      <i className="fa-solid fa-clock-rotate-left"></i>
                      <span>{lang === 'en' ? 'Schedule Delay & Overdue Deadlines' : '到期日落後與時程延遲亮點'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 font-extrabold">
                        {issueSpotlight.delayedIssues.length}
                      </span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {issueSpotlight.delayedIssues.map((p, idx) => (
                        <div
                          key={`delayed-${idx}`}
                          className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/40 flex flex-col justify-between text-xs"
                        >
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="font-bold text-slate-800 leading-[1.2]">
                                {idx + 1}. {p.desc}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold text-[10px] whitespace-nowrap flex-shrink-0">
                                +{p.delayDays}d slip
                              </span>
                            </div>
                            <p className="text-[11px] text-rose-800 font-medium mb-1">
                              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                              {p.reason}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-1 border-t border-rose-100">
                            <span className="font-semibold text-slate-600">
                              <i className="fa-regular fa-user mr-1"></i> {p.owner}
                            </span>
                            <span>
                              Due: {p.due ? p.due.toISOString().split('T')[0] : 'N/A'} → Rev: {p.rev ? p.rev.toISOString().split('T')[0] : 'N/A'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Flagged Blockers & Risk Keywords */}
                {issueSpotlight.riskKeywordItems.length > 0 && (
                  <div>
                    <h5 className="font-bold text-xs text-amber-700 flex items-center gap-1.5 mb-2">
                      <i className="fa-solid fa-shield-halved"></i>
                      <span>{lang === 'en' ? 'Flagged Risks, Blockers & Support Needs' : '標示風險、阻塞卡點與跨部門支援'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 font-extrabold">
                        {issueSpotlight.riskKeywordItems.length}
                      </span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {issueSpotlight.riskKeywordItems.map((r, idx) => (
                        <div
                          key={`risk-${idx}`}
                          className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/40 flex flex-col justify-between text-xs"
                        >
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="font-bold text-slate-800 leading-[1.2]">
                                {r.item.desc}
                              </span>
                              <div className="flex gap-1 flex-wrap justify-end">
                                {r.matchedKeywords.slice(0, 2).map((k, kIdx) => (
                                  <span key={kIdx} className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[9px] uppercase">
                                    {k}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-700 bg-white p-1.5 rounded border border-amber-100 my-1 font-mono leading-[1.2]">
                              {shortName(r.snippet, 110)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-1 border-t border-amber-100">
                            <span>
                              <i className="fa-regular fa-user mr-1"></i> {r.item.owner}
                            </span>
                            <span className="font-semibold text-amber-700">
                              Status: {r.item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Missing Deliverables Warning */}
                {issueSpotlight.missingDeliverableIssues.length > 0 && (
                  <div>
                    <h5 className="font-bold text-xs text-slate-700 flex items-center gap-1.5 mb-2">
                      <i className="fa-solid fa-file-circle-question text-amber-500"></i>
                      <span>{lang === 'en' ? 'Missing Deliverables & Clarification Needed' : '待補齊產出與交付物說明'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-extrabold">
                        {issueSpotlight.missingDeliverableIssues.length}
                      </span>
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {issueSpotlight.missingDeliverableIssues.map((m, idx) => (
                        <div
                          key={`missing-${idx}`}
                          className="p-2 rounded border border-slate-200 bg-slate-50 text-[11px] flex items-center gap-2 flex-grow sm:flex-grow-0"
                        >
                          <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                          <span className="font-bold text-slate-800">{m.desc}</span>
                          <span className="text-slate-500">({m.owner})</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                            TBD
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Actionable Executive Recommendations */}
                <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                  <h6 className="font-bold text-xs text-blue-900 flex items-center gap-1.5 mb-2">
                    <i className="fa-solid fa-lightbulb text-amber-500"></i>
                    {lang === 'en' ? 'Actionable Executive Recommendations' : '建議採取行動與應對方案'}
                  </h6>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {recommendations.map((rec, rIdx) => (
                      <div key={rIdx} className="bg-white p-2.5 rounded border border-blue-100 shadow-2xs flex items-start gap-2">
                        <i className={`${rec.icon} mt-0.5 text-xs text-blue-600 flex-shrink-0`}></i>
                        <div>
                          <div className="font-bold text-[12px] text-slate-800 leading-[1.2]">{rec.title}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5 leading-[1.2]">{rec.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 1: DUE-DATE CHECK */}
        {(activeTab === 'all' || activeTab === 'duedate') && (
          <section className="p-4 rounded-xl border shadow-sm bg-white" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                  <i className="fa-regular fa-calendar-check"></i>
                </div>
                <h4 className="font-bold text-[14px] text-slate-800 leading-[1.2]">
                  {lang === 'en' ? '1. Due-Date Check & Timeliness Audit' : '一、到期日檢核與時程遵從度'}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {dueDateAnalysis.onTimeRate}% {lang === 'en' ? 'On-Time Rate' : '準時率'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              {lang === 'en'
                ? 'Compares original Due Date vs Revision 1, tracks schedule deviation days, and audits upcoming milestones.'
                : '稽核原始到期日 (Due Date) 與修訂日 (Revision 1) 之落差，分析時程延遲天數，掌握即將到期里程碑。'}
            </p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {activeReportData.map((d, idx) => {
                const end = d.rev || d.due;
                const dateStr = getTaskDates(d);
                const hasRevDelay = Boolean(d.rev && d.due && d.rev.getTime() > d.due.getTime());
                const isClosed = d.status.toLowerCase() === 'closed';
                const isPast = end ? end.getTime() < todayTime : false;
                const isDelayed = hasRevDelay || (isPast && !isClosed);

                let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                let badgeText = lang === 'en' ? 'On Schedule' : '準時推進';

                if (isDelayed) {
                  badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                  badgeText = lang === 'en' ? 'Delayed / Slip' : '時程落後';
                } else if (!isClosed && end && end.getTime() <= todayTime + 7 * 86400000) {
                  badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                  badgeText = lang === 'en' ? 'Due Soon' : '即將到期';
                }

                return (
                  <div
                    key={`duedate-row-${idx}`}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="font-bold text-slate-400 mt-0.5">{idx + 1}.</span>
                      <div>
                        <div className="font-bold text-slate-800 leading-[1.2]">{d.desc}</div>
                        <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-1 flex-wrap">
                          <span className="font-semibold text-slate-700">
                            <i className="fa-regular fa-user mr-0.5"></i> {d.owner}
                          </span>
                          <span>•</span>
                          <span>
                            <i className="fa-solid fa-layer-group mr-0.5"></i> {d.cluster}
                          </span>
                          <span>•</span>
                          <span>
                            <i className="fa-regular fa-calendar mr-0.5"></i> {dateStr}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      <div className="text-right text-[11px]">
                        <div className="font-mono text-slate-600">
                          Due: {d.due ? d.due.toISOString().split('T')[0] : 'N/A'}
                        </div>
                        {d.rev && (
                          <div className={`font-mono text-[10px] ${hasRevDelay ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            Rev: {d.rev.toISOString().split('T')[0]}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION 2: PROGRESS UPDATE */}
        {(activeTab === 'all' || activeTab === 'progress') && (
          <section className="p-4 rounded-xl border shadow-sm bg-white" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <i className="fa-solid fa-spinner"></i>
                </div>
                <h4 className="font-bold text-[14px] text-slate-800 leading-[1.2]">
                  {lang === 'en' ? '2. Progress Update & Milestone Velocity' : '二、進度更新與達成率'}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-emerald-600">{progressAnalysis.closed.length} Closed</span>
                <span>•</span>
                <span className="text-blue-600">{progressAnalysis.processing.length} Processing</span>
                <span>•</span>
                <span className="text-amber-600">{progressAnalysis.pending.length} Pending</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex mb-4 shadow-inner">
              <div
                style={{ width: `${progressAnalysis.closedPct}%`, backgroundColor: 'var(--brand-positive)' }}
                className="h-full transition-all duration-500"
                title={`Closed: ${progressAnalysis.closedPct}%`}
              ></div>
              <div
                style={{ width: `${progressAnalysis.procPct}%`, backgroundColor: 'var(--brand-main)' }}
                className="h-full transition-all duration-500"
                title={`Processing: ${progressAnalysis.procPct}%`}
              ></div>
              <div
                style={{ width: `${progressAnalysis.pendPct}%`, backgroundColor: 'var(--brand-accent)' }}
                className="h-full transition-all duration-500"
                title={`Pending: ${progressAnalysis.pendPct}%`}
              ></div>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {activeReportData.map((d, idx) => {
                const s = d.status.toLowerCase();
                let statusBg = 'bg-blue-100 text-blue-800';
                if (s === 'closed') statusBg = 'bg-emerald-100 text-emerald-800';
                if (s === 'pending') statusBg = 'bg-amber-100 text-amber-800';

                return (
                  <div
                    key={`prog-${idx}`}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-slate-800 leading-[1.2]">
                        {idx + 1}. {d.desc}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${statusBg}`}>
                        {d.status}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded border border-slate-200 text-[11.5px] text-slate-700 flex items-start gap-2">
                      <i className="fa-solid fa-bars-progress mt-0.5 text-blue-500 flex-shrink-0"></i>
                      <div className="flex-grow">
                        <span className="font-semibold text-slate-500 mr-1.5">{lang === 'en' ? 'Progress Note:' : '進度回報:'}</span>
                        <span>{d.progressDisplay || (lang === 'en' ? 'Normal execution in progress' : '依原定時程推進中')}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        {d.owner}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION 3: EXECUTION PLAN */}
        {(activeTab === 'all' || activeTab === 'execution') && (
          <section className="p-4 rounded-xl border shadow-sm bg-white" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
                  <i className="fa-solid fa-diagram-project"></i>
                </div>
                <h4 className="font-bold text-[14px] text-slate-800 leading-[1.2]">
                  {lang === 'en' ? '3. Execution Plan & Resource Loading' : '三、執行計畫與工時配置'}
                </h4>
              </div>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                {lang === 'en' ? 'Total' : '總工時'}: {executionAnalysis.totalAccumMH} MH
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Cluster allocation */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <h5 className="font-bold text-xs text-slate-700 mb-2 flex items-center justify-between">
                  <span>
                    <i className="fa-solid fa-layer-group text-blue-500 mr-1"></i>
                    {lang === 'en' ? 'Workload by Cluster' : '群組工作量分佈'}
                  </span>
                  <span className="text-[10px] text-slate-500">MH / Items</span>
                </h5>
                <div className="space-y-2">
                  {executionAnalysis.clusterRank.map((c, cIdx) => {
                    const pct = executionAnalysis.totalAccumMH > 0
                      ? Math.round((c.totalMH / executionAnalysis.totalAccumMH) * 100)
                      : 0;
                    return (
                      <div key={cIdx} className="text-xs">
                        <div className="flex justify-between font-semibold text-slate-700 mb-0.5">
                          <span>{c.name}</span>
                          <span className="font-mono text-[11px]">
                            {c.totalMH}h ({pct}%) • {c.count} items
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: 'var(--brand-main)' }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Statutory capacity reminder */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-xs text-slate-700 mb-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-scale-balanced text-amber-500"></i>
                    {lang === 'en' ? 'Capacity & Buffer Discipline' : '工時產能與留白紀律檢核'}
                  </h5>
                  <p className="text-[11px] text-slate-600 leading-[1.2] mt-1">
                    {lang === 'en'
                      ? 'Statutory maximum load is recommended at 5.0 MH/day to reserve buffer for planning, iterative testing, and innovation proposals.'
                      : '法定建議產能上限為每日 5.0 小時，為同仁預留前期規劃、試行部署與自主創新試錯之留白時段。'}
                  </p>
                </div>
                <div className="mt-3 p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">{lang === 'en' ? 'Heavy Projects (≥2.0 MH/d):' : '高耗能專案 (≥2.0 MH/d):'}</span>
                  <span className="font-bold text-amber-700">{executionAnalysis.heavyProjects.length} items</span>
                </div>
              </div>
            </div>

            {/* Execution Schedule Table */}
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
              {activeReportData.map((d, idx) => {
                const dur = Math.max(1, d.duration || 1);
                const dailyMH = d.dailyMH || 0;
                const totalMH = (dur * dailyMH).toFixed(1);
                const dateStr = getTaskDates(d);

                return (
                  <div
                    key={`exec-plan-${idx}`}
                    className="p-2 rounded border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 leading-[1.2]">
                        {idx + 1}. {d.desc}
                      </div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">
                        <span>{d.owner}</span> • <span>{d.cluster}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        {dateStr} ({dur}d)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 font-mono">
                        {dailyMH} MH/d
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-bold text-white font-mono shadow-xs"
                        style={{ backgroundColor: 'var(--brand-text)' }}
                      >
                        {totalMH} Total MH
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION 4: DELIVERABLES */}
        {(activeTab === 'all' || activeTab === 'deliverables') && (
          <section className="p-4 rounded-xl border shadow-sm bg-white" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                  <i className="fa-solid fa-box-archive"></i>
                </div>
                <h4 className="font-bold text-[14px] text-slate-800 leading-[1.2]">
                  {lang === 'en' ? '4. Deliverables Checklist & Tangible Outputs' : '四、交付物審查與具體成果盤點'}
                </h4>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {deliverablesAnalysis.documentedRate}% {lang === 'en' ? 'Documented' : '已登載完整'}
              </span>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
              {activeReportData.map((d, idx) => {
                const text = (d.highlights || '').trim();
                const isPlaceholder = !text || text.toLowerCase() === 'tbd' || text.toLowerCase() === 'n/a' || text.length < 3;
                const bullets = formatBullets(text);

                return (
                  <div
                    key={`deliv-${idx}`}
                    className={`p-3 rounded-lg border ${
                      isPlaceholder ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-slate-50/50'
                    } text-xs`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div>
                        <span className="font-bold text-slate-800 text-[13px] leading-[1.2]">
                          {idx + 1}. {d.desc}
                        </span>
                        <div className="text-[10.5px] text-slate-500 mt-0.5">
                          <span className="font-semibold">{d.owner}</span> • <span>{d.category}</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                          d.status.toLowerCase() === 'closed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {d.status.toLowerCase() === 'closed' ? (lang === 'en' ? 'Delivered' : '已交付') : (lang === 'en' ? 'In Production' : '產出中')}
                      </span>
                    </div>

                    {isPlaceholder ? (
                      <div className="p-2 rounded border border-dashed border-amber-300 bg-white text-amber-700 flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        <span>{lang === 'en' ? 'No concrete deliverable specified yet. Please document specific outcomes.' : '尚無具體交付物成果，建議負責人填寫明確產出。'}</span>
                      </div>
                    ) : (
                      <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
                        <ul className="space-y-1">
                          {bullets.map((b, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-2 text-slate-700 leading-[1.2]">
                              <i className="fa-solid fa-check text-emerald-500 text-[10px] mt-1 flex-shrink-0"></i>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Footer Return Button */}
      <div className="flex justify-center pt-2 pb-1">
        <button
          onClick={onBackToColumns}
          className="px-4 py-1.5 text-xs font-bold rounded-lg border shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all text-slate-700 bg-white"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>{lang === 'en' ? 'Back to Weekly 3-Column Summary' : '返回三週欄位工作負載摘要'}</span>
        </button>
      </div>
    </div>
  );
};
