import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!sqlHost) {
  console.warn("SQL_HOST is not yet configured in environment variables.");
}
if (!sqlDbName) {
  console.warn("SQL_DB_NAME is not yet configured in environment variables.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    host: sqlHost || "localhost",
    user: user || "postgres",
    password: password || "",
    database: sqlDbName || "postgres",
    ssl: false,
  },
  verbose: true,
});
