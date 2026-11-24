import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema-kit.ts",
  out: "./drizzle",
  dialect: "postgresql",
});
