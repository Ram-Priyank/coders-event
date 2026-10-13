import "dotenv/config";
import mysql, { PoolConnection } from "mysql2/promise";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === "local-dev-only")
)
  throw new Error("Production requires explicit database credentials");
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "depttrack",
  password: process.env.DB_PASSWORD || "local-dev-only",
  database: process.env.DB_NAME || "depttrack",
  connectionLimit: 10,
  dateStrings: true,
  timezone: "Z",
  multipleStatements: false,
});
export async function rows(
  db: any,
  sql: string,
  args: any[] = [],
): Promise<any[]> {
  const [r] = await db.execute(sql, args);
  return r;
}
export async function transaction<T>(
  fn: (c: PoolConnection) => Promise<T>,
): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const result = await fn(c);
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function migrate() {
  for (const s of readFileSync(__dirname + "/schema.sql", "utf8")
    .split(";")
    .filter((s) => s.trim()))
    await pool.query(s);
}
export async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production");
  await transaction(async (c) => {
    if ((await rows(c, "SELECT id FROM users LIMIT 1")).length) return;
    const password = process.env.SEED_PASSWORD;
    if (!password || password.length < 12)
      throw new Error(
        "Set SEED_PASSWORD (12+ characters) to create demo users.",
      );
    const hash = await bcrypt.hash(password, 12);
    for (const [id, username, name, role, enrolment] of [
      ["admin", "admin", "Dr. S. Rao", "ADMIN", null],
      ["student", "priya", "Priya Sharma", "STUDENT", "DFIS-2026-001"],
      ["student2", "arjun", "Arjun Patel", "STUDENT", "DFIS-2026-002"],
    ])
      await c.execute(
        "INSERT INTO users(id,username,name,password_hash,role,enrolment,programme,semester) VALUES(?,?,?,?,?,?,?,?)",
        [id, username, name, hash, role, enrolment, "M.Sc. DFIS", 1],
      );
    await c.execute(
      "INSERT INTO locations VALUES ('lab','Digital Forensics Lab',NULL),('store','Equipment Store','lab')",
    );
    await c.execute(
      "INSERT INTO categories VALUES ('boards','Development Boards'),('cables','Cables & Accessories'),('tools','Lab Equipment')",
    );
    await c.execute(
      "INSERT INTO items VALUES ('board','DB','Arduino Development Board','boards','Microcontroller board for hardware security projects','Arduino Uno R3','unit','INDIVIDUAL',TRUE),('cable','USB','Reusable USB Cable','cables','USB data and power cable','USB-A to USB-B','unit','BULK',TRUE)",
    );
    await c.execute("INSERT INTO balances VALUES ('cable','lab','USABLE',20)");
    for (let n = 1; n <= 10; n++)
      await c.execute("INSERT INTO assets VALUES (?,?,?,?,?,?)", [
        randomUUID(),
        "board",
        "lab",
        `DB-${String(n).padStart(3, "0")}`,
        `SN-${n}`,
        "USABLE",
      ]);
    await c.execute(
      "INSERT INTO movements VALUES (?, 'cable','lab','USABLE',20,'Initial demonstration stock','admin',CURRENT_TIMESTAMP(3))",
      [randomUUID()],
    );
  });
}
if (require.main === module)
  migrate()
    .then(() => (process.argv.includes("--seed") ? seed() : undefined))
    .then(() => pool.end())
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
