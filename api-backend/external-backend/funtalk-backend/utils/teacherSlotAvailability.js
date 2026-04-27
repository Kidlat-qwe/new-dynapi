/**
 * Shared logic for 30-minute grid slots vs teacher availability, exceptions, and bookings.
 * Used by availability API and appointment approval validation.
 */

export const SLOT_MINUTES = 30;

export const toMinutes = (timeValue) => {
  if (!timeValue) return null;
  const raw = String(timeValue).substring(0, 5);
  const [hours, minutes] = raw.split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

export const toHHMM = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const buildSlotsInRange = (startTime, endTime) => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null || start >= end) return [];

  const slots = [];
  for (let m = start; m < end; m += SLOT_MINUTES) {
    slots.push(toHHMM(m));
  }
  return slots;
};

/** Calendar YYYY-MM-DD from DB date / ISO string (avoid UTC day-of-week drift). */
export const normalizeToYyyyMmDd = (dateValue) => {
  if (dateValue == null || dateValue === '') return null;
  if (typeof dateValue === 'string') {
    const t = dateValue.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  }
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(dateValue);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
};

/** Day of week 0–6 for a calendar date in local timezone. */
export const getLocalDayOfWeek = (yyyyMmDd) => {
  if (!yyyyMmDd) return 0;
  const [y, mo, d] = yyyyMmDd.split('-').map((v) => parseInt(v, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return 0;
  return new Date(y, mo - 1, d).getDay();
};

export const normalizeTimeHHMM = (timeValue) => {
  if (timeValue == null || timeValue === '') return '';
  const s = String(timeValue).trim();
  if (/^\d{1,2}:\d{2}/.test(s)) {
    return s.substring(0, 5);
  }
  const d = timeValue instanceof Date ? timeValue : new Date(timeValue);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const normalizeClassType = (classType) => {
  const v = String(classType ?? '').trim().toLowerCase();
  if (v === 'group' || v === 'one_on_one' || v === 'vip') return v;
  return null;
};

/** Contiguous 30-min slot keys starting at startHHMM needed to cover duration. */
export const slotKeysForDuration = (startHHMM, durationMinutes) => {
  const start = toMinutes(startHHMM);
  if (start === null) return [];
  const dm = Math.max(1, Number(durationMinutes) || 25);
  const slotCount = Math.ceil(dm / SLOT_MINUTES);
  const keys = [];
  for (let i = 0; i < slotCount; i++) {
    keys.push(toHHMM(start + i * SLOT_MINUTES));
  }
  return keys;
};

export const bookingFitsSlots = (availableSlotList, startHHMM, durationMinutes) => {
  const needed = slotKeysForDuration(startHHMM, durationMinutes);
  if (needed.length === 0) return false;
  const set = new Set(availableSlotList.map((s) => normalizeTimeHHMM(s)));
  return needed.every((k) => set.has(k));
};

/**
 * @param {Function} queryFn - (sql, params) => Promise<{ rows: any[] }>
 * @param {{ excludeAppointmentId?: number, targetClassType?: string }} [options]
 * @returns {Promise<{ slots: string[], availability: any[], exceptions: any[], bookedSlots: any[] }>}
 */
export async function computeAvailableSlotsDetailForTeacherDate(
  queryFn,
  teacherId,
  dateInput,
  options = {}
) {
  const date = normalizeToYyyyMmDd(dateInput);
  if (!date) {
    return { slots: [], availability: [], exceptions: [], bookedSlots: [] };
  }

  const dayOfWeek = getLocalDayOfWeek(date);
  const { excludeAppointmentId, targetClassType } = options;
  const normalizedTargetClassType = normalizeClassType(targetClassType);
  const teacherResult = await queryFn(
    `
      SELECT employment_type
      FROM teachertbl
      WHERE teacher_id = $1
      LIMIT 1
    `,
    [teacherId]
  );
  const teacherEmploymentType = String(teacherResult.rows[0]?.employment_type || 'part_time').toLowerCase();
  const isFullTimeTeacher = teacherEmploymentType === 'full_time';

  const availabilityResult = isFullTimeTeacher
    ? {
        rows: [{ start_time: '00:00', end_time: '24:00' }],
      }
    : await queryFn(
        `
          SELECT start_time, end_time
          FROM teacheravailabilitytbl
          WHERE teacher_id = $1 AND day_of_week = $2 AND is_active = true
        `,
        [teacherId, dayOfWeek]
      );

  const exceptionResult = await queryFn(
    `
      SELECT start_time, end_time
      FROM teacheravailabilityexceptionstbl
      WHERE teacher_id = $1 AND exception_date = $2 AND is_blocked = true
    `,
    [teacherId, date]
  );

  let appointmentSql = `
      SELECT appointment_time, class_type
      FROM appointmenttbl
      WHERE teacher_id = $1 AND appointment_date = $2
      AND status NOT IN ('cancelled', 'no_show')
    `;
  const appointmentParams = [teacherId, date];
  if (excludeAppointmentId != null) {
    appointmentSql += ` AND appointment_id <> $3`;
    appointmentParams.push(excludeAppointmentId);
  }

  const appointmentResult = await queryFn(appointmentSql, appointmentParams);

  const baseSlots = availabilityResult.rows.flatMap((row) =>
    buildSlotsInRange(row.start_time, row.end_time)
  );

  const blockedAllDay = exceptionResult.rows.some((row) => !row.start_time && !row.end_time);

  const blockedSlotSet = new Set();
  if (!blockedAllDay) {
    exceptionResult.rows.forEach((row) => {
      if (row.start_time && row.end_time) {
        const exceptionSlots = buildSlotsInRange(row.start_time, row.end_time);
        exceptionSlots.forEach((slot) => blockedSlotSet.add(slot));
      }
    });
  }

  const bookedSlotSet = new Set();
  appointmentResult.rows.forEach((apt) => {
    const aptClassType = normalizeClassType(apt.class_type);
    const shouldBlockSlot = !(
      normalizedTargetClassType === 'group' &&
      aptClassType === 'group'
    );
    if (!shouldBlockSlot) return;
    const slot = normalizeTimeHHMM(apt.appointment_time);
    if (slot) bookedSlotSet.add(slot);
  });

  const finalSlots = blockedAllDay
    ? []
    : baseSlots.filter((slot) => !blockedSlotSet.has(slot) && !bookedSlotSet.has(slot));

  return {
    slots: finalSlots,
    availability: availabilityResult.rows,
    exceptions: exceptionResult.rows,
    bookedSlots: appointmentResult.rows.map((apt) => apt.appointment_time),
  };
}

/** @returns {Promise<string[]>} */
export async function computeAvailableSlotsForTeacherDate(queryFn, teacherId, dateInput, options) {
  const { slots } = await computeAvailableSlotsDetailForTeacherDate(
    queryFn,
    teacherId,
    dateInput,
    options
  );
  return slots;
}

export const durationMinutesFromNotes = (additionalNotes) => {
  const m = String(additionalNotes ?? '').match(/Duration:\s*(\d+)\s*mins/i);
  if (!m) return 25;
  const mins = Number(m[1]);
  return Number.isFinite(mins) && mins > 0 ? mins : 25;
};
