const express = require('express');
const router = express.Router();
const { getMemoryDb, persistMemoryDb, resetDbToSeed, getIsMongoConnected } = require('../db');

// Helper: Calculate overdue days
function calculateOverdue(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

// Helper: Log audit action
function createAuditLog(action, responsibleUser, details) {
  const db = getMemoryDb();
  const logEntry = {
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    action,
    responsibleUser,
    details
  };
  db.auditLogs.unshift(logEntry);
  persistMemoryDb();
  return logEntry;
}

// 1. Health check & System info
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Department Inventory & Student Item Issue Management System',
    timestamp: new Date().toISOString(),
    mongoConnected: getIsMongoConnected(),
    engine: getIsMongoConnected() ? 'MongoDB Cluster' : 'Embedded JSON Datastore'
  });
});

// 2. Summary stats for Coordinator Dashboard
router.get('/stats', (req, res) => {
  const db = getMemoryDb();
  
  let totalItemsCount = 0;
  let totalAvailableCount = 0;
  let totalIssuedCount = 0;
  let totalMaintenanceCount = 0;
  let totalDamagedCount = 0;
  let totalLostCount = 0;

  db.items.forEach(item => {
    totalItemsCount += Number(item.totalQuantity || 0);
    totalAvailableCount += Number(item.availableQuantity || 0);
    totalIssuedCount += Number(item.issuedQuantity || 0);
    totalMaintenanceCount += Number(item.maintenanceQuantity || 0);
    totalDamagedCount += Number(item.damagedQuantity || 0);
    totalLostCount += Number(item.lostQuantity || 0);
  });

  // Calculate active overdues
  const now = new Date();
  const overdueIssues = db.issues.filter(i => {
    if (i.status === 'Returned') return false;
    const due = new Date(i.dueDate);
    return due < now;
  });

  const pendingRenewals = db.renewals.filter(r => r.status === 'Pending').length;

  res.json({
    totalQuantity: totalItemsCount,
    availableQuantity: totalAvailableCount,
    issuedQuantity: totalIssuedCount,
    maintenanceQuantity: totalMaintenanceCount,
    damagedQuantity: totalDamagedCount,
    lostQuantity: totalLostCount,
    overdueCount: overdueIssues.length,
    pendingRenewalsCount: pendingRenewals,
    totalRegisteredStudents: db.students.length,
    storageLocationsCount: db.locations.length
  });
});

// 3. Storage Locations
router.get('/locations', (req, res) => {
  const db = getMemoryDb();
  res.json(db.locations);
});

router.post('/locations', (req, res) => {
  const db = getMemoryDb();
  const { department, laboratory, room, cupboard, shelf, description } = req.body;
  if (!department || !laboratory || !room) {
    return res.status(400).json({ error: 'Department, laboratory, and room are required fields.' });
  }
  const newLocation = {
    id: `LOC-${Date.now().toString().slice(-4)}`,
    department,
    laboratory,
    room,
    cupboard: cupboard || 'N/A',
    shelf: shelf || 'N/A',
    description: description || ''
  };
  db.locations.push(newLocation);
  createAuditLog('LOCATION_CREATED', req.body.responsibleUser || 'Coordinator', `Added storage location: ${laboratory} (${room}, ${cupboard})`);
  persistMemoryDb();
  res.status(201).json(newLocation);
});

// 4. Inventory Items
router.get('/items', (req, res) => {
  const db = getMemoryDb();
  // enrich with location info
  const enriched = db.items.map(item => {
    const loc = db.locations.find(l => l.id === item.locationId);
    return {
      ...item,
      locationDetails: loc ? `${loc.laboratory} (${loc.room}, ${loc.cupboard})` : 'Unassigned'
    };
  });
  res.json(enriched);
});

router.post('/items', (req, res) => {
  const db = getMemoryDb();
  const { itemCode, name, category, description, makeModel, trackingType, totalQuantity, locationId } = req.body;
  
  if (!itemCode || !name || !trackingType) {
    return res.status(400).json({ error: 'Item code, name, and tracking type are required.' });
  }

  const existing = db.items.find(i => i.itemCode.toLowerCase() === itemCode.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `Item code ${itemCode} already exists.` });
  }

  const qty = parseInt(totalQuantity, 10) || 0;

  const newItem = {
    id: `ITEM-${Date.now().toString().slice(-6)}`,
    itemCode,
    name,
    category: category || 'General Hardware',
    description: description || '',
    makeModel: makeModel || 'Generic',
    trackingType: trackingType === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'QUANTITY',
    totalQuantity: qty,
    availableQuantity: qty,
    issuedQuantity: 0,
    maintenanceQuantity: 0,
    damagedQuantity: 0,
    lostQuantity: 0,
    locationId: locationId || (db.locations[0]?.id || '')
  };

  db.items.push(newItem);
  createAuditLog('ITEM_CREATED', req.body.responsibleUser || 'Coordinator', `Created item ${newItem.name} (${newItem.itemCode}) with total quantity ${qty}`);
  persistMemoryDb();
  res.status(201).json(newItem);
});

// 5. Individual Assets (for items with trackingType === 'INDIVIDUAL')
router.get('/assets', (req, res) => {
  const db = getMemoryDb();
  const { itemId, status } = req.query;
  let list = db.assets;
  if (itemId) list = list.filter(a => a.itemId === itemId);
  if (status) list = list.filter(a => a.status === status);

  const enriched = list.map(a => {
    const item = db.items.find(i => i.id === a.itemId);
    const loc = db.locations.find(l => l.id === a.locationId);
    return {
      ...a,
      itemName: item?.name || 'Unknown Item',
      itemCode: item?.itemCode || 'Unknown Code',
      locationDetails: loc ? `${loc.laboratory} (${loc.room})` : 'Unassigned'
    };
  });
  res.json(enriched);
});

router.post('/assets', (req, res) => {
  const db = getMemoryDb();
  const { assetId, itemId, serialNumber, locationId, condition } = req.body;

  if (!assetId || !itemId) {
    return res.status(400).json({ error: 'Asset ID and Item ID are required.' });
  }

  const existing = db.assets.find(a => a.assetId.toLowerCase() === assetId.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `Asset ID "${assetId}" is already registered. Unique ID is strictly required.` });
  }

  const item = db.items.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Referenced inventory item not found.' });
  }

  const newAsset = {
    id: `AST-${Date.now().toString().slice(-6)}`,
    assetId: assetId.trim().toUpperCase(),
    itemId,
    serialNumber: serialNumber || 'N/A',
    locationId: locationId || item.locationId,
    condition: condition || 'Usable',
    status: 'Available',
    currentStudentEnrolment: null
  };

  db.assets.push(newAsset);
  // increment item total & available quantity
  item.totalQuantity = (item.totalQuantity || 0) + 1;
  item.availableQuantity = (item.availableQuantity || 0) + 1;

  createAuditLog('ASSET_REGISTERED', req.body.responsibleUser || 'Coordinator', `Registered individual asset ${newAsset.assetId} for item ${item.name}`);
  persistMemoryDb();
  res.status(201).json(newAsset);
});

// Update asset condition/status (e.g., mark damaged, maintenance, or restore to usable)
router.put('/assets/:id/status', (req, res) => {
  const db = getMemoryDb();
  const { condition, status, responsibleUser } = req.body;
  const asset = db.assets.find(a => a.id === req.params.id || a.assetId === req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });

  const oldCondition = asset.condition;
  const oldStatus = asset.status;
  const item = db.items.find(i => i.id === asset.itemId);

  if (condition) asset.condition = condition;
  if (status) asset.status = status;

  // Sync item counters if condition changes
  if (item) {
    if (oldCondition === 'Usable' && (asset.condition === 'Damaged' || asset.condition === 'Under Maintenance')) {
      item.availableQuantity = Math.max(0, item.availableQuantity - 1);
      if (asset.condition === 'Damaged') item.damagedQuantity = (item.damagedQuantity || 0) + 1;
      if (asset.condition === 'Under Maintenance') item.maintenanceQuantity = (item.maintenanceQuantity || 0) + 1;
    } else if ((oldCondition === 'Damaged' || oldCondition === 'Under Maintenance') && asset.condition === 'Usable') {
      if (oldCondition === 'Damaged') item.damagedQuantity = Math.max(0, item.damagedQuantity - 1);
      if (oldCondition === 'Under Maintenance') item.maintenanceQuantity = Math.max(0, item.maintenanceQuantity - 1);
      if (asset.status === 'Available') {
        item.availableQuantity = (item.availableQuantity || 0) + 1;
      }
    }
  }

  createAuditLog('ASSET_STATUS_UPDATED', responsibleUser || 'Coordinator', `Asset ${asset.assetId} condition updated from ${oldCondition}/${oldStatus} to ${asset.condition}/${asset.status}`);
  persistMemoryDb();
  res.json(asset);
});

// 6. Registered Students
router.get('/students', (req, res) => {
  const db = getMemoryDb();
  res.json(db.students);
});

router.post('/students', (req, res) => {
  const db = getMemoryDb();
  const { enrolmentNumber, name, programme, semester, email, contactNumber } = req.body;

  if (!enrolmentNumber || !name || !programme || !semester) {
    return res.status(400).json({ error: 'Enrolment number, name, programme, and semester are required.' });
  }

  const existing = db.students.find(s => s.enrolmentNumber.toLowerCase() === enrolmentNumber.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `Student with enrolment number ${enrolmentNumber} is already registered.` });
  }

  const newStudent = {
    id: `STU-${Date.now().toString().slice(-4)}`,
    enrolmentNumber: enrolmentNumber.trim().toUpperCase(),
    name: name.trim(),
    programme: programme.trim(),
    semester: semester.trim(),
    email: email || `${enrolmentNumber.toLowerCase()}@university.edu`,
    contactNumber: contactNumber || '+91-XXXXXXXXXX',
    activeIssuedCount: 0
  };

  db.students.push(newStudent);
  createAuditLog('STUDENT_REGISTERED', req.body.responsibleUser || 'Coordinator', `Registered student ${newStudent.name} (${newStudent.enrolmentNumber})`);
  persistMemoryDb();
  res.status(201).json(newStudent);
});

// 7. Issue Items (Mandatory Rules 1-5 enforcement)
router.post('/issues', (req, res) => {
  const db = getMemoryDb();
  const { studentEnrolment, itemId, assetId, quantity, purpose, issuingStaff, issueDate } = req.body;

  // Mandatory Rule 1: Items can be issued only to registered students.
  const student = db.students.find(s => s.enrolmentNumber.toUpperCase() === (studentEnrolment || '').trim().toUpperCase());
  if (!student) {
    return res.status(400).json({
      error: `Failed to issue: Student with enrolment number "${studentEnrolment}" is not registered. Items can only be issued to registered students.`
    });
  }

  // Check item
  const item = db.items.find(i => i.id === itemId || i.itemCode === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Inventory item not found.' });
  }

  const requestedQty = parseInt(quantity, 10) || 1;

  // Mandatory Rule 3: The issued quantity cannot exceed the available stock.
  // "If an issue request cannot be fulfilled, the system must clearly explain the reason."
  if (requestedQty > item.availableQuantity) {
    return res.status(400).json({
      error: `Stock Unavailability: ${requestedQty} ${item.name} were requested, but only ${item.availableQuantity} are currently available.`
    });
  }

  // Individually tracked asset verification
  let selectedAsset = null;
  if (item.trackingType === 'INDIVIDUAL') {
    if (!assetId) {
      return res.status(400).json({
        error: `Item "${item.name}" is individually tracked. A specific unique Asset ID must be selected.`
      });
    }

    selectedAsset = db.assets.find(a => a.assetId.toUpperCase() === assetId.trim().toUpperCase() && a.itemId === item.id);
    if (!selectedAsset) {
      return res.status(404).json({ error: `Asset ID "${assetId}" not found for this item.` });
    }

    // Mandatory Rule 2: Only available items in usable condition can be issued.
    if (selectedAsset.condition !== 'Usable') {
      return res.status(400).json({
        error: `Asset ${selectedAsset.assetId} cannot be issued because its current condition is "${selectedAsset.condition}". Only usable items can be issued.`
      });
    }

    // Mandatory Rule 4: An individually tracked asset cannot be issued to more than one student at the same time.
    if (selectedAsset.status === 'Issued') {
      return res.status(400).json({
        error: `Asset Conflict: Asset ${selectedAsset.assetId} is already issued to student ${selectedAsset.currentStudentEnrolment} and cannot be issued to another student simultaneously.`
      });
    }
  }

  // Mandatory Rule 5: Automatically calculate the due date as 15 calendar days after the issue date.
  const actualIssueDate = issueDate ? new Date(issueDate) : new Date();
  const calculatedDueDate = new Date(actualIssueDate.getTime() + (15 * 24 * 60 * 60 * 1000));
  calculatedDueDate.setHours(23, 59, 59, 999);

  const ackNumber = `ACK-${Date.now().toString().slice(-6)}`;

  const newIssue = {
    id: `ISSUE-${Date.now().toString().slice(-5)}`,
    studentEnrolment: student.enrolmentNumber,
    studentName: student.name,
    programme: student.programme,
    itemId: item.id,
    itemName: item.name,
    trackingType: item.trackingType,
    assetId: selectedAsset ? selectedAsset.assetId : null,
    quantity: requestedQty,
    outstandingQuantity: requestedQty,
    purpose: purpose || 'Academic Lab Exercise',
    issueDate: actualIssueDate.toISOString(),
    dueDate: calculatedDueDate.toISOString(),
    issuingStaff: issuingStaff || 'Department Coordinator',
    status: 'Active',
    renewalsCount: 0,
    acknowledgementGenerated: true,
    acknowledgementNumber: ackNumber
  };

  // Update Item stock
  item.availableQuantity -= requestedQty;
  item.issuedQuantity = (item.issuedQuantity || 0) + requestedQty;

  // Update Asset status if individual
  if (selectedAsset) {
    selectedAsset.status = 'Issued';
    selectedAsset.currentStudentEnrolment = student.enrolmentNumber;
  }

  // Update Student active issued count
  student.activeIssuedCount = (student.activeIssuedCount || 0) + requestedQty;

  db.issues.unshift(newIssue);

  // Mandatory Rule 12: Record issue in audit log with responsible user and date
  createAuditLog(
    'ITEM_ISSUED',
    issuingStaff || 'Coordinator',
    `Issued ${requestedQty} unit(s) of ${item.name}${selectedAsset ? ` (Asset: ${selectedAsset.assetId})` : ''} to ${student.name} (${student.enrolmentNumber}). Due date: ${calculatedDueDate.toDateString()} (15 days loan). Ack #${ackNumber}`
  );

  persistMemoryDb();
  res.status(201).json(newIssue);
});

// 8. Get Issues (supports filters: studentEnrolment, status, programme, overdueOnly)
router.get('/issues', (req, res) => {
  const db = getMemoryDb();
  const { studentEnrolment, status, programme, itemCode, overdueOnly } = req.query;

  const now = new Date();
  let list = db.issues.map(iss => {
    const isReturned = iss.status === 'Returned';
    const due = new Date(iss.dueDate);
    const isOverdue = !isReturned && due < now;
    const overdueDays = isOverdue ? calculateOverdue(iss.dueDate) : 0;

    let computedStatus = iss.status;
    if (!isReturned && isOverdue) {
      computedStatus = 'Overdue';
    }

    return {
      ...iss,
      computedStatus,
      isOverdue,
      overdueDays
    };
  });

  if (studentEnrolment) {
    list = list.filter(i => i.studentEnrolment.toUpperCase() === studentEnrolment.trim().toUpperCase());
  }
  if (programme) {
    list = list.filter(i => i.programme.toLowerCase().includes(programme.toLowerCase()));
  }
  if (status) {
    list = list.filter(i => i.computedStatus.toLowerCase() === status.toLowerCase());
  }
  if (overdueOnly === 'true') {
    list = list.filter(i => i.isOverdue);
  }

  res.json(list);
});

// 9. Return Items (Mandatory Rules 9-11 enforcement)
router.post('/issues/:id/return', (req, res) => {
  const db = getMemoryDb();
  const { returnQuantity, conditionOnReturn, receivingStaff, returnDate, remarks } = req.body;

  const issue = db.issues.find(i => i.id === req.params.id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue transaction record not found.' });
  }

  if (issue.status === 'Returned') {
    return res.status(400).json({ error: 'This issue transaction has already been completely returned.' });
  }

  const qtyToReturn = parseInt(returnQuantity, 10) || issue.outstandingQuantity;
  if (qtyToReturn <= 0 || qtyToReturn > issue.outstandingQuantity) {
    return res.status(400).json({
      error: `Invalid return quantity: ${qtyToReturn}. Outstanding quantity is ${issue.outstandingQuantity}.`
    });
  }

  const item = db.items.find(i => i.id === issue.itemId);
  const student = db.students.find(s => s.enrolmentNumber === issue.studentEnrolment);
  const condition = conditionOnReturn || 'Usable'; // 'Usable', 'Damaged', 'Maintenance'

  // Update outstanding quantity
  issue.outstandingQuantity -= qtyToReturn;
  if (issue.outstandingQuantity === 0) {
    issue.status = 'Returned';
  } else {
    // Mandatory Rule 11: Partial returns must be supported, with the remaining quantity continuing as outstanding.
    issue.status = 'PartialReturned';
  }

  const actualReturnDate = returnDate ? new Date(returnDate).toISOString() : new Date().toISOString();

  // Record return details in issue record
  if (!issue.returnHistory) issue.returnHistory = [];
  issue.returnHistory.push({
    returnDate: actualReturnDate,
    quantityReturned: qtyToReturn,
    conditionOnReturn: condition,
    receivingStaff: receivingStaff || 'Coordinator',
    remarks: remarks || ''
  });

  // Mandatory Rule 9 & 10:
  // "Returned items become available for issue only after their receipt and condition have been recorded."
  // "Damaged, lost, or maintenance items must remain unavailable until the coordinator updates their status."
  if (item) {
    item.issuedQuantity = Math.max(0, item.issuedQuantity - qtyToReturn);
    if (condition === 'Usable') {
      item.availableQuantity += qtyToReturn;
    } else if (condition === 'Damaged') {
      item.damagedQuantity = (item.damagedQuantity || 0) + qtyToReturn;
    } else if (condition === 'Maintenance') {
      item.maintenanceQuantity = (item.maintenanceQuantity || 0) + qtyToReturn;
    }
  }

  // If individually tracked asset
  if (issue.assetId) {
    const asset = db.assets.find(a => a.assetId === issue.assetId);
    if (asset) {
      asset.condition = condition;
      if (condition === 'Usable') {
        asset.status = 'Available';
        asset.currentStudentEnrolment = null;
      } else {
        asset.status = condition === 'Damaged' ? 'Damaged' : 'Maintenance';
        asset.currentStudentEnrolment = null;
      }
    }
  }

  if (student) {
    student.activeIssuedCount = Math.max(0, student.activeIssuedCount - qtyToReturn);
  }

  // Mandatory Rule 12: Record return in audit log
  createAuditLog(
    'ITEM_RETURNED',
    receivingStaff || 'Coordinator',
    `Processed return of ${qtyToReturn} unit(s) for Issue #${issue.id} (${issue.itemName}). Condition: ${condition}. Outstanding remaining: ${issue.outstandingQuantity}. Staff: ${receivingStaff || 'Coordinator'}`
  );

  persistMemoryDb();
  res.json({
    message: 'Return recorded successfully',
    issue,
    conditionRecorded: condition,
    outstandingQuantity: issue.outstandingQuantity
  });
});

// 10. Renewal Management (Mandatory Rules 6, 7, 8 enforcement)
// Student submits renewal request
router.post('/renewals', (req, res) => {
  const db = getMemoryDb();
  const { issueId, reason, requestingStudent } = req.body;

  const issue = db.issues.find(i => i.id === issueId);
  if (!issue) {
    return res.status(404).json({ error: 'Issue record not found.' });
  }

  if (issue.status === 'Returned') {
    return res.status(400).json({ error: 'Cannot renew an item that has already been returned.' });
  }

  // Check if there is already an active pending request
  const existingPending = db.renewals.find(r => r.issueId === issueId && r.status === 'Pending');
  if (existingPending) {
    return res.status(400).json({ error: 'A pending renewal request already exists for this item issue.' });
  }

  // Policy check: max renewals allowed
  const maxRenewals = db.policies.maxRenewalsAllowed || 2;
  if ((issue.renewalsCount || 0) >= maxRenewals) {
    return res.status(400).json({
      error: `Renewal limit reached: This item has already been renewed ${issue.renewalsCount} times (Max allowed: ${maxRenewals}).`
    });
  }

  // Proposed due date: 15 calendar days from existing due date
  const currentDue = new Date(issue.dueDate);
  const proposedDue = new Date(currentDue.getTime() + (15 * 24 * 60 * 60 * 1000));
  proposedDue.setHours(23, 59, 59, 999);

  const newRenewal = {
    id: `REN-${Date.now().toString().slice(-4)}`,
    issueId: issue.id,
    studentEnrolment: issue.studentEnrolment,
    studentName: issue.studentName,
    itemName: issue.itemName + (issue.assetId ? ` (${issue.assetId})` : ''),
    requestDate: new Date().toISOString(),
    currentDueDate: issue.dueDate,
    proposedDueDate: proposedDue.toISOString(),
    status: 'Pending', // Mandatory Rule 7: Submitting a renewal request alone must NOT extend due date
    reason: reason || 'Project milestone extension needed',
    approvingStaff: null,
    decisionDate: null,
    remarks: null
  };

  db.renewals.unshift(newRenewal);

  createAuditLog(
    'RENEWAL_REQUESTED',
    requestingStudent || issue.studentName,
    `Renewal requested for Issue #${issue.id} (${issue.itemName}). Current due: ${new Date(issue.dueDate).toDateString()}`
  );

  persistMemoryDb();
  res.status(201).json(newRenewal);
});

// Get renewals
router.get('/renewals', (req, res) => {
  const db = getMemoryDb();
  const { studentEnrolment, status } = req.query;
  let list = db.renewals;
  if (studentEnrolment) {
    list = list.filter(r => r.studentEnrolment.toUpperCase() === studentEnrolment.trim().toUpperCase());
  }
  if (status) {
    list = list.filter(r => r.status.toLowerCase() === status.toLowerCase());
  }
  res.json(list);
});

// Coordinator Action: Approve or Reject Renewal
router.post('/renewals/:id/action', (req, res) => {
  const db = getMemoryDb();
  const { action, approvingStaff, remarks } = req.body; // action: 'APPROVE' or 'REJECT'

  const renewal = db.renewals.find(r => r.id === req.params.id);
  if (!renewal) {
    return res.status(404).json({ error: 'Renewal request not found.' });
  }

  if (renewal.status !== 'Pending') {
    return res.status(400).json({ error: `Renewal request is already processed with status: ${renewal.status}` });
  }

  const issue = db.issues.find(i => i.id === renewal.issueId);
  if (!issue) {
    return res.status(404).json({ error: 'Associated issue transaction not found.' });
  }

  renewal.decisionDate = new Date().toISOString();
  renewal.approvingStaff = approvingStaff || 'Department Coordinator';
  renewal.remarks = remarks || '';

  if (action === 'APPROVE') {
    // Mandatory Rule 8: Each approved renewal extends the due date by 15 calendar days from the existing due date.
    const oldDue = new Date(issue.dueDate);
    const newDue = new Date(oldDue.getTime() + (15 * 24 * 60 * 60 * 1000));
    newDue.setHours(23, 59, 59, 999);

    issue.dueDate = newDue.toISOString();
    issue.renewalsCount = (issue.renewalsCount || 0) + 1;
    // Update status if it was previously considered overdue
    if (newDue > new Date()) {
      issue.status = 'Active';
    }

    renewal.status = 'Approved';
    renewal.revisedDueDate = issue.dueDate;

    createAuditLog(
      'RENEWAL_APPROVED',
      approvingStaff || 'Coordinator',
      `Approved renewal for Issue #${issue.id}. Extended due date by 15 days to ${newDue.toDateString()}. Remarks: ${remarks || 'None'}`
    );
  } else {
    // Reject renewal - due date remains unchanged
    renewal.status = 'Rejected';
    createAuditLog(
      'RENEWAL_REJECTED',
      approvingStaff || 'Coordinator',
      `Rejected renewal for Issue #${issue.id}. Due date kept at ${new Date(issue.dueDate).toDateString()}. Remarks: ${remarks || 'None'}`
    );
  }

  persistMemoryDb();
  res.json({
    message: `Renewal successfully ${renewal.status.toLowerCase()}`,
    renewal,
    issue
  });
});

// 11. Stock Adjustments (New Stock, Stock Corrections, Item Retirement with Reasons)
router.post('/stock-adjustments', (req, res) => {
  const db = getMemoryDb();
  const { itemId, adjustmentType, quantity, reason, responsibleUser } = req.body;
  // adjustmentType: 'NEW_STOCK', 'CORRECTION', 'RETIREMENT'

  const item = db.items.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A valid reason is required for every stock adjustment.' });
  }

  const delta = parseInt(quantity, 10);
  if (isNaN(delta)) {
    return res.status(400).json({ error: 'Valid quantity number is required.' });
  }

  if (adjustmentType === 'NEW_STOCK') {
    item.totalQuantity += delta;
    item.availableQuantity += delta;
  } else if (adjustmentType === 'CORRECTION') {
    item.totalQuantity += delta;
    item.availableQuantity += delta;
  } else if (adjustmentType === 'RETIREMENT') {
    if (delta > item.availableQuantity) {
      return res.status(400).json({
        error: `Cannot retire ${delta} items. Only ${item.availableQuantity} are available in stock.`
      });
    }
    item.totalQuantity -= delta;
    item.availableQuantity -= delta;
  }

  createAuditLog(
    'STOCK_ADJUSTMENT',
    responsibleUser || 'Coordinator',
    `Stock adjustment [${adjustmentType}]: ${delta > 0 ? '+' : ''}${delta} units on ${item.name}. Reason: ${reason}`
  );

  persistMemoryDb();
  res.json({ message: 'Stock adjusted successfully', item });
});

// 12. Audit Logs & Transaction History
router.get('/audit-logs', (req, res) => {
  const db = getMemoryDb();
  const { action, limit } = req.query;
  let list = db.auditLogs;
  if (action) {
    list = list.filter(l => l.action.toLowerCase() === action.toLowerCase());
  }
  const max = parseInt(limit, 10) || 100;
  res.json(list.slice(0, max));
});

// 13. Reports (Student-wise, Item-wise, Programme-wise, Laboratory-wise)
router.get('/reports', (req, res) => {
  const db = getMemoryDb();
  const { type } = req.query; // 'student-wise', 'item-wise', 'programme-wise', 'lab-wise'

  if (type === 'student-wise') {
    const report = db.students.map(s => {
      const studentIssues = db.issues.filter(i => i.studentEnrolment === s.enrolmentNumber);
      const activeIssues = studentIssues.filter(i => i.status !== 'Returned');
      const overdueIssues = activeIssues.filter(i => new Date(i.dueDate) < new Date());
      return {
        enrolmentNumber: s.enrolmentNumber,
        studentName: s.name,
        programme: s.programme,
        semester: s.semester,
        totalIssuesEver: studentIssues.length,
        activeOutstanding: activeIssues.reduce((acc, curr) => acc + curr.outstandingQuantity, 0),
        overdueCount: overdueIssues.length
      };
    });
    return res.json(report);
  }

  if (type === 'item-wise') {
    const report = db.items.map(item => {
      const loc = db.locations.find(l => l.id === item.locationId);
      return {
        itemCode: item.itemCode,
        name: item.name,
        category: item.category,
        trackingType: item.trackingType,
        total: item.totalQuantity,
        available: item.availableQuantity,
        issued: item.issuedQuantity,
        maintenance: item.maintenanceQuantity,
        damaged: item.damagedQuantity,
        location: loc ? `${loc.laboratory} (${loc.room})` : 'Unassigned'
      };
    });
    return res.json(report);
  }

  if (type === 'programme-wise') {
    const programmes = [...new Set(db.students.map(s => s.programme))];
    const report = programmes.map(prog => {
      const progStudents = db.students.filter(s => s.programme === prog);
      const enrolments = progStudents.map(s => s.enrolmentNumber);
      const progIssues = db.issues.filter(i => enrolments.includes(i.studentEnrolment));
      const activeIssues = progIssues.filter(i => i.status !== 'Returned');
      return {
        programme: prog,
        totalStudents: progStudents.length,
        totalIssues: progIssues.length,
        activeBorrowedUnits: activeIssues.reduce((acc, curr) => acc + curr.outstandingQuantity, 0)
      };
    });
    return res.json(report);
  }

  if (type === 'lab-wise') {
    const report = db.locations.map(loc => {
      const locItems = db.items.filter(i => i.locationId === loc.id);
      const totalUnits = locItems.reduce((acc, curr) => acc + curr.totalQuantity, 0);
      const availableUnits = locItems.reduce((acc, curr) => acc + curr.availableQuantity, 0);
      const issuedUnits = locItems.reduce((acc, curr) => acc + curr.issuedQuantity, 0);
      return {
        laboratory: loc.laboratory,
        department: loc.department,
        room: loc.room,
        cupboard: loc.cupboard,
        itemsCount: locItems.length,
        totalUnits,
        availableUnits,
        issuedUnits
      };
    });
    return res.json(report);
  }

  // Default: overall summary
  res.json({ message: 'Select a valid report type: student-wise, item-wise, programme-wise, or lab-wise' });
});

// 14. Reset to seed
router.post('/seed', (req, res) => {
  const data = resetDbToSeed();
  createAuditLog('DATABASE_RESET', 'Coordinator', 'Reset database to initial specification seed state');
  res.json({ message: 'Database reset to initial test specifications successfully', data });
});

module.exports = router;
