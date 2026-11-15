import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const projectRef = process.env.SUPABASE_PROJECT_REF;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

const connStr = `postgresql://postgres:${encodeURIComponent(dbPassword!)}@db.${projectRef}.supabase.co:5432/postgres`;

async function runExplain() {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("--- EXPLAIN ANALYZE: audit_findings count query ---");
  const res1 = await client.query(`
    EXPLAIN ANALYZE
    SELECT count(*) FROM audit_findings
    WHERE organisation_id = '00000000-0000-0000-0000-000000000001'
      AND is_resolved = true;
  `);
  console.log(res1.rows.map((r) => r["QUERY PLAN"]).join("\n"));

  console.log("\n--- EXPLAIN ANALYZE: audits order query ---");
  const res2 = await client.query(`
    EXPLAIN ANALYZE
    SELECT id, overall_score, status, created_at
    FROM audits
    WHERE organisation_id = '00000000-0000-0000-0000-000000000001'
    ORDER BY created_at DESC
    LIMIT 20;
  `);
  console.log(res2.rows.map((r) => r["QUERY PLAN"]).join("\n"));

  await client.end();
}

runExplain();
