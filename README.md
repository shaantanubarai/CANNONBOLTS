# 🏛️ UniReserve — Campus Resource Booking & Conflict Resolution System

**College Internal Hackathon — Problem Statement #4**
> *"Build one booking system for campus resources with real-time availability, an approval workflow, and automatic prevention of double bookings."*

---

## 🌟 Solution Overview

**UniReserve** is an enterprise-grade full-stack platform built with a high-performance **Node.js + Express backend** and an **interactive, clean, responsive frontend**. It completely eliminates scheduling chaos and double-booking disasters on campus through mathematical interval checking, real-time WebSocket synchronization, role-based multi-tier approvals, and scannable digital QR entry passes.

---

## 🚀 Key Architectural Pillars

### 1. 🛡️ Automatic Prevention of Double Bookings (Zero-Conflict Guarantee)
- **Mathematical Overlap Detection:** Every proposed time interval $[S_{\text{prop}}, E_{\text{prop}})$ is checked against active reservations $[S_{\text{exist}}, E_{\text{exist}})$ on that date for that venue:
  $$\text{Collision} \iff (S_{\text{prop}} < E_{\text{exist}}) \land (E_{\text{prop}} > S_{\text{exist}})$$
- **Instant Pre-Validation:** As the user selects a venue, date, and times in the booking form, dynamic background checks evaluate the slot in real time. If a conflict is found:
  - Form submission is automatically disabled.
  - A warning banner details the colliding event.
  - **Intelligent Alternative Engine** automatically calculates and offers:
    1. Alternative open windows for that venue on the same day.
    2. Alternative venues with comparable capacity and matching amenities free during that window.
- **Atomic Collision Interception:** Any colliding submission attempting to bypass client validation is halted at the API level with `HTTP 409 Conflict` and logged into the **Conflict Resolution Audit Log**.

### 2. ⚡ Real-Time Availability & Live Schedule Matrix
- **Visual Occupancy Grid:** Interactive timeline mapping venues against 1-hour slots from **08:00 AM to 09:00 PM**.
- **Visual Status Coding:**
  - 🟢 **Available (Free):** Click any green slot to pre-fill the reservation form in 1 click!
  - 🔴 **Approved & Reserved:** Displays event title, club, and time range on hover.
  - 🟡 **Pending Review:** Reserved pending faculty/admin decision.
  - ⚪ **Maintenance / Closed:** Offline for upkeep or outside operating hours.
- **WebSocket Synchronization (`ws`):** Any reservation, approval, or cancellation instantly updates all connected screens without page refreshes.

### 3. 📋 Multi-Tier Approval Workflow
- **Role-Based Personas:** Switch between roles directly from the header dropdown:
  - 🎓 **Student / Club Lead (Alex Rivera - GDSC Chapter):** Requests venues, tracks approvals, views digital passes.
  - 👨‍🏫 **Faculty Approver (Dr. K. Sharma - HOD CSE):** Endorses requests, provides comments, or rejects with feedback.
  - 🏛️ **Campus Administrator (Estate Operations):** Oversees campus-wide facilities, high-capacity venues (e.g. 650-seat APJ Auditorium), and maintenance modes.
- **Audit Trail & Lifecycle:** Every state transition records timestamps, approver names, roles, and review remarks.

### 4. 🎫 Verifiable Digital QR Entry Passes
- Once a booking receives final approval, the backend automatically generates a cryptographic **Digital Gate Pass** with a **QR code** (via `qrcode` library).
- Security guards and lab attendants can scan the pass at the door to verify authorization, attendees, and allocated timings.

### 5. 📊 Campus Utilization Analytics & Live Simulator
- **Live Metrics:** Total reservations, approved count, pending review, and **double-bookings prevented counter**.
- **Venue Demand Ranking:** Identifies highest-demand facilities.
- **⚡ Live Collision Simulator:** 1-click button designed specifically for hackathon judges to witness concurrent double-booking interception in real time.

---

## 📁 Project Structure

```
campus-resource-hub/
├── package.json               # Node.js dependencies (express, ws, cors, qrcode)
├── server.js                  # Express HTTP server + WebSocket broadcast hub
├── data/
│   ├── store.js               # In-memory + persistent JSON database store
│   └── database.json          # Seed campus venues, initial bookings, conflict logs
├── services/
│   ├── conflictEngine.js      # Zero-conflict algorithm & alternative recommendation logic
│   └── approvalWorkflow.js    # Multi-stage approval state machine & QR pass generator
├── public/
│   ├── index.html             # Clean, modern single-page dashboard layout
│   ├── css/
│   │   └── styles.css         # Glassmorphism dark aesthetic, badges, timeline grid
│   └── js/
│       └── app.js             # Client controller, WebSocket sync, live conflict check
└── README.md
```

---

## 🏃 Running the Application

### 1. Start the Server
Open PowerShell in the project directory:
```powershell
node server.js
```
The server will start at:
- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **WebSocket Stream:** `ws://localhost:3000`

---

## 🏆 Hackathon Demonstration Script (How to Present to Judges)

1. **Show Real-Time Availability:**
   - Go to the **Live Schedule Matrix** tab. Show how different campus venues (APJ Kalam Auditorium, Turing AI Lab, CV Raman Hall) have green (available), red (approved), and yellow (pending) blocks.
   - Click any green box to show 1-click pre-fill in the booking modal.

2. **Demonstrate Automatic Prevention of Double Bookings:**
   - In the booking modal, select **Dr. APJ Abdul Kalam Auditorium** for Today at **10:00 AM - 11:30 AM**.
   - Notice the live preview banner immediately lights up red:
     > *"Conflict Detected: Double-Booking Prevented! Collides with Annual Inter-College Hackathon Opening Ceremony (09:00 - 12:00)"*
   - Show the suggested alternative slots (e.g. 12:00 PM) and alternative venues (Turing Lab, CV Raman Hall).
   - Click on one of the suggested slot buttons to show the times update automatically!

3. **Demonstrate Hackathon Collision Simulation:**
   - Click the top demo button: **`⚡ Simulate Collision & Prevention`**.
   - Show the instant alert notification.
   - Switch to the **Conflict Resolution Center** tab to show the logged collision and how the engine averted the double booking.

4. **Demonstrate Approval Workflow & QR Gate Pass:**
   - Switch active persona to **Faculty Approver (Dr. K. Sharma)**.
   - Go to **Approval Workflow** tab and click **Approve** on a pending booking.
   - Switch back to **Student** persona, go to **My Bookings & QR Pass**, and click **View Digital QR Pass** to present the official verifiable QR code entry badge.
