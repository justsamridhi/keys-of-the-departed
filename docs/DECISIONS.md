# Keys of the Departed — Architectural Decision Records (ADR)

## DECISION 001: Health Check Contract Alignment

- **Date:** 2026-10-29
- **Status:** APPROVED
- **Context:** `docs/SPEC.md` Section 5.7 listed `GET /healthz (reports db, model, scores loaded)` and Stage 6 (A-4) stated `healthz is false when db, model or scores are unavailable`. In a deployment with zero external credentials configured (demo mode), a rigid boolean false would break startup or Render cold-start checks.
- **Decision:** Each dependency check (`db`, `model`, `scores`) returns one of three discrete status strings: `"ok"`, `"not_configured"`, or `"unavailable"`.
- **Rule:** HTTP 200 is returned when all configured dependencies are `"ok"` and unconfigured optional dependencies are explicitly reported as `"not_configured"`. HTTP 503 is returned if and only if an enabled/configured dependency is `"unavailable"`.

## DECISION 002: Pinning of Contract Enums

- **Date:** 2026-10-29
- **Status:** APPROVED
- **Context:** Need consistent domain representation across JSON Schemas, Zod, TypeScript types, MongoDB records, and tests without casing ambiguities.
- **Decision:**
  - `owner_status`: `"verified"`, `"supported"`, `"conflicting"`, `"no_evidence"`. (UI components may capitalize for display).
  - `ghost_type`: `"LOST"`, `"FORGOTTEN"`, `"LONELY"`, `"INNOCENT"`, `"NOT_GHOST"`.
  - Account `kind`: `"deploy_key"`, `"service_account"`, `"bot"`.
  - Evidence `type`: `"commit"`, `"ticket"`, `"deploy_log"`, `"policy"`.
  - Claim `kind`: `"owner"`, `"purpose"`.
  - Removed claim `reason_code`: `"R1"`, `"R2"`, `"R3"`, `"R4"`, `"R5"`.

## DECISION 003: TabPFN Runtime Isolation

- **Date:** 2026-10-29
- **Status:** APPROVED
- **Context:** TabPFN operates as an offline Python tool generating `scores.csv`.
- **Decision:** `TABPFN_TOKEN` is strictly excluded from server runtime requirements. The Node.js server reads only precomputed score files.

## DECISION 004: Deferral of DevRelay Live Verification

- **Date:** 2026-10-29
- **Status:** APPROVED
- **Context:** Task 0+1 focuses on core contract, repository, and walking skeleton integrity.
- **Decision:** DevRelay CLI execution, authentication, and live session upload are deferred to Task 10 (submission workflow). No `@devrelay/*` runtime packages are added to the application server.

## DECISION 005: ESLint 9 Flat Config Migration & Unified Check Command

- **Date:** 2026-10-29
- **Status:** APPROVED
- **Context:** ESLint v9 defaults to flat config format (`eslint.config.js`). Running legacy `.eslintrc.json` required setting `ESLINT_USE_FLAT_CONFIG=false` in the shell, which creates environment-dependent developer friction.
- **Decision:** Provided native `eslint.config.js` and updated the `npm run lint` script to `eslint .`. Bound the full verification pipeline (`format:check`, `lint`, `typecheck`, `test`, `build`) to `npm run check`.
