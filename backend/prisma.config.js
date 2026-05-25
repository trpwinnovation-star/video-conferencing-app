const path = require("path");
const { defineConfig } = require("prisma/config");

require("dotenv").config({ path: path.join(__dirname, ".env") });

// generate does not connect to the DB; placeholder is enough when .env is missing
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://localhost:5432/placeholder?schema=public";

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
