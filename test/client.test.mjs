import { test } from "node:test";
import assert from "node:assert/strict";
import { Scrapiq, ScrapiqError } from "../dist/index.js";

const BASE = process.env.SCRAPIQ_BASE ?? "https://scrapiq.io";
const client = new Scrapiq({ baseUrl: BASE, timeoutMs: 60000 });

test("health returns ok", async () => {
  const h = await client.health();
  assert.equal(h.status, "ok");
  assert.ok(h.version);
});

test("markdown extraction returns clean content", async () => {
  const r = await client.markdown("https://example.com");
  assert.equal(r.format, "markdown");
  assert.ok(r.content && r.content.length > 0);
  assert.ok(r.metadata);
  assert.equal(typeof r.extraction_time_ms, "number");
});

test("text extraction returns clean text", async () => {
  const r = await client.text("https://example.com");
  assert.equal(r.format, "text");
  assert.ok(r.content && r.content.length > 0);
});

test("json extraction with schema returns a data object (schema keys or _raw fallback)", async () => {
  const r = await client.extract("https://example.com", {
    format: "json",
    schema: { title: { type: "string" } },
  });
  assert.equal(r.format, "json");
  assert.ok(r.data && typeof r.data === "object");
  // v0.1 API: schema extraction may fall back to a deterministic `_raw` view
  // when the schema cannot be matched (no LLM path configured server-side).
  assert.ok("title" in r.data || "_raw" in r.data);
});

test("invalid URL raises ScrapiqError with readable message (422 validation)", async () => {
  await assert.rejects(
    () => client.extract("not-a-url", { format: "text" }),
    (err) =>
      err instanceof ScrapiqError &&
      (err.status === 400 || err.status === 422) &&
      !err.message.includes("[object Object]"),
  );
});
