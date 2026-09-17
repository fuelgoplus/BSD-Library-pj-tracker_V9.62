import React from 'react';
import { ThemeName } from '../types';

interface CioLogoProps {
  currentTheme?: ThemeName;
  className?: string;
  height?: number | string;
}

export const CioLogo: React.FC<CioLogoProps> = ({
  currentTheme,
  className = 'h-[27px] sm:h-[33px] w-auto',
}) => {
  const isDark = currentTheme === 'extraDark';
  const rawBase = import.meta.env.BASE_URL || './';
  const base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
  const logoSrc = isDark ? `${base}/assets/cio-logo-dark.png?v=9.62` : `${base}/assets/cio-logo.png?v=9.62`;

  return (
    <div
      id="cioLogoWrapper"
      className="flex items-center justify-center flex-shrink-0 transition-transform duration-300 hover:scale-105 select-none"
      title="CIO Logo (RLITECH)"
    >
      <img
        id="cioLogoImg"
        src={logoSrc}
        alt="CIO Logo"
        className={`${className} max-w-none object-contain transition-opacity duration-200`}
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Fallback to SVG if PNG fails
          (e.currentTarget as HTMLImageElement).src = `${base}/assets/cio-logo.svg?v=9.62`;
        }}
      />
    </div>
  );
};
