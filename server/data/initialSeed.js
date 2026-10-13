const initialSeedData = {
  locations: [
    {
      id: "LOC-01",
      department: "Digital Forensics & Information Security",
      laboratory: "Cyber Forensics Lab",
      room: "Room 302",
      cupboard: "Cupboard A",
      shelf: "Shelf 2",
      description: "Primary forensics hardware repository"
    },
    {
      id: "LOC-02",
      department: "Digital Forensics & Information Security",
      laboratory: "Hardware Security & IoT Lab",
      room: "Room 204",
      cupboard: "Cupboard B",
      shelf: "Shelf 1",
      description: "Microcontroller and embedded devices storage"
    },
    {
      id: "LOC-03",
      department: "Computer Science",
      laboratory: "Networking & Cloud Lab",
      room: "Room 401",
      cupboard: "Cupboard C",
      shelf: "Shelf 3",
      description: "Network adapters and peripheral storage"
    }
  ],
  items: [
    {
      id: "ITEM-DEVBOARD",
      itemCode: "DEV-BOARD-ESP32",
      name: "ESP32-S3 Development Board",
      category: "Development Boards",
      description: "Dual-core Xtensa 32-bit LX7 MCU with Wi-Fi & BLE for hardware security analysis",
      makeModel: "Espressif Systems ESP32-S3-WROOM-1",
      trackingType: "INDIVIDUAL", // INDIVIDUAL or QUANTITY
      totalQuantity: 10,
      availableQuantity: 9, // 1 issued in sample
      issuedQuantity: 1,
      maintenanceQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      locationId: "LOC-02"
    },
    {
      id: "ITEM-USBCABLE",
      itemCode: "CBL-USB-USBC",
      name: "Reusable High-Speed USB-C Data Cable",
      category: "Cables & Adapters",
      description: "1-meter shielded USB Type-C high data-rate testing cables",
      makeModel: "Anker PowerLine+ 60W",
      trackingType: "QUANTITY", // QUANTITY
      totalQuantity: 20,
      availableQuantity: 18, // 2 issued in sample
      issuedQuantity: 2,
      maintenanceQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      locationId: "LOC-02"
    },
    {
      id: "ITEM-ADAPTER",
      itemCode: "ADP-USB-ETH",
      name: "Gigabit USB-C to Ethernet Adapter",
      category: "Network Peripherals",
      description: "Packet inspection network testing interface",
      makeModel: "TP-Link UE300C",
      trackingType: "QUANTITY",
      totalQuantity: 5,
      availableQuantity: 3,
      issuedQuantity: 2,
      maintenanceQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      locationId: "LOC-03"
    },
    {
      id: "ITEM-LAPTOP",
      itemCode: "LPT-SEC-01",
      name: "Forensic Analysis Laptop",
      category: "Workstations",
      description: "Hardened Linux forensic workstation with write-blockers",
      makeModel: "Dell Latitude 5540 i7 32GB",
      trackingType: "INDIVIDUAL",
      totalQuantity: 4,
      availableQuantity: 3,
      issuedQuantity: 1,
      maintenanceQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      locationId: "LOC-01"
    }
  ],
  assets: [
    // 10 development boards with unique asset IDs (DB-001 to DB-010)
    { id: "AST-001", assetId: "DB-001", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982101", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-002", assetId: "DB-002", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982102", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-003", assetId: "DB-003", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982103", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-004", assetId: "DB-004", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982104", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-005", assetId: "DB-005", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982105", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-006", assetId: "DB-006", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982106", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-007", assetId: "DB-007", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982107", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-008", assetId: "DB-008", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982108", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-009", assetId: "DB-009", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982109", locationId: "LOC-02", condition: "Usable", status: "Available" },
    { id: "AST-010", assetId: "DB-010", itemId: "ITEM-DEVBOARD", serialNumber: "ESP-SN-982110", locationId: "LOC-02", condition: "Usable", status: "Issued", currentStudentEnrolment: "DFIS-2026-001" },
    // Forensic laptops
    { id: "AST-011", assetId: "LPT-001", itemId: "ITEM-LAPTOP", serialNumber: "DELL-SN-4411A", locationId: "LOC-01", condition: "Usable", status: "Available" },
    { id: "AST-012", assetId: "LPT-002", itemId: "ITEM-LAPTOP", serialNumber: "DELL-SN-4412B", locationId: "LOC-01", condition: "Usable", status: "Available" },
    { id: "AST-013", assetId: "LPT-003", itemId: "ITEM-LAPTOP", serialNumber: "DELL-SN-4413C", locationId: "LOC-01", condition: "Usable", status: "Available" },
    { id: "AST-014", assetId: "LPT-004", itemId: "ITEM-LAPTOP", serialNumber: "DELL-SN-4414D", locationId: "LOC-01", condition: "Usable", status: "Issued", currentStudentEnrolment: "DFIS-2026-003" }
  ],
  students: [
    {
      id: "STU-01",
      enrolmentNumber: "DFIS-2026-001",
      name: "Priya Sharma",
      programme: "M.Sc. DFIS",
      semester: "Semester I",
      email: "priya.dfis@university.edu",
      contactNumber: "+91-9876543210",
      activeIssuedCount: 2
    },
    {
      id: "STU-02",
      enrolmentNumber: "DFIS-2026-002",
      name: "Rahul Verma",
      programme: "M.Sc. DFIS",
      semester: "Semester I",
      email: "rahul.dfis@university.edu",
      contactNumber: "+91-9876543211",
      activeIssuedCount: 0
    },
    {
      id: "STU-03",
      enrolmentNumber: "DFIS-2026-003",
      name: "Ananya Iyer",
      programme: "M.Sc. DFIS",
      semester: "Semester I",
      email: "ananya.dfis@university.edu",
      contactNumber: "+91-9876543212",
      activeIssuedCount: 1
    },
    {
      id: "STU-04",
      enrolmentNumber: "CS-2026-015",
      name: "Karan Patel",
      programme: "M.Tech Cyber Security",
      semester: "Semester II",
      email: "karan.cs@university.edu",
      contactNumber: "+91-9876543213",
      activeIssuedCount: 0
    }
  ],
  policies: {
    maxItemsPerStudent: 5,
    defaultLoanPeriodDays: 15,
    renewalExtensionDays: 15,
    maxRenewalsAllowed: 2,
    restrictions: [
      "Items marked as Damaged or Under Maintenance cannot be issued.",
      "An individually tracked asset cannot be checked out by more than one student concurrently.",
      "Total issued quantity cannot exceed available stock."
    ]
  },
  issues: [
    {
      id: "ISSUE-1001",
      studentEnrolment: "DFIS-2026-001",
      studentName: "Priya Sharma",
      programme: "M.Sc. DFIS",
      itemId: "ITEM-DEVBOARD",
      itemName: "ESP32-S3 Development Board",
      trackingType: "INDIVIDUAL",
      assetId: "DB-010",
      quantity: 1,
      outstandingQuantity: 1,
      purpose: "Hardware Embedded Security Lab Project",
      issueDate: "2026-10-01T10:00:00.000Z",
      dueDate: "2026-10-16T23:59:59.000Z", // Exactly 15 calendar days from 1 Oct 2026
      issuingStaff: "Dr. S. Rao (Coordinator)",
      status: "Active", // Active, Overdue, Returned, PartialReturned
      renewalsCount: 0,
      acknowledgementGenerated: true,
      acknowledgementNumber: "ACK-2026-00101"
    },
    {
      id: "ISSUE-1002",
      studentEnrolment: "DFIS-2026-001",
      studentName: "Priya Sharma",
      programme: "M.Sc. DFIS",
      itemId: "ITEM-USBCABLE",
      itemName: "Reusable High-Speed USB-C Data Cable",
      trackingType: "QUANTITY",
      assetId: null,
      quantity: 2,
      outstandingQuantity: 2,
      purpose: "Connecting logic analyzer to dev board",
      issueDate: "2026-10-01T10:05:00.000Z",
      dueDate: "2026-10-16T23:59:59.000Z", // Exactly 15 calendar days from 1 Oct 2026
      issuingStaff: "Dr. S. Rao (Coordinator)",
      status: "Active",
      renewalsCount: 0,
      acknowledgementGenerated: true,
      acknowledgementNumber: "ACK-2026-00102"
    },
    {
      id: "ISSUE-0980",
      studentEnrolment: "DFIS-2026-003",
      studentName: "Ananya Iyer",
      programme: "M.Sc. DFIS",
      itemId: "ITEM-LAPTOP",
      itemName: "Forensic Analysis Laptop",
      trackingType: "INDIVIDUAL",
      assetId: "LPT-004",
      quantity: 1,
      outstandingQuantity: 1,
      purpose: "Malware sandbox memory dump analysis",
      issueDate: "2026-09-20T09:30:00.000Z",
      dueDate: "2026-10-05T23:59:59.000Z", // Overdue demonstration
      issuingStaff: "Prof. M. Sharma",
      status: "Overdue",
      renewalsCount: 0,
      acknowledgementGenerated: true,
      acknowledgementNumber: "ACK-2026-00098"
    }
  ],
  renewals: [
    {
      id: "REN-201",
      issueId: "ISSUE-1001",
      studentEnrolment: "DFIS-2026-001",
      studentName: "Priya Sharma",
      itemName: "ESP32-S3 Development Board (DB-010)",
      requestDate: "2026-10-12T11:20:00.000Z",
      currentDueDate: "2026-10-16T23:59:59.000Z",
      proposedDueDate: "2026-10-31T23:59:59.000Z", // +15 days
      status: "Pending", // Pending, Approved, Rejected
      reason: "Need extra time to complete cryptographic side-channel tests.",
      approvingStaff: null,
      decisionDate: null,
      remarks: null
    }
  ],
  auditLogs: [
    {
      id: "AUDIT-001",
      timestamp: "2026-10-01T10:00:00.000Z",
      action: "ITEM_ISSUED",
      responsibleUser: "Dr. S. Rao (Coordinator)",
      details: "Issued 1 unit of ESP32-S3 Development Board (Asset DB-010) to student DFIS-2026-001 (Priya Sharma). Due Date: 16 October 2026."
    },
    {
      id: "AUDIT-002",
      timestamp: "2026-10-01T10:05:00.000Z",
      action: "ITEM_ISSUED",
      responsibleUser: "Dr. S. Rao (Coordinator)",
      details: "Issued 2 units of Reusable High-Speed USB-C Data Cable to student DFIS-2026-001 (Priya Sharma). Available stock updated to 18."
    },
    {
      id: "AUDIT-003",
      timestamp: "2026-10-12T11:20:00.000Z",
      action: "RENEWAL_REQUESTED",
      responsibleUser: "Priya Sharma (DFIS-2026-001)",
      details: "Submitted renewal request for Issue #ISSUE-1001. Proposed due date: 31 October 2026."
    }
  ]
};

module.exports = initialSeedData;
