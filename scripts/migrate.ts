import { runMigrations } from "../src/lib/db";

runMigrations();
console.log("SQLite migrations applied.");
