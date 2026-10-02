const store = require('../data/store');

/**
 * Convert time string "HH:MM" to minutes since midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight back to "HH:MM"
 */
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Core Overlap Check:
 * Two time intervals [startA, endA) and [startB, endB) overlap if and only if
 * startA < endB AND endA > startB
 */
function isOverlapping(startA, endA, startB, endB) {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && eA > sB;
}

class ConflictEngine {
  /**
   * Check for conflicts for a proposed booking
   * @param {Object} proposed - { resourceId, date, startTime, endTime, excludeBookingId }
   * @returns {Object} { hasConflict: boolean, conflicts: Array, alternatives: Object }
   */
  checkConflict(proposed) {
    const { resourceId, date, startTime, endTime, excludeBookingId } = proposed;
    const resource = store.getResourceById(resourceId);

    if (!resource) {
      return {
        hasConflict: true,
        reason: "RESOURCE_NOT_FOUND",
        message: "Requested campus resource does not exist.",
        conflicts: [],
        alternatives: null
      };
    }

    if (resource.status === 'maintenance') {
      return {
        hasConflict: true,
        reason: "UNDER_MAINTENANCE",
        message: `${resource.name} is currently offline for scheduled maintenance.`,
        conflicts: [],
        alternatives: this.findAlternativeResources(resource, date, startTime, endTime)
      };
    }

    // Operating hours check
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    const openMins = timeToMinutes(resource.operatingHours?.open || "08:00");
    const closeMins = timeToMinutes(resource.operatingHours?.close || "21:00");

    if (startMins < openMins || endMins > closeMins) {
      return {
        hasConflict: true,
        reason: "OUTSIDE_OPERATING_HOURS",
        message: `Booking must be within operating hours (${resource.operatingHours.open} - ${resource.operatingHours.close}).`,
        conflicts: [],
        alternatives: null
      };
    }

    if (endMins <= startMins) {
      return {
        hasConflict: true,
        reason: "INVALID_TIME_RANGE",
        message: "End time must be after start time.",
        conflicts: [],
        alternatives: null
      };
    }

    // Check all existing bookings on that date for that resource
    const existingBookings = store.getBookings().filter(b => {
      if (b.id === excludeBookingId) return false;
      if (b.resourceId !== resourceId) return false;
      if (b.date !== date) return false;
      // Confirmed or pending reservations block double-booking
      return b.status === 'APPROVED' || b.status === 'PENDING';
    });

    const conflicts = existingBookings.filter(b =>
      isOverlapping(startTime, endTime, b.startTime, b.endTime)
    );

    if (conflicts.length > 0) {
      const alternativeSlots = this.findAlternativeSlots(resourceId, date, startTime, endTime);
      const alternativeVenues = this.findAlternativeResources(resource, date, startTime, endTime);

      return {
        hasConflict: true,
        reason: "DOUBLE_BOOKING_PREVENTED",
        message: `Time slot conflict detected! ${resource.name} is already reserved during this window.`,
        conflicts: conflicts.map(c => ({
          bookingId: c.id,
          eventTitle: c.eventTitle,
          clubName: c.clubName,
          organizerName: c.organizerName,
          startTime: c.startTime,
          endTime: c.endTime,
          status: c.status
        })),
        alternatives: {
          sameVenueSlots: alternativeSlots,
          otherVenues: alternativeVenues
        }
      };
    }

    return {
      hasConflict: false,
      message: "Resource is completely free and available for this slot.",
      conflicts: [],
      alternatives: null
    };
  }

  /**
   * Find alternative time slots on the same date for the same resource
   */
  findAlternativeSlots(resourceId, date, requestedStart, requestedEnd) {
    const resource = store.getResourceById(resourceId);
    if (!resource) return [];

    const duration = timeToMinutes(requestedEnd) - timeToMinutes(requestedStart);
    const openMins = timeToMinutes(resource.operatingHours?.open || "08:00");
    const closeMins = timeToMinutes(resource.operatingHours?.close || "21:00");

    const existing = store.getBookings().filter(b =>
      b.resourceId === resourceId &&
      b.date === date &&
      (b.status === 'APPROVED' || b.status === 'PENDING')
    ).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const suggestions = [];
    let cur = openMins;

    // Check candidate slots in 60-min increments
    while (cur + duration <= closeMins && suggestions.length < 3) {
      const slotStart = minutesToTime(cur);
      const slotEnd = minutesToTime(cur + duration);

      const overlaps = existing.some(b => isOverlapping(slotStart, slotEnd, b.startTime, b.endTime));
      if (!overlaps && (slotStart !== requestedStart || slotEnd !== requestedEnd)) {
        suggestions.push({
          startTime: slotStart,
          endTime: slotEnd,
          durationMinutes: duration
        });
      }
      cur += 60; // move 1 hour forward
    }

    return suggestions;
  }

  /**
   * Find other comparable resources that are completely free during the requested window
   */
  findAlternativeResources(originalResource, date, startTime, endTime) {
    const allResources = store.getResources().filter(r =>
      r.id !== originalResource.id &&
      r.status === 'active'
    );

    const matches = [];

    for (const r of allResources) {
      // Check if within operating hours
      const open = timeToMinutes(r.operatingHours?.open || "08:00");
      const close = timeToMinutes(r.operatingHours?.close || "21:00");
      const s = timeToMinutes(startTime);
      const e = timeToMinutes(endTime);

      if (s < open || e > close) continue;

      // Check if free
      const hasOverlap = store.getBookings().some(b =>
        b.resourceId === r.id &&
        b.date === date &&
        (b.status === 'APPROVED' || b.status === 'PENDING') &&
        isOverlapping(startTime, endTime, b.startTime, b.endTime)
      );

      if (!hasOverlap) {
        matches.push({
          id: r.id,
          name: r.name,
          category: r.category,
          capacity: r.capacity,
          location: r.location,
          amenities: r.amenities,
          operatingHours: r.operatingHours
        });
      }

      if (matches.length >= 3) break;
    }

    return matches;
  }
}

module.exports = new ConflictEngine();
