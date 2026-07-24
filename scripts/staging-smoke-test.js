"use strict";

const baseUrl = String(process.env.STAGING_API_URL || "").replace(/\/$/, "");
const accessToken = String(process.env.STAGING_ACCESS_TOKEN || "").trim();

if (!baseUrl) {
  console.error("Missing STAGING_API_URL.");
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const health = await request("/health");
  assert(health.ok, `Health check failed with ${health.status}`);
  assert(health.body?.database === "connected", "Staging database is not connected.");
  console.log("PASS: health endpoint and staging database connection");

  const noToken = await request("/api/v2/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calculator: "generator" })
  });
  assert(noToken.status === 401, `Expected 401 without token, received ${noToken.status}`);
  console.log("PASS: protected access endpoint rejects missing token");

  if (!accessToken) {
    console.log("SKIP: authenticated entitlement tests; set STAGING_ACCESS_TOKEN to run them.");
    return;
  }

  for (const calculator of ["generator", "aic"]) {
    const result = await request("/api/v2/access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ calculator })
    });

    assert([200, 403].includes(result.status),
      `${calculator}: expected 200 or 403, received ${result.status}`);
    console.log(`PASS: ${calculator} entitlement returned expected status ${result.status}`);
  }
}

run().catch((error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
