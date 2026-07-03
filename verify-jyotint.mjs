#!/usr/bin/env node
// verify-jyotint — independent seal verifier.
//
// Removes the operator from the trust chain. Anyone who can run Node can
// fetch the public manifest, recompute the SHA-256 hashes from the four
// sealed inputs (objectId | dateIssued | title | claim), and confirm:
//   (a) the manifest hash in jyotishintelligence.com/seal-manifest.json
//       still matches what the live page claims,
//   (b) every per-advisory hash is consistent with the published inputs.
//
// Usage:
//   node verify-jyotint.mjs                        # verify live manifest + .ots anchor
//   node verify-jyotint.mjs --manifest path.json   # verify a local copy
//   node verify-jyotint.mjs --ots path.ots         # check this .ots commits to the manifest
//   node verify-jyotint.mjs --id LA-019            # verify a single advisory
//   node verify-jyotint.mjs --json                 # machine-readable output
//   node verify-jyotint.mjs --no-ots               # skip the anchor check
//
// Exit codes:
//   0  all checks pass
//   1  manifest integrity drift
//   2  one or more per-record hash mismatches
//   3  fetch / I/O failure
//   4  the .ots proof does NOT commit to this manifest (swap/backdate handle)
//   5  grading-ledger drift (frozen grades / Brier do not recompute)
//
// Zero non-builtin dependencies. Drop this file anywhere and run it.
//
// Grading ledger (separate artifact): grading-ledger.json freezes each closed
// call's assigned probability + graded outcome and makes the published Brier
// reproducible from anchored data. This script recomputes its hash and Brier as
// a best-effort extra check — it SKIPS (never fails) if the ledger is absent, so
// older manifests keep verifying unchanged.
//
// What the anchor check proves (and doesn't): an OpenTimestamps proof embeds the
// raw SHA-256 of the exact bytes it stamped. We confirm that digest equals the
// SHA-256 of the manifest you're holding — i.e. THIS proof is for THIS file, and
// the file has not been altered since stamping (integrity). It does NOT prove any
// individual call predated its event — anteriority lives in the platform (X /
// YouTube) upload timestamp, not in the Bitcoin anchor. To turn the embedded
// digest into a confirmed Bitcoin block height, run `ots verify` (needs the CLI).

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ORIGIN = "https://jyotishintelligence.com";
const MANIFEST_URL = `${ORIGIN}/seal-manifest.json`;
const PROOF_URL = `${ORIGIN}/seal-manifest.json.ots`;
const LEDGER_URL = `${ORIGIN}/grading-ledger.json`;
const MERKLE_URL = `${ORIGIN}/seal-merkle.json`;

const argv = process.argv.slice(2);
const opts = {
  manifest: argv.includes("--manifest") ? argv[argv.indexOf("--manifest") + 1] : null,
  ots: argv.includes("--ots") ? argv[argv.indexOf("--ots") + 1] : null,
  noOts: argv.includes("--no-ots"),
  id: argv.includes("--id") ? argv[argv.indexOf("--id") + 1] : null,
  json: argv.includes("--json"),
};

function recompute({ objectId, videoId, dateIssued, title, claim }) {
  // Seal payload binds the sealed artifact (video OR X post) + the claim fixed
  // at seal time: objectId|dateIssued|title|claim. Falls back to videoId for any
  // legacy record predating the objectId field.
  const oid = objectId ?? videoId ?? "";
  return createHash("sha256").update(`${oid}|${dateIssued}|${title}|${claim ?? ""}`).digest("hex");
}

// Merkle root over the per-record seal hashes (sorted by id) — the same
// construction as scripts/seal/build-merkle.mjs: parent = SHA256(leftHex+rightHex),
// odd row duplicates its last node. Lets a single record's inclusion be proven
// in O(log n) against a root that is itself a function of the anchored hashes.
function sha256hex(s) { return createHash("sha256").update(s, "utf8").digest("hex"); }
function merkleRootOf(records) {
  let level = [...records].sort((a, b) => a.id.localeCompare(b.id)).map((r) => r.hash);
  if (level.length === 0) return "";
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(sha256hex(left + right));
    }
    level = next;
  }
  return level[0];
}
function merkleProofOk(leaf, proof, root) {
  let cur = leaf;
  for (const step of proof) cur = step.position === "left" ? sha256hex(step.sibling + cur) : sha256hex(cur + step.sibling);
  return cur === root;
}

async function loadMerkle() {
  try {
    if (opts.manifest) {
      const sibling = opts.manifest.replace(/seal-manifest\.json$/, "seal-merkle.json");
      return JSON.parse(readFileSync(sibling, "utf8"));
    }
    const res = await fetch(MERKLE_URL);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function canonicalManifestHash(records) {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

async function loadManifest() {
  // Return BOTH the raw bytes (for the true file SHA-256 the anchor commits to)
  // and the parsed JSON (for the record checks). Re-serializing JSON would change
  // the bytes, so the digest must be taken over the exact served/read bytes.
  if (opts.manifest) {
    const raw = readFileSync(opts.manifest);
    return { raw, json: JSON.parse(raw.toString("utf8")) };
  }
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`fetch ${MANIFEST_URL} → HTTP ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  return { raw, json: JSON.parse(raw.toString("utf8")) };
}

// Best-effort: bytes of the .ots proof, or null if unavailable (the core verifier
// still works without it — the anchor check is then reported as skipped).
async function loadProof() {
  if (opts.noOts) return null;
  if (opts.ots) {
    try { return readFileSync(opts.ots); } catch { return null; }
  }
  if (opts.manifest) {
    // Look for a sibling `<manifest>.ots`.
    try { return readFileSync(`${opts.manifest}.ots`); } catch { return null; }
  }
  try {
    const res = await fetch(PROOF_URL);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// Best-effort: load grading-ledger.json from a sibling of --manifest, or fetch
// it live. Returns null (skip, don't fail) if it can't be found.
async function loadLedger() {
  try {
    if (opts.manifest) {
      const sibling = opts.manifest.replace(/seal-manifest\.json$/, "grading-ledger.json");
      return JSON.parse(readFileSync(sibling, "utf8"));
    }
    const res = await fetch(LEDGER_URL);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function report(name, ok, detail) {
  const tag = ok ? "PASS" : "FAIL";
  const line = `[${tag}] ${name}${detail ? ` · ${detail}` : ""}`;
  if (!opts.json) console.log(line);
  return { name, ok, detail };
}

try {
  const { raw: manifestRaw, json: manifest } = await loadManifest();
  const checks = [];

  const recomputed = canonicalManifestHash(manifest.records);
  checks.push(report(
    "manifest integrity",
    recomputed === manifest.manifestHash,
    `claimed=${manifest.manifestHash.slice(0, 12)}… actual=${recomputed.slice(0, 12)}…`,
  ));

  // Anchor check: the .ots proof embeds the raw SHA-256 of the file it stamped.
  // Confirm that digest equals SHA-256(this manifest's bytes) — i.e. the proof is
  // for THIS file (integrity / no swap). Skipped (not failed) if no proof is found.
  const fileSha = createHash("sha256").update(manifestRaw).digest(); // 32 raw bytes
  const proof = await loadProof();
  let anchorOk = null; // null = skipped
  if (proof) {
    anchorOk = proof.includes(fileSha);
    checks.push(report(
      "anchor · .ots commits to this manifest",
      anchorOk,
      anchorOk
        ? `sha256=${fileSha.toString("hex").slice(0, 12)}… present in proof`
        : `sha256=${fileSha.toString("hex").slice(0, 12)}… NOT in proof — proof is for a different file`,
    ));
  } else if (!opts.json) {
    console.log("[SKIP] anchor · .ots commits to this manifest · no proof available (use --ots or run online)");
  }

  const subset = opts.id
    ? manifest.records.filter((r) => r.id === opts.id)
    : manifest.records;
  if (opts.id && subset.length === 0) {
    console.error(`no record matches --id ${opts.id}`);
    process.exit(3);
  }

  let mismatched = 0;
  for (const r of subset) {
    const expected = recompute(r);
    const ok = expected === r.hash;
    if (!ok) mismatched++;
    checks.push(report(
      `seal · ${r.id}`,
      ok,
      ok ? r.hash.slice(0, 12) + "…" : `claimed=${r.hash.slice(0, 12)}… expected=${expected.slice(0, 12)}…`,
    ));
  }

  // Companion seals — corroborating operator posts sealed alongside each primary
  // forecast. Kept OUT of `records` (so the headline sealed-forecast count and
  // the DOI'd manifestHash never move), but they ARE bytes in this file, which
  // the .ots stamps whole — so each is Bitcoin-anchored just the same. Recompute
  // every companion hash with the identical recipe, then the companionsHash over
  // the whole array. Absent = skip (older manifest). Drift = exit 7.
  let companionsOk = null;
  let compMismatched = 0;
  if (Array.isArray(manifest.companions) && manifest.companions.length) {
    const compSubset = opts.id
      ? manifest.companions.filter((c) => c.parentId === opts.id || c.id === opts.id)
      : manifest.companions;
    for (const c of compSubset) {
      const expected = recompute(c);
      const ok = expected === c.hash;
      if (!ok) compMismatched++;
      checks.push(report(
        `companion · ${c.id}`,
        ok,
        ok ? c.hash.slice(0, 12) + "…" : `claimed=${c.hash.slice(0, 12)}… expected=${expected.slice(0, 12)}…`,
      ));
    }
    const chRecomputed = createHash("sha256").update(JSON.stringify(manifest.companions)).digest("hex");
    const chOk = chRecomputed === manifest.companionsHash;
    if (!chOk) compMismatched++;
    companionsOk = compMismatched === 0;
    checks.push(report(
      "companions · array hash",
      chOk,
      chOk ? chRecomputed.slice(0, 12) + "…" : `claimed=${String(manifest.companionsHash).slice(0, 12)}… actual=${chRecomputed.slice(0, 12)}…`,
    ));
  } else if (!opts.json && !opts.id) {
    console.log("[SKIP] companions · none on this manifest");
  }

  // Grading ledger — recompute its hash from the entries and the Brier from the
  // frozen per-call terms; confirm both equal the ledger's own claimed values.
  // Absent ledger = skip (older manifests verify unchanged). Drift = exit 5.
  let ledgerOk = null;
  const ledger = opts.id ? null : await loadLedger();
  if (ledger && Array.isArray(ledger.entries)) {
    const ledgerHash = createHash("sha256").update(JSON.stringify(ledger.entries)).digest("hex");
    const brierRecomputed = Number(
      (ledger.entries.reduce((s, e) => s + e.brierTerm, 0) / ledger.entries.length).toFixed(4),
    );
    const hashOk = ledgerHash === ledger.ledgerHash;
    const brierOk = brierRecomputed === ledger.brier;
    ledgerOk = hashOk && brierOk;
    checks.push(report(
      "grading ledger · hash",
      hashOk,
      hashOk ? ledgerHash.slice(0, 12) + "…" : `claimed=${String(ledger.ledgerHash).slice(0, 12)}… actual=${ledgerHash.slice(0, 12)}…`,
    ));
    checks.push(report(
      "grading ledger · brier reproduced",
      brierOk,
      `${brierRecomputed} (claimed ${ledger.brier}) over ${ledger.entries.length} closed calls`,
    ));
  } else if (!opts.id) {
    console.log("[SKIP] grading ledger · not available (older manifest or offline)");
  }

  // Merkle layer — recompute the root from THIS manifest's record hashes (which
  // manifestHash, and therefore the Bitcoin anchor, already commits to) and
  // confirm it equals the published seal-merkle.json root; then confirm each
  // record's inclusion proof folds up to that root. Absent = skip. Drift = exit 6.
  let merkleOk = null;
  const merkle = await loadMerkle();
  if (merkle && merkle.merkleRoot) {
    const rootRecomputed = merkleRootOf(manifest.records);
    const rootOk = rootRecomputed === merkle.merkleRoot;
    let proofsBad = 0, proofsChecked = 0;
    for (const r of subset) {
      const p = merkle.proofs?.[r.id];
      if (!p) { proofsBad++; continue; }
      proofsChecked++;
      if (!merkleProofOk(p.leaf, p.proof, merkle.merkleRoot)) proofsBad++;
    }
    merkleOk = rootOk && proofsBad === 0;
    checks.push(report(
      "merkle · root from manifest",
      rootOk,
      rootOk ? rootRecomputed.slice(0, 12) + "…" : `published=${String(merkle.merkleRoot).slice(0, 12)}… recomputed=${rootRecomputed.slice(0, 12)}…`,
    ));
    checks.push(report(
      "merkle · inclusion proofs",
      proofsBad === 0,
      `${proofsChecked - proofsBad}/${proofsChecked} proofs fold to root`,
    ));
  } else if (!opts.json) {
    console.log("[SKIP] merkle · not available (no seal-merkle.json)");
  }

  if (opts.json) {
    console.log(JSON.stringify({
      origin: ORIGIN,
      manifestUrl: MANIFEST_URL,
      manifestHash: manifest.manifestHash,
      manifestOk: recomputed === manifest.manifestHash,
      fileSha256: fileSha.toString("hex"),
      anchorOk, // true / false / null(skipped)
      ledgerOk, // true / false / null(skipped)
      merkleOk, // true / false / null(skipped)
      companionsOk, // true / false / null(skipped)
      records: checks.filter((c) => c.name.startsWith("seal · ")).length,
      companions: checks.filter((c) => c.name.startsWith("companion · ")).length,
      mismatched,
      companionMismatched: compMismatched,
      checks,
    }, null, 2));
  } else {
    console.log("");
    console.log(`origin:        ${ORIGIN}`);
    console.log(`manifest:      ${manifest.count} records`);
    console.log(`file sha256:   ${fileSha.toString("hex")}`);
    console.log(`anchor:        ${anchorOk === null ? "skipped (no proof)" : anchorOk ? "proof commits to this manifest ✓" : "PROOF MISMATCH ✗"}`);
    console.log(`grading:       ${ledgerOk === null ? "skipped (no ledger)" : ledgerOk ? "Brier reproduced from frozen grades ✓" : "LEDGER DRIFT ✗"}`);
    console.log(`merkle:        ${merkleOk === null ? "skipped (no merkle)" : merkleOk ? "root + inclusion proofs verified ✓" : "MERKLE DRIFT ✗"}`);
    console.log(`companions:    ${companionsOk === null ? "skipped (none)" : companionsOk ? `${manifest.companionCount ?? manifest.companions.length} corroborating seals verified ✓` : "COMPANION DRIFT ✗"}`);
    console.log(`mismatched:    ${mismatched}`);
  }

  if (recomputed !== manifest.manifestHash) process.exit(1);
  if (mismatched > 0) process.exit(2);
  if (anchorOk === false) process.exit(4);
  if (ledgerOk === false) process.exit(5);
  if (merkleOk === false) process.exit(6);
  if (companionsOk === false) process.exit(7);
  process.exit(0);
} catch (err) {
  console.error("verify-jyotint error:", err.message);
  process.exit(3);
}
