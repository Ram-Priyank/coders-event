import { useState, useEffect } from "react";
import {
  Package,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Users,
  MapPin,
  FileText,
  ShieldCheck,
  Settings,
  Search,
  Plus,
  LogOut,
  X,
  Box,
  ChevronRight,
  Check,
  Clock,
} from "lucide-react";
const icons = {
  Overview: LayoutDashboard,
  Inventory: Package,
  Loans: ArrowUpRight,
  Renewals: RefreshCw,
  Students: Users,
  Locations: MapPin,
  Reports: FileText,
  "Audit trail": ShieldCheck,
  Settings,
};
const date = (d) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
async function api(path, body, key) {
  const r = await fetch(
    "/api" + path,
    body
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key || crypto.randomUUID(),
          },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
function Badge({ children, tone = "" }) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Empty({
  message = "Nothing here yet. Records will appear as you work.",
}) {
  return (
    <div className="empty">
      <Box size={32} />
      <h3>All clear</h3>
      <p>{message}</p>
    </div>
  );
}
function Table({ heads, children }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function csv(name, list) {
  if (!list.length) return;
  const keys = Object.keys(list[0]);
  const escape = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const a = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob(
      [
        [keys, ...list.map((r) => keys.map((k) => r[k]))]
          .map((r) => r.map(escape).join(","))
          .join("\r\n"),
      ],
      { type: "text/csv" },
    ),
  );
  a.href = url;
  a.download = name + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
export default function App() {
  const [displayDate] = useState(() =>
    new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }),
  );
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState({}),
    [tab, setTab] = useState("Overview"),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("All"),
    [receipt, setReceipt] = useState(null);
  const refresh = async () => {
    const d = await api("/data");
    setData(d);
    setUser(d.user);
  };
  useEffect(() => {
    api("/auth/me")
      .then((u) => {
        setUser(u);
        return refresh();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const logout = async () => {
    await api("/auth/logout", {});
    setUser(null);
    setData({});
    setTab("Overview");
    setNotice("");
  };
  const staff = user?.role !== "STUDENT";
  const items = data.items || [],
    issues = data.issues || [],
    renewals = data.renewals || [],
    assets = data.assets || [],
    balances = data.balances || [],
    locations = data.locations || [];
  const active = issues.filter((i) => i.quantity > i.returned),
    overdue = active.filter((i) => i.overdue_days > 0),
    pending = renewals.filter((r) => r.status === "PENDING");
  const matches = (r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
  const count = (item, b) =>
    item.tracking === "BULK"
      ? balances
          .filter((x) => x.item_id === item.id && x.bucket === b)
          .reduce((s, x) => s + x.quantity, 0)
      : assets.filter((a) => a.item_id === item.id && a.status === b).length;
  const available = items.reduce((s, i) => s + count(i, "USABLE"), 0),
    unavailable = items.reduce(
      (s, i) =>
        s +
        ["DAMAGED", "MAINTENANCE", "LOST", "RETIRED"].reduce(
          (a, b) => a + count(i, b),
          0,
        ),
      0,
    );
  const opts = (list, label = "name") =>
    list.map((x) => ({ value: x.id, label: x[label] }));
  const field = (name, label, type = "text", options, initial) => ({
    name,
    label,
    type,
    options,
    initial,
  });
  const open = (title, path, fields, extra = {}) => {
    setError("");
    setModal({ title, path, fields, key: crypto.randomUUID(), ...extra });
  };
  const itemFields = [
    field("code", "Item code"),
    field("name", "Item name"),
    field("category_id", "Category", "select", opts(data.categories || [])),
    field("tracking", "Tracking mode", "select", ["BULK", "INDIVIDUAL"]),
    field("model", "Manufacturer / model"),
    field("description", "Description"),
    field("unit", "Base unit", "text", null, "unit"),
  ];
  const issue = () =>
    open("Issue equipment", "/issues", [
      field(
        "student_id",
        "Student",
        "select",
        opts((data.students || []).filter((s) => s.active)),
      ),
      field("item_id", "Item", "select", opts(items.filter((i) => i.active))),
      field("location_id", "Location", "select", opts(locations)),
      field("asset_id", "Individual asset (leave blank for bulk)", "select", [
        { value: "", label: "Bulk stock — no asset" },
        ...assets
          .filter((a) => a.status === "USABLE")
          .map((a) => ({ value: a.id, label: a.tag })),
      ]),
      field("quantity", "Quantity", "number", null, 1),
      field("purpose", "Purpose"),
    ]);
  const returnItem = (i) =>
    open("Receive a return", "/issues/" + i.id + "/return", [
      field(
        "quantity",
        "Quantity (outstanding: " + (i.quantity - i.returned) + ")",
        "number",
        null,
        i.quantity - i.returned,
      ),
      field("condition", "Inspected condition", "select", [
        "USABLE",
        "DAMAGED",
        "MAINTENANCE",
        "LOST",
        "RETIRED",
      ]),
      field("remarks", "Inspection remarks"),
    ]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      for (const f of modal.fields) {
        if (f.type === "number") b[f.name] = Number(b[f.name]);
        if (f.type === "checkbox") b[f.name] = b[f.name] === "on";
      }
      if ("asset_id" in b && !b.asset_id) b.asset_id = null;
      if ("parent_id" in b && !b.parent_id) b.parent_id = null;
      const r = await api(modal.path, { ...b, ...modal.fixed }, modal.key);
      if (modal.path === "/issues") setReceipt(r);
      setModal(null);
      setNotice("Saved successfully");
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "/auth/login",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const loanTable = (list) =>
    list.length ? (
      <Table
        heads={[
          "Equipment",
          "Borrower",
          "Outstanding",
          "Due date",
          "Status",
          "Action",
        ]}
      >
        {list.map((i) => (
          <tr key={i.id}>
            <td>
              <strong>{i.item_name}</strong>
              <small>
                {i.tag || "Bulk quantity"} · {i.id.slice(0, 8)}
              </small>
            </td>
            <td>
              {i.student_name}
              <small>{i.enrolment}</small>
            </td>
            <td>
              {i.quantity - i.returned}
              <span className="muted"> / {i.quantity}</span>
            </td>
            <td>{date(i.due_on)}</td>
            <td>
              <Badge
                tone={
                  i.quantity === i.returned
                    ? "green"
                    : i.overdue_days > 0
                      ? "red"
                      : "blue"
                }
              >
                {i.quantity === i.returned
                  ? "Returned"
                  : i.overdue_days > 0
                    ? `${i.overdue_days}d overdue`
                    : "On loan"}
              </Badge>
            </td>
            <td>
              {i.quantity > i.returned &&
                (staff ? (
                  <button className="text-button" onClick={() => returnItem(i)}>
                    Receive return <ArrowDownLeft size={14} />
                  </button>
                ) : (
                  <button
                    className="text-button"
                    disabled={renewals.some(
                      (r) => r.issue_id === i.id && r.status === "PENDING",
                    )}
                    onClick={() =>
                      open(
                        "Request a renewal",
                        "/issues/" + i.id + "/renewal",
                        [field("reason", "Why do you need more time?")],
                      )
                    }
                  >
                    Request renewal
                  </button>
                ))}
            </td>
          </tr>
        ))}
      </Table>
    ) : (
      <Empty />
    );
  if (loading) return <div className="loading">Loading DeptTrack…</div>;
  if (!user)
    return (
      <div className="login">
        <section>
          <div className="brand">
            <span className="brand-icon">
              <Package />
            </span>
            DeptTrack
          </div>
          <Badge tone="green">DEPARTMENT WORKSPACE</Badge>
          <h1>
            Less paperwork.
            <br />
            More possibilities.
          </h1>
          <p>
            A clear view of your equipment, every loan,
            <br />
            and the people doing great work with it.
          </p>
          <div className="login-art">
            <Package size={90} />
            <div>
              <strong>Every item. Accounted for.</strong>
              <p>Inventory · Lending · Accountability</p>
            </div>
          </div>
        </section>
        <form onSubmit={login}>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your department workspace.</p>
          <label>
            Username
            <input name="username" autoComplete="username" required autoFocus />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"} <ArrowUpRight size={18} />
          </button>
          <small>Access is managed by your department administrator.</small>
        </form>
      </div>
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <Package size={23} />
          </span>
          DeptTrack<span className="brand-dot">.</span>
        </div>
        <div className="workspace">
          <span className="avatar">DF</span>
          <div>
            <strong>Digital Forensics</strong>
            <small>Department workspace</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {(staff ? Object.keys(icons) : ["Overview", "Loans", "Renewals"]).map(
            (t) => {
              const Icon = icons[t];
              return (
                <button
                  key={t}
                  aria-label={t}
                  className={tab === t ? "selected" : ""}
                  onClick={() => {
                    setTab(t);
                    setSearch("");
                    setFilter("All");
                    setError("");
                  }}
                >
                  <Icon size={19} />
                  {t}
                  {t === "Renewals" && pending.length > 0 && (
                    <span className="nav-count">{pending.length}</span>
                  )}
                </button>
              );
            },
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="live">
            <span /> MySQL connected
          </div>
          <div className="profile">
            <span className="avatar purple">
              {user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role.toLowerCase()}</small>
            </div>
            <button aria-label="Sign out" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} /> <span>{tab}</span>
          </div>
          <div className="header-right">
            <button
              className="mobile-signout"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
            <span className="date">{displayDate}</span>
            <Badge tone="green">
              {staff ? "Staff workspace" : "Student portal"}
            </Badge>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">DEPARTMENT INVENTORY</p>
              <h1>{tab === "Overview" ? "Everything in its place." : tab}</h1>
              <p className="muted">
                {tab === "Overview"
                  ? `Welcome back, ${user.name}. Here’s what’s happening in your department.`
                  : {
                      Inventory:
                        "Manage equipment, individual assets, and stock across your locations.",
                      Loans: "Track every handover, deadline, and return.",
                      Renewals: "A little more time, with the right approval.",
                      Students:
                        "Registered borrowers and their department profiles.",
                      Locations: "Know where your equipment belongs.",
                      Reports:
                        "Your operational records, ready to review and export.",
                      "Audit trail":
                        "An accountable record of every important change.",
                      Settings:
                        "Configure borrowing limits and renewal eligibility.",
                    }[tab]}
              </p>
            </div>
            {staff && (
              <button className="primary" onClick={issue}>
                <Plus size={18} /> Issue equipment
              </button>
            )}
          </div>
          {error && !modal && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={17} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "Overview" && (
            <>
              <div className="stats">
                {[
                  [
                    staff ? "Available units" : "My active loans",
                    staff ? available : active.length,
                    Package,
                    "Ready for your next project",
                    "mint",
                  ],
                  [
                    "On loan",
                    active.reduce((n, i) => n + i.quantity - i.returned, 0),
                    ArrowUpRight,
                    "Across active issue records",
                    "lavender",
                  ],
                  [
                    "Overdue loans",
                    overdue.length,
                    Clock,
                    "Need a little attention",
                    "peach",
                  ],
                  [
                    "Pending renewals",
                    pending.length,
                    RefreshCw,
                    "Awaiting a coordinator decision",
                    "yellow",
                  ],
                ].map(([title, n, Icon, caption, color]) => (
                  <div className="stat" key={title}>
                    <div className={"stat-icon " + color}>
                      <Icon size={21} />
                    </div>
                    <span>{title}</span>
                    <strong>{n}</strong>
                    <small>{caption}</small>
                  </div>
                ))}
              </div>
              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Active loans</h2>
                      <p>Equipment currently out with students</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setTab("Loans")}
                    >
                      View all <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {loanTable(active.slice(0, 5))}
                </section>
                <section className="panel snapshot">
                  <div className="panel-heading">
                    <h2>
                      {staff ? "Stock at a glance" : "Your borrowing guide"}
                    </h2>
                  </div>
                  {staff ? (
                    <>
                      <div
                        className="donut"
                        style={{
                          "--portion": `${(available / Math.max(available + unavailable + active.reduce((n, i) => n + i.quantity - i.returned, 0), 1)) * 100}%`,
                        }}
                      >
                        <div>
                          <strong>{available}</strong>
                          <small>available units</small>
                        </div>
                      </div>
                      <div className="legend">
                        <span>
                          <i className="mint" />
                          Available
                        </span>
                        <strong>{available}</strong>
                      </div>
                      <div className="legend">
                        <span>
                          <i className="lavender" />
                          On loan
                        </span>
                        <strong>
                          {active.reduce(
                            (n, i) => n + i.quantity - i.returned,
                            0,
                          )}
                        </strong>
                      </div>
                      <div className="legend">
                        <span>
                          <i className="peach" />
                          Other conditions
                        </span>
                        <strong>{unavailable}</strong>
                      </div>
                    </>
                  ) : (
                    <div className="guide">
                      <Clock size={36} />
                      <h3>15 days to make it happen.</h3>
                      <p>
                        Every loan starts with 15 calendar days. Need longer?
                        Request a renewal. Your due date changes only after
                        approval.
                      </p>
                    </div>
                  )}
                </section>
              </div>
              <section className="tip">
                <ShieldCheck size={26} />
                <div>
                  <strong>Small details. Complete accountability.</strong>
                  <p>
                    Every issue, return, and approval is recorded with its
                    responsible staff member.
                  </p>
                </div>
                <Badge>15-day loan policy</Badge>
              </section>
            </>
          )}
          {tab !== "Overview" && tab !== "Settings" && (
            <div className="toolbar">
              <div className="search">
                <Search size={17} />
                <input
                  aria-label="Search records"
                  placeholder={"Search " + tab.toLowerCase() + "…"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="actions">
                {tab === "Inventory" && (
                  <>
                    <button
                      onClick={() =>
                        open("Add inventory item", "/items", itemFields)
                      }
                    >
                      <Plus size={16} />
                      New item
                    </button>
                    <button
                      onClick={() =>
                        open("Register individual asset", "/assets", [
                          field(
                            "item_id",
                            "Item",
                            "select",
                            opts(
                              items.filter((i) => i.tracking === "INDIVIDUAL"),
                            ),
                          ),
                          field(
                            "location_id",
                            "Location",
                            "select",
                            opts(locations),
                          ),
                          field("tag", "Unique asset tag"),
                          field("serial", "Serial number"),
                        ])
                      }
                    >
                      Add asset
                    </button>
                    <button
                      onClick={() =>
                        open("Adjust bulk stock", "/stock", [
                          field(
                            "item_id",
                            "Item",
                            "select",
                            opts(items.filter((i) => i.tracking === "BULK")),
                          ),
                          field(
                            "location_id",
                            "Location",
                            "select",
                            opts(locations),
                          ),
                          field("bucket", "Stock bucket", "select", [
                            "USABLE",
                            "DAMAGED",
                            "MAINTENANCE",
                            "LOST",
                            "RETIRED",
                          ]),
                          field(
                            "quantity",
                            "Quantity change (+ or −)",
                            "number",
                          ),
                          field("reason", "Reason"),
                        ])
                      }
                    >
                      Adjust stock
                    </button>
                    <button
                      onClick={() =>
                        open("Transfer bulk stock", "/transfers", [
                          field(
                            "item_id",
                            "Item",
                            "select",
                            opts(items.filter((i) => i.tracking === "BULK")),
                          ),
                          field(
                            "from",
                            "From location",
                            "select",
                            opts(locations),
                          ),
                          field("to", "To location", "select", opts(locations)),
                          field("bucket", "Condition", "select", [
                            "USABLE",
                            "DAMAGED",
                            "MAINTENANCE",
                            "LOST",
                            "RETIRED",
                          ]),
                          field("quantity", "Quantity", "number", null, 1),
                          field("reason", "Reason"),
                        ])
                      }
                    >
                      Transfer
                    </button>
                    <button
                      onClick={() =>
                        open("New category", "/categories", [
                          field("name", "Category name"),
                        ])
                      }
                    >
                      Category
                    </button>
                  </>
                )}
                {tab === "Students" && (
                  <button
                    onClick={() =>
                      open("Register student", "/students", [
                        field("name", "Full name"),
                        field("username", "Username"),
                        field("enrolment", "Enrolment number"),
                        field("programme", "Programme"),
                        field("semester", "Semester", "number", null, 1),
                        field(
                          "password",
                          "Initial password (12+ characters)",
                          "password",
                        ),
                      ])
                    }
                  >
                    <Plus size={16} />
                    Register student
                  </button>
                )}
                {tab === "Locations" && (
                  <button
                    onClick={() =>
                      open("Add location", "/locations", [
                        field("name", "Location name"),
                        field("parent_id", "Parent location", "select", [
                          { value: "", label: "No parent" },
                          ...opts(locations),
                        ]),
                      ])
                    }
                  >
                    <Plus size={16} />
                    New location
                  </button>
                )}
                {["Loans", "Renewals"].includes(tab) && (
                  <select
                    aria-label="Filter status"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {(tab === "Loans"
                      ? ["All", "Active", "Overdue", "Returned"]
                      : ["All", "PENDING", "APPROVED", "REJECTED"]
                    ).map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                )}
                {tab === "Reports" && (
                  <>
                    <select
                      aria-label="Report type"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      {[
                        "All",
                        "Overdue",
                        "Upcoming",
                        "Stock",
                        "Transactions",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    <button onClick={() => window.print()}>Print</button>
                    <button
                      onClick={() => csv("depttrack-" + filter, reportRows())}
                    >
                      Export CSV
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {tab === "Inventory" && (
            <>
              <section className="panel">
                {items.filter(matches).length ? (
                  <Table
                    heads={[
                      "Equipment",
                      "Tracking",
                      "Available",
                      "On loan",
                      "Other",
                      "Status",
                      "",
                    ]}
                  >
                    {items.filter(matches).map((i) => (
                      <tr key={i.id}>
                        <td>
                          <strong>{i.name}</strong>
                          <small>
                            {i.code} · {i.category}
                          </small>
                        </td>
                        <td>
                          <Badge>{i.tracking}</Badge>
                        </td>
                        <td>
                          <strong className="green-text">
                            {count(i, "USABLE")}
                          </strong>
                        </td>
                        <td>
                          {active
                            .filter((x) => x.item_id === i.id)
                            .reduce((n, x) => n + x.quantity - x.returned, 0)}
                        </td>
                        <td>
                          {["DAMAGED", "MAINTENANCE", "LOST", "RETIRED"]
                            .map((b) => `${b.toLowerCase()}: ${count(i, b)}`)
                            .join(" · ")}
                        </td>
                        <td>
                          <Badge tone={i.active ? "green" : ""}>
                            {i.active ? "Active" : "Retired"}
                          </Badge>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              open(
                                "Edit inventory item",
                                "/items/" + i.id + "/update",
                                [
                                  field("name", "Name", "text", null, i.name),
                                  field(
                                    "description",
                                    "Description",
                                    "text",
                                    null,
                                    i.description,
                                  ),
                                  field(
                                    "model",
                                    "Model",
                                    "text",
                                    null,
                                    i.model,
                                  ),
                                  field(
                                    "active",
                                    "Active and available for lending",
                                    "checkbox",
                                    null,
                                    !!i.active,
                                  ),
                                ],
                              )
                            }
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty />
                )}
              </section>
              <section className="panel spaced">
                <div className="panel-heading">
                  <h2>Individual asset register</h2>
                  <Badge>{assets.length} assets</Badge>
                </div>
                <Table
                  heads={[
                    "Asset tag",
                    "Equipment",
                    "Location",
                    "Condition",
                    "",
                  ]}
                >
                  {assets.filter(matches).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.tag}</strong>
                        <small>{a.serial}</small>
                      </td>
                      <td>{items.find((i) => i.id === a.item_id)?.name}</td>
                      <td>
                        {locations.find((l) => l.id === a.location_id)?.name}
                      </td>
                      <td>
                        <Badge tone={a.status === "USABLE" ? "green" : ""}>
                          {a.status}
                        </Badge>
                      </td>
                      <td>
                        <button
                          disabled={a.status === "ISSUED"}
                          className="text-button"
                          onClick={() =>
                            open(
                              "Update asset condition / location",
                              "/assets/" + a.id + "/status",
                              [
                                field(
                                  "status",
                                  "Condition",
                                  "select",
                                  [
                                    "USABLE",
                                    "DAMAGED",
                                    "MAINTENANCE",
                                    "LOST",
                                    "RETIRED",
                                  ],
                                  a.status,
                                ),
                                field(
                                  "location_id",
                                  "Location",
                                  "select",
                                  opts(locations),
                                  a.location_id,
                                ),
                                field("reason", "Reason"),
                              ],
                            )
                          }
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              </section>
            </>
          )}
          {tab === "Loans" && (
            <section className="panel">
              {loanTable(
                issues
                  .filter(matches)
                  .filter(
                    (i) =>
                      filter === "All" ||
                      (filter === "Active" && i.quantity > i.returned) ||
                      (filter === "Returned" && i.quantity === i.returned) ||
                      (filter === "Overdue" &&
                        i.quantity > i.returned &&
                        i.overdue_days > 0),
                  ),
              )}
            </section>
          )}
          {tab === "Renewals" && (
            <section className="panel">
              {renewals
                .filter(matches)
                .filter((r) => filter === "All" || r.status === filter)
                .length ? (
                <Table
                  heads={[
                    "Borrower / equipment",
                    "Reason",
                    "Status",
                    "Deadline",
                    "Decision",
                  ]}
                >
                  {renewals
                    .filter(matches)
                    .filter((r) => filter === "All" || r.status === filter)
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.student_name}</strong>
                          <small>{r.item_name}</small>
                        </td>
                        <td>{r.reason}</td>
                        <td>
                          <Badge
                            tone={
                              r.status === "PENDING"
                                ? "amber"
                                : r.status === "APPROVED"
                                  ? "green"
                                  : "red"
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td>{date(r.new_due || r.old_due)}</td>
                        <td>
                          {staff && r.status === "PENDING" ? (
                            <button
                              className="text-button"
                              onClick={() =>
                                open(
                                  "Review renewal",
                                  "/renewals/" + r.id + "/decision",
                                  [
                                    field("decision", "Decision", "select", [
                                      "APPROVED",
                                      "REJECTED",
                                    ]),
                                    field("remarks", "Decision remarks"),
                                  ],
                                )
                              }
                            >
                              Review request
                            </button>
                          ) : (
                            r.remarks || "Awaiting review"
                          )}
                        </td>
                      </tr>
                    ))}
                </Table>
              ) : (
                <Empty message="No renewal requests match this view." />
              )}
            </section>
          )}
          {tab === "Students" && (
            <section className="panel">
              <Table
                heads={["Student", "Enrolment", "Programme", "Status", ""]}
              >
                {(data.students || []).filter(matches).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <small>@{s.username}</small>
                    </td>
                    <td>{s.enrolment}</td>
                    <td>
                      {s.programme}
                      <small>Semester {s.semester}</small>
                    </td>
                    <td>
                      <Badge tone={s.active ? "green" : "red"}>
                        {s.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() =>
                          open(
                            "Student eligibility",
                            "/students/" + s.id + "/status",
                            [
                              field(
                                "active",
                                "Student is eligible to borrow",
                                "checkbox",
                                null,
                                !!s.active,
                              ),
                            ],
                          )
                        }
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            </section>
          )}
          {tab === "Locations" && (
            <div className="location-grid">
              {locations.filter(matches).map((l) => (
                <section className="panel location" key={l.id}>
                  <MapPin size={25} />
                  <h2>{l.name}</h2>
                  <p className="muted">
                    {locations.find((p) => p.id === l.parent_id)?.name ||
                      "Department location"}
                  </p>
                  <Badge>
                    {assets.filter((a) => a.location_id === l.id).length}{" "}
                    individual assets
                  </Badge>
                </section>
              ))}
            </div>
          )}
          {tab === "Reports" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  {filter === "All" ? "Loan register" : filter + " report"}
                </h2>
                <Badge>{reportRows().length} records</Badge>
              </div>
              {reportRows().length ? (
                <Table heads={Object.keys(reportRows()[0])}>
                  {reportRows().map((r, i) => (
                    <tr key={i}>
                      {Object.values(r).map((v, k) => (
                        <td key={k}>{String(v ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </Table>
              ) : (
                <Empty />
              )}
            </section>
          )}
          {tab === "Audit trail" && (
            <section className="panel">
              <Table
                heads={[
                  "Time",
                  "Staff member",
                  "Action",
                  "Reference",
                  "Details",
                ]}
              >
                {(data.audit || []).filter(matches).map((a) => (
                  <tr key={a.id}>
                    <td>{a.created_at}</td>
                    <td>{a.actor}</td>
                    <td>
                      <Badge>{a.action}</Badge>
                    </td>
                    <td>{a.entity_id.slice(0, 8)}</td>
                    <td className="audit-detail">
                      {JSON.stringify(a.details)}
                    </td>
                  </tr>
                ))}
              </Table>
            </section>
          )}
          {tab === "Settings" && (
            <section className="panel settings">
              <ShieldCheck size={32} />
              <h2>Borrowing policy</h2>
              <p>
                Issue and renewal periods are fixed at 15 calendar days.
                Deadlines use Asia/Kolkata calendar dates.
              </p>
              <dl>
                <dt>Maximum outstanding units per student</dt>
                <dd>{data.policy?.max_units}</dd>
                <dt>Maximum renewals per issue</dt>
                <dd>{data.policy?.max_renewals}</dd>
                <dt>Allow overdue renewal approval</dt>
                <dd>{data.policy?.allow_overdue ? "Yes" : "No"}</dd>
              </dl>
              {user.role === "ADMIN" && (
                <button
                  className="primary"
                  onClick={() =>
                    open("Edit borrowing policy", "/policy", [
                      field(
                        "max_units",
                        "Maximum outstanding units",
                        "number",
                        null,
                        data.policy.max_units,
                      ),
                      field(
                        "max_renewals",
                        "Maximum renewals",
                        "number",
                        null,
                        data.policy.max_renewals,
                      ),
                      field(
                        "allow_overdue",
                        "Allow overdue renewals",
                        "checkbox",
                        null,
                        !!data.policy.allow_overdue,
                      ),
                    ])
                  }
                >
                  Edit policy
                </button>
              )}
            </section>
          )}
          <footer>
            DeptTrack <span>Thoughtfully organized. Responsibly managed.</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="panel-heading">
              <h2 id="modal-title">{modal.title}</h2>
              <button
                aria-label="Close dialog"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit}>
              {modal.fields.map((f) => (
                <label key={f.name}>
                  {f.label}
                  {f.type === "select" ? (
                    <select
                      aria-label={f.label}
                      name={f.name}
                      defaultValue={f.initial}
                      required={f.name !== "asset_id" && f.name !== "parent_id"}
                    >
                      {f.options.map((o) => (
                        <option key={o.value ?? o} value={o.value ?? o}>
                          {o.label ?? o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "checkbox" ? (
                    <input
                      aria-label={f.label}
                      name={f.name}
                      type="checkbox"
                      defaultChecked={f.initial}
                    />
                  ) : (
                    <input
                      aria-label={f.label}
                      name={f.name}
                      type={f.type}
                      defaultValue={f.initial}
                      required={
                        !["description", "model", "serial"].includes(f.name)
                      }
                      step={f.type === "number" ? 1 : undefined}
                      autoComplete={
                        f.type === "password" ? "new-password" : undefined
                      }
                    />
                  )}
                </label>
              ))}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                  <Check size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {receipt && (
        <div className="modal-backdrop">
          <section className="modal receipt" role="dialog" aria-modal="true">
            <ShieldCheck size={40} />
            <h2>Issue acknowledged</h2>
            <p>Reference: {receipt.id}</p>
            <p>Issued: {date(receipt.issued_on)}</p>
            <h3>Due: {date(receipt.due_on)}</h3>
            <p>
              Please return equipment in its issued condition or request a
              renewal before the due date.
            </p>
            <div className="actions">
              <button onClick={() => window.print()}>
                Print acknowledgement
              </button>
              <button className="primary" onClick={() => setReceipt(null)}>
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
  function reportRows() {
    if (filter === "Stock")
      return items.filter(matches).map((i) => ({
        Code: i.code,
        Item: i.name,
        Category: i.category,
        Available: count(i, "USABLE"),
        Damaged: count(i, "DAMAGED"),
        Maintenance: count(i, "MAINTENANCE"),
        Lost: count(i, "LOST"),
        Retired: count(i, "RETIRED"),
      }));
    if (filter === "Transactions")
      return (data.movements || []).filter(matches).map((m) => ({
        Date: m.created_at,
        Item: items.find((i) => i.id === m.item_id)?.name,
        Location: locations.find((l) => l.id === m.location_id)?.name,
        Condition: m.bucket,
        Change: m.delta,
        Reason: m.reason,
      }));
    return issues
      .filter(matches)
      .filter((i) =>
        filter === "Overdue"
          ? i.quantity > i.returned && i.overdue_days > 0
          : filter === "Upcoming"
            ? i.quantity > i.returned &&
              i.overdue_days <= 0 &&
              i.overdue_days >= -7
            : true,
      )
      .map((i) => ({
        Student: i.student_name,
        Enrolment: i.enrolment,
        Programme: i.programme,
        Item: i.item_name,
        Location: i.location_name,
        Issued: i.quantity,
        Outstanding: i.quantity - i.returned,
        Due: i.due_on,
      }));
  }
}
