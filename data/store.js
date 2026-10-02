const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

// Default initial seed data if DB_FILE doesn't exist
const initialResources = [
  {
    id: "res-1",
    name: "Dr. APJ Abdul Kalam Auditorium",
    category: "Auditorium",
    capacity: 650,
    location: "Main Academic Block, Ground Floor",
    building: "Academic Block A",
    floor: "Ground Floor",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=60",
    amenities: ["Dual 4K Laser Projectors", "Surround Sound & 8 Wireless Mics", "Central AC", "Stage Lighting", "Live-Stream Rig"],
    requiresAdminApproval: true,
    operatingHours: { open: "08:00", close: "21:00" },
    status: "active" // active, maintenance
  },
  {
    id: "res-2",
    name: "Turing Advanced Computing & AI Lab",
    category: "Computer Lab",
    capacity: 75,
    location: "CS Block, 3rd Floor - Room 304",
    building: "Turing Computer Center",
    floor: "3rd Floor",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=60",
    amenities: ["75 High-End GPU Workstations", "Gigabit LAN & WiFi 6", "Smart Interactive Board", "Central AC", "UPS Backup"],
    requiresAdminApproval: false,
    operatingHours: { open: "08:00", close: "20:00" },
    status: "active"
  },
  {
    id: "res-3",
    name: "Sir CV Raman Seminar Hall",
    category: "Seminar Hall",
    capacity: 180,
    location: "Science Complex, 1st Floor",
    building: "Science & Innovation Block",
    floor: "1st Floor",
    image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=60",
    amenities: ["Acoustic Wall Panels", "Full HD Projector", "Podium with Mic", "AC", "Video Conferencing Setup"],
    requiresAdminApproval: false,
    operatingHours: { open: "08:00", close: "20:00" },
    status: "active"
  },
  {
    id: "res-4",
    name: "Smart Lecture Theatre LT-102",
    category: "Classroom",
    capacity: 120,
    location: "Academic Block B, Room 102",
    building: "Academic Block B",
    floor: "1st Floor",
    image: "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=60",
    amenities: ["Tiered Seating", "Touchscreen Smart Board", "Mic & PA System", "AC", "High-Speed WiFi"],
    requiresAdminApproval: false,
    operatingHours: { open: "08:00", close: "19:00" },
    status: "active"
  },
  {
    id: "res-5",
    name: "Aryabhata Innovation & IoT Studio",
    category: "Innovation Lab",
    capacity: 45,
    location: "R&D Centre, 2nd Floor",
    building: "R&D Wing",
    floor: "2nd Floor",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=60",
    amenities: ["Oscilloscopes & Soldering Stations", "3D Printers", "Embedded Development Kits", "AC", "Modular Benches"],
    requiresAdminApproval: false,
    operatingHours: { open: "08:00", close: "20:00" },
    status: "active"
  },
  {
    id: "res-6",
    name: "Indoor Multipurpose Sports Arena",
    category: "Sports Complex",
    capacity: 350,
    location: "Student Activity Center, West Wing",
    building: "SAC Complex",
    floor: "Ground Floor",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=60",
    amenities: ["Synthetic Wooden Flooring", "Badminton & Basketball Courts", "Spectator Bleachers", "Floodlights", "Locker Rooms"],
    requiresAdminApproval: true,
    operatingHours: { open: "06:00", close: "21:00" },
    status: "active"
  },
  {
    id: "res-7",
    name: "Media Production & Podcasting Studio",
    category: "Media Kit / Studio",
    capacity: 20,
    location: "Library Basement, Studio Room 03",
    building: "Central Library",
    floor: "Basement",
    image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&auto=format&fit=crop&q=60",
    amenities: ["4K Broadcast Cameras", "Shure Podcasting Microphones", "Green Screen Chroma Wall", "Sound Isolation Booth", "Editing Station"],
    requiresAdminApproval: false,
    operatingHours: { open: "09:00", close: "18:00" },
    status: "active"
  }
];

function getTodayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function getInitialBookings() {
  const today = getTodayString(0);
  const tomorrow = getTodayString(1);

  return [
    {
      id: "book-101",
      resourceId: "res-1",
      resourceName: "Dr. APJ Abdul Kalam Auditorium",
      eventTitle: "Annual Inter-College Hackathon Opening Ceremony",
      organizerName: "Alex Rivera",
      clubName: "Google Developer Student Club (GDSC)",
      department: "Computer Science & Engineering",
      role: "student",
      date: today,
      startTime: "09:00",
      endTime: "12:00",
      expectedAttendees: 450,
      purpose: "Inaugural keynote, problem statement release, and team onboarding.",
      requestedEquipment: ["Dual 4K Laser Projectors", "Surround Sound & 8 Wireless Mics", "Stage Lighting"],
      status: "APPROVED", // PENDING, APPROVED, REJECTED, CANCELLED
      approvalStage: "COMPLETED",
      supervisor: "Dr. K. Sharma (HOD CSE)",
      passCode: "PASS-AUD-8821",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      approvalHistory: [
        {
          stage: "Faculty Advisor",
          status: "APPROVED",
          by: "Dr. K. Sharma",
          note: "Recommended for university-level technical fest.",
          timestamp: new Date(Date.now() - 72000000).toISOString()
        },
        {
          stage: "Estate Admin",
          status: "APPROVED",
          by: "Campus Estate Officer",
          note: "Approved. Main AC and power backup scheduled.",
          timestamp: new Date(Date.now() - 50000000).toISOString()
        }
      ]
    },
    {
      id: "book-102",
      resourceId: "res-2",
      resourceName: "Turing Advanced Computing & AI Lab",
      eventTitle: "Hands-on Deep Learning & LLM Fine-Tuning Bootcamp",
      organizerName: "Samantha Chen",
      clubName: "ACM Student Chapter",
      department: "Data Science & AI",
      role: "student",
      date: today,
      startTime: "13:00",
      endTime: "16:00",
      expectedAttendees: 60,
      purpose: "Intensive lab workshop training students on PyTorch and model deployment.",
      requestedEquipment: ["75 High-End GPU Workstations", "Smart Interactive Board"],
      status: "APPROVED",
      approvalStage: "COMPLETED",
      supervisor: "Prof. Rajesh Verma",
      passCode: "PASS-LAB-3141",
      createdAt: new Date(Date.now() - 50000000).toISOString(),
      approvalHistory: [
        {
          stage: "Faculty Advisor",
          status: "APPROVED",
          by: "Prof. Rajesh Verma",
          note: "Lab assistants instructed to prepare GPU cluster accounts.",
          timestamp: new Date(Date.now() - 36000000).toISOString()
        }
      ]
    },
    {
      id: "book-103",
      resourceId: "res-3",
      resourceName: "Sir CV Raman Seminar Hall",
      eventTitle: "Guest Lecture: Quantum Algorithms in Cryptography",
      organizerName: "Dr. Elena Rostova",
      clubName: "Physics & Computing Forum",
      department: "Mathematics & Physics",
      role: "faculty",
      date: today,
      startTime: "14:00",
      endTime: "16:00",
      expectedAttendees: 110,
      purpose: "Invited academic talk by visiting research scientist.",
      requestedEquipment: ["Full HD Projector", "Podium with Mic", "AC"],
      status: "PENDING",
      approvalStage: "PENDING_FACULTY",
      supervisor: "Dean of Academic Affairs",
      passCode: null,
      createdAt: new Date(Date.now() - 10000000).toISOString(),
      approvalHistory: []
    },
    {
      id: "book-104",
      resourceId: "res-4",
      resourceName: "Smart Lecture Theatre LT-102",
      eventTitle: "Robotics Club Internal Design Review",
      organizerName: "Marcus Sterling",
      clubName: "Robotics & Automation Society",
      department: "Mechanical & Mechatronics",
      role: "student",
      date: today,
      startTime: "16:00",
      endTime: "18:00",
      expectedAttendees: 40,
      purpose: "Final review of Autonomous Ground Vehicle CAD designs.",
      requestedEquipment: ["Touchscreen Smart Board", "High-Speed WiFi"],
      status: "PENDING",
      approvalStage: "PENDING_FACULTY",
      supervisor: "Dr. Anita Roy",
      passCode: null,
      createdAt: new Date(Date.now() - 5000000).toISOString(),
      approvalHistory: []
    },
    {
      id: "book-105",
      resourceId: "res-1",
      resourceName: "Dr. APJ Abdul Kalam Auditorium",
      eventTitle: "Cultural Society Music Gala Rehearsals",
      organizerName: "Rohan Kapoor",
      clubName: "Campus Symphony & Band",
      department: "Student Affairs",
      role: "student",
      date: tomorrow,
      startTime: "15:00",
      endTime: "19:00",
      expectedAttendees: 150,
      purpose: "Stage soundcheck and orchestral rehearsal for Foundation Day.",
      requestedEquipment: ["Surround Sound & 8 Wireless Mics", "Stage Lighting"],
      status: "APPROVED",
      approvalStage: "COMPLETED",
      supervisor: "Prof. S. N. Bannerjee",
      passCode: "PASS-AUD-9904",
      createdAt: new Date(Date.now() - 40000000).toISOString(),
      approvalHistory: [
        {
          stage: "Faculty Advisor",
          status: "APPROVED",
          by: "Prof. S. N. Bannerjee",
          note: "Approved for evening rehearsal session.",
          timestamp: new Date(Date.now() - 30000000).toISOString()
        }
      ]
    }
  ];
}

class Store {
  constructor() {
    this.data = {
      resources: [],
      bookings: [],
      conflictLog: [],
      notifications: []
    };
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
        console.log(`[Store] Loaded ${this.data.resources.length} resources, ${this.data.bookings.length} bookings from disk.`);
      } else {
        this.data.resources = initialResources;
        this.data.bookings = getInitialBookings();
        this.data.conflictLog = [
          {
            id: "conf-1",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            resourceId: "res-1",
            resourceName: "Dr. APJ Abdul Kalam Auditorium",
            attemptedBy: "Web Dev Club",
            requestedTime: "09:30 - 11:30",
            date: getTodayString(0),
            reason: "Double-booking prevented: Collided with 'Hackathon Opening Ceremony' (09:00 - 12:00)",
            actionTaken: "Automatically blocked & alternative slots suggested"
          }
        ];
        this.data.notifications = [
          {
            id: "notif-1",
            title: "Booking Approved!",
            message: "GDSC's request for Dr. APJ Abdul Kalam Auditorium has been fully approved. Digital entry pass issued.",
            timestamp: new Date(Date.now() - 50000000).toISOString(),
            type: "success",
            read: false
          },
          {
            id: "notif-2",
            title: "Pending Approval Request",
            message: "New booking request from Robotics Club for LT-102 awaits faculty advisor review.",
            timestamp: new Date(Date.now() - 5000000).toISOString(),
            type: "warning",
            read: false
          }
        ];
        this.save();
        console.log(`[Store] Initialized fresh database with seed records.`);
      }
    } catch (err) {
      console.error("[Store] Error loading database, creating fallback:", err);
      this.data.resources = initialResources;
      this.data.bookings = getInitialBookings();
      this.data.conflictLog = [];
      this.data.notifications = [];
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error("[Store] Failed to save database file:", err);
    }
  }

  // Resources
  getResources() {
    return this.data.resources;
  }

  getResourceById(id) {
    return this.data.resources.find(r => r.id === id);
  }

  addResource(resource) {
    this.data.resources.push(resource);
    this.save();
    return resource;
  }

  updateResource(id, updates) {
    const idx = this.data.resources.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.data.resources[idx] = { ...this.data.resources[idx], ...updates };
      this.save();
      return this.data.resources[idx];
    }
    return null;
  }

  // Bookings
  getBookings() {
    return this.data.bookings;
  }

  getBookingById(id) {
    return this.data.bookings.find(b => b.id === id);
  }

  addBooking(booking) {
    this.data.bookings.push(booking);
    this.save();
    return booking;
  }

  updateBooking(id, updates) {
    const idx = this.data.bookings.findIndex(b => b.id === id);
    if (idx !== -1) {
      this.data.bookings[idx] = { ...this.data.bookings[idx], ...updates };
      this.save();
      return this.data.bookings[idx];
    }
    return null;
  }

  deleteBooking(id) {
    const idx = this.data.bookings.findIndex(b => b.id === id);
    if (idx !== -1) {
      const removed = this.data.bookings.splice(idx, 1)[0];
      this.save();
      return removed;
    }
    return null;
  }

  // Conflict Logs
  getConflictLogs() {
    return this.data.conflictLog;
  }

  addConflictLog(log) {
    this.data.conflictLog.unshift(log); // newest first
    if (this.data.conflictLog.length > 50) this.data.conflictLog.pop();
    this.save();
    return log;
  }

  // Notifications
  getNotifications() {
    return this.data.notifications;
  }

  addNotification(notif) {
    this.data.notifications.unshift(notif);
    if (this.data.notifications.length > 30) this.data.notifications.pop();
    this.save();
    return notif;
  }

  markAllNotificationsRead() {
    this.data.notifications.forEach(n => n.read = true);
    this.save();
    return this.data.notifications;
  }

  resetToDefault() {
    this.data.resources = initialResources;
    this.data.bookings = getInitialBookings();
    this.data.conflictLog = [];
    this.data.notifications = [];
    this.save();
    return { success: true, message: "Database reset to initial demo state" };
  }
}

module.exports = new Store();
