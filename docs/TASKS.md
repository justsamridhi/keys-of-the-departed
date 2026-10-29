# Keys of the Departed — Implementation Task Cards

**Rule:** Complete one task at a time. A task is done only when its required tests pass. Do not begin a later task while its dependencies are failing.

## TASK 0 — Repository and CI Foundation

**Goal:** Establish reproducible project tooling, secret protection, and CI.

**Files allowed:**

- `.gitignore`
- `.env.example`
- `package.json`
- lockfiles
- `tsconfig.json`
- lint and test configuration
- `.github/workflows/`
- `render.yaml`
- `server/` and `client/` configuration files only

**Required checks:**

- Missing required environment variables produce clear startup errors.
- Lint, TypeScript checks, and unit tests run in CI.
- Secret scanning reports no exposed credentials.
- Entire creates a checkpoint after the first commit.

**Out of scope:**

- Application features.
- Database schemas and data generation.
- AI integration.
- Authentication flows.
- README content.

## TASK 1 — Contracts and Validation

**Goal:** Implement the canonical schemas for accounts, people, evidence records, claims, removed claims, cases, and API payloads.

**Files allowed:**

- `contracts/`
- `server/src/schemas/`
- `tests/contracts/`

**Required checks:**

- Valid fixtures pass schema validation.
- Invalid account kinds, record types, missing fields, and invalid claim structures fail.
- TypeScript and runtime validation agree.
- All contract tests pass.

**Out of scope:**

- Database connections.
- Model calls.
- Frontend components.
- Revocation actions.

## TASK 2 — Synthetic Dataset Generator

**Goal:** Generate deterministic synthetic accounts, directory entries, evidence records, and a separate gold dataset.

**Files allowed:**

- `python-tools/`
- `data/fixtures/`
- `data/generated/`
- `tests/python/`

**Required checks:**

- Same seed produces byte-identical output.
- Dataset counts match the specification.
- At least three prompt-injection records exist.
- Every gold owner exists in the directory.
- Runtime bundles contain no gold labels.
- All records validate against canonical contracts.
- The frozen test split hash is reproducible.

**Out of scope:**

- Atlas writes.
- AI calls.
- Live GitHub resources.
- Frontend implementation.

## TASK 3 — Deterministic Verifier

**Goal:** Verify evidence claims and compute owner status and ghost type using pure application code.

**Files allowed:**

- `server/src/verifier/`
- `server/src/classification/`
- `tests/verifier/`
- `tests/classification/`

**Required checks:**

- All V-1 through V-14 checks in `docs/SPEC.md` pass.
- Rejected claims contain the correct reason codes.
- Injected text cannot independently establish verified ownership.
- Employment status comes only from the directory.
- Ghost-type precedence is deterministic.

**Out of scope:**

- LLM calls.
- Database persistence.
- Frontend.
- Revocation.

## TASK 4 — Gemma Investigation and Evaluation

**Goal:** Retrieve evidence, request structured claims from Gemma, validate output, and evaluate the investigation results.

**Files allowed:**

- `server/src/investigation/`
- `server/src/model/`
- `python-tools/evaluation/`
- `tests/investigation/`
- `tests/evaluation/`

**Required checks:**

- Output parses or the model abstains.
- Schema failure retries once, then abstains.
- Timeouts produce a model-unavailable state.
- Empty evidence causes abstention.
- Prompt-injection cases cannot upgrade verification status.
- Development-split evaluation produces the specified three-way comparison.

**Out of scope:**

- Production deployment.
- Live revocation.
- UI redesign.
- Training or fine-tuning a model.

## TASK 5 — Offline TabPFN Ranking

**Goal:** Generate reproducible anomaly scores from behaviour-only features and compare them against baselines.

**Files allowed:**

- `python-tools/ranking/`
- `data/generated/`
- `tests/ranking/`

**Required checks:**

- Feature list contains no owner identities or gold labels.
- Ranking is reproducible for a fixed seed.
- Offline execution works after weights are cached.
- AUROC and precision@10 are computed against both baselines.
- Manifest records the version, weights file, and seed.
- Licence and distribution restrictions are documented.

**Out of scope:**

- Loading TabPFN weights in the web runtime.
- Model training on gold labels.
- Frontend implementation.

## TASK 6 — MongoDB Atlas Persistence

**Goal:** Persist bundles, accounts, records, people, cases, decisions, and verified memory with bundle isolation.

**Files allowed:**

- `server/src/db/`
- `server/src/repositories/`
- `tests/database/`

**Required checks:**

- Ingestion is idempotent.
- Duplicate record IDs are rejected.
- Malformed documents fail validation.
- Retrieval never crosses bundle boundaries.
- Memory only contains human-verified facts.
- Connection failures return safe, readable errors.
- Demo uploads expire.

**Out of scope:**

- Production data.
- Unrestricted database access.
- Automatic revocation.
- Gold-label persistence.

## TASK 7 — API

**Goal:** Implement the endpoints documented in `docs/SPEC.md`.

**Files allowed:**

- `server/src/routes/`
- `server/src/middleware/`
- `server/src/app.ts`
- `server/src/index.ts`
- `tests/api/`

**Required checks:**

- Endpoint status codes and response schemas are tested.
- Invalid or oversized uploads return safe errors.
- Rate limiting works.
- `/healthz` reports database, model, and score availability.
- Unauthenticated revocation returns 401.
- Raw, unvalidated model output never reaches the client.

**Out of scope:**

- UI components.
- Unapproved destructive actions.
- Production secrets in source code.

## TASK 8 — Frontend and Accessibility

**Goal:** Build the book-inspired investigation UI, evidence viewer, removed-claims view, approval modal, and evaluation results.

**Files allowed:**

- `client/`
- `tests/e2e/`

**Required checks:**

- All frontend acceptance checks F-1 through F-10 pass.
- Loading, empty, error, and partial states exist.
- Evidence quotes link to their source records.
- Keyboard navigation and reduced motion work.
- The 390 px layout has no horizontal overflow.
- Critical accessibility violations are absent.
- Playwright golden path passes.

**Out of scope:**

- Verifier logic in the browser.
- Client-side secrets.
- Direct GitHub revocation from the browser.

## TASK 9 — Auth0 Approval and GitHub Sandbox

**Goal:** Authenticate reviewers and implement explicit, auditable approval for sandbox deploy-key revocation.

**Files allowed:**

- `server/src/auth/`
- `server/src/approval/`
- `server/src/integrations/github/`
- `tests/approval/`
- `tests/integrations/`

**Required checks:**

- Auth0 login works.
- Revocation cannot proceed without approval.
- Approval, denial, and timeout behaviours are tested.
- The decision log records the reviewer ID.
- The GitHub credential is restricted to the sandbox repository.
- Repeated requests are idempotent.
- Any fallback is explicitly labelled and does not claim CIBA or Token Vault guarantees.

**Out of scope:**

- Production repositories.
- Broad personal GitHub tokens.
- Automatic revocation without human approval.

## TASK 10 — Deployment and Submission

**Goal:** Deploy from a clean clone and prepare reproducible evaluation evidence.

**Files allowed:**

- `render.yaml`
- deployment scripts
- smoke-test scripts
- `docs/`
- submission assets

**Required checks:**

- Render deployment succeeds from a clean clone.
- Live `/healthz` and smoke tests pass.
- Cold-start messaging works.
- Demo mode is visibly labelled.
- Reported evaluation numbers match saved result files.
- Demo video is under 90 seconds.
- Required submission tags, links, prize details, and Entire evidence are checked.

**Out of scope:**

- Unsupported performance claims.
- Fabricated evaluation results.
- Unverified integrations.
- Production destructive actions.

## Global acceptance rules

1. Never commit `.env` files, tokens, passwords, private keys, or model credentials.
2. Do not weaken verifier rules to make model results appear better.
3. Do not use gold labels in runtime inference.
4. Do not claim a feature works until it has been tested.
5. Do not change files outside a task's allowed scope without approval.
6. Run the relevant tests after each task and report exact results.
7. Keep the README empty until the application has been built and verified.
