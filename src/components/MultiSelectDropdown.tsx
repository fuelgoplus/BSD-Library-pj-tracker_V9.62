import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectDropdownProps {
  id?: string;
  label: string;
  options: string[]; // does not include 'All'
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  allLabel?: string;
  placeholder?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  id,
  label,
  options,
  selectedValues,
  onChange,
  allLabel = 'All',
  placeholder = 'Select...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllSelected = selectedValues.length === 0;

  const toggleOption = (val: string) => {
    if (isAllSelected) {
      // Transition from All to just this one option
      onChange([val]);
    } else {
      if (selectedValues.includes(val)) {
        const next = selectedValues.filter(v => v !== val);
        // If everything is unselected, revert back to All (empty array)
        onChange(next);
      } else {
        const next = [...selectedValues, val];
        // If user selected all individual options, normalize to All (empty array)
        if (next.length === options.length) {
          onChange([]);
        } else {
          onChange(next);
        }
      }
    }
  };

  const handleSelectAll = () => {
    onChange([]); // empty array represents 'All'
  };

  const displaySummary = () => {
    if (isAllSelected) return allLabel;
    if (selectedValues.length === 1) return selectedValues[0];
    if (selectedValues.length <= 2) return selectedValues.join(', ');
    return `${selectedValues.length} selected`;
  };

  return (
    <div className="relative w-full" ref={containerRef} id={id}>
      <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--brand-text)' }}>
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="std-input w-full flex items-center justify-between text-left cursor-pointer text-xs py-1.5 px-2.5 h-[34px] rounded transition-all focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-sky-500"
        title={isAllSelected ? allLabel : selectedValues.join(', ')}
      >
        <span className="truncate pr-1 font-medium" style={{ color: 'var(--text-main)' }}>
          {displaySummary()}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isAllSelected && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.2 rounded-full text-white"
              style={{ backgroundColor: 'var(--brand-main)' }}
            >
              {selectedValues.length}
            </span>
          )}
          <i
            className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-sub)' }}
          ></i>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 w-full min-w-[170px] max-w-[260px] z-50 rounded-lg shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--border-color)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Header Action Buttons */}
          <div
            className="flex items-center justify-between px-2.5 py-1.5 border-b text-[10px] font-semibold"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}
          >
            <button
              type="button"
              onClick={handleSelectAll}
              className={`hover:underline cursor-pointer ${isAllSelected ? 'font-bold' : ''}`}
              style={{ color: isAllSelected ? 'var(--brand-text)' : 'var(--text-sub)' }}
            >
              <i className="fa-solid fa-rotate-left mr-1"></i>
              {allLabel}
            </button>
            {!isAllSelected && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="hover:underline text-rose-500 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
            {/* All Checkbox */}
            <label
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs select-none hover:bg-black hover:bg-opacity-5 transition-colors"
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5 cursor-pointer"
              />
              <span className={`truncate ${isAllSelected ? 'font-bold' : ''}`} style={{ color: 'var(--text-main)' }}>
                {allLabel}
              </span>
            </label>

            {/* Item Checkboxes */}
            {options.map(opt => {
              const checked = selectedValues.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs select-none transition-colors ${
                    checked ? 'bg-sky-50 dark:bg-sky-950/30' : 'hover:bg-black hover:bg-opacity-5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(opt)}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span
                    className={`truncate ${checked ? 'font-semibold' : ''}`}
                    style={{ color: checked ? 'var(--brand-text)' : 'var(--text-main)' }}
                  >
                    {opt}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
