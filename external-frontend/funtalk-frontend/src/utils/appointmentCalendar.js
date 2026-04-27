/**
 * Calendar-safe parsing for appointment date/time from API (PostgreSQL DATE/TIME
 * serialized as ISO strings can shift the calendar day in regex-based parsers).
 */

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string|Date|number} dateValue
 * @returns {string} YYYY-MM-DD in local calendar, or '' if invalid
 */
export function toCalendarYyyyMmDd(dateValue) {
  if (dateValue == null || dateValue === '') return '';
  if (typeof dateValue === 'string') {
    const t = dateValue.trim();
    if (PLAIN_DATE.test(t)) return t;
  }
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * @param {string|Date} timeValue — "HH:MM:SS", "HH:MM", or ISO datetime
 * @returns {string} HH:MM (24h) or ''
 */
export function normalizeAppointmentTimeHHMM(timeValue) {
  if (timeValue == null || timeValue === '') return '';
  const s = String(timeValue).trim();
  if (/^\d{1,2}:\d{2}/.test(s)) {
    return s.substring(0, 5);
  }
  const d = timeValue instanceof Date ? timeValue : new Date(timeValue);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
