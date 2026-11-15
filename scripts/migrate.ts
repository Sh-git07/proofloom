import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runMigrations() {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!projectRef || !dbPassword) {
    console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD in .env.local");
    process.exit(1);
  }

  // Candidates for connection string
  // 1. Direct connection: db.[project-ref].supabase.co:5432
  // 2. Pooler connection: aws-0-[region].pooler.supabase.com:6543 (session/transaction)
  const connectionStrings = [
    `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`,
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  ];

  let client: Client | null = null;

  for (const connStr of connectionStrings) {
    const masked = connStr.replace(/:([^:@]+)@/, ":****@");
    console.log(`Attempting connection: ${masked}`);
    try {
      const c = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });
      await c.connect();
      client = c;
      console.log(`Connected successfully to database!`);
      break;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Failed connecting with ${masked}: ${message}`);
    }
  }

  if (!client) {
    console.error("Could not connect to database using any known host.");
    process.exit(1);
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    const { rows: appliedRows } = await client.query<{ name: string }>(
      "SELECT name FROM public._schema_migrations"
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // If table was newly created, pre-populate existing migrations 01 and 02 which already exist in DB
    if (appliedSet.size === 0) {
      await client.query(
        "INSERT INTO public._schema_migrations (name) VALUES ('20261115000001_initial_schema.sql'), ('20261115000002_functions_and_rls.sql') ON CONFLICT DO NOTHING"
      );
      appliedSet.add("20261115000001_initial_schema.sql");
      appliedSet.add("20261115000002_functions_and_rls.sql");
    }

    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`Found ${files.length} migration files (${appliedSet.size} previously recorded).`);

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`Skipping already-applied migration: ${file}`);
        continue;
      }
      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");
      await client.query(sql);
      await client.query("INSERT INTO public._schema_migrations (name) VALUES ($1)", [file]);
      console.log(`Successfully applied: ${file}`);
    }

    console.log("All migrations applied successfully!");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Migration error:", message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
