/**
 * Utility for managing completed days (ribbons) for RHZ365 and WnR365.
 * Persists state in localStorage.
 */

const COMPLETED_RHZ_KEY = 'completed_rhz365_days';
const COMPLETED_WNR_KEY = 'completed_wnr365_days';

export interface CompletedDaysMap {
  [dayIndex: number]: boolean;
}

export function getCompletedRhzDays(): CompletedDaysMap {
  try {
    const raw = localStorage.getItem(COMPLETED_RHZ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCompletedRhzDays(map: CompletedDaysMap): void {
  try {
    localStorage.setItem(COMPLETED_RHZ_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Failed to save completed RHZ days:", err);
  }
}

export function isRhzDayCompleted(dayIndex: number): boolean {
  const map = getCompletedRhzDays();
  return !!map[dayIndex];
}

export function toggleRhzDayCompleted(dayIndex: number): boolean {
  const map = getCompletedRhzDays();
  const next = !map[dayIndex];
  if (next) {
    map[dayIndex] = true;
  } else {
    delete map[dayIndex];
  }
  saveCompletedRhzDays(map);
  return next;
}

export function markRhzDayCompleted(dayIndex: number): void {
  const map = getCompletedRhzDays();
  if (!map[dayIndex]) {
    map[dayIndex] = true;
    saveCompletedRhzDays(map);
  }
}

export function getCompletedWnrDays(): CompletedDaysMap {
  try {
    const raw = localStorage.getItem(COMPLETED_WNR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCompletedWnrDays(map: CompletedDaysMap): void {
  try {
    localStorage.setItem(COMPLETED_WNR_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Failed to save completed WnR days:", err);
  }
}

export function isWnrDayCompleted(dayIndex: number): boolean {
  const map = getCompletedWnrDays();
  return !!map[dayIndex];
}

export function toggleWnrDayCompleted(dayIndex: number): boolean {
  const map = getCompletedWnrDays();
  const next = !map[dayIndex];
  if (next) {
    map[dayIndex] = true;
  } else {
    delete map[dayIndex];
  }
  saveCompletedWnrDays(map);
  return next;
}

export function markWnrDayCompleted(dayIndex: number): void {
  const map = getCompletedWnrDays();
  if (!map[dayIndex]) {
    map[dayIndex] = true;
    saveCompletedWnrDays(map);
  }
}
