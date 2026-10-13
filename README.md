# Department Inventory and Student Item Issue Management System (DeptTrack)

> **MERN Stack Application** developed for **Problem Statement #5: Department Inventory and Student Item Issue Management System**.

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-blue.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-v4-lightgrey.svg)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-v6-purple.svg)](https://vitejs.dev/)

---

## 📋 Overview

**DeptTrack** is a full-stack web application designed for academic department inventory coordinators and students. It maintains accurate stock availability, handles reusable item issues, inspects condition upon returns, and enforces strict loan duration and renewal workflows.

### ⏱️ The 15-Day Rule & Core Policies
- **15-Calendar-Day Loan Period:** Every item issued is automatically assigned a due date 15 calendar days from the issue date.
- **Renewal Extension:** Each coordinator-approved renewal extends the due date by an additional **15 calendar days** from the existing due date.
- **Approval Prerequisite:** Submitting a renewal request alone does **not** extend the due date; coordinator approval is mandatory.
- **Individually Tracked Assets vs Quantity Items:**
  - **Individually Tracked:** (e.g., Laptops, Development Boards like `DB-010`) have unique asset IDs and cannot be issued to more than one student at the same time.
  - **Quantity-Based:** (e.g., USB cables, Adapters) track total, available, and issued counts.
- **Stock & Condition Restrictions:** Items in damaged or maintenance condition cannot be issued. Stock cannot be overdrawn; if stock is insufficient, the system explains the exact deficit (e.g., *"Five adapters were requested, but only three are currently available"*).
- **Partial Returns:** Outstanding balance continues to be tracked until all items are returned.
- **Condition on Return:** Usable condition immediately restores stock availability; damaged or maintenance items remain unavailable until cleared by the coordinator.
- **Permanent Audit Trail:** Every transaction (issue, return, renewal, and stock adjustment) is logged with date and responsible user.

---

## 🚀 Preloaded Demonstration Scenario (Problem Statement Section 5)

Pre-seeded for **M.Sc. DFIS, Semester I**:
- **10 Development Boards** (`DB-001` through `DB-010`), each with unique asset IDs and serial numbers.
- **20 Reusable USB Cables** tracked by quantity.
- Registered students (including **Priya Sharma - DFIS-2026-001**) and authorized coordinator (**Dr. S. Rao**).
- One development board (`DB-010`) and two USB cables issued on 1 October 2026 with due date 16 October 2026.
- Demonstration overdue item with live countdown banner.

---

## 🛠️ Tech Stack & Architecture

```
code/
├── client/                 # React frontend powered by Vite
│   ├── src/
│   │   ├── App.jsx         # Coordinator Dashboard, Student Portal, Modals
│   │   ├── index.css       # Rich dark UI, glassmorphism, responsive styles
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js      # API reverse proxy to port 5000
│
├── server/                 # Express backend API
│   ├── data/
│   │   ├── initialSeed.js  # Problem Statement pre-seeded data
│   │   └── db_fallback.json# Persistent datastore
│   ├── routes/
│   │   └── api.js          # REST endpoints & business logic validation
│   ├── db.js               # Dual-engine (MongoDB + Zero-config Embedded Store)
│   ├── server.js           # Express server entry point
│   ├── seed.js             # Seed reset utility
│   └── package.json
│
├── .gitignore
├── README.md
└── package.json            # Root orchestration script
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Git**
- Optional: MongoDB running locally or MongoDB Atlas connection string (falls back to persistent high-performance embedded JSON store if MongoDB is not present).

### 2. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/Ram-Priyank/coders-event.git
cd coders-event

# Install dependencies for both server and client
npm run install-all
```

### 3. Launch the Application
Run both backend API and frontend dev server simultaneously:
```bash
npm run dev
```

- **Frontend Client:** `http://localhost:5173`
- **Backend API:** `http://localhost:5000/api`

---

## 🎯 Key Application Features

### 1. Coordinator Workspace
- **Live Metric Cards:** Total items, available stock, issued units, overdues, damaged/maintenance, and pending renewals.
- **Issue Desk & Printable Acknowledgement:** Instant issue with automated 15-day due date calculation and printable acknowledgement slip.
- **Return Inspection Desk:** Records quantity (full or partial) and condition (Usable, Damaged, Maintenance).
- **Renewal Approvals Desk:** One-click approve (+15 days) or reject with justification remarks.
- **Asset Registry:** Unique asset ID tracking for hardware development boards, laptops, and specialized test equipment.
- **Multi-dimensional Reports:** View records student-wise, item-wise, programme-wise, and laboratory-wise with instant export/print.
- **Stock Adjustments:** Record new stock, physical corrections, or item retirement with mandatory reason logging.

### 2. Student Portal
- **Role Switcher:** Switch seamlessly between Coordinator and Student view.
- **My Borrowed Items:** View active loans, asset IDs, and due date countdown badges.
- **Request 15-Day Renewal:** Submit extension request before due date with project justification.
- **Live Status Tracker:** Track pending, approved (+15 days), or rejected status with coordinator remarks.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health and datastore engine status |
| `GET` | `/api/stats` | Aggregated dashboard metrics |
| `GET` | `/api/items` | List inventory items with availability |
| `POST` | `/api/items` | Add new inventory item |
| `GET` | `/api/assets` | Query individually tracked assets |
| `POST` | `/api/assets` | Register unique individual asset |
| `POST` | `/api/issues` | Issue item (validates 15-day rule, stock, registered student) |
| `POST` | `/api/issues/:id/return` | Record return, partial return & condition inspection |
| `POST` | `/api/renewals` | Student renewal request submission |
| `POST` | `/api/renewals/:id/action` | Coordinator approve/reject renewal (+15 calendar days) |
| `POST` | `/api/stock-adjustments`| Record stock additions, corrections, or retirements |
| `GET` | `/api/reports` | Multi-pivot reports (`student-wise`, `item-wise`, `programme-wise`, `lab-wise`) |
| `GET` | `/api/audit-logs` | Filterable chronological transaction audit trail |
| `POST` | `/api/seed` | Reset database to initial sample dataset |
