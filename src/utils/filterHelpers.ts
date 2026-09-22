import { ProjectItem, FilterState } from '../types';

/**
 * Checks if an item's property matches the filter value (which can be 'All', a single string, or an array of strings).
 */
export function matchesFilterValue(itemValue: string, filterValue: string | string[] | undefined): boolean {
  if (!filterValue || filterValue === 'All') return true;
  if (Array.isArray(filterValue)) {
    if (filterValue.length === 0 || filterValue.includes('All')) return true;
    return filterValue.includes(itemValue);
  }
  return itemValue === filterValue;
}

/**
 * Returns formatted string representing the selected values (for display, badges, reports).
 */
export function formatFilterDisplay(filterValue: string | string[] | undefined, allLabel = 'All'): string {
  if (!filterValue || filterValue === 'All') return allLabel;
  if (Array.isArray(filterValue)) {
    if (filterValue.length === 0 || filterValue.includes('All')) return allLabel;
    if (filterValue.length === 1) return filterValue[0];
    return filterValue.join(', ');
  }
  return filterValue;
}

/**
 * Checks if a filter has any active constraint (not 'All' and not empty).
 */
export function isFilterActive(filterValue: string | string[] | undefined): boolean {
  if (!filterValue || filterValue === 'All') return false;
  if (Array.isArray(filterValue)) {
    return filterValue.length > 0 && !filterValue.includes('All');
  }
  return true;
}

/**
 * Helper to normalize string | string[] to an array of selected items (excluding 'All').
 */
export function toSelectedArray(filterValue: string | string[] | undefined): string[] {
  if (!filterValue || filterValue === 'All') return [];
  if (Array.isArray(filterValue)) {
    return filterValue.filter(v => v !== 'All');
  }
  return [filterValue];
}
