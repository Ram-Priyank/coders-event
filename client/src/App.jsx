import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  ShieldCheck,
  PlusCircle,
  Search,
  Filter,
  Printer,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Building,
  RefreshCw,
  X,
  ExternalLink
} from 'lucide-react';

export default function App() {
  // Role State: 'COORDINATOR' or 'STUDENT'
  const [role, setRole] = useState('COORDINATOR');
  const [activeTab, setActiveTab] = useState('overview'); // overview, issues, returns, renewals, inventory, reports, audit
  const [activeStudentEnrolment, setActiveStudentEnrolment] = useState('DFIS-2026-001');

  // Data States
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [students, setStudents] = useState([]);
  const [issues, setIssues] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [reportType, setReportType] = useState('student-wise');
  const [toast, setToast] = useState(null);

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedIssueForReturn, setSelectedIssueForReturn] = useState(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedIssueForRenewal, setSelectedIssueForRenewal] = useState(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
  const [activeAckSlip, setActiveAckSlip] = useState(null);

  // Form states
  const [issueForm, setIssueForm] = useState({
    studentEnrolment: 'DFIS-2026-001',
    itemId: '',
    assetId: '',
    quantity: 1,
    purpose: 'Hardware Security Project',
    issueDate: new Date().toISOString().split('T')[0]
  });

  const [returnForm, setReturnForm] = useState({
    returnQuantity: 1,
    conditionOnReturn: 'Usable',
    receivingStaff: 'Dr. S. Rao (Coordinator)',
    remarks: ''
  });

  const [renewalForm, setRenewalForm] = useState({
    reason: 'Need extra days to complete protocol debugging'
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    itemId: '',
    adjustmentType: 'NEW_STOCK',
    quantity: 5,
    reason: 'Department grant equipment received',
    responsibleUser: 'Dr. S. Rao (Coordinator)'
  });

  const [newItemForm, setNewItemForm] = useState({
    itemCode: '',
    name: '',
    category: 'Development Boards',
    makeModel: '',
    description: '',
    trackingType: 'QUANTITY',
    totalQuantity: 10,
    locationId: ''
  });

  const [newAssetForm, setNewAssetForm] = useState({
    assetId: '',
    itemId: '',
    serialNumber: '',
    locationId: '',
    condition: 'Usable'
  });

  const [newLocationForm, setNewLocationForm] = useState({
    department: 'Digital Forensics & Information Security',
    laboratory: 'IoT Security Testing Lab',
    room: 'Room 305',
    cupboard: 'Cupboard D',
    shelf: 'Shelf 1',
    description: 'Specialized lab space'
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch all core data
  const fetchData = async () => {
    try {
      const [sRes, iRes, aRes, lRes, stRes, isRes, rRes, audRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/items'),
        fetch('/api/assets'),
        fetch('/api/locations'),
        fetch('/api/students'),
        fetch('/api/issues'),
        fetch('/api/renewals'),
        fetch('/api/audit-logs?limit=50')
      ]);

      if (sRes.ok) setStats(await sRes.json());
      if (iRes.ok) setItems(await iRes.json());
      if (aRes.ok) setAssets(await aRes.json());
      if (lRes.ok) setLocations(await lRes.json());
      if (stRes.ok) setStudents(await stRes.json());
      if (isRes.ok) setIssues(await isRes.json());
      if (rRes.ok) setRenewals(await rRes.json());
      if (audRes.ok) setAuditLogs(await audRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const fetchReports = async (type) => {
    try {
      const res = await fetch(`/api/reports?type=${type}`);
      if (res.ok) setReportData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports(reportType);
    }
  }, [activeTab, reportType]);

  // Handle Item Issuance
  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...issueForm,
          issuingStaff: 'Dr. S. Rao (Coordinator)'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to issue item', 'error');
        return;
      }
      showToast(`Item successfully issued! Due in 15 days (${new Date(data.dueDate).toLocaleDateString()})`);
      setShowIssueModal(false);
      setActiveAckSlip(data);
      fetchData();
    } catch (err) {
      showToast('Network error during issue request', 'error');
    }
  };

  // Handle Item Return
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIssueForReturn) return;
    try {
      const res = await fetch(`/api/issues/${selectedIssueForReturn.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnForm)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Return failed', 'error');
        return;
      }
      showToast(`Return recorded (${data.conditionRecorded}). Outstanding: ${data.outstandingQuantity}`);
      setShowReturnModal(false);
      setSelectedIssueForReturn(null);
      fetchData();
    } catch (err) {
      showToast('Error recording return', 'error');
    }
  };

  // Student Requests Renewal
  const handleRenewalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIssueForRenewal) return;
    try {
      const res = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: selectedIssueForRenewal.id,
          reason: renewalForm.reason,
          requestingStudent: selectedIssueForRenewal.studentName
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Renewal request failed', 'error');
        return;
      }
      showToast('Renewal request submitted! Awaiting Coordinator approval.');
      setShowRenewalModal(false);
      setSelectedIssueForRenewal(null);
      fetchData();
    } catch (err) {
      showToast('Network error submitting renewal', 'error');
    }
  };

  // Coordinator Renewal Action (Approve / Reject)
  const handleRenewalAction = async (renewalId, action) => {
    const remarks = prompt(
      action === 'APPROVE'
        ? 'Enter approval remarks (or leave empty):'
        : 'Enter rejection reason remarks:'
    );
    if (remarks === null) return;

    try {
      const res = await fetch(`/api/renewals/${renewalId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvingStaff: 'Dr. S. Rao (Coordinator)',
          remarks
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Action failed', 'error');
        return;
      }
      showToast(
        action === 'APPROVE'
          ? `Renewal Approved! Due date extended by 15 days to ${new Date(data.issue.dueDate).toLocaleDateString()}`
          : 'Renewal Rejected. Due date remains unchanged.'
      );
      fetchData();
    } catch (err) {
      showToast('Error processing renewal action', 'error');
    }
  };

  // Add Item
  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItemForm)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to add item', 'error');
        return;
      }
      showToast(`Added ${data.name} successfully!`);
      setShowAddItemModal(false);
      fetchData();
    } catch (err) {
      showToast('Network error adding item', 'error');
    }
  };

  // Add Individual Asset
  const handleAddAsset = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAssetForm)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to register asset', 'error');
        return;
      }
      showToast(`Asset ID ${data.assetId} registered successfully!`);
      setShowAddAssetModal(false);
      fetchData();
    } catch (err) {
      showToast('Network error registering asset', 'error');
    }
  };

  // Add Storage Location
  const handleAddLocation = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocationForm)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to add location', 'error');
        return;
      }
      showToast(`Storage Location ${data.laboratory} registered!`);
      setShowLocationModal(false);
      fetchData();
    } catch (err) {
      showToast('Network error adding location', 'error');
    }
  };

  // Stock Adjustment
  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustmentForm)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Adjustment failed', 'error');
        return;
      }
      showToast('Stock adjustment recorded in audit log!');
      setShowStockAdjustmentModal(false);
      fetchData();
    } catch (err) {
      showToast('Network error adjusting stock', 'error');
    }
  };

  // Reset to initial test specs
  const handleResetData = async () => {
    if (!confirm('Reset database to initial specifications test data?')) return;
    try {
      await fetch('/api/seed', { method: 'POST' });
      showToast('Reset to initial specs data completed!');
      fetchData();
    } catch (err) {
      showToast('Reset failed', 'error');
    }
  };

  // Overdue calculation
  const overdueIssues = issues.filter(i => i.isOverdue && i.status !== 'Returned');
  const currentStudent = students.find(s => s.enrolmentNumber === activeStudentEnrolment);
  const studentIssues = issues.filter(i => i.studentEnrolment === activeStudentEnrolment);

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 size={18} color="#10b981" />}
          {toast.type === 'error' && <AlertCircle size={18} color="#ef4444" />}
          {toast.type === 'info' && <Clock size={18} color="#6366f1" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="header-bar">
        <div className="header-content">
          <div className="brand-wrapper">
            <div className="brand-icon-box">
              <Package size={22} />
            </div>
            <div>
              <div className="brand-title">
                DeptTrack
                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                  v1.0 • MERN
                </span>
              </div>
              <div className="brand-subtitle">
                Department Inventory & Student Item Issue Management
              </div>
            </div>
          </div>

          <div className="header-controls">
            {/* Role Switcher */}
            <div className="role-switcher">
              <button
                className={`role-btn ${role === 'COORDINATOR' ? 'active' : ''}`}
                onClick={() => setRole('COORDINATOR')}
              >
                <ShieldCheck size={14} />
                Coordinator
              </button>
              <button
                className={`role-btn ${role === 'STUDENT' ? 'active' : ''}`}
                onClick={() => setRole('STUDENT')}
              >
                <Users size={14} />
                Student Portal
              </button>
            </div>

            {role === 'STUDENT' && (
              <select
                className="select-filter"
                value={activeStudentEnrolment}
                onChange={(e) => setActiveStudentEnrolment(e.target.value)}
              >
                {students.map((st) => (
                  <option key={st.enrolmentNumber} value={st.enrolmentNumber}>
                    {st.name} ({st.enrolmentNumber})
                  </option>
                ))}
              </select>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleResetData}
              title="Reset to problem statement sample scenario"
            >
              <RefreshCw size={13} />
              Reset Demo
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-wrapper">
        {/* Overdue Banner Notification (Visible if any overdue exists) */}
        {overdueIssues.length > 0 && (
          <div className="alert-banner">
            <AlertTriangle size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div className="alert-banner-title">
                Attention: {overdueIssues.length} Item(s) Currently Overdue Beyond 15-Day Limit
              </div>
              <div className="alert-banner-desc">
                {overdueIssues.map((oi) => (
                  <div key={oi.id} style={{ marginTop: '0.2rem' }}>
                    • <strong>{oi.itemName}</strong> {oi.assetId ? `(Asset ${oi.assetId})` : ''} issued to{' '}
                    <strong>{oi.studentName} ({oi.studentEnrolment})</strong> was due on{' '}
                    <strong>{new Date(oi.dueDate).toLocaleDateString()}</strong> and is overdue by{' '}
                    <span className="badge badge-danger">{oi.overdueDays} day(s)</span>.
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* COORDINATOR DASHBOARD VIEW                                */}
        {/* ======================================================== */}
        {role === 'COORDINATOR' && (
          <div>
            {/* Top Metric Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Total Inventory</span>
                  <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                    <Package size={16} />
                  </div>
                </div>
                <div className="stat-val">{stats?.totalQuantity ?? 0}</div>
                <div className="stat-meta">Items across {stats?.storageLocationsCount ?? 0} storage locations</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Available Stock</span>
                  <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="stat-val" style={{ color: 'var(--success)' }}>
                  {stats?.availableQuantity ?? 0}
                </div>
                <div className="stat-meta">Usable condition & ready for issue</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Issued to Students</span>
                  <div className="stat-icon" style={{ background: 'var(--accent-cyan-light)', color: 'var(--accent-cyan)' }}>
                    <Users size={16} />
                  </div>
                </div>
                <div className="stat-val" style={{ color: 'var(--accent-cyan)' }}>
                  {stats?.issuedQuantity ?? 0}
                </div>
                <div className="stat-meta">Active loans (15-day policy)</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Overdue Items</span>
                  <div className="stat-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                    <Clock size={16} />
                  </div>
                </div>
                <div className="stat-val" style={{ color: stats?.overdueCount > 0 ? 'var(--danger)' : '#fff' }}>
                  {stats?.overdueCount ?? 0}
                </div>
                <div className="stat-meta">Passed 15-day return threshold</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Pending Renewals</span>
                  <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                    <RotateCcw size={16} />
                  </div>
                </div>
                <div className="stat-val" style={{ color: 'var(--warning)' }}>
                  {stats?.pendingRenewalsCount ?? 0}
                </div>
                <div className="stat-meta">Awaiting coordinator decision</div>
              </div>
            </div>

            {/* Coordinator Navigation Tabs */}
            <div className="tabs-nav">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <Layers size={16} />
                Overview & Items
              </button>
              <button
                className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
                onClick={() => setActiveTab('issues')}
              >
                <FileText size={16} />
                Active Issues & Loan Desk
                <span className="tab-badge">{issues.length}</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'renewals' ? 'active' : ''}`}
                onClick={() => setActiveTab('renewals')}
              >
                <RotateCcw size={16} />
                Renewal Requests
                {stats?.pendingRenewalsCount > 0 && (
                  <span className="badge badge-warning">{stats.pendingRenewalsCount}</span>
                )}
              </button>
              <button
                className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
                onClick={() => setActiveTab('assets')}
              >
                <ShieldCheck size={16} />
                Asset Registry (Individual)
              </button>
              <button
                className={`tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
                onClick={() => setActiveTab('locations')}
              >
                <Building size={16} />
                Storage Locations
              </button>
              <button
                className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => setActiveTab('reports')}
              >
                <TrendingUp size={16} />
                Reports & Analytics
              </button>
              <button
                className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit')}
              >
                <Clock size={16} />
                Audit Trail
              </button>
            </div>

            {/* TAB: OVERVIEW & INVENTORY */}
            {activeTab === 'overview' && (
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Department Inventory Repository</h2>
                    <p className="section-desc">
                      Distinguishes individually tracked assets (e.g., Laptops, Development Boards) from quantity-based items (e.g., Cables, Adapters).
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setIssueForm({
                          ...issueForm,
                          itemId: items[0]?.id || '',
                          assetId: ''
                        });
                        setShowIssueModal(true);
                      }}
                    >
                      <PlusCircle size={15} />
                      Issue Item to Student
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAddItemModal(true)}>
                      <PlusCircle size={15} />
                      New Inventory Item
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowStockAdjustmentModal(true)}>
                      <TrendingUp size={15} />
                      Stock Adjustment
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="filter-bar">
                  <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <input
                      type="text"
                      className="input-search"
                      placeholder="Search items by code, name, make/model..."
                      style={{ width: '100%', paddingLeft: '2rem' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search
                      size={14}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </div>

                  <select
                    className="select-filter"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="ALL">All Tracking Types</option>
                    <option value="INDIVIDUAL">Individually Tracked Assets</option>
                    <option value="QUANTITY">Quantity-Based Items</option>
                  </select>
                </div>

                {/* Inventory Table */}
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Code & Name</th>
                        <th>Category / Model</th>
                        <th>Tracking Type</th>
                        <th>Total Stock</th>
                        <th>Available</th>
                        <th>Issued</th>
                        <th>Condition / Status</th>
                        <th>Location</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .filter((i) => {
                          const matchesSearch =
                            i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            i.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            i.category.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesType =
                            filterCategory === 'ALL' || i.trackingType === filterCategory;
                          return matchesSearch && matchesType;
                        })
                        .map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {item.itemCode}
                              </div>
                            </td>
                            <td>
                              <div>{item.category}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {item.makeModel}
                              </div>
                            </td>
                            <td>
                              {item.trackingType === 'INDIVIDUAL' ? (
                                <span className="badge badge-primary">Individually Tracked</span>
                              ) : (
                                <span className="badge badge-neutral">Quantity-Based</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 600 }}>{item.totalQuantity}</td>
                            <td>
                              <span
                                className={`badge ${
                                  item.availableQuantity > 0 ? 'badge-success' : 'badge-danger'
                                }`}
                              >
                                {item.availableQuantity} Usable
                              </span>
                            </td>
                            <td>{item.issuedQuantity}</td>
                            <td>
                              {item.maintenanceQuantity > 0 || item.damagedQuantity > 0 ? (
                                <span className="badge badge-warning">
                                  {item.maintenanceQuantity} Maint / {item.damagedQuantity} Dmg
                                </span>
                              ) : (
                                <span className="badge badge-success">All Usable</span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {item.locationDetails}
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setIssueForm({
                                    ...issueForm,
                                    itemId: item.id,
                                    assetId: ''
                                  });
                                  setShowIssueModal(true);
                                }}
                                disabled={item.availableQuantity <= 0}
                              >
                                Issue
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: ACTIVE ISSUES & LOAN DESK */}
            {activeTab === 'issues' && (
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Active Item Issues & Return Desk</h2>
                    <p className="section-desc">
                      Enforcing 15-day calendar return deadline. Partial returns record unreturned quantity as outstanding.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowIssueModal(true)}>
                    <PlusCircle size={15} />
                    Issue Item
                  </button>
                </div>

                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Issue ID / Ack</th>
                        <th>Student Details</th>
                        <th>Item / Asset</th>
                        <th>Issued / Outstanding</th>
                        <th>Issue Date</th>
                        <th>Due Date (15d Rule)</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((iss) => (
                        <tr key={iss.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{iss.id}</div>
                            <div style={{ fontSize: '0.725rem', color: 'var(--primary)' }}>
                              {iss.acknowledgementNumber}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{iss.studentName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {iss.studentEnrolment} • {iss.programme}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{iss.itemName}</div>
                            {iss.assetId && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                                Asset ID: <strong>{iss.assetId}</strong>
                              </div>
                            )}
                          </td>
                          <td>
                            <div>
                              Outstanding: <strong>{iss.outstandingQuantity}</strong> / {iss.quantity}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {new Date(iss.issueDate).toLocaleDateString()}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            <strong>{new Date(iss.dueDate).toLocaleDateString()}</strong>
                            {iss.isOverdue && (
                              <div style={{ color: 'var(--danger)', fontSize: '0.725rem', fontWeight: 600 }}>
                                Overdue by {iss.overdueDays} day(s)
                              </div>
                            )}
                          </td>
                          <td>
                            {iss.status === 'Returned' && (
                              <span className="badge badge-success">Returned</span>
                            )}
                            {iss.status === 'PartialReturned' && (
                              <span className="badge badge-warning">Partial Returned</span>
                            )}
                            {iss.status === 'Active' && !iss.isOverdue && (
                              <span className="badge badge-primary">Active</span>
                            )}
                            {iss.isOverdue && iss.status !== 'Returned' && (
                              <span className="badge badge-danger">Overdue</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {iss.status !== 'Returned' && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setSelectedIssueForReturn(iss);
                                    setReturnForm({
                                      returnQuantity: iss.outstandingQuantity,
                                      conditionOnReturn: 'Usable',
                                      receivingStaff: 'Dr. S. Rao (Coordinator)',
                                      remarks: ''
                                    });
                                    setShowReturnModal(true);
                                  }}
                                >
                                  Process Return
                                </button>
                              )}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setActiveAckSlip(iss)}
                                title="Print / View Acknowledgement"
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: RENEWAL REQUESTS */}
            {activeTab === 'renewals' && (
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Renewal Requests Management</h2>
                    <p className="section-desc">
                      Rule: Submitting a request alone does NOT extend the due date. Coordinator approval extends due date by +15 calendar days.
                    </p>
                  </div>
                </div>

                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Req ID</th>
                        <th>Student</th>
                        <th>Item / Asset</th>
                        <th>Request Date</th>
                        <th>Current Due</th>
                        <th>Proposed Due (+15d)</th>
                        <th>Student Reason</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renewals.map((ren) => (
                        <tr key={ren.id}>
                          <td>{ren.id}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{ren.studentName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {ren.studentEnrolment}
                            </div>
                          </td>
                          <td>{ren.itemName}</td>
                          <td>{new Date(ren.requestDate).toLocaleDateString()}</td>
                          <td>{new Date(ren.currentDueDate).toLocaleDateString()}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                            {new Date(ren.proposedDueDate).toLocaleDateString()}
                          </td>
                          <td style={{ maxWidth: '240px', fontSize: '0.8rem' }}>{ren.reason}</td>
                          <td>
                            {ren.status === 'Pending' && (
                              <span className="badge badge-warning">Pending Approval</span>
                            )}
                            {ren.status === 'Approved' && (
                              <span className="badge badge-success">Approved (+15d)</span>
                            )}
                            {ren.status === 'Rejected' && (
                              <span className="badge badge-danger">Rejected</span>
                            )}
                          </td>
                          <td>
                            {ren.status === 'Pending' ? (
                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleRenewalAction(ren.id, 'APPROVE')}
                                >
                                  Approve (+15d)
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRenewalAction(ren.id, 'REJECT')}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {ren.remarks ? `Remarks: ${ren.remarks}` : 'Processed'}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: ASSETS REGISTRY */}
            {activeTab === 'assets' && (
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Individually Tracked Assets</h2>
                    <p className="section-desc">
                      Mandatory rule: Unique asset ID assigned. Cannot be checked out to more than one student concurrently.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowAddAssetModal(true)}>
                    <PlusCircle size={15} />
                    Register New Asset
                  </button>
                </div>

                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Unique Asset ID</th>
                        <th>Item Name</th>
                        <th>Serial Number</th>
                        <th>Condition</th>
                        <th>Loan Status</th>
                        <th>Current Holder</th>
                        <th>Storage Location</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((ast) => (
                        <tr key={ast.id}>
                          <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            {ast.assetId}
                          </td>
                          <td>{ast.itemName}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {ast.serialNumber}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                ast.condition === 'Usable'
                                  ? 'badge-success'
                                  : ast.condition === 'Damaged'
                                  ? 'badge-danger'
                                  : 'badge-warning'
                              }`}
                            >
                              {ast.condition}
                            </span>
                          </td>
                          <td>
                            {ast.status === 'Available' && (
                              <span className="badge badge-success">Available</span>
                            )}
                            {ast.status === 'Issued' && (
                              <span className="badge badge-warning">Issued</span>
                            )}
                            {ast.status !== 'Available' && ast.status !== 'Issued' && (
                              <span className="badge badge-danger">{ast.status}</span>
                            )}
                          </td>
                          <td>
                            {ast.currentStudentEnrolment ? (
                              <span style={{ fontWeight: 600 }}>{ast.currentStudentEnrolment}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>— In Lab —</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>{ast.locationDetails}</td>
                          <td>
                            {ast.condition !== 'Usable' && ast.status !== 'Issued' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={async () => {
                                  await fetch(`/api/assets/${ast.id}/status`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      condition: 'Usable',
                                      status: 'Available',
                                      responsibleUser: 'Dr. S. Rao (Coordinator)'
                                    })
                                  });
                                  showToast(`Asset ${ast.assetId} marked as Usable and Available!`);
                                  fetchData();
                                }}
                              >
                                Mark Restored
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: STORAGE LOCATIONS */}
            {activeTab === 'locations' && (
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Department Storage Locations</h2>
                    <p className="section-desc">
                      Tracks departments, laboratories, rooms, cupboards, and shelves for physical audits.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowLocationModal(true)}>
                    <PlusCircle size={15} />
                    Add Location
                  </button>
                </div>

                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Location ID</th>
                        <th>Laboratory</th>
                        <th>Department</th>
                        <th>Room</th>
                        <th>Cupboard / Shelf</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((loc) => (
                        <tr key={loc.id}>
                          <td style={{ fontWeight: 600 }}>{loc.id}</td>
                          <td style={{ fontWeight: 600 }}>{loc.laboratory}</td>
                          <td>{loc.department}</td>
                          <td>{loc.room}</td>
                          <td>
                            {loc.cupboard} / {loc.shelf}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {loc.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: REPORTS */}
            {activeTab === 'reports' && (
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Inventory Reports & Analysis</h2>
                    <p className="section-desc">
                      Comprehensive breakdown: student-wise, item-wise, programme-wise, and laboratory-wise.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      className="select-filter"
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                    >
                      <option value="student-wise">Student-Wise Report</option>
                      <option value="item-wise">Item-Wise Report</option>
                      <option value="programme-wise">Programme-Wise Report</option>
                      <option value="lab-wise">Laboratory-Wise Report</option>
                    </select>
                    <button className="btn btn-secondary" onClick={() => window.print()}>
                      <Printer size={15} />
                      Export / Print
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table>
                    <thead>
                      {reportType === 'student-wise' && (
                        <tr>
                          <th>Enrolment #</th>
                          <th>Student Name</th>
                          <th>Programme & Semester</th>
                          <th>Lifetime Issues</th>
                          <th>Current Outstanding Units</th>
                          <th>Overdue Count</th>
                        </tr>
                      )}
                      {reportType === 'item-wise' && (
                        <tr>
                          <th>Item Code</th>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Total Stock</th>
                          <th>Available</th>
                          <th>Issued</th>
                          <th>Damaged/Maint</th>
                          <th>Assigned Lab</th>
                        </tr>
                      )}
                      {reportType === 'programme-wise' && (
                        <tr>
                          <th>Programme</th>
                          <th>Registered Students</th>
                          <th>Total Issues Record</th>
                          <th>Active Borrowed Units</th>
                        </tr>
                      )}
                      {reportType === 'lab-wise' && (
                        <tr>
                          <th>Laboratory</th>
                          <th>Department</th>
                          <th>Room / Cupboard</th>
                          <th>Distinct Items</th>
                          <th>Total Physical Units</th>
                          <th>Available Units</th>
                          <th>Issued Units</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {reportData.map((row, idx) => (
                        <tr key={idx}>
                          {reportType === 'student-wise' && (
                            <>
                              <td style={{ fontWeight: 600 }}>{row.enrolmentNumber}</td>
                              <td>{row.studentName}</td>
                              <td>
                                {row.programme} ({row.semester})
                              </td>
                              <td>{row.totalIssuesEver}</td>
                              <td style={{ fontWeight: 600 }}>{row.activeOutstanding}</td>
                              <td>
                                {row.overdueCount > 0 ? (
                                  <span className="badge badge-danger">{row.overdueCount} Overdue</span>
                                ) : (
                                  <span className="badge badge-success">Clean</span>
                                )}
                              </td>
                            </>
                          )}
                          {reportType === 'item-wise' && (
                            <>
                              <td style={{ fontWeight: 600 }}>{row.itemCode}</td>
                              <td>{row.name}</td>
                              <td>{row.category}</td>
                              <td>{row.total}</td>
                              <td style={{ color: 'var(--success)' }}>{row.available}</td>
                              <td style={{ color: 'var(--primary)' }}>{row.issued}</td>
                              <td>{row.maintenance + row.damaged}</td>
                              <td>{row.location}</td>
                            </>
                          )}
                          {reportType === 'programme-wise' && (
                            <>
                              <td style={{ fontWeight: 600 }}>{row.programme}</td>
                              <td>{row.totalStudents}</td>
                              <td>{row.totalIssues}</td>
                              <td>{row.activeBorrowedUnits}</td>
                            </>
                          )}
                          {reportType === 'lab-wise' && (
                            <>
                              <td style={{ fontWeight: 600 }}>{row.laboratory}</td>
                              <td>{row.department}</td>
                              <td>
                                {row.room} ({row.cupboard})
                              </td>
                              <td>{row.itemsCount}</td>
                              <td>{row.totalUnits}</td>
                              <td style={{ color: 'var(--success)' }}>{row.availableUnits}</td>
                              <td style={{ color: 'var(--primary)' }}>{row.issuedUnits}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: AUDIT TRAIL */}
            {activeTab === 'audit' && (
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">System Audit Log & Traceability</h2>
                    <p className="section-desc">
                      Mandatory rule: Every issue, return, renewal, and stock adjustment is permanently recorded with responsible user and timestamp.
                    </p>
                  </div>
                </div>

                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Responsible User</th>
                        <th>Audit Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '0.785rem', color: 'var(--text-secondary)' }}>
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                log.action.includes('RETURN')
                                  ? 'badge-success'
                                  : log.action.includes('ISSUE')
                                  ? 'badge-primary'
                                  : log.action.includes('RENEW')
                                  ? 'badge-warning'
                                  : 'badge-neutral'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{log.responsibleUser}</td>
                          <td style={{ fontSize: '0.825rem' }}>{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STUDENT PORTAL VIEW                                       */}
        {/* ======================================================== */}
        {role === 'STUDENT' && (
          <div>
            {/* Student Header Card */}
            <div className="section-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={22} color="var(--primary)" />
                    <h2 className="section-title">{currentStudent?.name}</h2>
                    <span className="badge badge-primary">{currentStudent?.enrolmentNumber}</span>
                  </div>
                  <div className="section-desc" style={{ marginTop: '0.35rem' }}>
                    {currentStudent?.programme} • {currentStudent?.semester} • Contact: {currentStudent?.contactNumber}
                  </div>
                </div>
                <div>
                  <div className="stat-card" style={{ padding: '0.75rem 1.25rem', minWidth: '160px' }}>
                    <div className="stat-label">Active Loans</div>
                    <div className="stat-val" style={{ fontSize: '1.4rem' }}>
                      {studentIssues.filter((i) => i.status !== 'Returned').length}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Student's Issued Items */}
            <div className="section-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">My Issued Items & Due Dates</h2>
                  <p className="section-desc">
                    Must return or request renewal within 15 days of issue date.
                  </p>
                </div>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Item / Asset</th>
                      <th>Quantity Outstanding</th>
                      <th>Issue Date</th>
                      <th>Due Date (15-Day Limit)</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentIssues.map((iss) => (
                      <tr key={iss.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{iss.itemName}</div>
                          {iss.assetId && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                              Unique Asset ID: {iss.assetId}
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Ack #{iss.acknowledgementNumber}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{iss.outstandingQuantity} unit(s)</td>
                        <td>{new Date(iss.issueDate).toLocaleDateString()}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(iss.dueDate).toLocaleDateString()}
                          </div>
                          {iss.isOverdue && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>
                              Overdue by {iss.overdueDays} day(s)
                            </div>
                          )}
                        </td>
                        <td>
                          {iss.status === 'Returned' && (
                            <span className="badge badge-success">Returned</span>
                          )}
                          {iss.status === 'PartialReturned' && (
                            <span className="badge badge-warning">Partial Returned</span>
                          )}
                          {iss.status === 'Active' && !iss.isOverdue && (
                            <span className="badge badge-primary">Active</span>
                          )}
                          {iss.isOverdue && iss.status !== 'Returned' && (
                            <span className="badge badge-danger">Overdue</span>
                          )}
                        </td>
                        <td>
                          {iss.status !== 'Returned' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedIssueForRenewal(iss);
                                setShowRenewalModal(true);
                              }}
                            >
                              <RotateCcw size={13} />
                              Request 15-Day Renewal
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {studentIssues.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No items currently borrowed by this student account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student's Renewal Request Status Tracker */}
            <div className="section-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Renewal Request Tracking</h2>
                  <p className="section-desc">
                    Tracking approval status and remarks from department coordinator.
                  </p>
                </div>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Request ID</th>
                      <th>Item</th>
                      <th>Request Date</th>
                      <th>Original Due Date</th>
                      <th>Proposed Due Date</th>
                      <th>Approval Status</th>
                      <th>Coordinator Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renewals
                      .filter((r) => r.studentEnrolment === activeStudentEnrolment)
                      .map((ren) => (
                        <tr key={ren.id}>
                          <td>{ren.id}</td>
                          <td style={{ fontWeight: 500 }}>{ren.itemName}</td>
                          <td>{new Date(ren.requestDate).toLocaleDateString()}</td>
                          <td>{new Date(ren.currentDueDate).toLocaleDateString()}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                            {new Date(ren.proposedDueDate).toLocaleDateString()}
                          </td>
                          <td>
                            {ren.status === 'Pending' && (
                              <span className="badge badge-warning">Pending Coordinator Review</span>
                            )}
                            {ren.status === 'Approved' && (
                              <span className="badge badge-success">Approved (+15 Calendar Days)</span>
                            )}
                            {ren.status === 'Rejected' && (
                              <span className="badge badge-danger">Rejected</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {ren.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODALS                                                   */}
      {/* ======================================================== */}

      {/* 1. Issue Item Modal */}
      {showIssueModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Issue Inventory Item</h3>
              <button className="close-btn" onClick={() => setShowIssueModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleIssueSubmit}>
              <div className="form-group">
                <label className="form-label">Registered Student *</label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={issueForm.studentEnrolment}
                  onChange={(e) => setIssueForm({ ...issueForm, studentEnrolment: e.target.value })}
                  required
                >
                  {students.map((st) => (
                    <option key={st.enrolmentNumber} value={st.enrolmentNumber}>
                      {st.name} ({st.enrolmentNumber}) — {st.programme}
                    </option>
                  ))}
                </select>
                <div className="form-hint">Mandatory: Only registered students can receive items.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Inventory Item *</label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={issueForm.itemId}
                  onChange={(e) => {
                    const sel = items.find((i) => i.id === e.target.value);
                    setIssueForm({
                      ...issueForm,
                      itemId: e.target.value,
                      assetId: '',
                      quantity: 1
                    });
                  }}
                  required
                >
                  <option value="">-- Choose Item --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.itemCode}) — Avail: {i.availableQuantity} / {i.totalQuantity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Asset selection if individually tracked */}
              {items.find((i) => i.id === issueForm.itemId)?.trackingType === 'INDIVIDUAL' && (
                <div className="form-group">
                  <label className="form-label">Select Unique Asset ID *</label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={issueForm.assetId}
                    onChange={(e) => setIssueForm({ ...issueForm, assetId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Available Usable Asset --</option>
                    {assets
                      .filter(
                        (a) =>
                          a.itemId === issueForm.itemId &&
                          a.status === 'Available' &&
                          a.condition === 'Usable'
                      )
                      .map((a) => (
                        <option key={a.id} value={a.assetId}>
                          {a.assetId} (SN: {a.serialNumber}) — Location: {a.locationDetails}
                        </option>
                      ))}
                  </select>
                  <div className="form-hint">
                    Rule: Individually tracked assets cannot be checked out to more than one student.
                  </div>
                </div>
              )}

              {/* Quantity input if quantity-based */}
              {items.find((i) => i.id === issueForm.itemId)?.trackingType === 'QUANTITY' && (
                <div className="form-group">
                  <label className="form-label">Quantity to Issue *</label>
                  <input
                    type="number"
                    min="1"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                    required
                  />
                  <div className="form-hint">
                    Available stock:{' '}
                    {items.find((i) => i.id === issueForm.itemId)?.availableQuantity ?? 0}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Issue Date</label>
                <input
                  type="date"
                  className="input-text"
                  style={{ width: '100%' }}
                  value={issueForm.issueDate}
                  onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })}
                />
                <div className="form-hint">
                  Due date will automatically be set to exactly 15 calendar days later.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Purpose of Issue</label>
                <input
                  type="text"
                  className="input-text"
                  style={{ width: '100%' }}
                  value={issueForm.purpose}
                  onChange={(e) => setIssueForm({ ...issueForm, purpose: e.target.value })}
                  placeholder="e.g. M.Sc. DFIS Embedded Hardware Lab Exercise"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowIssueModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Issue & Generate Ack Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Return Item Modal */}
      {showReturnModal && selectedIssueForReturn && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Record Return & Inspect Condition</h3>
              <button className="close-btn" onClick={() => setShowReturnModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReturnSubmit}>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                <div>Item: <strong>{selectedIssueForReturn.itemName}</strong></div>
                {selectedIssueForReturn.assetId && <div>Asset ID: <strong>{selectedIssueForReturn.assetId}</strong></div>}
                <div>Student: <strong>{selectedIssueForReturn.studentName} ({selectedIssueForReturn.studentEnrolment})</strong></div>
                <div>Outstanding: <strong>{selectedIssueForReturn.outstandingQuantity}</strong> unit(s)</div>
              </div>

              <div className="form-group">
                <label className="form-label">Return Quantity *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedIssueForReturn.outstandingQuantity}
                  className="input-text"
                  style={{ width: '100%' }}
                  value={returnForm.returnQuantity}
                  onChange={(e) => setReturnForm({ ...returnForm, returnQuantity: e.target.value })}
                  required
                />
                <div className="form-hint">
                  Partial returns are supported; any remaining balance continues as outstanding.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Condition on Return (Mandatory Inspection) *</label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={returnForm.conditionOnReturn}
                  onChange={(e) => setReturnForm({ ...returnForm, conditionOnReturn: e.target.value })}
                >
                  <option value="Usable">Usable (Stock is immediately restored to Available)</option>
                  <option value="Damaged">Damaged (Marked unavailable until coordinator resolves)</option>
                  <option value="Maintenance">Under Maintenance (Marked unavailable for calibration/repair)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Receiving Staff Member</label>
                <input
                  type="text"
                  className="input-text"
                  style={{ width: '100%' }}
                  value={returnForm.receivingStaff}
                  onChange={(e) => setReturnForm({ ...returnForm, receivingStaff: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Inspection Remarks</label>
                <input
                  type="text"
                  className="input-text"
                  style={{ width: '100%' }}
                  value={returnForm.remarks}
                  onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })}
                  placeholder="e.g. Returned with all pin headers intact, fully functional."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Return Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Student Renewal Request Modal */}
      {showRenewalModal && selectedIssueForRenewal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Request 15-Day Renewal</h3>
              <button className="close-btn" onClick={() => setShowRenewalModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRenewalSubmit}>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                <div>Item: <strong>{selectedIssueForRenewal.itemName}</strong></div>
                <div>Current Due Date: <strong>{new Date(selectedIssueForRenewal.dueDate).toLocaleDateString()}</strong></div>
                <div style={{ color: 'var(--success)', marginTop: '0.25rem' }}>
                  Requested New Due Date: <strong>{new Date(new Date(selectedIssueForRenewal.dueDate).getTime() + (15 * 24 * 60 * 60 * 1000)).toLocaleDateString()}</strong> (+15 calendar days)
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Renewal *</label>
                <textarea
                  className="input-textarea"
                  style={{ width: '100%', minHeight: '90px' }}
                  value={renewalForm.reason}
                  onChange={(e) => setRenewalForm({ ...renewalForm, reason: e.target.value })}
                  placeholder="Explain why extension is required for your project..."
                  required
                />
                <div className="form-hint">
                  Note: Submitting this request does NOT automatically extend the due date until the Coordinator approves it.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRenewalModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Renewal Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Inventory Item Modal */}
      {showAddItemModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Add New Inventory Item</h3>
              <button className="close-btn" onClick={() => setShowAddItemModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Item Code *</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newItemForm.itemCode}
                    onChange={(e) => setNewItemForm({ ...newItemForm, itemCode: e.target.value })}
                    placeholder="e.g. DEV-BOARD-01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Item Name *</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newItemForm.name}
                    onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                    placeholder="e.g. Raspberry Pi 5"
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newItemForm.category}
                    onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Make / Model</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newItemForm.makeModel}
                    onChange={(e) => setNewItemForm({ ...newItemForm, makeModel: e.target.value })}
                    placeholder="e.g. 8GB RAM Model B"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tracking Type *</label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newItemForm.trackingType}
                    onChange={(e) => setNewItemForm({ ...newItemForm, trackingType: e.target.value })}
                  >
                    <option value="QUANTITY">Quantity-Based (e.g. Cables, Adapters)</option>
                    <option value="INDIVIDUAL">Individually Tracked (e.g. Laptops, Dev Boards)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newItemForm.totalQuantity}
                    onChange={(e) => setNewItemForm({ ...newItemForm, totalQuantity: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Storage Location</label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={newItemForm.locationId}
                  onChange={(e) => setNewItemForm({ ...newItemForm, locationId: e.target.value })}
                >
                  <option value="">-- Select Location --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.laboratory} ({loc.room}, {loc.cupboard})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="input-textarea"
                  style={{ width: '100%' }}
                  value={newItemForm.description}
                  onChange={(e) => setNewItemForm({ ...newItemForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddItemModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Asset Modal */}
      {showAddAssetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Register Individually Tracked Asset</h3>
              <button className="close-btn" onClick={() => setShowAddAssetModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddAsset}>
              <div className="form-group">
                <label className="form-label">Parent Inventory Item *</label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={newAssetForm.itemId}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, itemId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Item --</option>
                  {items
                    .filter((i) => i.trackingType === 'INDIVIDUAL')
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.itemCode})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Unique Asset ID *</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newAssetForm.assetId}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, assetId: e.target.value })}
                    placeholder="e.g. DB-014 or LPT-005"
                    required
                  />
                  <div className="form-hint">Must be globally unique.</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newAssetForm.serialNumber}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, serialNumber: e.target.value })}
                    placeholder="e.g. SN-892182"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Initial Condition</label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={newAssetForm.condition}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, condition: e.target.value })}
                >
                  <option value="Usable">Usable</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddAssetModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Storage Location Modal */}
      {showLocationModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Add Storage Location</h3>
              <button className="close-btn" onClick={() => setShowLocationModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddLocation}>
              <div className="form-group">
                <label className="form-label">Department *</label>
                <input
                  type="text"
                  className="input-text"
                  style={{ width: '100%' }}
                  value={newLocationForm.department}
                  onChange={(e) => setNewLocationForm({ ...newLocationForm, department: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Laboratory *</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newLocationForm.laboratory}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, laboratory: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Room Number *</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newLocationForm.room}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, room: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Cupboard / Rack</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newLocationForm.cupboard}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, cupboard: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Shelf Number</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={newLocationForm.shelf}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, shelf: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLocationModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Storage Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Stock Adjustment Modal */}
      {showStockAdjustmentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Record Stock Adjustment</h3>
              <button className="close-btn" onClick={() => setShowStockAdjustmentModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleStockAdjustment}>
              <div className="form-group">
                <label className="form-label">Item *</label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={adjustmentForm.itemId}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, itemId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Item --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.itemCode}) — Current Total: {i.totalQuantity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Adjustment Type *</label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={adjustmentForm.adjustmentType}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value })}
                  >
                    <option value="NEW_STOCK">New Stock Arrival (+)</option>
                    <option value="CORRECTION">Inventory Audit Correction (+/-)</option>
                    <option value="RETIREMENT">Item Retirement / Decommission (-)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity Delta *</label>
                  <input
                    type="number"
                    className="input-text"
                    style={{ width: '100%' }}
                    value={adjustmentForm.quantity}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Justification (Mandatory) *</label>
                <input
                  type="text"
                  className="input-text"
                  style={{ width: '100%' }}
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  placeholder="e.g. Annual physical count variance or procurement batch 2026-Q4"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStockAdjustmentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Post Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Printable Acknowledgement Slip Modal */}
      {activeAckSlip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Item Issue Acknowledgement Slip</h3>
              <button className="close-btn" onClick={() => setActiveAckSlip(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="ack-slip" id="print-slip">
              <h3>DEPARTMENT INVENTORY MANAGEMENT</h3>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.75rem' }}>
                OFFICIAL ITEM ISSUE ACKNOWLEDGEMENT & LOAN CONTRACT
              </div>

              <div className="ack-meta-row">
                <span>Acknowledgement Ref:</span>
                <strong>{activeAckSlip.acknowledgementNumber || activeAckSlip.id}</strong>
              </div>
              <div className="ack-meta-row">
                <span>Student Name:</span>
                <strong>{activeAckSlip.studentName}</strong>
              </div>
              <div className="ack-meta-row">
                <span>Enrolment Number:</span>
                <strong>{activeAckSlip.studentEnrolment}</strong>
              </div>
              <div className="ack-meta-row">
                <span>Programme:</span>
                <span>{activeAckSlip.programme || 'M.Sc. DFIS'}</span>
              </div>
              <div className="ack-meta-row">
                <span>Issued Item:</span>
                <strong>{activeAckSlip.itemName}</strong>
              </div>
              {activeAckSlip.assetId && (
                <div className="ack-meta-row">
                  <span>Asset ID (Individually Tracked):</span>
                  <strong>{activeAckSlip.assetId}</strong>
                </div>
              )}
              <div className="ack-meta-row">
                <span>Quantity Issued:</span>
                <strong>{activeAckSlip.quantity} unit(s)</strong>
              </div>
              <div className="ack-meta-row">
                <span>Issue Date:</span>
                <span>{new Date(activeAckSlip.issueDate).toLocaleDateString()}</span>
              </div>

              <div className="ack-due-highlight">
                MANDATORY RETURN / RENEWAL DUE DATE:<br />
                {new Date(activeAckSlip.dueDate).toLocaleDateString()} (15 Calendar Days)
              </div>

              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem' }}>
                Notice: Every item issued must be returned or renewed within 15 days. Submitting a renewal request alone does not extend this due date; coordinator approval is required.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #d1d5db', fontSize: '0.75rem' }}>
                <div>Student Signature: __________________</div>
                <div>Coordinator Signature: __________________</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={15} />
                Print Acknowledgement
              </button>
              <button className="btn btn-primary" onClick={() => setActiveAckSlip(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
