const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
};

async function timeRequest(endpoint, requestHeaders = {}) {
  const start = performance.now();
  try {
    const res = await fetch(`${url}${endpoint}`, {
      headers: requestHeaders,
    });
    const duration = performance.now() - start;
    console.log(`[${res.status}] ${endpoint} - ${duration.toFixed(2)}ms`);
    return { ok: res.ok, duration };
  } catch (err) {
    const duration = performance.now() - start;
    console.error(`[FAIL] ${endpoint} after ${duration.toFixed(2)}ms:`, err.message);
    return { ok: false, duration, error: err.message };
  }
}

async function run() {
  console.log(`Pinging Supabase at: ${url}`);
  console.log("--- Health Check (/auth/v1/health) ---");
  for (let i = 1; i <= 3; i++) {
    process.stdout.write(`Attempt ${i}: `);
    await timeRequest("/auth/v1/health", headers);
  }

  console.log("\n--- REST Query (/rest/v1/organisations?select=id&limit=1) ---");
  for (let i = 1; i <= 3; i++) {
    process.stdout.write(`Attempt ${i}: `);
    await timeRequest("/rest/v1/organisations?select=id&limit=1", headers);
  }
}

run();
