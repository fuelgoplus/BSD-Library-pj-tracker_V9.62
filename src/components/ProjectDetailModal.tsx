import React, { useState, useEffect } from 'react';
import { ProjectItem, ThemeColors, Language } from '../types';
import { formatBullets } from '../utils/dataProcessor';

interface ProjectDetailModalProps {
  project: ProjectItem | null;
  onClose: () => void;
  palette: ThemeColors;
  lang: Language;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  onClose,
  palette,
  lang,
}) => {
  const [copied, setCopied] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!project) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayTime = now.getTime();

  const end = project.rev || project.due;
  const dur = Math.max(1, project.duration || 1);
  const pMH = project.dailyMH || 0;
  const totalMH = (dur * pMH).toFixed(1);

  let startDateStr = 'TBD';
  let endDateStr = 'TBD';
  if (end) {
    const startLocal = new Date(end.getTime());
    startLocal.setDate(startLocal.getDate() - (dur - 1));
    const pad = (n: number) => String(n).padStart(2, '0');
    startDateStr = `${startLocal.getFullYear()}-${pad(startLocal.getMonth() + 1)}-${pad(startLocal.getDate())}`;
    endDateStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  }

  const dueDateStr = project.due ? project.due.toISOString().split('T')[0] : 'N/A';
  const revDateStr = project.rev ? project.rev.toISOString().split('T')[0] : 'N/A';

  const isClosed = project.status.toLowerCase() === 'closed';
  const hasRevDelay = Boolean(project.rev && project.due && project.rev.getTime() > project.due.getTime());
  const isPastDue = end ? end.getTime() < todayTime && !isClosed : false;
  const isDelayed = hasRevDelay || isPastDue;

  let delayDays = 0;
  if (hasRevDelay && project.due && project.rev) {
    delayDays = Math.ceil((project.rev.getTime() - project.due.getTime()) / 86400000);
  } else if (isPastDue && end) {
    delayDays = Math.ceil((todayTime - end.getTime()) / 86400000);
  }

  const bullets = formatBullets(project.highlights);
  const isPlaceholder = !project.highlights ||
    project.highlights.trim().toLowerCase() === 'tbd' ||
    project.highlights.trim().toLowerCase() === 'n/a' ||
    project.highlights.trim().length < 3;

  const statusLower = project.status.toLowerCase();
  let statusBadgeBg = 'bg-blue-100 text-blue-800 border-blue-200';
  if (statusLower === 'closed') statusBadgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  else if (statusLower === 'pending') statusBadgeBg = 'bg-amber-100 text-amber-800 border-amber-200';

  const handleCopyMarkdown = () => {
    let md = `### Project Details: ${project.desc}\n\n`;
    md += `- **Owner:** ${project.owner}\n`;
    md += `- **Status:** ${project.status}\n`;
    md += `- **Category / Cluster:** ${project.category} / ${project.cluster}\n`;
    md += `- **Timeline:** ${startDateStr} ~ ${endDateStr} (${dur} days)\n`;
    md += `- **Due Date:** ${dueDateStr} | **Revision 1:** ${revDateStr}\n`;
    md += `- **Workload:** ${pMH} MH/d (Total: ${totalMH} MH)\n`;
    md += `- **Progress:** ${project.progressDisplay || 'N/A'}\n`;
    md += `- **Deliverables:**\n`;
    if (isPlaceholder) {
      md += `  * (Pending documentation)\n`;
    } else {
      bullets.forEach(b => {
        md += `  * ${b}\n`;
      });
    }

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] transition-all"
        style={{ borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="p-4 border-b flex justify-between items-start gap-3 bg-slate-50"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0 mt-0.5"
              style={{ backgroundColor: 'var(--brand-main)' }}
            >
              <i className="fa-solid fa-folder-tree text-base"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${statusBadgeBg}`}>
                  {project.status}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600">
                  <i className="fa-solid fa-layer-group text-slate-400 mr-1"></i>
                  {project.cluster}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600">
                  <i className="fa-solid fa-tag text-slate-400 mr-1"></i>
                  {project.category}
                </span>
              </div>
              <h3 className="font-bold text-base text-slate-900 leading-[1.3] break-words">
                {project.desc}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors flex-shrink-0"
            title={lang === 'en' ? 'Close' : '關閉'}
          >
            <i className="fa-solid fa-times text-base"></i>
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-sm">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Owner */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-[10.5px] font-bold uppercase text-slate-500 block mb-0.5">
                {lang === 'en' ? 'Owner' : '負責人'}
              </span>
              <span className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5">
                <i className="fa-regular fa-user text-blue-500 text-xs"></i>
                {project.owner}
              </span>
            </div>

            {/* Execution Duration */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-[10.5px] font-bold uppercase text-slate-500 block mb-0.5">
                {lang === 'en' ? 'Duration' : '執行天數'}
              </span>
              <span className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5">
                <i className="fa-regular fa-calendar-days text-amber-500 text-xs"></i>
                {dur} {lang === 'en' ? 'days' : '天'}
              </span>
            </div>

            {/* Daily MH Load */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-[10.5px] font-bold uppercase text-slate-500 block mb-0.5">
                {lang === 'en' ? 'Daily Bandwidth' : '每日工時'}
              </span>
              <span className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5 font-mono">
                <i className="fa-regular fa-clock text-purple-500 text-xs"></i>
                {pMH} MH/d
              </span>
            </div>

            {/* Total Accumulated MH */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-[10.5px] font-bold uppercase text-slate-500 block mb-0.5">
                {lang === 'en' ? 'Total Workload' : '累計總工時'}
              </span>
              <span className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5 font-mono">
                <i className="fa-solid fa-hourglass-half text-emerald-500 text-xs"></i>
                {totalMH} MH
              </span>
            </div>
          </div>

          {/* Timeline & Due Date Audit */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center justify-between border-b pb-2">
              <span className="flex items-center gap-1.5">
                <i className="fa-regular fa-calendar-check text-blue-500"></i>
                {lang === 'en' ? 'Schedule Timeline & Due Date Check' : '時程規劃與到期日檢核'}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                  isDelayed
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {isDelayed
                  ? (lang === 'en' ? `Delayed (${delayDays}d slip)` : `落後延遲 (${delayDays} 天)`)
                  : (lang === 'en' ? 'On Schedule' : '準時推進中')}
              </span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block mb-0.5">{lang === 'en' ? 'Execution Span:' : '執行區間:'}</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-200 block">
                  {startDateStr} ~ {endDateStr}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block mb-0.5">{lang === 'en' ? 'Original Due Date:' : '原始到期日 (Due Date):'}</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-200 block">
                  {dueDateStr}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block mb-0.5">{lang === 'en' ? 'Revision 1 Date:' : '修訂日 (Revision 1):'}</span>
                <span className={`font-mono font-bold px-2 py-1 rounded border block ${
                  hasRevDelay
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-50 text-slate-800 border-slate-200'
                }`}>
                  {revDateStr}
                </span>
              </div>
            </div>

            {project.deviation !== undefined && project.deviation !== '' && (
              <div className="text-[11.5px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 flex items-center justify-between">
                <span>{lang === 'en' ? 'Schedule Deviation Variance:' : '時程偏差量 (Deviation):'}</span>
                <span className="font-mono font-bold text-slate-800">{String(project.deviation)}</span>
              </div>
            )}
          </div>

          {/* Progress Status Update */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b pb-2">
              <i className="fa-solid fa-spinner text-blue-500"></i>
              {lang === 'en' ? 'Progress Status & Update' : '進度更新與現狀說明'}
            </h4>
            <div className="p-3 rounded bg-slate-50 border border-slate-200 text-[13px] text-slate-800 leading-[1.4]">
              {project.progressDisplay || (lang === 'en' ? 'No specific progress update notes recorded.' : '尚未記載額外進度說明。')}
            </div>
          </div>

          {/* Key Deliverables & Highlights */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs space-y-2.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center justify-between border-b pb-2">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-box-archive text-amber-500"></i>
                {lang === 'en' ? 'Key Highlights & Deliverables' : '重點成果與交付物盤點'}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {isPlaceholder ? 0 : bullets.length} {lang === 'en' ? 'deliverables' : '項產出'}
              </span>
            </h4>

            {isPlaceholder ? (
              <div className="p-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 text-amber-800 text-xs flex items-center gap-2.5">
                <i className="fa-solid fa-triangle-exclamation text-base text-amber-600 flex-shrink-0"></i>
                <div>
                  <span className="font-bold block">
                    {lang === 'en' ? 'Deliverables not yet specified' : '尚未登載具體交付物'}
                  </span>
                  <span className="text-[11px] opacity-90">
                    {lang === 'en'
                      ? 'Please ensure tangible outcomes, architecture specs, or test reports are documented for assessment.'
                      : '請負責人儘速補充具體規格、產出文件或驗收報告以供年度考核佐證。'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {bullets.map((b, bIdx) => (
                  <div
                    key={bIdx}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 flex items-start gap-2.5 text-xs"
                  >
                    <i className="fa-solid fa-circle-check text-emerald-500 text-xs mt-0.5 flex-shrink-0"></i>
                    <span className="font-medium text-slate-800 leading-[1.3]">{b}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          className="p-3 border-t bg-slate-50 flex justify-between items-center gap-2"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs"
            style={{ borderColor: 'var(--border-color)' }}
            title={lang === 'en' ? 'Copy Markdown Details' : '複製 Markdown 格式明細'}
          >
            <i className={copied ? 'fa-solid fa-check text-emerald-500' : 'fa-regular fa-copy'}></i>
            <span>{copied ? (lang === 'en' ? 'Copied Details!' : '已複製明細！') : (lang === 'en' ? 'Copy Details' : '複製明細')}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold rounded-lg text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--brand-main)' }}
          >
            {lang === 'en' ? 'Close' : '關閉'}
          </button>
        </div>
      </div>
    </div>
  );
};
