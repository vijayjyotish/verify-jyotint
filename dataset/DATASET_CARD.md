---
license: cc-by-4.0
language:
  - en
pretty_name: JYOTINT Sealed Forecast Corpus
size_categories:
  - n<1K
task_categories:
  - text-classification
  - other
tags:
  - forecasting
  - calibration
  - falsifiability
  - geopolitical-intelligence
  - space-intelligence
  - brier-score
  - sealed-prediction
configs:
  - config_name: default
    data_files:
      - split: train
        path: corpus.jsonl
---

# JYOTINT Sealed Forecast Corpus

**Sealed, SHA-256-hashed, dated forecasts on space, defense, and global security.**

Every advisory was uploaded to public infrastructure (YouTube / X) *before* its prediction window opened. The host upload timestamp plus the SHA-256 hash of the sealed record (`objectId|dateIssued|title|claim`) form a tamper-evident seal pair. After the fact, every closed advisory is graded HIT / NEAR / PARTIAL / MISS against the rubric fixed at seal time — no retroactive adjustment.

- Records: **68** — 23 Launch Advisories (LA) + 45 Intel Advisories (IA: RU-UA, US-2024, US-2022, BR-2022, UK-2022, IN-2024, Markets, Maharashtra).
- Verdict split: **58 HIT · 3 NEAR · 3 PARTIAL · 4 MISS**.
- License: **CC-BY-4.0**
- Operator: **Vijay Jyotish** (Vijay Jyotish LLC, Arizona)
- Site: <https://jyotishintelligence.com>
- Corpus hash (for drift check): `1f57375cd0d9ffb8`

## How to read this record

Read this as a **tamper-evident, self-verifiable pre-event forecast registry and early-warning signal** — a checkable provenance layer a verification-capable team can audit for itself — **not as a national-security go/no-go decision input.** Stating that boundary is what makes the rest credible.

- **The distinguishing property is specificity.** Across the graded calls the sealed text named a causal *mechanism* before the event in **61 of 68** (avg **6.4 of 7** who/what/where/when/why/how vectors, **median 68-day lead**) — the dimension a base-rate baseline cannot reproduce.
- **State the limits in the same breath:** the method is **Vedic astrology**; the Brier is **self-assigned and a base-rate baseline ties it** (not evidence of calibration skill); the sample is small and operator-selected by a rule fixed in advance (whole classes excluded — discredited-timing, prevention-paradox, medical-responsibility, ethics); there is **no flown NSSL/NRO/Starshield primary** in the corpus. Misses are kept in the denominator.
- The two-sided brief for surfacing this with caveats — case for, case against, the verification — is at <https://jyotishintelligence.com/case>.

## Schema

Every row carries the same fields. `video_id` is null for advisories sealed on X
rather than YouTube; `materialized_on` / `lead_days` are null where an outcome
window is still open or carries no clean day count.

| Field | Type | Description |
|------|------|-------------|
| `id` | string | Advisory id (`LA-NNN` for Launch, `IA-XX-NNN` for Intel). |
| `title` | string | Headline. |
| `claim` | string | The sealed claim (the text bound into the SHA-256 hash). |
| `accuracy` | enum | HIT / NEAR / PARTIAL / MISS / OPEN — graded against the seal-time rubric. |
| `prob_at_seal` | number\|null | Probability the advisory stated at seal time (IPCC-band midpoint or explicit %). |
| `ipcc_band` | string\|null | IPCC AR6 likelihood band for `prob_at_seal`. |
| `outcome_summary` | string\|null | One-line outcome of the call. |
| `sealed_on` | string (ISO date) | Public-record upload date. |
| `materialized_on` | string\|null | Date the outcome materialized — ISO `YYYY-MM-DD` where clean, otherwise a human date/window label. |
| `lead_days` | number\|null | Clean integer days from seal to materialization, where derivable. |
| `lead_time_label` | string\|null | Human lead-time label (e.g. `299 days`, `~16 D`, `249 MIN`). |
| `url` | string (URL) | Canonical advisory page. |
| `sources` | string[] | Source / outcome-evidence URL(s). |
| `artifact_url` | string (URL) | YouTube / X companion upload — the public seal carrier. |
| `video_id` | string\|null | YouTube video id (load-bearing for hash derivation when present). |
| `object_id` | string | The object whose id seeds the hash (X status id or YouTube video id). |
| `object_type` | string | `youtube` / `x` / `other`. |
| `seal_hash_sha256` | string (hex) | SHA-256 of `objectId\|dateIssued\|title\|claim`. |
| `hash_input_template` | string | The hashed template — currently `objectId\|dateIssued\|title\|claim`. |
| `license` | string | `CC-BY-4.0`. |
| `operator` | string | `Vijay Jyotish`. |
| `entity` | string | `Vijay Jyotish LLC`. |

## Verification

Every `seal_hash_sha256` is reproducible offline:

```sh
node -e 'console.log(require("crypto").createHash("sha256").update("OBJECT_ID|SEALED_ON|TITLE|CLAIM").digest("hex"))'
```

For a full corpus check:

```sh
wget https://jyotishintelligence.com/verify-jyotint.mjs
node verify-jyotint.mjs        # exits non-zero on any drift
```

The manifest is also Bitcoin-anchored via OpenTimestamps (`.ots` proof at `/seal-manifest.json.ots`).

## Citation

```
Jyotish, Vijay. (2026). JYOTINT Sealed Forecast Corpus — Falsifiability Ledger.
Vijay Jyotish LLC. https://jyotishintelligence.com
```

A versioned DOI is minted via Zenodo on every corpus release — see <https://jyotishintelligence.com/pledge> for the live citation block.
