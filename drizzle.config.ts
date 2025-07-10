/** biome-ignore-all lint/suspicious/noConsole: <explanation> */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log(
  "All env vars:",
  Object.keys(process.env).filter((key) => key.includes("DATABASE"))
);

export default defineConfig({
  dialect: "postgresql",
  casing: "snake_case",
  schema: "./src/db/schema/**.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    url: process.env.DATABASE_URL!,
  },
});
