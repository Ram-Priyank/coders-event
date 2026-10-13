import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import app, { auditWriter } from "../src/app";
import { pool, rows, transaction } from "../src/db";
import { addDays, today } from "../src/domain";
let server: any, base: string;
const ids = {
  staff: randomUUID(),
  student: randomUUID(),
  other: randomUUID(),
  bulk: randomUUID(),
  board: randomUUID(),
  asset: randomUUID(),
  location: randomUUID(),
  category: randomUUID(),
};
let staff = "",
  student = "",
  other = "",
  issueId = "",
  renewalId = "";
const password = "Test-Only-Password-2026";
async function request(
  path: string,
  body?: any,
  cookie = staff,
  key = randomUUID(),
) {
  const r = await fetch(base + "/api" + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
const issue = (extra = {}) => ({
  student_id: ids.student,
  item_id: ids.bulk,
  location_id: ids.location,
  quantity: 2,
  purpose: "Integration testing",
  ...extra,
});
before(async () => {
  const hash = await bcrypt.hash(password, 4);
  for (const [id, role] of [
    [ids.staff, "ADMIN"],
    [ids.student, "STUDENT"],
    [ids.other, "STUDENT"],
  ])
    await pool.execute(
      "INSERT INTO users(id,username,name,password_hash,role) VALUES(?,?,?,?,?)",
      [id, id, "Test user", hash, role],
    );
  await pool.execute("INSERT INTO locations VALUES(?,?,NULL)", [
    ids.location,
    "Test location",
  ]);
  await pool.execute("INSERT INTO categories VALUES(?,?)", [
    ids.category,
    ids.category,
  ]);
  for (const [id, tracking] of [
    [ids.bulk, "BULK"],
    [ids.board, "INDIVIDUAL"],
  ])
    await pool.execute("INSERT INTO items VALUES(?,?,?,?,?,?,?,?,TRUE)", [
      id,
      id,
      "Test item",
      ids.category,
      "",
      "",
      "unit",
      tracking,
    ]);
  await pool.execute("INSERT INTO balances VALUES(?,?,?,?)", [
    ids.bulk,
    ids.location,
    "USABLE",
    20,
  ]);
  await pool.execute("INSERT INTO assets VALUES(?,?,?,?,?,?)", [
    ids.asset,
    ids.board,
    ids.location,
    ids.asset,
    "",
    "USABLE",
  ]);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  staff = (await request("/auth/login", { username: ids.staff, password }, ""))
    .cookie;
  student = (
    await request("/auth/login", { username: ids.student, password }, "")
  ).cookie;
  other = (await request("/auth/login", { username: ids.other, password }, ""))
    .cookie;
});
after(async () => {
  for (const id of [ids.staff, ids.student, ids.other]) {
    await pool.execute("DELETE FROM sessions WHERE user_id=?", [id]);
    await pool.execute("DELETE FROM idempotency WHERE actor_id=?", [id]);
    await pool.execute("DELETE FROM audit WHERE actor_id=?", [id]);
    await pool.execute("DELETE FROM movements WHERE actor_id=?", [id]);
  }
  await pool.execute(
    "DELETE FROM renewals WHERE issue_id IN (SELECT id FROM issues WHERE student_id IN (?,?))",
    [ids.student, ids.other],
  );
  await pool.execute(
    "DELETE FROM returns WHERE issue_id IN (SELECT id FROM issues WHERE student_id IN (?,?))",
    [ids.student, ids.other],
  );
  await pool.execute("DELETE FROM issues WHERE student_id IN (?,?)", [
    ids.student,
    ids.other,
  ]);
  await pool.execute("DELETE FROM assets WHERE item_id=?", [ids.board]);
  await pool.execute("DELETE FROM balances WHERE item_id=?", [ids.bulk]);
  await pool.execute("DELETE FROM items WHERE id IN (?,?)", [
    ids.bulk,
    ids.board,
  ]);
  await pool.execute("DELETE FROM categories WHERE id=?", [ids.category]);
  await pool.execute("DELETE FROM locations WHERE id=?", [ids.location]);
  for (const id of Object.values(ids).slice(0, 3))
    await pool.execute("DELETE FROM users WHERE id=?", [id]);
  await new Promise<void>((r) => server.close(r));
  await pool.end();
});
test("15 calendar days crosses month and year boundaries", () => {
  assert.equal(addDays("2026-10-01"), "2026-10-16");
  assert.equal(addDays("2026-12-25"), "2027-01-09");
});
test("anonymous requests are rejected", async () =>
  assert.equal((await request("/data", undefined, "")).status, 401));
test("student cannot issue inventory", async () =>
  assert.equal((await request("/issues", issue(), student)).status, 403));
test("issue stock and calculate due date on server", async () => {
  const r = await request("/issues", issue());
  assert.equal(r.status, 200);
  issueId = r.data.id;
  assert.equal(r.data.due_on, addDays(today()));
  const [b] = await rows(
    pool,
    "SELECT quantity FROM balances WHERE item_id=? AND bucket=?",
    [ids.bulk, "USABLE"],
  );
  assert.equal(b.quantity, 18);
});
test("retry is idempotent and rejects a changed payload", async () => {
  const key = randomUUID();
  const a = await request("/issues", issue({ quantity: 1 }), staff, key),
    b = await request("/issues", issue({ quantity: 1 }), staff, key);
  assert.equal(a.status, 200);
  assert.deepEqual(a.data, b.data);
  assert.equal(
    (await request("/issues", issue({ quantity: 2 }), staff, key)).status,
    409,
  );
});
test("student data is ownership-scoped", async () => {
  const a = await request("/data", undefined, student),
    b = await request("/data", undefined, other);
  assert.ok(a.data.issues.some((i: any) => i.id === issueId));
  assert.equal(b.data.issues.length, 0);
  assert.equal(a.data.students, undefined);
});
test("cross-student renewal request is concealed", async () =>
  assert.equal(
    (
      await request(
        `/issues/${issueId}/renewal`,
        { reason: "Need time" },
        other,
      )
    ).status,
    404,
  ));
test("pending renewal leaves deadline unchanged", async () => {
  const r = await request(
    `/issues/${issueId}/renewal`,
    { reason: "Finish project" },
    student,
  );
  assert.equal(r.status, 200);
  renewalId = r.data.id;
  const [i] = await rows(pool, "SELECT due_on FROM issues WHERE id=?", [
    issueId,
  ]);
  assert.equal(i.due_on, addDays(today()));
});
test("concurrent approval extends only once", async () => {
  const r = await Promise.all([
    request(`/renewals/${renewalId}/decision`, {
      decision: "APPROVED",
      remarks: "Approved",
    }),
    request(`/renewals/${renewalId}/decision`, {
      decision: "APPROVED",
      remarks: "Approved",
    }),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [200, 409]);
  const [i] = await rows(
    pool,
    "SELECT due_on,renewals FROM issues WHERE id=?",
    [issueId],
  );
  assert.equal(i.due_on, addDays(today(), 30));
  assert.equal(i.renewals, 1);
});
test("partial damaged return does not replenish usable stock", async () => {
  const [before] = await rows(
    pool,
    "SELECT quantity FROM balances WHERE item_id=? AND bucket=?",
    [ids.bulk, "USABLE"],
  );
  assert.equal(
    (
      await request(`/issues/${issueId}/return`, {
        quantity: 1,
        condition: "DAMAGED",
        remarks: "Connector bent",
      })
    ).status,
    200,
  );
  const [after] = await rows(
    pool,
    "SELECT quantity FROM balances WHERE item_id=? AND bucket=?",
    [ids.bulk, "USABLE"],
  );
  assert.equal(before.quantity, after.quantity);
  const [i] = await rows(pool, "SELECT returned FROM issues WHERE id=?", [
    issueId,
  ]);
  assert.equal(i.returned, 1);
});
test("over-return fails without creating a receipt", async () => {
  const [before] = await rows(
    pool,
    "SELECT COUNT(*) n FROM returns WHERE issue_id=?",
    [issueId],
  );
  assert.equal(
    (
      await request(`/issues/${issueId}/return`, {
        quantity: 2,
        condition: "USABLE",
        remarks: "Too many",
      })
    ).status,
    409,
  );
  const [after] = await rows(
    pool,
    "SELECT COUNT(*) n FROM returns WHERE issue_id=?",
    [issueId],
  );
  assert.equal(before.n, after.n);
});
test("concurrent requests cannot allocate one asset twice", async () => {
  const b = issue({ item_id: ids.board, asset_id: ids.asset, quantity: 1 });
  const results = await Promise.all([
    request("/issues", b),
    request("/issues", b),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});
test("competing borrowers cannot oversell the last bulk unit", async () => {
  await pool.execute(
    "UPDATE balances SET quantity=1 WHERE item_id=? AND bucket='USABLE'",
    [ids.bulk],
  );
  const results = await Promise.all([
    request("/issues", issue({ quantity: 1 })),
    request("/issues", issue({ quantity: 1, student_id: ids.other })),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});
test("inactive students and nonpositive quantities are rejected", async () => {
  await pool.execute("UPDATE users SET active=FALSE WHERE id=?", [ids.other]);
  assert.equal(
    (await request("/issues", issue({ student_id: ids.other, quantity: 1 })))
      .status,
    409,
  );
  assert.equal((await request("/issues", issue({ quantity: -1 }))).status, 400);
});
test("audit failure rolls back stock, issue and movement writes", async () => {
  await pool.execute(
    "UPDATE balances SET quantity=5 WHERE item_id=? AND bucket='USABLE'",
    [ids.bulk],
  );
  const original = auditWriter.write;
  auditWriter.write = async () => {
    throw new Error("Injected audit failure");
  };
  const [before] = await rows(
    pool,
    "SELECT COUNT(*) n FROM issues WHERE student_id=?",
    [ids.student],
  );
  const r = await request("/issues", issue({ quantity: 1 }));
  assert.equal(r.status, 500);
  const [after] = await rows(
    pool,
    "SELECT COUNT(*) n FROM issues WHERE student_id=?",
    [ids.student],
  );
  assert.equal(before.n, after.n);
  const [b] = await rows(
    pool,
    "SELECT quantity FROM balances WHERE item_id=? AND bucket='USABLE'",
    [ids.bulk],
  );
  assert.equal(b.quantity, 5);
  auditWriter.write = original;
});
test("audit has no public mutation route", async () =>
  assert.equal((await request("/audit/delete", {})).status, 404));
test("SQL-shaped input remains data", async () =>
  assert.equal(
    (await request("/auth/login", { username: "' OR 1=1 --", password }, ""))
      .status,
    401,
  ));
test("logout revokes the session", async () => {
  assert.equal((await request("/auth/logout", {}, other)).status, 401);
  assert.equal((await request("/auth/logout", {}, student)).status, 200);
  assert.equal((await request("/data", undefined, student)).status, 401);
});
