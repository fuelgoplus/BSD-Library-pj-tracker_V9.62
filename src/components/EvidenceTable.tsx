import React, { useState } from 'react';
import { ProjectItem, Language } from '../types';
import { TEXT } from '../constants/theme';
import { formatDate, formatBullets, exportEvidenceCSV } from '../utils/dataProcessor';

interface EvidenceTableProps {
  filteredData: ProjectItem[];
  lang: Language;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onShowNotice: (title: string, msg: string) => void;
}

export const EvidenceTable: React.FC<EvidenceTableProps> = ({
  filteredData,
  lang,
  searchTerm,
  setSearchTerm,
  onShowNotice,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = TEXT[lang];

  const handleExport = () => {
    const success = exportEvidenceCSV(filteredData);
    if (!success) {
      onShowNotice(
        lang === 'en' ? 'Notice' : '提醒',
        lang === 'en' ? 'No data to export' : '沒有可匯出的資料'
      );
    }
  };

  return (
    <div className="dashboard-card flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div
          className="flex items-center gap-2 cursor-pointer select-none group"
          onClick={() => setIsOpen(prev => !prev)}
          title="Toggle Evidence List"
        >
          <h3
            id="lblEvidence"
            className="text-base font-bold group-hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-main)' }}
          >
            {t.evidence}
          </h3>
          <i
            className={`fa-solid ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-sm transition-transform duration-300`}
            style={{ color: 'var(--text-sub)' }}
          ></i>
        </div>
        <div className="flex gap-2">
          <input
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'en' ? 'Search...' : '搜尋...'}
            className="std-input w-48"
          />
          <button
            id="btnExport"
            onClick={handleExport}
            className="bg-white border px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity shadow-sm"
            style={{ borderColor: 'var(--border-color)', color: 'var(--brand-text)' }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="overflow-x-auto border rounded-lg max-h-[500px] transition-all custom-scrollbar"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <table className="w-full text-left border-collapse data-table">
            <thead className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: 'var(--card-bg)' }}>
              <tr>
                <th id="thOwner">{t.thOwner}</th>
                <th id="thDesc" style={{ minWidth: '450px' }}>
                  {t.thDesc}
                </th>
                <th id="thStatus">{t.thStatus}</th>
                <th id="thProgress">{t.thProgress}</th>
                <th id="thCategory">{t.thCategory}</th>
                <th id="thCluster">{t.thCluster}</th>
                <th id="thDuration">{t.thDuration}</th>
                <th id="thDeviation">{t.thDeviation}</th>
                <th id="thRev">{t.thRev}</th>
                <th id="thOnTime">{t.thOnTime}</th>
                <th id="thHighlights">{t.thHighlights}</th>
              </tr>
            </thead>
            <tbody id="tBody">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8" style={{ color: 'var(--text-sub)' }}>
                    {lang === 'en' ? 'No data loaded' : '無資料'}
                  </td>
                </tr>
              ) : (
                filteredData.slice(0, 500).map((d, index) => {
                  const s = d.status.toLowerCase();
                  let badgeStyle: React.CSSProperties = {
                    backgroundColor: 'var(--bg-color)',
                    color: 'var(--text-sub)',
                  };
                  if (s === 'closed') {
                    badgeStyle = {
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      color: 'var(--brand-positive)',
                      border: '1px solid var(--brand-positive)',
                    };
                  } else if (s === 'pending') {
                    badgeStyle = {
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      color: 'var(--brand-negative)',
                      border: '1px solid var(--brand-negative)',
                    };
                  } else if (s === 'processing') {
                    badgeStyle = {
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      color: 'var(--text-blue)',
                      border: '1px solid var(--text-blue)',
                    };
                  }

                  const devUnit = lang === 'en' ? 'days' : '天';
                  const devNum = parseFloat(String(d.deviation));
                  const devVal = d.deviation === undefined || d.deviation === '' ? '-' : `${d.deviation} ${devUnit}`;

                  let devStyle: React.CSSProperties = { color: 'var(--text-sub)' };
                  if (!isNaN(devNum)) {
                    if (devNum < 0) devStyle = { color: 'var(--brand-negative)', fontWeight: 'bold' };
                    else devStyle = { color: 'var(--text-blue)', fontWeight: 'bold' };
                  }

                  const bullets = formatBullets(d.highlights);
                  const progressBullets = formatBullets(d.progressDisplay);

                  return (
                    <tr key={`${d.desc}-${index}`} className="hover:bg-gray-50 transition-colors">
                      <td style={{ fontWeight: 500 }}>{d.owner}</td>
                      <td style={{ color: 'var(--text-sub)', minWidth: '450px', whiteSpace: 'normal' }}>
                        {d.desc}
                      </td>
                      <td>
                        <span className="px-2 py-1 rounded text-[10px] font-semibold" style={badgeStyle}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ minWidth: '150px', color: 'var(--text-main)', fontSize: '11px' }}>
                          {progressBullets.length <= 1 ? (
                            d.progressDisplay
                          ) : (
                            <ul className="hl-list">
                              {progressBullets.map((item, bIdx) => (
                                <li key={bIdx}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                      <td>{d.category}</td>
                      <td>{d.cluster}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-main)', fontWeight: 'bold' }}>
                        {d.duration}
                      </td>
                      <td style={{ fontFamily: 'monospace', ...devStyle }}>{devVal}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--brand-sub)' }}>{formatDate(d.rev)}</td>
                      <td className="text-center">
                        {d.isOnTime ? (
                          <span style={{ color: 'var(--brand-positive)', fontWeight: 'bold' }}>
                            <i className="fa-solid fa-check"></i>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--brand-negative)', fontWeight: 'bold' }}>
                            <i className="fa-solid fa-clock"></i>
                          </span>
                        )}
                      </td>
                      <td style={{ minWidth: '250px' }}>
                        {bullets.length <= 1 ? (
                          d.highlights || '-'
                        ) : (
                          <ul className="hl-list">
                            {bullets.map((item, bIdx) => (
                              <li key={bIdx}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
