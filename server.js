const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const QRCode = require('qrcode');

const store = require('./data/store');
const conflictEngine = require('./services/conflictEngine');
const approvalWorkflow = require('./services/approvalWorkflow');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket Broadcast Helper
function broadcast(eventType, payload) {
  const message = JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected. Total active clients:', wss.clients.size);
  ws.send(JSON.stringify({ event: 'CONNECTED', data: { message: 'Real-time synchronization connected' } }));

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected.');
  });
});

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Resources
app.get('/api/resources', (req, res) => {
  const { category, minCapacity, search } = req.query;
  let resources = store.getResources();

  if (category && category !== 'ALL') {
    resources = resources.filter(r => r.category.toLowerCase() === category.toLowerCase());
  }
  if (minCapacity) {
    resources = resources.filter(r => r.capacity >= parseInt(minCapacity, 10));
  }
  if (search) {
    const q = search.toLowerCase();
    resources = resources.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q) ||
      r.amenities.some(a => a.toLowerCase().includes(q))
    );
  }

  res.json({ success: true, count: resources.length, data: resources });
});

app.get('/api/resources/:id', (req, res) => {
  const resource = store.getResourceById(req.params.id);
  if (!resource) {
    return res.status(404).json({ success: false, error: 'Resource not found' });
  }
  res.json({ success: true, data: resource });
});

// Add new resource (Campus Admin & Faculty HOD only)
app.post('/api/resources', (req, res) => {
  const {
    role,
    name,
    category,
    capacity,
    location,
    building,
    floor,
    image,
    amenities,
    requiresAdminApproval,
    operatingHours
  } = req.body;

  if (role !== 'admin' && role !== 'faculty') {
    return res.status(403).json({
      success: false,
      error: 'Permission Denied: Only Campus Administrators and Faculty HODs can add resources.'
    });
  }

  if (!name || !category || !capacity || !location) {
    return res.status(400).json({
      success: false,
      error: 'Resource name, category, capacity, and location are required.'
    });
  }

  const defaultImages = {
    'Auditorium': 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=60',
    'Computer Lab': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=60',
    'Seminar Hall': 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=60',
    'Classroom': 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=60',
    'Sports Complex': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=60',
    'Media Kit / Studio': 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&auto=format&fit=crop&q=60'
  };

  let parsedAmenities = [];
  if (Array.isArray(amenities)) {
    parsedAmenities = amenities;
  } else if (typeof amenities === 'string' && amenities.trim()) {
    parsedAmenities = amenities.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    parsedAmenities = ["Air Conditioning", "High-Speed WiFi", "Projector & Sound"];
  }

  const resourceId = `res-${Date.now()}`;
  const newResource = {
    id: resourceId,
    name: name.trim(),
    category,
    capacity: parseInt(capacity, 10) || 50,
    location: location.trim(),
    building: building && building.trim() ? building.trim() : (location.includes(',') ? location.split(',')[0].trim() : 'Campus Complex'),
    floor: floor && floor.trim() ? floor.trim() : 'Ground Floor',
    image: (image && image.trim()) ? image.trim() : (defaultImages[category] || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=60'),
    amenities: parsedAmenities,
    requiresAdminApproval: !!requiresAdminApproval,
    operatingHours: operatingHours || { open: "08:00", close: "20:00" },
    status: "active"
  };

  store.addResource(newResource);
  broadcast('RESOURCE_ADDED', newResource);

  res.status(201).json({
    success: true,
    message: `Resource "${newResource.name}" added to catalogue successfully.`,
    data: newResource
  });
});

// Toggle maintenance mode for a resource
app.patch('/api/resources/:id/maintenance', (req, res) => {
  const { status } = req.body; // 'active' or 'maintenance'
  const updated = store.updateResource(req.params.id, { status });
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Resource not found' });
  }

  broadcast('RESOURCE_STATUS_CHANGED', updated);
  res.json({ success: true, data: updated });
});

// 2. Conflict Pre-Check (Dynamic validation as user fills form)
app.post('/api/check-conflict', (req, res) => {
  const { resourceId, date, startTime, endTime, excludeBookingId } = req.body;

  if (!resourceId || !date || !startTime || !endTime) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  const result = conflictEngine.checkConflict({
    resourceId,
    date,
    startTime,
    endTime,
    excludeBookingId
  });

  res.json({ success: true, ...result });
});

// 3. Bookings
app.get('/api/bookings', (req, res) => {
  const { date, resourceId, status, role, clubName } = req.query;
  let bookings = store.getBookings();

  if (date) {
    bookings = bookings.filter(b => b.date === date);
  }
  if (resourceId) {
    bookings = bookings.filter(b => b.resourceId === resourceId);
  }
  if (status) {
    bookings = bookings.filter(b => b.status === status);
  }
  if (clubName) {
    bookings = bookings.filter(b => b.clubName?.toLowerCase() === clubName.toLowerCase());
  }

  // Sort by date and startTime
  bookings.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  res.json({ success: true, count: bookings.length, data: bookings });
});

app.get('/api/bookings/:id', (req, res) => {
  const booking = store.getBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  res.json({ success: true, data: booking });
});

// Submit a new booking (Protected with Automatic Double-Booking Prevention)
app.post('/api/bookings', async (req, res) => {
  const {
    resourceId,
    eventTitle,
    organizerName,
    clubName,
    department,
    role,
    date,
    startTime,
    endTime,
    expectedAttendees,
    purpose,
    requestedEquipment,
    supervisor
  } = req.body;

  // Validation
  if (role === 'viewer') {
    return res.status(403).json({ success: false, error: 'Permission Denied: Read-only Visitors cannot create bookings.' });
  }

  if (!resourceId || !eventTitle || !organizerName || !date || !startTime || !endTime) {
    return res.status(400).json({ success: false, error: 'All core booking fields are required.' });
  }

  const resource = store.getResourceById(resourceId);
  if (!resource) {
    return res.status(404).json({ success: false, error: 'Resource not found' });
  }

  // AUTOMATIC PREVENTION OF DOUBLE BOOKINGS
  const conflictCheck = conflictEngine.checkConflict({
    resourceId,
    date,
    startTime,
    endTime
  });

  if (conflictCheck.hasConflict) {
    // Record intercepted conflict to system logs
    store.addConflictLog({
      id: `conf-${Date.now()}`,
      timestamp: new Date().toISOString(),
      resourceId,
      resourceName: resource.name,
      attemptedBy: `${organizerName} (${clubName || department || 'Campus Member'})`,
      eventTitle,
      requestedTime: `${startTime} - ${endTime}`,
      date,
      reason: conflictCheck.message,
      actionTaken: "Automatically blocked by Conflict Engine & alternative suggestions generated."
    });

    broadcast('CONFLICT_PREVENTED', {
      resourceName: resource.name,
      attemptedEvent: eventTitle,
      date,
      time: `${startTime} - ${endTime}`
    });

    return res.status(409).json({
      success: false,
      error: "DOUBLE_BOOKING_PREVENTED",
      message: conflictCheck.message,
      conflicts: conflictCheck.conflicts,
      alternatives: conflictCheck.alternatives
    });
  }

  // Build new booking object
  const bookingId = `book-${Date.now()}`;
  const newBooking = {
    id: bookingId,
    resourceId,
    resourceName: resource.name,
    eventTitle,
    organizerName,
    clubName: clubName || 'Student Group',
    department: department || 'General Academic',
    role: role || 'student',
    date,
    startTime,
    endTime,
    expectedAttendees: Number(expectedAttendees) || 10,
    purpose: purpose || 'Academic/Club Activity',
    requestedEquipment: Array.isArray(requestedEquipment) ? requestedEquipment : [],
    status: 'PENDING',
    approvalStage: 'PENDING_FACULTY',
    supervisor: supervisor || 'Department Faculty Advisor',
    passCode: null,
    qrDataUrl: null,
    createdAt: new Date().toISOString(),
    approvalHistory: [
      {
        stage: "Submission",
        status: "SUBMITTED",
        by: organizerName,
        note: "Booking request created and dispatched for faculty approval.",
        timestamp: new Date().toISOString()
      }
    ]
  };

  store.addBooking(newBooking);

  store.addNotification({
    id: `notif-${Date.now()}`,
    title: "New Booking Request",
    message: `${organizerName} requested ${resource.name} on ${date} (${startTime} - ${endTime}) for '${eventTitle}'.`,
    timestamp: new Date().toISOString(),
    type: "info",
    read: false
  });

  broadcast('BOOKING_CREATED', newBooking);

  res.status(201).json({
    success: true,
    message: "Booking submitted successfully and queued for approval.",
    data: newBooking
  });
});

// 4. Approval Workflow Endpoints
app.post('/api/bookings/:id/approve', async (req, res) => {
  const { role, name, note } = req.body;
  if (role === 'viewer' || role === 'student') {
    return res.status(403).json({ success: false, error: 'Permission Denied: Only Faculty and Administrators can approve bookings.' });
  }

  try {
    const result = await approvalWorkflow.approveBooking(req.params.id, {
      role: role || 'faculty',
      name: name || 'Faculty Approver',
      note: note || 'Approved'
    });

    broadcast('BOOKING_APPROVED', result.booking);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/bookings/:id/reject', async (req, res) => {
  const { role, name, reason } = req.body;
  if (role === 'viewer' || role === 'student') {
    return res.status(403).json({ success: false, error: 'Permission Denied: Only Faculty and Administrators can reject bookings.' });
  }

  try {
    const result = await approvalWorkflow.rejectBooking(req.params.id, {
      role: role || 'faculty',
      name: name || 'Faculty Approver',
      reason: reason || 'Not approved due to schedule conflict'
    });

    broadcast('BOOKING_REJECTED', result.booking);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/bookings/:id/cancel', async (req, res) => {
  const { role, name, reason } = req.body;
  if (role === 'student' || role === 'viewer') {
    return res.status(403).json({ success: false, error: 'Permission Denied: Student Club Leads and Visitors cannot cancel bookings.' });
  }

  try {
    const result = await approvalWorkflow.cancelBooking(req.params.id, {
      role: role || 'admin',
      name: name || 'Campus Administrator',
      reason: reason || 'Cancelled by authorized staff'
    });

    broadcast('BOOKING_CANCELLED', result.booking);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Dynamic QR Code Generation / Retrieval Endpoint
app.get('/api/bookings/:id/qrcode', async (req, res) => {
  const booking = store.getBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }

  if (booking.qrDataUrl) {
    return res.json({ success: true, qrDataUrl: booking.qrDataUrl });
  }

  try {
    if (!booking.passCode) {
      booking.passCode = `PASS-${booking.id.toUpperCase()}`;
    }
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
    store.updateBooking(booking.id, booking);
    res.json({ success: true, qrDataUrl: booking.qrDataUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

// 5. System Analytics & Utilization Metrics
app.get('/api/analytics', (req, res) => {
  const resources = store.getResources();
  const bookings = store.getBookings();
  const conflictLogs = store.getConflictLogs();

  const totalBookings = bookings.length;
  const approvedBookings = bookings.filter(b => b.status === 'APPROVED').length;
  const pendingBookings = bookings.filter(b => b.status === 'PENDING').length;
  const rejectedBookings = bookings.filter(b => b.status === 'REJECTED').length;
  const doubleBookingsPrevented = conflictLogs.length;

  // Resource utilization count
  const resourcePopularity = resources.map(r => {
    const count = bookings.filter(b => b.resourceId === r.id && b.status === 'APPROVED').length;
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      capacity: r.capacity,
      approvedBookingsCount: count
    };
  }).sort((a, b) => b.approvedBookingsCount - a.approvedBookingsCount);

  // Club / Department distribution
  const clubCounts = {};
  bookings.forEach(b => {
    const club = b.clubName || 'General';
    clubCounts[club] = (clubCounts[club] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      stats: {
        totalBookings,
        approvedBookings,
        pendingBookings,
        rejectedBookings,
        doubleBookingsPrevented,
        activeResourcesCount: resources.filter(r => r.status === 'active').length,
        approvalRate: totalBookings > 0 ? Math.round((approvedBookings / totalBookings) * 100) : 100
      },
      resourcePopularity,
      clubDistribution: clubCounts
    }
  });
});

// 6. Conflict Prevention Logs
app.get('/api/conflict-log', (req, res) => {
  res.json({ success: true, data: store.getConflictLogs() });
});

// 7. Notifications
app.get('/api/notifications', (req, res) => {
  res.json({ success: true, data: store.getNotifications() });
});

app.post('/api/notifications/read', (req, res) => {
  res.json({ success: true, data: store.markAllNotificationsRead() });
});

// 8. Simulation & Demonstration Tools for Hackathon Judges
app.post('/api/simulate-conflict', (req, res) => {
  // Simulates an immediate collision attempt on the busiest resource
  const today = new Date().toISOString().split('T')[0];
  const firstResource = store.getResources()[0]; // Dr. APJ Abdul Kalam Auditorium

  const conflictCheck = conflictEngine.checkConflict({
    resourceId: firstResource.id,
    date: today,
    startTime: "09:30",
    endTime: "11:30"
  });

  const logEntry = store.addConflictLog({
    id: `conf-sim-${Date.now()}`,
    timestamp: new Date().toISOString(),
    resourceId: firstResource.id,
    resourceName: firstResource.name,
    attemptedBy: "AI Society (Live Demo Simulation)",
    eventTitle: "Simulated Concurrent Reservation Attempt",
    requestedTime: "09:30 - 11:30",
    date: today,
    reason: "Zero-tolerance Double Booking Intercept: Slot 09:00 - 12:00 is occupied by Hackathon Opening Ceremony",
    actionTaken: "Real-time collision averted. Automated alternative slots calculated and returned."
  });

  broadcast('CONFLICT_PREVENTED', {
    resourceName: firstResource.name,
    attemptedEvent: "Simulated Concurrent Reservation Attempt",
    date: today,
    time: "09:30 - 11:30"
  });

  res.json({
    success: true,
    message: "Live double-booking prevention simulated successfully!",
    interceptedLog: logEntry,
    resolution: conflictCheck
  });
});

// Reset Demo Data
app.post('/api/reset-demo', (req, res) => {
  const result = store.resetToDefault();
  broadcast('DATABASE_RESET', {});
  res.json(result);
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize existing approved bookings with QR codes if missing
(async () => {
  const bookings = store.getBookings();
  for (const b of bookings) {
    if (b.status === 'APPROVED' && (!b.qrDataUrl || !b.passCode)) {
      if (!b.passCode) b.passCode = `PASS-${b.id.toUpperCase()}`;
      try {
        const qrPayload = JSON.stringify({
          passCode: b.passCode,
          id: b.id,
          resource: b.resourceName,
          event: b.eventTitle,
          organizer: b.organizerName,
          date: b.date,
          time: `${b.startTime} - ${b.endTime}`,
          status: "VERIFIED"
        });
        b.qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 220, margin: 1 });
      } catch (e) {
        console.error("QR Code init error:", e);
      }
    }
  }
  store.save();
})();

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Campus Resource Hub Server running at http://localhost:${PORT}`);
  console.log(`⚡ WebSocket Real-time availability active at ws://localhost:${PORT}`);
  console.log(`🔒 Zero Double-Booking Conflict Engine initialized.`);
  console.log(`=======================================================`);
});
