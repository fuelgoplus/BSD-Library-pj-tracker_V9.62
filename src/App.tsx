import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ProjectItem, ThemeColors, ThemeName, Language, FilterState } from './types';
import { THEMES, INITIAL_SAMPLE_ROWS } from './constants/theme';
import { processData, isDateOverlapping } from './utils/dataProcessor';
import { Header } from './components/Header';
import { GanttChart } from './components/GanttChart';
import { WizSummary } from './components/WizSummary';
import { GlobalFilters } from './components/GlobalFilters';
import { KpiCards } from './components/KpiCards';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { EvidenceTable } from './components/EvidenceTable';
import { Modals } from './components/Modals';

export default function App() {
  const [currentThemeName, setCurrentThemeName] = useState<ThemeName>('slightGray');
  const [palette, setPalette] = useState<ThemeColors>(THEMES.slightGray);
  const [lang, setLang] = useState<Language>('en');

  const [rawData, setRawData] = useState<ProjectItem[]>(() => processData(INITIAL_SAMPLE_ROWS));
  const [fileStatus, setFileStatus] = useState<string>(`${INITIAL_SAMPLE_ROWS.length} records`);
  const [globalWorkbook, setGlobalWorkbook] = useState<any>(null);
  const [currentYear, setCurrentYear] = useState<string>('2026');

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    owner: 'All',
    status: 'All',
    category: 'All',
    cluster: 'All',
    startMonth: 'All',
    endMonth: 'All',
    search: '',
  });

  const [ganttFilters, setGanttFilters] = useState<FilterState>({
    owner: 'All',
    status: 'All',
    category: 'All',
    cluster: 'All',
    startMonth: 'All',
    endMonth: 'All',
  });

  const [isWizOpen, setIsWizOpen] = useState<boolean>(false);

  // Modals state
  const [dialog, setDialog] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: '',
  });
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isCustomColorOpen, setIsCustomColorOpen] = useState(false);

  const showNotice = (title: string, message: string) => {
    setDialog({ isOpen: true, title, message });
  };

  // Apply CSS variables whenever palette changes
  const applyPaletteToRoot = useCallback((t: ThemeColors) => {
    const root = document.documentElement;
    root.style.setProperty('--bg-color', t.bg);
    root.style.setProperty('--card-bg', t.card);
    root.style.setProperty('--text-main', t.textMain);
    root.style.setProperty('--text-sub', t.textSub);
    root.style.setProperty('--border-color', t.border);
    root.style.setProperty('--brand-main', t.main);
    root.style.setProperty('--brand-text', t.textBrand || t.main);
    root.style.setProperty('--brand-sub', t.sub);
    root.style.setProperty('--brand-positive', t.positive);
    root.style.setProperty('--brand-negative', t.negative);
    root.style.setProperty('--brand-accent', t.accent);
    root.style.setProperty('--text-blue', t.blue);
  }, []);

  const handleSelectTheme = (themeName: ThemeName) => {
    setCurrentThemeName(themeName);
    const newPal = THEMES[themeName];
    setPalette(newPal);
    applyPaletteToRoot(newPal);
  };

  const handleApplyCustomColors = (newColors: ThemeColors) => {
    setPalette(newColors);
    applyPaletteToRoot(newColors);
    setIsCustomColorOpen(false);
  };

  const handleToggleLang = () => {
    const nextLang = lang === 'en' ? 'zh' : 'en';
    setLang(nextLang);
    if (nextLang === 'zh') {
      document.body.style.fontFamily =
        "'Microsoft JhengHei UI', '微軟正黑體', 'PingFang TC', 'Quicksand', sans-serif";
    } else {
      document.body.style.fontFamily =
        "'Microsoft JhengHei UI', 'Quicksand', '微軟正黑體', sans-serif";
    }
  };

  // Derive unique months from raw data
  const months = useMemo(() => {
    return [...new Set(rawData.flatMap(d => [d.startMonthStr, d.endMonthStr]))]
      .filter(m => m !== 'Unknown')
      .sort();
  }, [rawData]);

  // Handle data loading helper
  const handleLoadData = useCallback((json: any[], sheetCountInfo?: string) => {
    const processed = processData(json);
    setRawData(processed);
    setFileStatus(sheetCountInfo || `${processed.length} records`);

    const availableMonths = [...new Set(processed.flatMap(d => [d.startMonthStr, d.endMonthStr]))]
      .filter(m => m !== 'Unknown')
      .sort();

    const now = new Date();
    const startM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const endM = `${now.getFullYear()}-12`;

    const gStart = availableMonths.includes(startM)
      ? startM
      : availableMonths.length > 0
      ? availableMonths[0]
      : 'All';
    const gEnd = availableMonths.includes(endM)
      ? endM
      : availableMonths.length > 0
      ? availableMonths[availableMonths.length - 1]
      : 'All';

    setGanttFilters({
      owner: 'All',
      status: 'All',
      category: 'All',
      cluster: 'All',
      startMonth: gStart,
      endMonth: gEnd,
    });

    setFilters({
      owner: 'All',
      status: 'All',
      category: 'All',
      cluster: 'All',
      startMonth: 'All',
      endMonth: 'All',
      search: '',
    });
  }, []);

  // Fetch initial Google Apps Script data if accessible
  useEffect(() => {
    applyPaletteToRoot(palette);

    const initialUrl =
      'https://script.google.com/macros/s/AKfycbww91fgTQIYG-dngmp0J8qe9-Nzt9QpG8qVCY7lWaYrV31CWJ8ZbqugPY8qTbAP2LKxRA/exec';

    const fetchGSheet = async () => {
      try {
        setFileStatus('Downloading...');
        const response = await fetch(initialUrl, { redirect: 'follow', mode: 'cors' });
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();

        if (data.SheetNames && data.Sheets) {
          const wb = {
            isGAS: true,
            SheetNames: data.SheetNames,
            Sheets: data.Sheets,
          };
          setGlobalWorkbook(wb);

          let chosenYear = '2026';
          let sheetName = '';
          if (wb.SheetNames.some((n: string) => n.includes('2026'))) {
            sheetName = wb.SheetNames.find((n: string) => n.includes('2026'));
            chosenYear = '2026';
          } else if (wb.SheetNames.some((n: string) => n.includes('2025'))) {
            sheetName = wb.SheetNames.find((n: string) => n.includes('2025'));
            chosenYear = '2025';
          } else {
            sheetName = wb.SheetNames[0];
          }

          setCurrentYear(chosenYear);
          handleLoadData(wb.Sheets[sheetName]);
        }
      } catch (err) {
        console.warn('Initial Google Sheet fetch fallback to seed records:', err);
        setFileStatus(`${INITIAL_SAMPLE_ROWS.length} records`);
      }
    };

    fetchGSheet();
  }, [applyPaletteToRoot, handleLoadData, palette]);

  // Switch sheet year
  const handleSwitchYear = (year: string) => {
    if (!globalWorkbook) return;
    setCurrentYear(year);
    let sheetName = globalWorkbook.SheetNames.find((n: string) => n.includes(year));
    if (!sheetName) sheetName = globalWorkbook.SheetNames[0];

    let json: any[];
    if (globalWorkbook.isGAS) {
      json = globalWorkbook.Sheets[sheetName];
    } else {
      const ws = globalWorkbook.Sheets[sheetName];
      json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    }
    handleLoadData(json);
  };

  // Local file upload handling (.xlsx, .xls, .csv)
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });

        setGlobalWorkbook({
          isGAS: false,
          SheetNames: wb.SheetNames,
          Sheets: wb.Sheets,
        });

        let chosenYear = '2026';
        let sheetName = '';
        if (wb.SheetNames.some(n => n.includes('2026'))) {
          sheetName = wb.SheetNames.find(n => n.includes('2026'))!;
          chosenYear = '2026';
        } else if (wb.SheetNames.some(n => n.includes('2025'))) {
          sheetName = wb.SheetNames.find(n => n.includes('2025'))!;
          chosenYear = '2025';
        } else {
          sheetName = wb.SheetNames[0];
        }

        setCurrentYear(chosenYear);
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        handleLoadData(json, `${file.name} (${json.length} items)`);
      } catch (err) {
        console.error('File parsing error:', err);
        showNotice('Upload Error', 'Failed to parse file. Please upload a valid .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Load custom Drive Web App URL
  const handleLoadDriveUrl = async (url: string) => {
    setIsDriveOpen(false);
    setFileStatus('Downloading...');
    try {
      const response = await fetch(url, { redirect: 'follow', mode: 'cors' });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      const wb = {
        isGAS: true,
        SheetNames: data.SheetNames,
        Sheets: data.Sheets,
      };
      setGlobalWorkbook(wb);

      let chosenYear = '2026';
      let sheetName = '';
      if (wb.SheetNames.some((n: string) => n.includes('2026'))) {
        sheetName = wb.SheetNames.find((n: string) => n.includes('2026'));
        chosenYear = '2026';
      } else if (wb.SheetNames.some((n: string) => n.includes('2025'))) {
        sheetName = wb.SheetNames.find((n: string) => n.includes('2025'));
        chosenYear = '2025';
      } else {
        sheetName = wb.SheetNames[0];
      }

      setCurrentYear(chosenYear);
      handleLoadData(wb.Sheets[sheetName]);
    } catch (error) {
      console.error(error);
      showNotice(
        'Connection Error',
        'Failed to load data.<br><br>Please verify your <b>Google Apps Script Web App URL</b> is correct and deployed with "Anyone" access to avoid CORS redirects.'
      );
      setFileStatus('Error loading link');
    }
  };

  // Filtered dataset for global KPIs & charts
  const filteredData = useMemo(() => {
    const q = (filters.search || '').toLowerCase().trim();
    return rawData.filter(d => {
      if (filters.owner !== 'All' && d.owner !== filters.owner) return false;
      if (filters.status !== 'All' && d.status !== filters.status) return false;
      if (filters.category !== 'All' && d.category !== filters.category) return false;
      if (filters.cluster !== 'All' && d.cluster !== filters.cluster) return false;
      if (!isDateOverlapping(d, filters.startMonth, filters.endMonth)) return false;
      if (q && !d.desc.toLowerCase().includes(q) && !d.owner.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rawData, filters]);

  const hasMultiYears = Boolean(
    globalWorkbook?.SheetNames &&
      (globalWorkbook.SheetNames.some((n: string) => n.includes('2025')) ||
        globalWorkbook.SheetNames.some((n: string) => n.includes('2026')))
  );

  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <Header
        currentTheme={currentThemeName}
        onSelectTheme={handleSelectTheme}
        onOpenCustomColorModal={() => setIsCustomColorOpen(true)}
        lang={lang}
        onToggleLang={handleToggleLang}
        hasMultiYears={hasMultiYears}
        currentYear={currentYear}
        onSwitchYear={handleSwitchYear}
        fileStatus={fileStatus}
        onFileUpload={handleFileUpload}
        onOpenDriveModal={() => setIsDriveOpen(true)}
      />

      {/* Main Dashboard Canvas */}
      <main className="max-w-[1600px] mx-auto px-6 pb-12 space-y-6">
        {/* Project Schedule (Gantt Chart) */}
        <GanttChart
          rawData={rawData}
          palette={palette}
          lang={lang}
          ganttFilters={ganttFilters}
          setGanttFilters={setGanttFilters}
          months={months}
          onToggleWiz={() => setIsWizOpen(prev => !prev)}
          isWizOpen={isWizOpen}
          onShowNotice={showNotice}
        />

        {/* AI Wiz Summary & Workload Module */}
        <WizSummary
          isOpen={isWizOpen}
          onClose={() => setIsWizOpen(false)}
          rawData={rawData}
          palette={palette}
          lang={lang}
          ganttFilters={ganttFilters}
        />

        {/* Global Filters */}
        <GlobalFilters
          rawData={rawData}
          filters={filters}
          setFilters={setFilters}
          months={months}
          lang={lang}
        />

        {/* KPI Cards */}
        <KpiCards filteredData={filteredData} lang={lang} />

        {/* Analytics & Distribution Charts */}
        <AnalyticsCharts filteredData={filteredData} palette={palette} lang={lang} />

        {/* Evidence List Table */}
        <EvidenceTable
          filteredData={filteredData}
          lang={lang}
          searchTerm={filters.search || ''}
          setSearchTerm={(term) => setFilters(prev => ({ ...prev, search: term }))}
          onShowNotice={showNotice}
        />
      </main>

      {/* Modals & Dialogs */}
      <Modals
        dialog={dialog}
        onCloseDialog={() => setDialog(prev => ({ ...prev, isOpen: false }))}
        isDriveOpen={isDriveOpen}
        onCloseDrive={() => setIsDriveOpen(false)}
        onLoadDrive={handleLoadDriveUrl}
        isCustomColorOpen={isCustomColorOpen}
        onCloseCustomColor={() => setIsCustomColorOpen(false)}
        currentPalette={palette}
        onApplyCustomColors={handleApplyCustomColors}
        lang={lang}
      />
    </div>
  );
}
