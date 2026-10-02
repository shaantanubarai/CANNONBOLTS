/**
 * UniReserve - Campus Resource Booking & Conflict Resolution System
 * Frontend Application Controller
 */

// Application State
const state = {
  resources: [],
  bookings: [],
  conflicts: [],
  analytics: {},
  currentRole: 'student', // 'student', 'faculty', 'admin'
  selectedDate: new Date().toISOString().split('T')[0],
  activeTab: 'resources',
  conflictCheckTimer: null,
  activeActionBookingId: null,
  activeActionType: null // 'approve' or 'reject'
};

// WebSocket Real-Time Connection
let socket = null;

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  const wsBadge = document.getElementById('ws-badge');
  const wsText = document.getElementById('ws-status-text');

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('[WS] Connected to real-time update stream');
    if (wsBadge) {
      wsBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      wsBadge.style.color = '#34d399';
    }
    if (wsText) wsText.textContent = '';
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('[WS Event Received]', msg.event, msg.data);
      handleRealtimeEvent(msg.event, msg.data);
    } catch (e) {
      console.error('[WS] Parse error:', e);
    }
  };

  socket.onclose = () => {
    console.warn('[WS] Connection closed, retrying in 3s...');
    if (wsBadge) {
      wsBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      wsBadge.style.color = '#fbbf24';
    }
    if (wsText) wsText.textContent = '';
    setTimeout(initWebSocket, 3000);
  };
}

function handleRealtimeEvent(eventType, payload) {
  // Update state according to event
  if (eventType === 'BOOKING_CREATED') {
    showToast(`New booking requested: "${payload.eventTitle}" for ${payload.resourceName}`, 'info');
    fetchBookings();
    fetchAnalytics();
  } else if (eventType === 'BOOKING_APPROVED') {
    showToast(`Booking Approved! ${payload.resourceName} (${payload.eventTitle}) is confirmed.`, 'success');
    fetchBookings();
    fetchAnalytics();
  } else if (eventType === 'BOOKING_REJECTED') {
    showToast(`Booking Rejected: ${payload.resourceName} (${payload.eventTitle})`, 'danger');
    fetchBookings();
    fetchAnalytics();
  } else if (eventType === 'BOOKING_CANCELLED') {
    showToast(`Booking Cancelled: Slot released for ${payload.resourceName}`, 'warning');
    fetchBookings();
    fetchAnalytics();
  } else if (eventType === 'CONFLICT_PREVENTED') {
    showToast(`⚠️ Collision Prevented: Conflicting reservation for ${payload.resourceName} was intercepted!`, 'danger');
    fetchConflicts();
    fetchAnalytics();
  } else if (eventType === 'DATABASE_RESET') {
    showToast('Database reset to fresh demo state.', 'info');
    refreshAllData();
  } else if (eventType === 'RESOURCE_ADDED') {
    showToast(`New venue added to catalogue: ${payload.name}`, 'info');
    fetchResources();
    fetchAnalytics();
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: 'check-circle-2',
    danger: 'alert-triangle',
    warning: 'info',
    info: 'bell'
  };

  toast.innerHTML = `
    <i data-lucide="${iconMap[type] || 'info'}" style="width: 20px; height: 20px; flex-shrink: 0;"></i>
    <div style="font-size: 0.82rem; line-height: 1.4;">${message}</div>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Data Fetching
async function fetchResources() {
  try {
    const res = await fetch('/api/resources');
    const json = await res.json();
    if (json.success) {
      state.resources = json.data;
      renderResources();
      populateResourceDropdown();
      document.getElementById('count-resources').textContent = state.resources.length;
    }
  } catch (err) {
    console.error('Error fetching resources:', err);
  }
}

async function fetchBookings() {
  try {
    const res = await fetch('/api/bookings');
    const json = await res.json();
    if (json.success) {
      state.bookings = json.data;
      renderTimeline();
      renderApprovals();
      renderMyBookings();
      updateBadges();
    }
  } catch (err) {
    console.error('Error fetching bookings:', err);
  }
}

async function fetchConflicts() {
  try {
    const res = await fetch('/api/conflict-log');
    const json = await res.json();
    if (json.success) {
      state.conflicts = json.data;
      renderConflicts();
      document.getElementById('count-conflicts').textContent = state.conflicts.length;
      document.getElementById('badge-total-prevented').textContent = `${state.conflicts.length} Collisions Averted`;
    }
  } catch (err) {
    console.error('Error fetching conflict logs:', err);
  }
}

async function fetchAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    const json = await res.json();
    if (json.success) {
      state.analytics = json.data;
      renderAnalytics();
    }
  } catch (err) {
    console.error('Error fetching analytics:', err);
  }
}

function refreshAllData() {
  fetchResources();
  fetchBookings();
  fetchConflicts();
  fetchAnalytics();
}

function updateBadges() {
  const pendingCount = state.bookings.filter(b => b.status === 'PENDING').length;
  document.getElementById('count-pending-approvals').textContent = pendingCount;

  const myBookingsCount = state.bookings.filter(b => {
    if (state.currentRole === 'student') return b.organizerName.includes('Alex') || b.role === 'student';
    return true;
  }).length;
  document.getElementById('count-my-bookings').textContent = myBookingsCount;
}

// ---------------------------------------------------------------------
// RENDERERS
// ---------------------------------------------------------------------

// 1. Resource Catalog Renderer
function renderResources() {
  const container = document.getElementById('resources-grid-container');
  if (!container) return;

  const searchTerm = (document.getElementById('filter-search')?.value || '').toLowerCase();
  const selectedCat = document.getElementById('filter-category')?.value || 'ALL';

  const filtered = state.resources.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(searchTerm) ||
      r.location.toLowerCase().includes(searchTerm) ||
      r.amenities.some(a => a.toLowerCase().includes(searchTerm));
    const matchCat = selectedCat === 'ALL' || r.category.toLowerCase() === selectedCat.toLowerCase();
    return matchSearch && matchCat;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <i data-lucide="search-x" style="width: 48px; height: 48px; margin-bottom: 0.5rem; opacity: 0.5;"></i>
        <p>No campus resources match your filter criteria.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(r => {
    const isMaintenance = r.status === 'maintenance';
    return `
      <div class="resource-card">
        <div class="card-img-wrap">
          <img src="${r.image}" alt="${r.name}" loading="lazy">
          <div class="card-floating-badge">
            <span class="badge ${isMaintenance ? 'badge-rejected' : 'badge-category'}">
              ${isMaintenance ? '🔧 Under Maintenance' : r.category}
            </span>
          </div>
        </div>
        <div class="card-content">
          <h3 class="card-title">${r.name}</h3>
          <div class="card-location">
            <i data-lucide="map-pin" style="width: 14px; height: 14px; color: var(--accent-indigo);"></i>
            <span>${r.location}</span>
          </div>

          <div class="amenities-list">
            ${r.amenities.map(a => `<span class="amenity-chip">${a}</span>`).join('')}
          </div>

          <div class="card-footer">
            <div class="capacity-info">
              <i data-lucide="users" style="width: 15px; height: 15px;"></i>
              <span>Capacity: <strong>${r.capacity} seats</strong></span>
            </div>
            <button class="btn btn-primary" onclick="openBookingForResource('${r.id}')" ${isMaintenance ? 'disabled' : ''}>
              Book Slot
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// 2. Interactive Schedule & Availability Matrix Renderer
function renderTimeline() {
  const table = document.getElementById('timeline-table');
  if (!table) return;

  const date = state.selectedDate;
  // 1-hour slots from 08:00 to 20:00 (8am to 8pm)
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  let headerHtml = `
    <thead>
      <tr>
        <th class="venue-col" style="text-align: left; padding-left: 1rem;">Resource / Venue</th>
        ${hours.map(h => `<th>${String(h).padStart(2, '0')}:00</th>`).join('')}
      </tr>
    </thead>
  `;

  const dateBookings = state.bookings.filter(b => b.date === date && (b.status === 'APPROVED' || b.status === 'PENDING'));

  let rowsHtml = '<tbody>';

  state.resources.forEach(res => {
    rowsHtml += `<tr>`;
    rowsHtml += `
      <td class="venue-col" style="padding-left: 1rem;">
        <div style="font-weight: 700; color: #fff;">${res.name}</div>
        <div style="font-size: 0.72rem; color: var(--text-muted);">${res.category} • ${res.capacity} Seats</div>
      </td>
    `;

    hours.forEach(hour => {
      const slotStart = `${String(hour).padStart(2, '0')}:00`;
      const slotEnd = `${String(hour + 1).padStart(2, '0')}:00`;

      // Check if slot falls in operating hours
      const openHour = parseInt(res.operatingHours?.open?.split(':')[0] || '8', 10);
      const closeHour = parseInt(res.operatingHours?.close?.split(':')[0] || '21', 10);

      if (hour < openHour || hour >= closeHour) {
        rowsHtml += `
          <td class="slot-cell">
            <div class="slot-block slot-maintenance" title="Closed during this hour">
              Closed
            </div>
          </td>
        `;
        return;
      }

      // Check if any booking occupies this slot
      const occupyingBooking = dateBookings.find(b => {
        if (b.resourceId !== res.id) return false;
        const bStart = parseInt(b.startTime.split(':')[0], 10);
        const bEnd = Math.ceil(parseInt(b.endTime.split(':')[0], 10) + (parseInt(b.endTime.split(':')[1], 10) > 0 ? 1 : 0));
        return hour >= bStart && hour < bEnd;
      });

      if (occupyingBooking) {
        const isApproved = occupyingBooking.status === 'APPROVED';
        rowsHtml += `
          <td class="slot-cell">
            <div class="slot-block ${isApproved ? 'slot-booked' : 'slot-pending'}" 
                 title="${occupyingBooking.eventTitle} (${occupyingBooking.clubName || occupyingBooking.organizerName}) [${occupyingBooking.startTime} - ${occupyingBooking.endTime}]">
              ${isApproved ? 'Reserved' : 'Pending'}
            </div>
          </td>
        `;
      } else {
        // Free slot
        rowsHtml += `
          <td class="slot-cell">
            <div class="slot-block slot-available" 
                 onclick="quickBookSlot('${res.id}', '${date}', '${slotStart}', '${slotEnd}')"
                 title="Click to reserve ${res.name} at ${slotStart}">
              Free
            </div>
          </td>
        `;
      }
    });

    rowsHtml += `</tr>`;
  });

  rowsHtml += '</tbody>';
  table.innerHTML = headerHtml + rowsHtml;
}

// 3. Conflict Resolution Audit Log Renderer
function renderConflicts() {
  const tbody = document.getElementById('conflicts-table-body');
  if (!tbody) return;

  if (state.conflicts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No double bookings attempted yet. All schedule conflicts are actively intercepted.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.conflicts.map(c => {
    const dateFormatted = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `
      <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.08);">
        <td style="padding: 0.75rem; color: #94a3b8; font-family: monospace;">${dateFormatted}</td>
        <td style="padding: 0.75rem; font-weight: 600; color: #fff;">${c.resourceName}</td>
        <td style="padding: 0.75rem;">
          <div style="color: #cbd5e1; font-weight: 600;">${c.eventTitle || 'Concurrent Booking Attempt'}</div>
          <div style="font-size: 0.75rem; color: #94a3b8;">${c.attemptedBy}</div>
        </td>
        <td style="padding: 0.75rem; font-family: monospace; color: #fbbf24;">${c.date} (${c.requestedTime})</td>
        <td style="padding: 0.75rem; color: #fda4af;">${c.reason}</td>
        <td style="padding: 0.75rem;">
          <span class="badge badge-approved" style="font-size: 0.7rem;">🛡️ Blocked & Alternative Given</span>
        </td>
      </tr>
    `;
  }).join('');
}

// 4. Approval Workflow Portal Renderer
function renderApprovals() {
  const tbody = document.getElementById('approvals-table-body');
  if (!tbody) return;

  const showOnlyPending = document.getElementById('filter-approval-pending')?.classList.contains('btn-primary');
  let list = state.bookings;

  if (showOnlyPending) {
    list = list.filter(b => b.status === 'PENDING');
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No bookings require action at this time.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(b => {
    const isPending = b.status === 'PENDING';
    const isApproved = b.status === 'APPROVED';
    const isRejected = b.status === 'REJECTED';

    const statusBadge = isApproved ?
      `<span class="badge badge-approved">Approved</span>` :
      isRejected ?
      `<span class="badge badge-rejected">Rejected</span>` :
      `<span class="badge badge-pending">Pending Review</span>`;

    const stageLabel = b.approvalStage === 'PENDING_ADMIN' ? 'Awaiting Estate Admin' :
      b.approvalStage === 'PENDING_FACULTY' ? 'Awaiting Faculty Advisor' :
      b.approvalStage === 'COMPLETED' ? 'Approved & Ready' : b.status;

    return `
      <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.08);">
        <td style="padding: 0.75rem;">
          <div style="font-weight: 700; color: #fff;">${b.eventTitle}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${b.organizerName} • ${b.clubName || b.department}</div>
        </td>
        <td style="padding: 0.75rem; color: #cbd5e1; font-weight: 500;">${b.resourceName}</td>
        <td style="padding: 0.75rem; font-family: monospace; color: #a5b4fc;">
          ${b.date}<br><small style="color: #94a3b8;">${b.startTime} - ${b.endTime}</small>
        </td>
        <td style="padding: 0.75rem; color: #cbd5e1;">${b.expectedAttendees}</td>
        <td style="padding: 0.75rem;">
          <span style="font-size: 0.78rem; color: #cbd5e1;">${stageLabel}</span>
        </td>
        <td style="padding: 0.75rem;">${statusBadge}</td>
        <td style="padding: 0.75rem; text-align: right;">
          ${isPending ? (() => {
            const role = state.currentRole;
            const stage = b.approvalStage;
            // Admin can always approve/reject
            const canAdmin = role === 'admin';
            // Faculty can only act when booking is at PENDING_FACULTY stage
            const canFaculty = role === 'faculty' && stage === 'PENDING_FACULTY';

            if (canAdmin || canFaculty) {
              return `
                <div style="display: flex; gap: 0.4rem; justify-content: flex-end;">
                  <button class="btn btn-success" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;" onclick="openApprovalActionModal('${b.id}', 'approve')">
                    <i data-lucide="check" style="width: 14px; height: 14px;"></i> Approve
                  </button>
                  <button class="btn btn-danger" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;" onclick="openApprovalActionModal('${b.id}', 'reject')">
                    <i data-lucide="x" style="width: 14px; height: 14px;"></i> Reject
                  </button>
                </div>`;
            } else {
              return `<span style="font-size:0.75rem; color: var(--text-muted);">No action available</span>`;
            }
          })() : `
            <button class="btn btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;" onclick="viewBookingDetails('${b.id}')">
              View Trail
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// 5. My Bookings & Digital Pass Renderer
function renderMyBookings() {
  const container = document.getElementById('my-bookings-container');
  if (!container) return;

  const myBookings = state.bookings.filter(b => {
    if (state.currentRole === 'student') {
      return b.organizerName.includes('Alex') || b.role === 'student';
    }
    return true;
  });

  if (myBookings.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);" class="glass-panel">
        <i data-lucide="ticket" style="width: 48px; height: 48px; margin-bottom: 0.5rem; opacity: 0.4;"></i>
        <p>You have no active bookings under this persona.</p>
        <button class="btn btn-primary" onclick="openBookingModal()" style="margin-top: 1rem;">
          Create Your First Booking
        </button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = myBookings.map(b => {
    const isApproved = b.status === 'APPROVED';
    const isPending = b.status === 'PENDING';

    return `
      <div class="glass-panel" style="display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <h4 style="font-size: 1.05rem; font-weight: 700; color: #fff;">${b.eventTitle}</h4>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${b.resourceName}</div>
          </div>
          <span class="badge ${isApproved ? 'badge-approved' : isPending ? 'badge-pending' : 'badge-rejected'}">
            ${b.status}
          </span>
        </div>

        <div style="background: rgba(15, 23, 42, 0.5); padding: 0.65rem 0.85rem; border-radius: 6px; font-size: 0.8rem; margin-bottom: 0.75rem; color: #cbd5e1;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
            <span style="color: var(--text-muted);">Date & Time:</span>
            <strong>${b.date} | ${b.startTime} - ${b.endTime}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
            <span style="color: var(--text-muted);">Attendees:</span>
            <span>${b.expectedAttendees} Pax</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Faculty Advisor:</span>
            <span>${b.supervisor || 'Department Advisor'}</span>
          </div>
        </div>

        ${b.requestedEquipment && b.requestedEquipment.length > 0 ? `
          <div style="margin-bottom: 0.75rem; font-size: 0.72rem; color: #94a3b8;">
            Equipment: ${b.requestedEquipment.join(', ')}
          </div>
        ` : ''}

        <div style="margin-top: auto; display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(148, 163, 184, 0.1);">
          ${isApproved ? `
            <button class="btn btn-primary" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;" onclick="viewDigitalPass('${b.id}')">
              <i data-lucide="qr-code" style="width: 14px; height: 14px;"></i> View Digital QR Pass
            </button>
          ` : isPending && state.currentRole !== 'student' && state.currentRole !== 'viewer' ? `
            <button class="btn btn-secondary" style="font-size: 0.78rem; padding: 0.35rem 0.75rem; color: #fda4af;" onclick="cancelBooking('${b.id}')">
              Cancel Request
            </button>
          ` : `
            <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">
              ${isPending ? '⏳ Awaiting Review (View-Only)' : b.status}
            </span>
          `}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// 6. Analytics & KPI Renderer
function renderAnalytics() {
  const stats = state.analytics?.stats || {};
  document.getElementById('kpi-total-bookings').textContent = stats.totalBookings || 0;
  document.getElementById('kpi-approved-bookings').textContent = stats.approvedBookings || 0;
  document.getElementById('kpi-pending-bookings').textContent = stats.pendingBookings || 0;
  document.getElementById('kpi-prevented-conflicts').textContent = stats.doubleBookingsPrevented || 0;

  // Render Popularity Ranking
  const popList = document.getElementById('analytics-popularity-list');
  if (popList && state.analytics?.resourcePopularity) {
    popList.innerHTML = state.analytics.resourcePopularity.map((r, i) => {
      const pct = Math.min(100, Math.round((r.approvedBookingsCount / Math.max(1, stats.approvedBookings)) * 100));
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.25rem;">
            <span style="font-weight: 600; color: #fff;">${i + 1}. ${r.name}</span>
            <span style="color: #a5b4fc; font-weight: 700;">${r.approvedBookingsCount} bookings</span>
          </div>
          <div style="width: 100%; height: 6px; background: #334155; border-radius: 999px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--accent-indigo), var(--accent-emerald)); border-radius: 999px;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Club Distribution
  const clubList = document.getElementById('analytics-clubs-list');
  if (clubList && state.analytics?.clubDistribution) {
    const entries = Object.entries(state.analytics.clubDistribution);
    clubList.innerHTML = entries.map(([club, count]) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: rgba(15, 23, 42, 0.4); border-radius: 6px; font-size: 0.82rem;">
        <span style="color: #cbd5e1; font-weight: 600;">${club}</span>
        <span class="badge badge-category">${count} events</span>
      </div>
    `).join('');
  }
}

// ---------------------------------------------------------------------
// DYNAMIC REAL-TIME CONFLICT PREVIEW IN BOOKING MODAL
// ---------------------------------------------------------------------
function triggerConflictPreview() {
  clearTimeout(state.conflictCheckTimer);

  const resourceId = document.getElementById('booking-resource')?.value;
  const date = document.getElementById('booking-date')?.value;
  const startTime = document.getElementById('booking-start')?.value;
  const endTime = document.getElementById('booking-end')?.value;

  const banner = document.getElementById('conflict-preview-banner');
  const submitBtn = document.getElementById('btn-submit-booking');

  if (!resourceId || !date || !startTime || !endTime) {
    if (banner) banner.style.display = 'none';
    return;
  }

  state.conflictCheckTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, date, startTime, endTime })
      });

      const data = await res.json();

      if (!banner) return;

      if (data.hasConflict) {
        banner.className = 'conflict-alert-box conflict';
        let html = `
          <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; margin-bottom: 0.35rem;">
            <i data-lucide="alert-octagon" style="width: 16px; height: 16px;"></i>
            <span>Conflict Detected: Double-Booking Prevented!</span>
          </div>
          <div>${data.message}</div>
        `;

        if (data.conflicts && data.conflicts.length > 0) {
          html += `<div style="margin-top: 0.35rem; font-size: 0.75rem; opacity: 0.9;">`;
          data.conflicts.forEach(c => {
            html += `• Collides with <strong>"${c.eventTitle}"</strong> (${c.startTime} - ${c.endTime})<br>`;
          });
          html += `</div>`;
        }

        // Suggestions
        if (data.alternatives?.sameVenueSlots && data.alternatives.sameVenueSlots.length > 0) {
          html += `
            <div style="margin-top: 0.6rem;">
              <strong style="color: #fff; font-size: 0.75rem;">Alternative Open Slots for this Venue Today:</strong><br>
              ${data.alternatives.sameVenueSlots.map(s => `
                <button type="button" class="suggested-slot-pill" onclick="applySuggestedSlot('${s.startTime}', '${s.endTime}')">
                  🕒 ${s.startTime} - ${s.endTime} (Use This Slot)
                </button>
              `).join('')}
            </div>
          `;
        }

        if (data.alternatives?.otherVenues && data.alternatives.otherVenues.length > 0) {
          html += `
            <div style="margin-top: 0.5rem;">
              <strong style="color: #fff; font-size: 0.75rem;">Alternative Venues Available at ${startTime} - ${endTime}:</strong><br>
              ${data.alternatives.otherVenues.map(v => `
                <button type="button" class="suggested-slot-pill" onclick="applySuggestedVenue('${v.id}')">
                  🏛️ ${v.name} (${v.capacity} seats)
                </button>
              `).join('')}
            </div>
          `;
        }

        banner.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
        if (submitBtn) submitBtn.disabled = true;
      } else {
        banner.className = 'conflict-alert-box free';
        banner.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700;">
            <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
            <span>Verified 100% Free & Available! Zero scheduling conflicts detected.</span>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        if (submitBtn) submitBtn.disabled = false;
      }
    } catch (e) {
      console.error('Conflict check error:', e);
    }
  }, 250);
}

window.applySuggestedSlot = function(start, end) {
  document.getElementById('booking-start').value = start;
  document.getElementById('booking-end').value = end;
  triggerConflictPreview();
};

window.applySuggestedVenue = function(venueId) {
  document.getElementById('booking-resource').value = venueId;
  triggerConflictPreview();
};

// ---------------------------------------------------------------------
// MODAL CONTROLS & USER ACTIONS
// ---------------------------------------------------------------------
function populateResourceDropdown() {
  const sel = document.getElementById('booking-resource');
  if (!sel) return;
  sel.innerHTML = state.resources.map(r => `
    <option value="${r.id}">${r.name} (${r.category} • ${r.capacity} Seats)</option>
  `).join('');
}

function openBookingModal(prefills = {}) {
  if (state.currentRole === 'viewer') {
    showToast('Read-Only Mode: Campus Visitors / Auditors cannot request bookings.', 'warning');
    return;
  }

  const modal = document.getElementById('modal-booking');
  if (!modal) return;

  const todayStr = state.selectedDate;
  document.getElementById('booking-date').value = prefills.date || todayStr;
  if (prefills.resourceId) document.getElementById('booking-resource').value = prefills.resourceId;
  if (prefills.startTime) document.getElementById('booking-start').value = prefills.startTime;
  if (prefills.endTime) document.getElementById('booking-end').value = prefills.endTime;

  // Auto set organizer based on role
  if (state.currentRole === 'student') {
    document.getElementById('booking-organizer').value = 'Alex Rivera';
    document.getElementById('booking-club').value = 'GDSC Student Chapter';
  } else if (state.currentRole === 'faculty') {
    document.getElementById('booking-organizer').value = 'Dr. K. Sharma';
    document.getElementById('booking-club').value = 'Dept of CSE & Robotics';
  } else if (state.currentRole === 'admin') {
    document.getElementById('booking-organizer').value = 'Estate Admin Officer';
    document.getElementById('booking-club').value = 'Campus Administration';
  }

  modal.classList.add('show');
  triggerConflictPreview();
}

function closeBookingModal() {
  document.getElementById('modal-booking')?.classList.remove('show');
}

window.openBookingForResource = function(resourceId) {
  openBookingModal({ resourceId });
};

window.quickBookSlot = function(resourceId, date, start, end) {
  if (state.currentRole === 'viewer') {
    showToast('Read-Only Mode: Campus Visitors / Auditors cannot request bookings.', 'warning');
    return;
  }
  openBookingModal({ resourceId, date, startTime: start, endTime: end });
};

// Form Submission
async function handleBookingSubmit(e) {
  e.preventDefault();

  if (state.currentRole === 'viewer') {
    showToast('Read-Only Mode: Campus Visitors cannot create bookings.', 'danger');
    return;
  }

  const equipment = Array.from(document.querySelectorAll('input[name="equipment"]:checked')).map(el => el.value);

  const payload = {
    resourceId: document.getElementById('booking-resource').value,
    eventTitle: document.getElementById('booking-title').value,
    organizerName: document.getElementById('booking-organizer').value,
    clubName: document.getElementById('booking-club').value,
    department: 'Engineering & Computing',
    role: state.currentRole,
    date: document.getElementById('booking-date').value,
    startTime: document.getElementById('booking-start').value,
    endTime: document.getElementById('booking-end').value,
    expectedAttendees: parseInt(document.getElementById('booking-attendees').value, 10),
    purpose: document.getElementById('booking-purpose').value,
    supervisor: document.getElementById('booking-supervisor').value,
    requestedEquipment: equipment
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        showToast(`❌ Collision Prevented! ${data.message}`, 'danger');
        triggerConflictPreview();
      } else {
        showToast(data.error || 'Failed to submit booking', 'danger');
      }
      return;
    }

    showToast('🎉 Booking request submitted! Awaiting advisor review.', 'success');
    closeBookingModal();
    document.getElementById('form-booking').reset();
    fetchBookings();
    fetchAnalytics();
  } catch (err) {
    console.error('Submit booking error:', err);
    showToast('Network error while booking', 'danger');
  }
}

// ---------------------------------------------------------------------
// Add Resource Modal & Submission (Campus Admin & Faculty HOD)
// ---------------------------------------------------------------------
function openAddResourceModal() {
  if (state.currentRole !== 'admin' && state.currentRole !== 'faculty') {
    showToast('Permission Denied: Only Campus Administrators and Faculty HODs can add resources.', 'danger');
    return;
  }
  const modal = document.getElementById('modal-add-resource');
  if (modal) modal.classList.add('show');
}

function closeAddResourceModal() {
  const modal = document.getElementById('modal-add-resource');
  if (modal) modal.classList.remove('show');
}

async function handleAddResourceSubmit(e) {
  e.preventDefault();

  if (state.currentRole !== 'admin' && state.currentRole !== 'faculty') {
    showToast('Permission Denied: Only Campus Administrators and Faculty HODs can add resources.', 'danger');
    return;
  }

  const name = document.getElementById('new-resource-name')?.value;
  const category = document.getElementById('new-resource-category')?.value;
  const capacity = document.getElementById('new-resource-capacity')?.value;
  const location = document.getElementById('new-resource-location')?.value;
  const building = document.getElementById('new-resource-building')?.value;
  const floor = document.getElementById('new-resource-floor')?.value;
  const openTime = document.getElementById('new-resource-open')?.value || '08:00';
  const closeTime = document.getElementById('new-resource-close')?.value || '21:00';
  const amenitiesStr = document.getElementById('new-resource-amenities')?.value || '';
  const image = document.getElementById('new-resource-image')?.value || '';
  const requiresAdminApproval = document.getElementById('new-resource-requires-admin')?.checked || false;

  const payload = {
    role: state.currentRole,
    name,
    category,
    capacity: parseInt(capacity, 10),
    location,
    building,
    floor,
    image,
    amenities: amenitiesStr ? amenitiesStr.split(',').map(s => s.trim()).filter(Boolean) : [],
    requiresAdminApproval,
    operatingHours: { open: openTime, close: closeTime }
  };

  try {
    const res = await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      data = { error: `Server returned status ${res.status}. Please restart server using run.bat to load latest routes.` };
    }

    if (!res.ok) {
      showToast(data.error || 'Failed to add resource', 'danger');
      return;
    }

    showToast(`🎉 Venue "${data.data.name}" added to catalogue successfully!`, 'success');
    closeAddResourceModal();
    document.getElementById('form-add-resource')?.reset();
    await fetchResources();
    await fetchAnalytics();
  } catch (err) {
    console.error('Add resource error:', err);
    showToast(err.message || 'Network error while adding resource', 'danger');
  }
}

// Digital Pass Viewer
window.viewDigitalPass = async function(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) return;

  const modal = document.getElementById('modal-qr-pass');
  document.getElementById('pass-event-title').textContent = booking.eventTitle;
  document.getElementById('pass-code').textContent = booking.passCode || `PASS-${booking.id.toUpperCase()}`;
  document.getElementById('pass-venue').textContent = booking.resourceName;
  document.getElementById('pass-time').textContent = `${booking.date} (${booking.startTime} - ${booking.endTime})`;
  document.getElementById('pass-organizer').textContent = `${booking.organizerName} (${booking.clubName || booking.department || 'Campus Lead'})`;

  const qrImg = document.getElementById('pass-qr-img');
  if (booking.qrDataUrl) {
    qrImg.src = booking.qrDataUrl;
  } else {
    // Generate QR code dynamically via backend or fallback
    try {
      const res = await fetch(`/api/bookings/${booking.id}/qrcode`);
      const data = await res.json();
      if (data.qrDataUrl) {
        booking.qrDataUrl = data.qrDataUrl;
        qrImg.src = data.qrDataUrl;
      } else {
        const qrPayload = encodeURIComponent(`PASS:${booking.passCode || booking.id}|${booking.resourceName}|${booking.date}`);
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrPayload}`;
      }
    } catch (e) {
      const qrPayload = encodeURIComponent(`PASS:${booking.passCode || booking.id}|${booking.resourceName}|${booking.date}`);
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrPayload}`;
    }
  }

  modal.classList.add('show');
};

// Approval Review Actions
window.openApprovalActionModal = function(bookingId, actionType) {
  if (state.currentRole === 'viewer' || state.currentRole === 'student') {
    showToast('Permission Denied: Only Faculty and Administrators can take approval actions.', 'danger');
    return;
  }

  state.activeActionBookingId = bookingId;
  state.activeActionType = actionType;

  const booking = state.bookings.find(b => b.id === bookingId);
  const modal = document.getElementById('modal-approval-action');
  const title = document.getElementById('modal-action-title');
  const desc = document.getElementById('modal-action-description');
  const btn = document.getElementById('btn-confirm-action');

  if (actionType === 'approve') {
    title.textContent = 'Endorse & Approve Booking';
    desc.textContent = `You are approving "${booking.eventTitle}" for ${booking.resourceName} on ${booking.date} (${booking.startTime} - ${booking.endTime}).`;
    btn.className = 'btn btn-success';
    btn.textContent = 'Approve Booking';
    document.getElementById('action-comment').value = 'Approved. Facilities and equipment verified.';
  } else {
    title.textContent = 'Decline Booking Request';
    desc.textContent = `You are rejecting "${booking.eventTitle}" requested by ${booking.organizerName}. Please specify the reason.`;
    btn.className = 'btn btn-danger';
    btn.textContent = 'Reject Request';
    document.getElementById('action-comment').value = 'Scheduling conflict with academic departmental event.';
  }

  modal.classList.add('show');
};

async function submitApprovalAction() {
  const bookingId = state.activeActionBookingId;
  const actionType = state.activeActionType;
  const note = document.getElementById('action-comment').value;

  if (!bookingId || !actionType) return;

  try {
    const approverName = state.currentRole === 'admin' ? 'Campus Estate Officer' : 'Dr. K. Sharma (HOD CSE)';
    const endpoint = `/api/bookings/${bookingId}/${actionType}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: state.currentRole,
        name: approverName,
        note: note,
        reason: note
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Action failed', 'danger');
      return;
    }

    showToast(data.message, actionType === 'approve' ? 'success' : 'danger');
    document.getElementById('modal-approval-action').classList.remove('show');
    fetchBookings();
    fetchAnalytics();
  } catch (e) {
    console.error('Approval action error:', e);
  }
}

// Cancel Booking
window.cancelBooking = async function(bookingId) {
  if (state.currentRole === 'student' || state.currentRole === 'viewer') {
    showToast('Permission Denied: Student Club Leads and Visitors cannot cancel bookings.', 'danger');
    return;
  }

  if (!confirm('Are you sure you want to cancel this booking and free the slot?')) return;
  try {
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: state.currentRole, name: state.currentRole === 'admin' ? 'Campus Estate Officer' : 'Faculty Approver' })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Booking cancelled and slot released.', 'warning');
      fetchBookings();
      fetchAnalytics();
    } else {
      showToast(data.error || 'Failed to cancel booking', 'danger');
    }
  } catch (e) {
    console.error('Cancel booking error:', e);
  }
};

// Simulation Triggers for Hackathon Demo
async function simulateDoubleBooking() {
  if (state.currentRole === 'viewer') {
    showToast('Read-Only Mode: Simulation is disabled for Visitor persona.', 'warning');
    return;
  }

  try {
    showToast('Executing concurrent booking collision test...', 'info');
    const res = await fetch('/api/simulate-conflict', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`🛡️ Collision successfully prevented! Check the Conflict Resolution Center tab.`, 'danger');
      fetchConflicts();
      fetchAnalytics();
    }
  } catch (e) {
    console.error('Simulation error:', e);
  }
}

// Booking Details & Audit Trail Viewer
window.viewBookingDetails = function(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) return;

  const modal = document.getElementById('modal-audit-trail');
  const summary = document.getElementById('modal-audit-summary');
  const timeline = document.getElementById('modal-audit-timeline');

  summary.innerHTML = `
    <div style="font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem;">${booking.eventTitle}</div>
    <div style="color: #94a3b8;">${booking.resourceName} • ${booking.date} (${booking.startTime} - ${booking.endTime})</div>
    <div style="margin-top: 0.35rem; color: #cbd5e1;">Organizer: <strong>${booking.organizerName}</strong> (${booking.clubName || booking.department})</div>
    <div style="color: #cbd5e1;">Pass Code: <strong style="font-family: monospace; color: var(--accent-indigo);">${booking.passCode || 'Pending Issuance'}</strong></div>
  `;

  if (!booking.approvalHistory || booking.approvalHistory.length === 0) {
    timeline.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem;">No lifecycle audit records yet.</div>`;
  } else {
    timeline.innerHTML = booking.approvalHistory.map((item, idx) => {
      const isApproved = item.status === 'APPROVED' || item.status === 'SUBMITTED';
      return `
        <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: ${isApproved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}; color: ${isApproved ? '#34d399' : '#fda4af'}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">
            ${idx + 1}
          </div>
          <div style="flex: 1; background: rgba(15, 23, 42, 0.4); padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="font-weight: 700; color: #fff;">${item.stage} (${item.status})</span>
              <span style="color: var(--text-muted); font-size: 0.72rem;">${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style="color: #cbd5e1; margin-top: 0.2rem;">By: <strong>${item.by}</strong></div>
            ${item.note ? `<div style="color: #94a3b8; font-style: italic; margin-top: 0.2rem;">"${item.note}"</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('show');
};

async function resetDemoData() {
  if (state.currentRole === 'viewer' || state.currentRole === 'student') {
    showToast('Permission Denied: Only Estate Administrators can reset demo data.', 'danger');
    return;
  }

  if (!confirm('Reset all reservations and conflict logs to initial demo state?')) return;
  try {
    const res = await fetch('/api/reset-demo', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Database reset to default demo scenario.', 'info');
      refreshAllData();
    }
  } catch (e) {
    console.error('Reset error:', e);
  }
}

// ---------------------------------------------------------------------
// INITIALIZATION & EVENT LISTENERS
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Init Date Pickers with Today
  const todayStr = new Date().toISOString().split('T')[0];
  state.selectedDate = todayStr;

  const datePicker = document.getElementById('timeline-date-picker');
  if (datePicker) {
    datePicker.value = todayStr;
    datePicker.addEventListener('change', (e) => {
      state.selectedDate = e.target.value;
      renderTimeline();
    });
  }

  // ── AUTO-SET ROLE FROM LOGIN ──────────────────────────────────────────
  // Read the role stored by login.html and preset the UI
  const savedRole = localStorage.getItem('userRole');   // 'admin' | 'faculty' | 'student' | 'viewer'
  const savedUser = localStorage.getItem('userName') || '';
  const roleSelect = document.getElementById('current-role');

  if (savedRole && roleSelect) {
    // Match the option value
    const matchingOption = Array.from(roleSelect.options).find(o => o.value === savedRole);
    if (matchingOption) {
      roleSelect.value = savedRole;
      state.currentRole = savedRole;
    }

    // Show a welcome banner at the top of the page
    const welcomeRoleLabel = {
      admin:   '🏛️ Campus Administrator',
      faculty: '👨‍🏫 Faculty / HOD',
      student: '🎓 Student Lead',
      viewer:  '👀 Campus Visitor (Read-Only)'
    }[savedRole] || savedRole;

    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
      const badge = document.createElement('div');
      badge.id = 'user-welcome-badge';
      badge.style.cssText = `
        font-size: 0.75rem;
        padding: 0.25rem 0.65rem;
        border-radius: 20px;
        background: rgba(99,102,241,0.15);
        border: 1px solid rgba(99,102,241,0.3);
        color: var(--accent-indigo);
        display: flex;
        align-items: center;
        gap: 0.4rem;
        white-space: nowrap;
      `;
      badge.innerHTML = `${welcomeRoleLabel} &nbsp;
        <button onclick="localStorage.clear(); window.location.href='/login.html';"
          style="background:none;border:none;cursor:pointer;color:#f43f5e;font-size:0.7rem;padding:0;">
          Logout
        </button>`;
      navActions.insertBefore(badge, navActions.firstChild);
    }

    // Keep role selector enabled so user can easily switch personas for testing/demo
    roleSelect.disabled = false;
  }
  // ─────────────────────────────────────────────────────────────────────

  // Role Selector (persona switcher)
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      const newRole = e.target.value;
      state.currentRole = newRole;
      localStorage.setItem('userRole', newRole);
      
      // Update welcome badge if present
      const badge = document.getElementById('user-welcome-badge');
      if (badge) {
        const welcomeRoleLabel = {
          admin:   '🏛️ Campus Administrator',
          faculty: '👨‍🏫 Faculty / HOD',
          student: '🎓 Student Lead',
          viewer:  '👀 Campus Visitor (Read-Only)'
        }[newRole] || newRole;
        badge.innerHTML = `${welcomeRoleLabel} &nbsp;
          <button onclick="localStorage.clear(); window.location.href='/login.html';"
            style="background:none;border:none;cursor:pointer;color:#f43f5e;font-size:0.7rem;padding:0;">
            Logout
          </button>`;
      }

      showToast(`Switched active persona to ${roleSelect.options[roleSelect.selectedIndex].text}`, 'info');
      updateRolePermissionsUI();
      renderApprovals();
      renderMyBookings();
      updateBadges();
    });
  }

  // Update UI permissions based on current active role
  function updateRolePermissionsUI() {
    const canAddResource = state.currentRole === 'admin' || state.currentRole === 'faculty';
    const addResourceBtn = document.getElementById('btn-open-add-resource-modal');
    if (addResourceBtn) {
      addResourceBtn.style.display = canAddResource ? 'inline-flex' : 'none';
    }
  }

  updateRolePermissionsUI();

  // Tab Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      state.activeTab = targetTab;

      const targetView = document.getElementById(`view-${targetTab}`);
      if (targetView) targetView.style.display = 'block';

      if (targetTab === 'timeline') renderTimeline();
      if (targetTab === 'conflicts') renderConflicts();
      if (targetTab === 'approvals') renderApprovals();
      if (targetTab === 'my-bookings') renderMyBookings();
      if (targetTab === 'analytics') renderAnalytics();
    });
  });

  // Resource Filter inputs
  document.getElementById('filter-search')?.addEventListener('input', renderResources);
  document.getElementById('filter-category')?.addEventListener('change', renderResources);

  // Booking Modal Triggers
  document.getElementById('btn-open-booking-modal')?.addEventListener('click', () => openBookingModal());
  document.getElementById('btn-close-booking-modal')?.addEventListener('click', closeBookingModal);
  document.getElementById('btn-cancel-booking-modal')?.addEventListener('click', closeBookingModal);

  // Add Resource Modal Triggers (Admin & HOD)
  document.getElementById('btn-open-add-resource-modal')?.addEventListener('click', openAddResourceModal);
  document.getElementById('btn-close-add-resource-modal')?.addEventListener('click', closeAddResourceModal);
  document.getElementById('btn-cancel-add-resource-modal')?.addEventListener('click', closeAddResourceModal);
  document.getElementById('form-add-resource')?.addEventListener('submit', handleAddResourceSubmit);

  // Dynamic Conflict Preview on Inputs
  ['booking-resource', 'booking-date', 'booking-start', 'booking-end'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', triggerConflictPreview);
    document.getElementById(id)?.addEventListener('change', triggerConflictPreview);
  });

  // Form submission
  document.getElementById('form-booking')?.addEventListener('submit', handleBookingSubmit);

  // QR Modal
  document.getElementById('btn-close-qr-modal')?.addEventListener('click', () => {
    document.getElementById('modal-qr-pass')?.classList.remove('show');
  });
  document.getElementById('btn-done-pass')?.addEventListener('click', () => {
    document.getElementById('modal-qr-pass')?.classList.remove('show');
  });

  // Action Modal
  document.getElementById('btn-close-action-modal')?.addEventListener('click', () => {
    document.getElementById('modal-approval-action')?.classList.remove('show');
  });
  document.getElementById('btn-cancel-action-modal')?.addEventListener('click', () => {
    document.getElementById('modal-approval-action')?.classList.remove('show');
  });
  document.getElementById('btn-confirm-action')?.addEventListener('click', submitApprovalAction);

  // Audit Trail Modal
  document.getElementById('btn-close-audit-modal')?.addEventListener('click', () => {
    document.getElementById('modal-audit-trail')?.classList.remove('show');
  });
  document.getElementById('btn-close-audit-btn')?.addEventListener('click', () => {
    document.getElementById('modal-audit-trail')?.classList.remove('show');
  });

  // Approval Filter buttons
  const btnAll = document.getElementById('filter-approval-all');
  const btnPending = document.getElementById('filter-approval-pending');
  if (btnAll && btnPending) {
    btnAll.addEventListener('click', () => {
      btnAll.className = 'btn btn-primary';
      btnPending.className = 'btn btn-secondary';
      renderApprovals();
    });
    btnPending.addEventListener('click', () => {
      btnPending.className = 'btn btn-primary';
      btnAll.className = 'btn btn-secondary';
      renderApprovals();
    });
  }

  // Demo actions
  document.getElementById('btn-simulate-conflict')?.addEventListener('click', simulateDoubleBooking);
  document.getElementById('btn-trigger-sim-conflict')?.addEventListener('click', simulateDoubleBooking);
  document.getElementById('btn-reset-demo')?.addEventListener('click', resetDemoData);

  // Init Data and WebSockets
  initWebSocket();
  refreshAllData();

  if (window.lucide) window.lucide.createIcons();
});
