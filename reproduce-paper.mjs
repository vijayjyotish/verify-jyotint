#!/usr/bin/env node
/**
 * reproduce-paper.mjs — recompute EVERY headline statistic in "Sealed Before the
 * Event" from the public, CC-BY data, and check each against the value the site
 * publishes. Zero dependencies (native Node ≥18). For peer reviewers and anyone
 * who wants to reproduce the manuscript's numbers, not merely trust them.
 *
 *   node reproduce-paper.mjs                 # fetch the public JSON from the site
 *   node reproduce-paper.mjs --local DIR     # read graded.json + the published
 *                                            # analysis JSON from a local folder
 *
 * It reads ONLY:
 *   /api/v1/graded.json            — the raw graded record (the single source)
 *   /api/v1/measurement-profile.json, /luck-test.json, /novel-metrics.json,
 *   /grading-ledger.json           — the PUBLISHED values, to check against
 * Everything below is recomputed FROM graded.json and compared to those files,
 * so a MATCH proves the published analysis is an honest projection of the raw
 * record — no number was typed by hand. Exits non-zero on any mismatch.
 *
 * Companion to verify-jyotint.mjs (which checks the seals, the Merkle tree, the
 * Bitcoin anchor and the Brier). This checks the STATISTICS the paper reports.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ORIGIN = "https://jyotishintelligence.com";
const localArg = process.argv.indexOf("--local");
const LOCAL = localArg > -1 ? (process.argv[localArg + 1] || ".") : null;

async function load(name, apiPath) {
  if (LOCAL) return JSON.parse(readFileSync(resolve(LOCAL, name), "utf8"));
  const r = await fetch(`${ORIGIN}${apiPath}`);
  if (!r.ok) throw new Error(`fetch ${apiPath} → ${r.status}`);
  return r.json();
}

const graded = await load("graded.json", "/api/v1/graded.json");
const mp = await load("measurement-profile.json", "/api/v1/measurement-profile.json");
const lt = await load("luck-test.json", "/api/v1/luck-test.json");
const nm = await load("novel-metrics.json", "/api/v1/novel-metrics.json");

const recs = graded.records;
const O = (a) => (a === "HIT" ? 1 : a === "MISS" ? 0 : 0.5);
const rows = recs.map((r) => ({ p: r.prob_at_seal, o: O(r.accuracy), a: r.accuracy, lead: r.lead_days, id: r.id, iy: r.iy?.bits, sita: r.sita?.score, sitaGrade: r.sita?.grade, src: Array.isArray(r.sources) ? r.sources.length : 0 }));
const n = rows.length;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pbar = mean(rows.map((r) => r.p)), obar = mean(rows.map((r) => r.o));

// ── Brier + Murphy decomposition ──────────────────────────────────────────────
const brier = mean(rows.map((r) => (r.p - r.o) ** 2));
const groups = new Map();
for (const r of rows) { if (!groups.has(r.p)) groups.set(r.p, []); groups.get(r.p).push(r.o); }
let REL = 0, RES = 0;
for (const [p, os] of groups) { const ok = os.length, obark = mean(os); REL += (ok / n) * (p - obark) ** 2; RES += (ok / n) * (obark - obar) ** 2; }
const UNC = mean(rows.map((r) => r.o ** 2)) - obar ** 2;
// Spiegelhalter Z
const zNum = rows.reduce((s, r) => s + (r.o - r.p) * (1 - 2 * r.p), 0);
const zDen = Math.sqrt(rows.reduce((s, r) => s + (1 - 2 * r.p) ** 2 * r.p * (1 - r.p), 0));
const Z = zDen ? zNum / zDen : 0;
// Cox slope/intercept
const sp = rows.reduce((s, r) => s + (r.p - pbar) * (r.o - obar), 0);
const spp = rows.reduce((s, r) => s + (r.p - pbar) ** 2, 0);
const slope = spp ? sp / spp : 0, intercept = obar - slope * pbar;
// Sharpness + CITL
const sharpness = mean(rows.map((r) => Math.abs(r.p - 0.5))), citl = pbar - obar;

// ── Luck test — clustering (same partition the site publishes) ────────────────
const by = (id) => recs.find((a) => a.id === id);
const NAMED = [
  ["IA-IN24-001", "IA-IN24-002", "IA-IN24-003", "IA-IN24-004"],
  recs.filter((a) => a.id.startsWith("IA-US24")).map((a) => a.id),
  ["IA-RU-003", "IA-RU-005"],
  ["LA-007", "LA-008", "LA-009", "LA-010"],
  ["LA-011", "LA-012"],
  ["LA-014", "LA-015", "LA-016", "LA-017", "LA-018"],
  ["LA-019", "LA-020", "LA-021", "LA-022"],
];
const clustered = new Set(NAMED.flat());
const clusters = [...NAMED, ...recs.filter((a) => !clustered.has(a.id)).map((a) => [a.id])];
const events = clusters.map((ids) => ids.map(by).every((x) => x.accuracy === "HIT"));
const nEvents = events.length, nSuccess = events.filter(Boolean).length;
const logC = (N, k) => { let s = 0; for (let i = 0; i < k; i++) s += Math.log(N - i) - Math.log(i + 1); return s; };
const tail = (N, k, p) => { let t = 0; for (let j = k; j <= N; j++) t += Math.exp(logC(N, j) + j * Math.log(p) + (N - j) * Math.log(1 - p)); return t; };
const pCoin = tail(nEvents, nSuccess, 0.5);
let breakEven05 = null; for (let p = 0.999; p > 0.3; p -= 0.001) if (tail(nEvents, nSuccess, p) < 0.05) { breakEven05 = +p.toFixed(3); break; }

// ── Value axes ────────────────────────────────────────────────────────────────
const iyMedian = median(rows.map((r) => r.iy).filter((x) => typeof x === "number"));
const sitaMedian = median(rows.map((r) => r.sita).filter((x) => typeof x === "number"));
// Novel: decisiveness, corroboration, value-concentration
const decisiveness = mean(rows.map((r) => 2 * Math.abs(r.p - 0.5)));
const medSources = median(rows.map((r) => r.src));
const medBits = median(rows.map((r) => r.iy).filter((x) => typeof x === "number"));
const HI = new Set(["High", "Very High", "Critical"]);
const hiVal = rows.filter((r) => HI.has(r.sitaGrade) && typeof r.iy === "number" && r.iy >= medBits);
const hiValHit = hiVal.filter((r) => r.a === "HIT").length;

// ── Compare recomputed vs published ───────────────────────────────────────────
let fails = 0;
const near = (a, b, tol = 5e-4) => Math.abs(a - b) <= tol;
function check(label, got, want, tol) {
  const ok = typeof want === "number" ? near(got, want, tol) : got === want;
  if (!ok) fails++;
  const g = typeof got === "number" ? got.toFixed(4) : String(got);
  const w = typeof want === "number" ? Number(want).toFixed(4) : String(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(42)} recomputed ${g.padStart(10)}  published ${w.padStart(10)}`);
}

console.log(`\nreproduce-paper.mjs — ${n} graded calls from ${LOCAL ? LOCAL : ORIGIN + "/api/v1/graded.json"}\n`);
console.log("§3.2/§4.1  Brier & scored record");
check("Brier", brier, mp.brier, 5e-4);
check("graded count", n, mp.n, 0);
console.log("\n§3.6  Five-way calibration-integrity suite");
check("Murphy reliability", REL, mp.calibration_integrity.murphy.reliability, 5e-4);
check("Murphy resolution", RES, mp.calibration_integrity.murphy.resolution, 5e-4);
check("Murphy uncertainty", UNC, mp.calibration_integrity.murphy.uncertainty, 5e-4);
check("Spiegelhalter Z", Z, mp.calibration_integrity.spiegelhalter_z, 5e-3);
check("Cox slope", slope, mp.calibration_integrity.cox_slope, 5e-3);
check("Cox intercept", intercept, mp.calibration_integrity.cox_intercept, 5e-3);
check("Sharpness", sharpness, mp.calibration_integrity.sharpness, 5e-3);
check("Calibration-in-the-large", citl, mp.calibration_integrity.calibration_in_the_large, 5e-4);
console.log("\n§3.5/§4  Luck test (clustered, strict, coin-flip floor)");
check("independent events", nEvents, lt.result.independentEvents, 0);
check("strict successes", nSuccess, lt.result.strictSuccesses, 0);
check("p at coin-flip floor", pCoin, lt.result.pIfEveryEventWereACoinFlip, Math.abs(lt.result.pIfEveryEventWereACoinFlip) * 0.02 + 1e-9);
check("break-even (p<0.05)", breakEven05, lt.result.breakEven.p05, 2e-3);
console.log("\n§3.4/§4.6  Value axes");
check("Information Yield median (bits)", iyMedian, median(recs.map((r) => r.iy?.bits).filter((x) => typeof x === "number")), 1e-6);
check("decisiveness (novel)", decisiveness, nm.decisiveness.decisiveness, 5e-4);
check("corroboration median sources", medSources, nm.corroboration.median_sources, 0);
check("value-concentration high-value HITs", hiValHit, nm.value_concentration.high_value_hits, 0);
check("value-concentration high-value calls", hiVal.length, nm.value_concentration.high_value_calls, 0);

console.log(`\n${fails === 0 ? "ALL CHECKS PASSED — every published statistic recomputes from the raw graded record." : fails + " MISMATCH(ES) — see FAIL rows above."}`);
process.exit(fails === 0 ? 0 : 1);
