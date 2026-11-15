import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connStr = `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`;

async function testFix() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("Applying get_user_org_ids function...");
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_user_org_ids()
    RETURNS TABLE(org_id UUID)
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $$
      SELECT organisation_id FROM public.organisation_members
      WHERE user_id = (SELECT auth.uid());
    $$;

    ALTER FUNCTION public.get_user_org_ids() OWNER TO postgres;

    DROP POLICY IF EXISTS "Org members can view other members" ON public.organisation_members;
    CREATE POLICY "Org members can view other members"
      ON public.organisation_members FOR SELECT
      TO authenticated
      USING (
        user_id = (SELECT auth.uid())
        OR organisation_id IN (SELECT public.get_user_org_ids())
      );
  `);

  console.log("Applied. Testing client query...");
  await client.end();
}

testFix();
