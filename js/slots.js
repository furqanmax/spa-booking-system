import { timeToMinutes, minutesToTime, getDayOfWeek, intersectTimeSlots, timesOverlap } from './utils.js';

export function generateAvailableSlots(params) {
  const {
    date, serviceId, branchId, staffId,
    branchConfig, branchAvailability, staffList,
    staffAvailability, staffHolidays, branchHolidays,
    existingAppointments, serviceDurationMinutes, serviceAvailability
  } = params;

  const isBranchHoliday = branchHolidays.some(h =>
    h.date === date && (h.affectsAllStaff !== false || h.branchId === branchId)
  );
  if (isBranchHoliday) return [];

  const dayOfWeek = getDayOfWeek(date);

  let baseSlots = [];
  if (branchConfig.availabilityMode === 'common' || !branchConfig.availabilityMode) {
    const dayAvail = branchAvailability[dayOfWeek];
    if (!dayAvail?.isOpen) return [];
    baseSlots = dayAvail.slots || [];
  } else {
    const sAvail = serviceAvailability?.[dayOfWeek];
    if (!sAvail?.isAvailable) return [];
    baseSlots = sAvail.slots || [];
  }

  if (baseSlots.length === 0) return [];

  const eligibleStaff = staffId
    ? staffList.filter(s => s.id === staffId)
    : staffList.filter(s => s.serviceIds?.includes(serviceId) && s.isActive !== false);

  if (eligibleStaff.length === 0) return [];

  const allSlots = [];

  for (const staff of eligibleStaff) {
    const staffHoliday = staffHolidays[staff.id]?.find(h => h.date === date);
    if (staffHoliday?.isFullDay) continue;
    if (staffHoliday && !staffHoliday.isFullDay) {
      const partialSlots = staffHoliday.slots || [];
      if (partialSlots.length > 0) {
        const holidayRanges = partialSlots.map(s => ({ start: s.start, end: s.end }));
        let remainingSlots = [...baseSlots];
        for (const hr of holidayRanges) {
          remainingSlots = subtractTimeSlot(remainingSlots, hr);
        }
        if (remainingSlots.length === 0) continue;
        baseSlots = remainingSlots;
      }
    }

    const staffDay = staffAvailability[staff.id]?.[dayOfWeek];
    if (!staffDay?.isWorking) continue;

    const workingSlots = intersectTimeSlots(baseSlots, staffDay.slots || []);

    const slotInterval = branchConfig.slotDurationMinutes || 30;

    for (const window of workingSlots) {
      let cursor = timeToMinutes(window.start);
      const windowEnd = timeToMinutes(window.end);

      while (cursor + serviceDurationMinutes <= windowEnd) {
        const slotStart = minutesToTime(cursor);
        const slotEnd = minutesToTime(cursor + serviceDurationMinutes);

        const bookedCount = existingAppointments.filter(apt =>
          apt.staffId === staff.id &&
          apt.status !== 'cancelled' &&
          timesOverlap(apt.startTime, apt.endTime, slotStart, slotEnd)
        ).length;

        const maxParallel = branchConfig.overbookingEnabled
          ? (branchConfig.maxOverbookingSlots || Infinity)
          : 1;

        if (bookedCount < maxParallel) {
          allSlots.push({
            time: slotStart,
            endTime: slotEnd,
            staffId: staff.id,
            staffName: staff.name,
            isOverbooking: bookedCount > 0
          });
        }

        cursor += slotInterval;
      }
    }
  }

  return allSlots.sort((a, b) => a.time.localeCompare(b.time));
}

function subtractTimeSlot(slots, exclude) {
  const result = [];
  const exStart = timeToMinutes(exclude.start);
  const exEnd = timeToMinutes(exclude.end);

  for (const slot of slots) {
    const sStart = timeToMinutes(slot.start);
    const sEnd = timeToMinutes(slot.end);

    if (sEnd <= exStart || sStart >= exEnd) {
      result.push(slot);
    } else {
      if (sStart < exStart) {
        result.push({ start: slot.start, end: minutesToTime(exStart) });
      }
      if (sEnd > exEnd) {
        result.push({ start: minutesToTime(exEnd), end: slot.end });
      }
    }
  }
  return result;
}

export async function fetchSlotData({
  date, branchId, serviceId, staffId, branchConfig
}) {
  const [branchAvail, staffListMod, existingAppts] = await Promise.all([
    import('./db/branches.js').then(m => m.getBranchAvailability(branchId)),
    import('./db/staff.js').then(m => m.getStaffList(branchId)),
    import('./db/appointments.js').then(m => m.getAppointmentsForDate(branchId, date))
  ]);

  const staffAvailabilityMap = {};
  const staffHolidaysMap = {};
  const allHolidays = await import('./db/holidays.js').then(m => m.getHolidayForDate(branchId, date));

  const staffList = staffListMod.filter(s => s.serviceIds?.includes(serviceId) && s.isActive !== false);

  for (const staff of staffList) {
    const [avail, holidays] = await Promise.all([
      import('./db/staff.js').then(m => m.getStaffAvailability(staff.id)),
      import('./db/staff.js').then(m => m.getStaffHolidays(staff.id, date))
    ]);
    staffAvailabilityMap[staff.id] = avail;
    staffHolidaysMap[staff.id] = holidays;
  }

  let serviceAvailability = null;
  if (branchConfig.availabilityMode === 'per_service') {
    serviceAvailability = await import('./db/services.js').then(m => m.getServiceAvailability(serviceId));
  }

  const service = await import('./db/services.js').then(m => m.getService(serviceId));
  const duration = service?.durationMinutes || 60;

  const slots = generateAvailableSlots({
    date,
    serviceId,
    branchId,
    staffId: staffId || null,
    branchConfig,
    branchAvailability: branchAvail,
    staffList,
    staffAvailability: staffAvailabilityMap,
    staffHolidays: staffHolidaysMap,
    branchHolidays: allHolidays,
    existingAppointments: existingAppts,
    serviceDurationMinutes: duration,
    serviceAvailability
  });

  return slots;
}
