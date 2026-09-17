import React, { useRef } from 'react';
import { ThemeName, Language } from '../types';
import { TEXT } from '../constants/theme';
import { CioLogo } from './CioLogo';

interface HeaderProps {
  currentTheme: ThemeName;
  onSelectTheme: (theme: ThemeName) => void;
  onOpenCustomColorModal: () => void;
  lang: Language;
  onToggleLang: () => void;
  hasMultiYears: boolean;
  currentYear: string;
  onSwitchYear: (year: string) => void;
  fileStatus: string;
  onFileUpload: (file: File) => void;
  onOpenDriveModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTheme,
  onSelectTheme,
  onOpenCustomColorModal,
  lang,
  onToggleLang,
  hasMultiYears,
  currentYear,
  onSwitchYear,
  fileStatus,
  onFileUpload,
  onOpenDriveModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TEXT[lang];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <nav className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col xl:flex-row justify-between items-center gap-6">
      <div className="flex flex-col sm:flex-row items-center gap-6 w-full xl:w-auto">
        <CioLogo currentTheme={currentTheme} />
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <h1
            id="lblTitle"
            className="text-3xl font-bold tracking-tight transition-colors"
            style={{ color: 'var(--text-main)', fontFamily: "'Microsoft JhengHei UI', sans-serif" }}
          >
            {t.title}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p id="lblSubtitle" className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-sub)' }}>
              {t.subtitle}
            </p>
            <span
              className="px-2 py-0.5 text-[10px] font-bold rounded-md border shadow-sm"
              style={{
                backgroundColor: 'var(--card-bg)',
                color: 'var(--brand-text)',
                borderColor: 'var(--border-color)',
              }}
            >
              V9.62
            </span>
          </div>
        </div>
      </div>

      <div
        className="px-4 py-3 rounded-lg border shadow-sm flex flex-wrap items-center gap-4 w-full xl:w-auto justify-center sm:justify-end"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
      >
        {hasMultiYears && (
          <div id="yearSwitcher" className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-sub)' }}>
              Period:
            </span>
            <div className="flex rounded-md border" style={{ borderColor: 'var(--border-color)' }}>
              <button
                id="btnYear2025"
                onClick={() => onSwitchYear('2025')}
                className="px-3 py-1.5 text-xs font-semibold rounded-l hover:bg-gray-100 transition-colors"
                style={{
                  backgroundColor: currentYear === '2025' ? 'var(--brand-main)' : 'transparent',
                  color: currentYear === '2025' ? '#FFFFFF' : 'var(--text-main)',
                }}
              >
                2025
              </button>
              <button
                id="btnYear2026"
                onClick={() => onSwitchYear('2026')}
                className="px-3 py-1.5 text-xs font-semibold rounded-r hover:bg-gray-100 transition-colors"
                style={{
                  backgroundColor: currentYear === '2026' ? 'var(--brand-main)' : 'transparent',
                  color: currentYear === '2026' ? '#FFFFFF' : 'var(--text-main)',
                }}
              >
                2026
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border"
            style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
          >
            <button
              className={`icon-btn w-7 h-7 ${currentTheme === 'light' ? 'active' : ''}`}
              onClick={() => onSelectTheme('light')}
              title="Light (Cloud Dancer)"
            >
              <i className="fa-solid fa-sun text-xs"></i>
            </button>
            <button
              className={`icon-btn w-7 h-7 ${currentTheme === 'slightGray' ? 'active' : ''}`}
              onClick={() => onSelectTheme('slightGray')}
              title="Slight Gray"
            >
              <i className="fa-solid fa-cloud text-xs"></i>
            </button>
            <button
              className={`icon-btn w-7 h-7 ${currentTheme === 'dark' ? 'active' : ''}`}
              onClick={() => onSelectTheme('dark')}
              title="Nature Green (New)"
            >
              <i className="fa-solid fa-leaf text-xs"></i>
            </button>
            <button
              className={`icon-btn w-7 h-7 ${currentTheme === 'extraDark' ? 'active' : ''}`}
              onClick={() => onSelectTheme('extraDark')}
              title="Extra Dark (Night)"
            >
              <i className="fa-solid fa-moon text-xs"></i>
            </button>
            <button
              className={`icon-btn w-7 h-7 ${currentTheme === 'creative' ? 'active' : ''}`}
              onClick={() => onSelectTheme('creative')}
              title="Vibrant Artist (Updated)"
            >
              <i className="fa-solid fa-palette text-xs"></i>
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            <button
              className="icon-btn w-7 h-7"
              onClick={onOpenCustomColorModal}
              title="Custom Theme Settings"
            >
              <i className="fa-solid fa-sliders text-xs"></i>
            </button>
          </div>

          <button
            id="btnLang"
            className="lang-switch text-xs py-1.5 px-3 h-9 flex items-center justify-center font-semibold"
            onClick={onToggleLang}
          >
            <i className="fa-solid fa-globe mr-1"></i> EN / 繁中
          </button>
        </div>

        <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-sub)' }}></span>
          <span id="lblDataSource" className="text-xs font-semibold uppercase" style={{ color: 'var(--brand-text)' }}>
            {t.dataSource}
          </span>
        </div>

        <div className="h-6 w-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

        <label
          className="cursor-pointer flex items-center gap-2 hover:opacity-80 px-2 py-1.5 rounded transition"
          title="Upload Local File (.xlsx, .csv)"
        >
          <i className="fa-solid fa-file-upload" style={{ color: 'var(--brand-text)' }}></i>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
            Local
          </span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
        </label>

        <div className="h-4 w-px" style={{ backgroundColor: 'var(--border-color)' }}></div>

        <button
          onClick={onOpenDriveModal}
          className="cursor-pointer flex items-center gap-2 hover:opacity-80 px-2 py-1.5 rounded transition"
          title="Link Google Sheet"
        >
          <i className="fa-brands fa-google-drive" style={{ color: 'var(--brand-text)' }}></i>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
            Drive
          </span>
        </button>

        <span id="fileStatus" className="text-xs font-mono ml-2" style={{ color: 'var(--text-sub)' }}>
          {fileStatus}
        </span>
      </div>
    </nav>
  );
};
