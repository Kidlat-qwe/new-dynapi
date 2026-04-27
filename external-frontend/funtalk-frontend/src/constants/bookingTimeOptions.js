/**
 * Class booking times: 30-minute slots only (:00 and :30), 9:00 AM – 9:00 PM.
 * `value` is HH:MM (24h) for API payloads.
 */
export const BOOKING_TIME_OPTIONS = (() => {
  const options = [];
  for (let minutes = 9 * 60; minutes <= 21 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const h12 = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const label = `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
    options.push({ value, label });
  }
  return options;
})();
