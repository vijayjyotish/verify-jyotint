# JYOTINT™ — Sealed-Forecast Record

**What this repository is:** a working, complete-corpus example of **cryptographic forecast pre-registration** — a **publicly graded, falsifiable forecasting track record** (misses retained at full weight) whose full manifest is **Bitcoin-anchored via OpenTimestamps** (the published answer to the selective-reveal attack). It includes a **graded public launch mission-assurance record** (23 calls, outcomes adjudicated by public reality — e.g. the New Glenn NG-3 upper-stage failure named the day before flight) and geopolitical indications-&-warning calls (e.g. a mass-casualty warning sealed ~200 days before the Crocus City Hall attack; the 2024 Indian general election called ~299 days before results). Hostile re-grading is invited: every input needed to re-score the record under your own verdicts ships in this repo and at the [regrade kit](https://jyotishintelligence.com/regrade).


> A tamper-evident, Bitcoin-anchored, publicly-graded forecasting record on space launches and great-power events — **that you can verify yourself, without trusting anyone.**

[![verify](https://github.com/vijayjyotish/verify-jyotint/actions/workflows/verify.yml/badge.svg)](https://github.com/vijayjyotish/verify-jyotint/actions/workflows/verify.yml)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20630257.svg)](https://doi.org/10.5281/zenodo.20630257)

This repository is the **independently verifiable core** of the JYOTINT record: a zero-dependency verifier, the Bitcoin-anchored seal manifest, the frozen grading ledger, the calibration data, and the full CC-BY corpus. Nothing here asks you to trust the operator — it asks you to **recompute**.

- **Live record / interactive map:** https://jyotishintelligence.com
- **Operator:** Vijay Jyotish — Vijay Jyotish LLC (Arizona, USA)
- **Archived deposition (DOI):** https://doi.org/10.5281/zenodo.20630257

## Verify it yourself in ~60 seconds

```bash
git clone https://github.com/vijayjyotish/verify-jyotint.git && cd verify-jyotint

# Check the LIVE record at jyotishintelligence.com:
node verify-jyotint.mjs

# …or fully offline, against the cryptographic files committed in this repo:
node verify-jyotint.mjs --manifest ./seal-manifest.json
```

The verifier recomputes the SHA-256 of every sealed advisory (`objectId|dateIssued|title|claim`), confirms the manifest hash, checks the per-record Merkle inclusion proofs, and confirms the OpenTimestamps proof commits the manifest to a Bitcoin block. **It exits non-zero on any drift.** Zero dependencies — just Node 18+.

## What's in here

| File | What it is |
|---|---|
| `verify-jyotint.mjs` | The zero-dependency verifier (live or `--manifest` offline). |
| `seal-manifest.json` (+ `.ots`) | Every sealed advisory's SHA-256 hash, Bitcoin-anchored via OpenTimestamps. |
| `grading-ledger.json` | The frozen grades + probabilities behind the Brier — reproducible. |
| `seal-merkle.json` | Per-record Merkle inclusion proofs. |
| `calibration.json` | The Brier, log-loss, and reliability bins across the closed corpus. |
| `dataset/corpus.jsonl` | The full record as JSON Lines — one sealed call per line. CC-BY-4.0. |

**`corpus.jsonl` fields:** `id`, `title`, `claim` (verbatim sealed text), `accuracy` (HIT/NEAR/PARTIAL/MISS), `prob_at_seal`, `ipcc_band`, `outcome_summary`, `sealed_on`, `materialized_on`, `lead_days`, `url`, `sources`, `seal_hash_sha256`, `hash_input_template`, `operator`, `entity`. 92 graded records.

## How a seal works

Before each event, the exact forecast text is SHA-256-hashed and timestamped on public infrastructure (YouTube / X); the manifest of all hashes is then Bitcoin-anchored via OpenTimestamps. After the event, each call is graded **HIT / NEAR / PARTIAL / MISS** against a rubric fixed at seal time — **with the misses kept in.** The Bitcoin anchor proves the text is *unchanged since stamping*; the *pre-event timing* rests on the platform upload timestamp (independently visible).

## Read it honestly — the caveats are part of the record

- The forecasting method is **Vedic astrology**, disclosed openly; **no causal mechanism is claimed.**
- The published Brier (**0.0958** across 92 graded calls) is a **self-assigned, reproducible self-audit — not externally adjudicated** — and a base-rate baseline ties it. **So the edge is _specificity_, not the score:** 73 of the 88 calls named a causal mechanism before the event — e.g. a Moscow mass-casualty warning sealed ~200 days before the 22 March 2024 Crocus City Hall attack, checkable to the day.
- Small, operator-selected sample (n = 68); no flown NSSL/NRO primary in the corpus.
- **What this is:** a verifiable, falsifiable, pre-sealed forecasting record and early-warning signal — weighed as **one augmenting input.** **Not** a validated national-security go/no-go decision authority.

## Cite

> Vijay Jyotish. *JYOTINT Sealed-Forecast Record.* Zenodo. https://doi.org/10.5281/zenodo.20630257 (CC-BY-4.0)

## License

Corpus and record: **CC-BY-4.0** (see `LICENSE`). The verifier script may be reused freely.

---

*JYOTINT™ is a trademark of Vijay Jyotish LLC (U.S. trademark application pending, USPTO).*
