import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, rows, transaction } from "./db";
import { AppError, ensure, today, addDays } from "./domain";
const app = express();
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
  }),
);
app.use(express.json({ limit: "64kb" }));
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const wrap = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res)).catch(next);
const text = z.string().trim().min(1).max(500);
const qty = z.number().int().positive().max(100000);
const bucket = z.enum(["USABLE", "DAMAGED", "MAINTENANCE", "LOST", "RETIRED"]);
app.get(
  "/api/health",
  wrap(async (_: any, res: any) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok", engine: "MySQL", businessDate: today() });
  }),
);
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("origin") &&
    req.get("origin") !== `${req.protocol}://${req.get("host")}` &&
    req.get("origin") !== process.env.APP_ORIGIN
  )
    return res.status(403).json({ error: "Origin not permitted" });
  next();
});
app.post(
  "/api/auth/login",
  rateLimit({
    windowMs: 900000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  wrap(async (req: any, res: any) => {
    const b = z
      .object({ username: text, password: z.string().min(1).max(128) })
      .parse(req.body);
    const [u] = await rows(pool, "SELECT * FROM users WHERE username=?", [
      b.username,
    ]);
    ensure(
      u && u.active && (await bcrypt.compare(b.password, u.password_hash)),
      "Invalid username or password",
      401,
    );
    const token = randomBytes(32).toString("hex");
    await pool.execute(
      "INSERT INTO sessions VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 12 HOUR))",
      [hash(token), u.id],
    );
    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 43200000,
      path: "/",
    });
    res.json({ id: u.id, name: u.name, role: u.role });
  }),
);
app.use("/api", (req: any, res: any, next: any) => {
  const token = req.headers.cookie
    ?.split(";")
    .map((x: string) => x.trim())
    .find((x: string) => x.startsWith("session="))
    ?.slice(8);
  (async () => {
    const [u] = token
      ? await rows(
          pool,
          "SELECT u.id,u.name,u.role,u.enrolment,u.programme,u.semester FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.active=TRUE",
          [hash(token)],
        )
      : [];
    ensure(u, "Please sign in", 401);
    req.user = u;
    req.sessionToken = token;
    next();
  })().catch(next);
});
app.get("/api/auth/me", (req: any, res) => res.json(req.user));
app.post(
  "/api/auth/logout",
  wrap(async (req: any, res: any) => {
    await pool.execute("DELETE FROM sessions WHERE token_hash=?", [
      hash(req.sessionToken),
    ]);
    res.clearCookie("session", { path: "/" });
    res.json({ ok: true });
  }),
);
function staff(req: any) {
  ensure(req.user.role !== "STUDENT", "Staff permission required", 403);
}
export const auditWriter = {
  async write(c: any, req: any, action: string, id: string, details: any) {
    await c.execute(
      "INSERT INTO audit(id,actor_id,action,entity_id,details) VALUES(?,?,?,?,?)",
      [randomUUID(), req.user.id, action, id, JSON.stringify(details)],
    );
  },
};
async function movement(
  c: any,
  req: any,
  item: string,
  location: string,
  b: string,
  delta: number,
  reason: string,
) {
  await c.execute(
    "INSERT INTO movements(id,item_id,location_id,bucket,delta,reason,actor_id) VALUES(?,?,?,?,?,?,?)",
    [randomUUID(), item, location, b, delta, reason, req.user.id],
  );
}
async function change(
  c: any,
  item: string,
  location: string,
  b: string,
  delta: number,
) {
  await c.execute("INSERT IGNORE INTO balances VALUES(?,?,?,0)", [
    item,
    location,
    b,
  ]);
  const [r]: any = await c.execute(
    "UPDATE balances SET quantity=quantity+? WHERE item_id=? AND location_id=? AND bucket=? AND quantity+?>=0",
    [delta, item, location, b, delta],
  );
  ensure(r.affectedRows === 1, "Insufficient stock");
}
function mutate(path: string, schema: any, fn: any, student = false) {
  app.post(
    "/api" + path,
    wrap(async (req: any, res: any) => {
      if (!student) staff(req);
      const b = schema.parse(req.body);
      const key = z.string().min(8).max(100).parse(req.get("Idempotency-Key"));
      const operation = req.path;
      const digest = hash(JSON.stringify(b));
      const result = await transaction(async (c) => {
        await c.execute(
          "INSERT IGNORE INTO idempotency(actor_id,operation,request_key,request_hash) VALUES(?,?,?,?)",
          [req.user.id, operation, key, digest],
        );
        const [prior] = await rows(
          c,
          "SELECT * FROM idempotency WHERE actor_id=? AND operation=? AND request_key=? FOR UPDATE",
          [req.user.id, operation, key],
        );
        ensure(
          prior.request_hash === digest,
          "Idempotency key was already used for a different request",
        );
        if (prior.response)
          return typeof prior.response === "string"
            ? JSON.parse(prior.response)
            : prior.response;
        const output = await fn(c, req, b);
        await auditWriter.write(
          c,
          req,
          operation,
          output.id || req.params.id || "configuration",
          b,
        );
        await c.execute(
          "UPDATE idempotency SET response=? WHERE actor_id=? AND operation=? AND request_key=?",
          [JSON.stringify(output), req.user.id, operation, key],
        );
        return output;
      });
      res.json(result);
    }),
  );
}
app.get(
  "/api/data",
  wrap(async (req: any, res: any) => {
    const isStudent = req.user.role === "STUDENT";
    const issues = await rows(
      pool,
      `SELECT i.*,u.name student_name,u.enrolment,u.programme,t.name item_name,t.code,a.tag,l.name location_name,DATEDIFF(?,i.due_on) overdue_days FROM issues i JOIN users u ON u.id=i.student_id JOIN items t ON t.id=i.item_id LEFT JOIN assets a ON a.id=i.asset_id JOIN locations l ON l.id=i.location_id ${isStudent ? "WHERE student_id=?" : ""} ORDER BY i.issued_on DESC,i.id`,
      isStudent ? [today(), req.user.id] : [today()],
    );
    const renewals = await rows(
      pool,
      `SELECT r.*,i.student_id,u.name student_name,t.name item_name FROM renewals r JOIN issues i ON i.id=r.issue_id JOIN users u ON u.id=i.student_id JOIN items t ON t.id=i.item_id ${isStudent ? "WHERE i.student_id=?" : ""} ORDER BY r.created_at DESC`,
      isStudent ? [req.user.id] : [],
    );
    if (isStudent) return res.json({ issues, renewals, user: req.user });
    const [
      items,
      assets,
      balances,
      locations,
      categories,
      students,
      policy,
      events,
      movements,
      returns,
    ] = await Promise.all([
      rows(
        pool,
        "SELECT i.*,c.name category FROM items i JOIN categories c ON c.id=i.category_id ORDER BY i.name",
      ),
      rows(pool, "SELECT * FROM assets"),
      rows(pool, "SELECT * FROM balances"),
      rows(pool, "SELECT * FROM locations"),
      rows(pool, "SELECT * FROM categories"),
      rows(
        pool,
        "SELECT id,username,name,enrolment,programme,semester,active FROM users WHERE role='STUDENT'",
      ),
      rows(pool, "SELECT * FROM policies"),
      rows(
        pool,
        "SELECT a.*,u.name actor FROM audit a JOIN users u ON u.id=a.actor_id ORDER BY created_at DESC LIMIT 200",
      ),
      rows(pool, "SELECT * FROM movements ORDER BY created_at DESC"),
      rows(pool, "SELECT * FROM returns ORDER BY created_at DESC"),
    ]);
    res.json({
      user: req.user,
      items,
      assets,
      balances,
      locations,
      categories,
      students,
      policy: policy[0],
      issues,
      renewals,
      audit: events,
      movements,
      returns,
    });
  }),
);
mutate(
  "/items",
  z.object({
    code: text,
    name: text,
    category_id: text,
    description: z.string().max(2000).default(""),
    model: z.string().max(150).default(""),
    unit: text.default("unit"),
    tracking: z.enum(["BULK", "INDIVIDUAL"]),
  }),
  async (c: any, req: any, b: any) => {
    const id = randomUUID();
    await c.execute("INSERT INTO items VALUES(?,?,?,?,?,?,?,?,TRUE)", [
      id,
      b.code,
      b.name,
      b.category_id,
      b.description,
      b.model,
      b.unit,
      b.tracking,
    ]);
    return { id, ...b };
  },
);
mutate(
  "/items/:id/update",
  z.object({
    name: text,
    description: z.string().max(2000),
    model: z.string().max(150),
    active: z.boolean(),
  }),
  async (c: any, req: any, b: any) => {
    const [r]: any = await c.execute(
      "UPDATE items SET name=?,description=?,model=?,active=? WHERE id=?",
      [b.name, b.description, b.model, b.active, req.params.id],
    );
    ensure(r.affectedRows, "Item not found", 404);
    return { id: req.params.id };
  },
);
mutate(
  "/categories",
  z.object({ name: text }),
  async (c: any, req: any, b: any) => {
    const id = randomUUID();
    await c.execute("INSERT INTO categories VALUES(?,?)", [id, b.name]);
    return { id };
  },
);
mutate(
  "/locations",
  z.object({ name: text, parent_id: z.string().nullable().default(null) }),
  async (c: any, req: any, b: any) => {
    const id = randomUUID();
    await c.execute("INSERT INTO locations VALUES(?,?,?)", [
      id,
      b.name,
      b.parent_id,
    ]);
    return { id };
  },
);
mutate(
  "/students",
  z.object({
    username: text,
    name: text,
    enrolment: text,
    programme: text,
    semester: z.number().int().min(1).max(12),
    password: z.string().min(12).max(128),
  }),
  async (c: any, req: any, b: any) => {
    const id = randomUUID();
    await c.execute("INSERT INTO users VALUES(?,?,?,?, 'STUDENT',TRUE,?,?,?)", [
      id,
      b.username,
      b.name,
      await bcrypt.hash(b.password, 12),
      b.enrolment,
      b.programme,
      b.semester,
    ]);
    delete b.password;
    return { id };
  },
);
mutate(
  "/students/:id/status",
  z.object({ active: z.boolean() }),
  async (c: any, req: any, b: any) => {
    await c.execute("UPDATE users SET active=? WHERE id=? AND role='STUDENT'", [
      b.active,
      req.params.id,
    ]);
    return { id: req.params.id };
  },
);
mutate(
  "/assets",
  z.object({
    item_id: text,
    location_id: text,
    tag: text,
    serial: z.string().max(100).default(""),
  }),
  async (c: any, req: any, b: any) => {
    const [item] = await rows(c, "SELECT * FROM items WHERE id=? FOR UPDATE", [
      b.item_id,
    ]);
    ensure(
      item?.tracking === "INDIVIDUAL" && item.active,
      "Select an active individual item",
    );
    const id = randomUUID();
    await c.execute("INSERT INTO assets VALUES(?,?,?,?,?,'USABLE')", [
      id,
      b.item_id,
      b.location_id,
      b.tag,
      b.serial,
    ]);
    await movement(
      c,
      req,
      b.item_id,
      b.location_id,
      "USABLE",
      1,
      "Asset registered",
    );
    return { id };
  },
);
mutate(
  "/stock",
  z.object({
    item_id: text,
    location_id: text,
    bucket,
    quantity: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine((n) => n !== 0),
    reason: text,
  }),
  async (c: any, req: any, b: any) => {
    const [item] = await rows(c, "SELECT * FROM items WHERE id=? FOR UPDATE", [
      b.item_id,
    ]);
    ensure(
      item?.tracking === "BULK" && item.active,
      "Use asset management for individual items",
    );
    await change(c, b.item_id, b.location_id, b.bucket, b.quantity);
    await movement(
      c,
      req,
      b.item_id,
      b.location_id,
      b.bucket,
      b.quantity,
      b.reason,
    );
    return { id: randomUUID() };
  },
);
mutate(
  "/transfers",
  z.object({
    item_id: text,
    from: text,
    to: text,
    bucket,
    quantity: qty,
    reason: text,
  }),
  async (c: any, req: any, b: any) => {
    ensure(b.from !== b.to, "Choose different locations");
    const [item] = await rows(c, "SELECT * FROM items WHERE id=? FOR UPDATE", [
      b.item_id,
    ]);
    ensure(item?.tracking === "BULK", "Select a bulk item");
    await change(c, b.item_id, b.from, b.bucket, -b.quantity);
    await change(c, b.item_id, b.to, b.bucket, b.quantity);
    await movement(c, req, b.item_id, b.from, b.bucket, -b.quantity, b.reason);
    await movement(c, req, b.item_id, b.to, b.bucket, b.quantity, b.reason);
    return { id: randomUUID() };
  },
);
mutate(
  "/assets/:id/status",
  z.object({ status: bucket, location_id: text, reason: text }),
  async (c: any, req: any, b: any) => {
    const [a] = await rows(c, "SELECT * FROM assets WHERE id=? FOR UPDATE", [
      req.params.id,
    ]);
    ensure(a && a.status !== "ISSUED", "Issued assets must be returned first");
    await c.execute("UPDATE assets SET status=?,location_id=? WHERE id=?", [
      b.status,
      b.location_id,
      a.id,
    ]);
    await movement(c, req, a.item_id, a.location_id, a.status, -1, b.reason);
    await movement(c, req, a.item_id, b.location_id, b.status, 1, b.reason);
    return { id: a.id };
  },
);
mutate(
  "/issues",
  z.object({
    student_id: text,
    item_id: text,
    location_id: text,
    asset_id: z.string().nullable().default(null),
    quantity: qty,
    purpose: text,
  }),
  async (c: any, req: any, b: any) => {
    const [student] = await rows(
      c,
      "SELECT * FROM users WHERE id=? AND role='STUDENT' FOR UPDATE",
      [b.student_id],
    );
    ensure(student?.active, "Student must be registered and active");
    const [p] = await rows(c, "SELECT * FROM policies WHERE id=1");
    const [out] = await rows(
      c,
      "SELECT COALESCE(SUM(quantity-returned),0) n FROM issues WHERE student_id=?",
      [b.student_id],
    );
    ensure(
      Number(out.n) + b.quantity <= p.max_units,
      "Student issue limit exceeded",
    );
    const [item] = await rows(c, "SELECT * FROM items WHERE id=? FOR UPDATE", [
      b.item_id,
    ]);
    ensure(item?.active, "Item is inactive or missing");
    if (item.tracking === "INDIVIDUAL") {
      ensure(b.quantity === 1 && b.asset_id, "Choose one individual asset");
      const [r]: any = await c.execute(
        "UPDATE assets SET status='ISSUED' WHERE id=? AND item_id=? AND location_id=? AND status='USABLE'",
        [b.asset_id, b.item_id, b.location_id],
      );
      ensure(r.affectedRows === 1, "Asset is unavailable");
    } else {
      ensure(!b.asset_id, "Bulk stock cannot specify an asset");
      await change(c, b.item_id, b.location_id, "USABLE", -b.quantity);
    }
    const id = randomUUID(),
      issued_on = today(),
      due_on = addDays(issued_on);
    await c.execute(
      "INSERT INTO issues(id,student_id,item_id,asset_id,location_id,quantity,issued_on,due_on,purpose,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        b.student_id,
        b.item_id,
        b.asset_id,
        b.location_id,
        b.quantity,
        issued_on,
        due_on,
        b.purpose,
        req.user.id,
      ],
    );
    await movement(
      c,
      req,
      b.item_id,
      b.location_id,
      "USABLE",
      -b.quantity,
      "Issue " + id,
    );
    return { id, issued_on, due_on };
  },
);
mutate(
  "/issues/:id/return",
  z.object({ quantity: qty, condition: bucket, remarks: text }),
  async (c: any, req: any, b: any) => {
    const [i] = await rows(c, "SELECT * FROM issues WHERE id=? FOR UPDATE", [
      req.params.id,
    ]);
    ensure(i, "Issue not found", 404);
    ensure(
      b.quantity <= i.quantity - i.returned,
      "Return exceeds outstanding quantity",
    );
    if (i.asset_id)
      await c.execute("UPDATE assets SET status=? WHERE id=?", [
        b.condition,
        i.asset_id,
      ]);
    else await change(c, i.item_id, i.location_id, b.condition, b.quantity);
    const id = randomUUID();
    await c.execute(
      "INSERT INTO returns(id,issue_id,quantity,condition_code,remarks,actor_id) VALUES(?,?,?,?,?,?)",
      [id, i.id, b.quantity, b.condition, b.remarks, req.user.id],
    );
    await c.execute("UPDATE issues SET returned=returned+? WHERE id=?", [
      b.quantity,
      i.id,
    ]);
    await movement(
      c,
      req,
      i.item_id,
      i.location_id,
      b.condition,
      b.quantity,
      "Return " + id,
    );
    return { id };
  },
);
mutate(
  "/issues/:id/renewal",
  z.object({ reason: text }),
  async (c: any, req: any, b: any) => {
    ensure(req.user.role === "STUDENT", "Only students request renewals", 403);
    const [i] = await rows(c, "SELECT * FROM issues WHERE id=? FOR UPDATE", [
      req.params.id,
    ]);
    ensure(i?.student_id === req.user.id, "Issue not found", 404);
    ensure(i.quantity > i.returned, "Issue already returned");
    const existing = await rows(
      c,
      "SELECT id FROM renewals WHERE issue_id=? AND status='PENDING'",
      [i.id],
    );
    ensure(!existing.length, "A request is already pending");
    const id = randomUUID();
    await c.execute(
      "INSERT INTO renewals(id,issue_id,reason,old_due) VALUES(?,?,?,?)",
      [id, i.id, b.reason, i.due_on],
    );
    return { id };
  },
  true,
);
mutate(
  "/renewals/:id/decision",
  z.object({ decision: z.enum(["APPROVED", "REJECTED"]), remarks: text }),
  async (c: any, req: any, b: any) => {
    const [r] = await rows(c, "SELECT * FROM renewals WHERE id=? FOR UPDATE", [
      req.params.id,
    ]);
    ensure(r?.status === "PENDING", "Request already decided or missing");
    const [i] = await rows(c, "SELECT * FROM issues WHERE id=? FOR UPDATE", [
      r.issue_id,
    ]);
    let due = null;
    if (b.decision === "APPROVED") {
      const [p] = await rows(c, "SELECT * FROM policies WHERE id=1");
      ensure(
        i.quantity > i.returned && i.renewals < p.max_renewals,
        "Renewal limit reached or issue returned",
      );
      ensure(
        p.allow_overdue || i.due_on >= today(),
        "Overdue renewals are disabled by policy",
      );
      due = addDays(i.due_on);
      await c.execute(
        "UPDATE issues SET due_on=?,renewals=renewals+1 WHERE id=?",
        [due, i.id],
      );
    }
    await c.execute(
      "UPDATE renewals SET status=?,old_due=?,new_due=?,remarks=?,actor_id=? WHERE id=?",
      [b.decision, i.due_on, due, b.remarks, req.user.id, r.id],
    );
    return { id: r.id, due_on: due };
  },
);
mutate(
  "/policy",
  z.object({
    max_units: qty,
    max_renewals: z.number().int().min(0).max(20),
    allow_overdue: z.boolean(),
  }),
  async (c: any, req: any, b: any) => {
    ensure(req.user.role === "ADMIN", "Admin permission required", 403);
    await c.execute(
      "UPDATE policies SET max_units=?,max_renewals=?,allow_overdue=? WHERE id=1",
      [b.max_units, b.max_renewals, b.allow_overdue],
    );
    return { id: "policy" };
  },
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
app.use(
  express.static(require("node:path").resolve(__dirname, "../../client/dist")),
);
app.get("*", (_req, res) =>
  res.sendFile(
    require("node:path").resolve(__dirname, "../../client/dist/index.html"),
  ),
);
app.use((e: any, _req: any, res: any, _next: any) => {
  const status =
    e instanceof z.ZodError
      ? 400
      : e instanceof AppError
        ? e.status
        : e.code === "ER_DUP_ENTRY"
          ? 409
          : e.code === "ER_NO_REFERENCED_ROW_2"
            ? 400
            : 500;
  if (status === 500) console.error({ code: e.code, message: e.message });
  res.status(status).json({
    error:
      status === 500
        ? "An internal error occurred"
        : e instanceof z.ZodError
          ? e.issues
              .map((i: any) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : e.code === "ER_DUP_ENTRY"
            ? "This record already exists"
            : e.code === "ER_NO_REFERENCED_ROW_2"
              ? "Referenced record does not exist"
              : e.message,
  });
});
export default app;
