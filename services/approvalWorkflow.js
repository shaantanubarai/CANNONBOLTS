const store = require('../data/store');
const QRCode = require('qrcode');

class ApprovalWorkflowService {
  /**
   * Process an approval action on a booking
   */
  async approveBooking(bookingId, { role, name, note }) {
    const booking = store.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.status !== 'PENDING') {
      throw new Error(`Cannot approve booking in status: ${booking.status}`);
    }

    const resource = store.getResourceById(booking.resourceId);
    const requiresAdmin = resource?.requiresAdminApproval;

    const historyEntry = {
      stage: role === 'admin' ? 'Estate Admin' : 'Faculty Advisor',
      status: 'APPROVED',
      by: name || (role === 'admin' ? 'Estate Admin Office' : 'Faculty Advisor'),
      note: note || 'Approved as requested',
      timestamp: new Date().toISOString()
    };

    booking.approvalHistory.push(historyEntry);

    // If currently at faculty stage and admin is required:
    if (booking.approvalStage === 'PENDING_FACULTY' && requiresAdmin) {
      if (role === 'faculty') {
        booking.approvalStage = 'PENDING_ADMIN';
        store.updateBooking(bookingId, booking);

        store.addNotification({
          id: `notif-${Date.now()}`,
          title: "Faculty Endorsed Request",
          message: `${booking.organizerName}'s booking for ${booking.resourceName} was approved by Faculty and routed to Estate Admin.`,
          timestamp: new Date().toISOString(),
          type: "info",
          read: false
        });

        return {
          booking,
          stageCompleted: "PENDING_ADMIN",
          message: "Faculty approved. Forwarded to Campus Estate Admin for final sign-off."
        };
      }
    }

    // Otherwise, mark fully APPROVED and generate pass code
    booking.status = 'APPROVED';
    booking.approvalStage = 'COMPLETED';
    booking.passCode = `PASS-${resource?.category?.substring(0, 3).toUpperCase() || 'RES'}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Generate QR payload data URL
    try {
      const qrPayload = JSON.stringify({
        passCode: booking.passCode,
        id: booking.id,
        resource: booking.resourceName,
        event: booking.eventTitle,
        organizer: booking.organizerName,
        date: booking.date,
        time: `${booking.startTime} - ${booking.endTime}`,
        status: "VERIFIED"
      });
      booking.qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 220, margin: 1 });
    } catch (e) {
      console.error("QR Code generation error:", e);
    }

    store.updateBooking(bookingId, booking);

    store.addNotification({
      id: `notif-${Date.now()}`,
      title: "Booking Confirmed! 🎉",
      message: `Booking for ${booking.resourceName} (${booking.eventTitle}) is fully approved. Digital pass generated!`,
      timestamp: new Date().toISOString(),
      type: "success",
      read: false
    });

    return {
      booking,
      stageCompleted: "COMPLETED",
      message: "Booking fully approved! Digital entry pass generated."
    };
  }

  /**
   * Reject a booking with mandatory reason
   */
  async rejectBooking(bookingId, { role, name, reason }) {
    const booking = store.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    booking.status = 'REJECTED';
    booking.approvalStage = 'REJECTED';
    booking.rejectionReason = reason || "Capacity or scheduling conflict with academic timetable.";

    const historyEntry = {
      stage: role === 'admin' ? 'Estate Admin' : 'Faculty Advisor',
      status: 'REJECTED',
      by: name || (role === 'admin' ? 'Estate Admin Office' : 'Faculty Advisor'),
      note: booking.rejectionReason,
      timestamp: new Date().toISOString()
    };

    booking.approvalHistory.push(historyEntry);
    store.updateBooking(bookingId, booking);

    store.addNotification({
      id: `notif-${Date.now()}`,
      title: "Booking Request Rejected",
      message: `Request for ${booking.resourceName} was rejected: ${booking.rejectionReason}`,
      timestamp: new Date().toISOString(),
      type: "danger",
      read: false
    });

    return {
      booking,
      message: "Booking rejected."
    };
  }

  /**
   * Cancel an existing booking
   */
  async cancelBooking(bookingId, { role, name, reason }) {
    const booking = store.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    booking.status = 'CANCELLED';
    booking.approvalStage = 'CANCELLED';
    booking.cancellationReason = reason || "Cancelled by requester.";

    booking.approvalHistory.push({
      stage: "Cancellation",
      status: "CANCELLED",
      by: name || role,
      note: booking.cancellationReason,
      timestamp: new Date().toISOString()
    });

    store.updateBooking(bookingId, booking);

    store.addNotification({
      id: `notif-${Date.now()}`,
      title: "Booking Cancelled",
      message: `Reservation for ${booking.resourceName} on ${booking.date} (${booking.startTime}) was cancelled. Slot is now free.`,
      timestamp: new Date().toISOString(),
      type: "warning",
      read: false
    });

    return {
      booking,
      message: "Booking cancelled and slot released."
    };
  }
}

module.exports = new ApprovalWorkflowService();
