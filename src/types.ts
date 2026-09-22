export interface ProjectItem {
  owner: string;
  status: string;
  category: string;
  cluster: string;
  due: Date | null;
  rev: Date | null;
  isOnTime: boolean;
  desc: string;
  highlights: string;
  duration: number;
  deviation: string | number;
  dailyMH: number;
  progressDisplay: string;
  startMonthStr: string;
  endMonthStr: string;
  month: string;
  boundedMH?: number;
}

export interface ThemeColors {
  bg: string;
  card: string;
  textMain: string;
  textSub: string;
  border: string;
  main: string;
  textBrand: string;
  sub: string;
  positive: string;
  negative: string;
  accent: string;
  blue: string;
}

export type ThemeName = 'light' | 'slightGray' | 'dark' | 'extraDark' | 'creative';
export type Language = 'en' | 'zh';

export type WizViewMode = 'project' | 'category' | 'weekly' | 'mh_breakdown' | 'tracking';
export type StatusDistMode = 'status' | 'category' | 'cluster';

export interface FilterState {
  owner: string | string[];
  status: string | string[];
  category: string | string[];
  cluster: string | string[];
  startMonth: string;
  endMonth: string;
  search?: string;
}
