import "dotenv/config";
import app from "./app";
import { pool } from "./db";
const port = Number(process.env.PORT || 5000);
pool
  .query("SELECT 1")
  .then(() => {
    const server = app.listen(port, "0.0.0.0", () =>
      console.log(`DeptTrack API listening on ${port}`),
    );
    process.on("SIGTERM", () => server.close(() => pool.end()));
  })
  .catch((e) => {
    console.error("Database connection failed:", e.code);
    process.exit(1);
  });
