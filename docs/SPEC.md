# Keys of the Departed — Technical Specification

**Project:** Keys of the Departed  
**Tagline:** The engineer left. Their access didn't.  
**Source of truth:** Build Spec, October 29, 2026  
**Status:** Pre-implementation  
**Rule:** Contracts first, tests second, implementation third.

## 1. Architecture

### 1.1 Technology stack

- **Frontend:** React, Vite, TypeScript.
- **Backend:** Node.js 22, TypeScript, Express.
- **Validation:** Zod schemas, including structured model-output validation.
- **Database:** MongoDB Atlas for accounts, evidence records, cases, decisions, and verified memory.
- **AI:** Gemma through local Ollama for privacy-focused operation; a hosted Gemma endpoint for the explicitly labelled public demo.
- **Ranking:** Offline Python job using TabPFN, with precomputed scores loaded by the runtime.
- **Authentication and approval:** Auth0 login, CIBA approval and Token Vault if available and verified.
- **GitHub integration:** GitHub API restricted to a dedicated sandbox repository.
- **Testing:** Vitest, Testing Library, Playwright, Python tests, and secret scanning.
- **Deployment:** One Render web service serving the API and compiled frontend.

### 1.2 Processing pipeline

The application must use an explicit, testable state machine:

1. **Ingest:** Validate an uploaded or selected audit bundle.
2. **Rank:** Load precomputed ghost-likelihood scores.
3. **Retrieve:** Find relevant evidence records within the current bundle.
4. **Investigate:** Ask Gemma to produce structured claims supported by record IDs and exact quotes.
5. **Verify:** Validate every claim using deterministic application code.
6. **Classify:** Compute the account's ghost type from verified evidence and account metadata.
7. **Persist:** Store the case, accepted and removed claims, model metadata, and relevant decisions.

The user-facing investigation experience is central. The model should construct a coherent case narrative from evidence, competing explanations, and gaps in the records. It must not simply return a pass/fail result.

### 1.3 Trust boundaries

- All audit records are untrusted input, including text containing prompt-injection instructions.
- Model output is untrusted until it passes schema validation and the deterministic verifier.
- Model-generated employment status, evidence validity, and ghost classification must never override application rules.
- Only an authenticated, approved revocation path may change a sandbox resource.
- Gold labels must never enter the runtime evidence bundle or database.
- Demo mode must be visibly labelled and must use synthetic data.

### 1.4 Failure behaviour

- Model timeout: show a model-unavailable state; never fabricate an answer.
- Database outage: show a useful error and allow an explicitly labelled cached demo case where available.
- Approval denied or expired: make no change.
- Cold start: display a clear waking/loading message until the actual result is available.

## 2. Data contracts

Canonical schemas belong in `contracts/`. Runtime validation must use the same definitions as tests and data generation. The initial contracts should be JSON Schema files, with Zod validation integrated into the TypeScript application.

### 2.1 Account

Fields:

- `account_id`: string, unique within a bundle.
- `kind`: `deploy_key`, `service_account`, or `bot`.
- `created_at`: timestamp.
- `last_used_at`: timestamp or `null`.
- `permissions`: string array.
- `tags`: string array.
- `expires_at`: timestamp or `null`.

### 2.2 Person directory entry

Fields:

- `person_id`: string.
- `display_name`: string.
- `handles`: string array.
- `status`: `active` or `departed`.
- `departed_at`: timestamp or `null`.

The directory is the authoritative source for employment status.

### 2.3 Evidence record

Fields:

- `record_id`: string, unique within a bundle.
- `type`: `commit`, `ticket`, `deploy_log`, or `policy`.
- `ts`: timestamp.
- `author_handle`: string or `null`.
- `assignee_handle`: string or `null`.
- `actor_account_id`: string or `null`.
- `content`: string.
- `structured`: boolean.

### 2.4 Investigation claim

Fields:

- `kind`: `owner` or `purpose`.
- `account_id`: string.
- `person_id`: string or `null`.
- `record_id`: string.
- `quote`: exact supporting text from the record.
- `text`: concise claim or explanation.

### 2.5 Removed claim

A removed claim contains the original claim and a reason code:

- `R1`: referenced evidence record does not exist in the current bundle.
- `R2`: quote does not match the record after normalization.
- `R3`: owner references an unknown directory person.
- `R4`: claim fails schema validation.
- `R5`: quote is too short or otherwise fails the minimum quote requirement.

The implementation must use these codes consistently. Removed claims remain visible for review rather than silently disappearing.

## 3. Synthetic data generation

Implement a deterministic Python generator that constructs the underlying truth first and then produces messy evidence records that express that truth in varied ways.

### 3.1 Dataset composition

Generate 40 synthetic accounts:

| Category                                                          |  Count |
| ----------------------------------------------------------------- | -----: |
| LOST                                                              |      8 |
| FORGOTTEN                                                         |      8 |
| LONELY                                                            |      6 |
| INNOCENT                                                          |      6 |
| Legitimate bots without HR records                                |      6 |
| Difficult cases: nicknames, conflicting tickets, prompt injection |      6 |
| **Total**                                                         | **40** |

Include at least three evidence records containing adversarial instructions.

### 3.2 Dataset split

- Development split: 20 accounts.
- Frozen test split: 20 accounts.
- Use a deterministic seed.
- Record the test split hash and ensure subsequent generation reproduces it.
- Keep the gold file containing true owner, purpose, ghost flag, and class outside the runtime bundle.
- Never expose gold labels to the model or runtime database.

### 3.3 Sandbox case

Create one real mini-case using a deploy key in a separate, disposable GitHub repository owned by the developer. Associate the case with a fictional departed person. No production repository or unrelated GitHub resource may be modified.

## 4. MongoDB persistence

Use bundle-scoped documents so that evidence from one upload cannot leak into another investigation.

### 4.1 Collections

- `bundles`: bundle ID, name, creation time, expiry/TTL metadata.
- `accounts`: bundle ID, account ID, account fields, TabPFN score and rank.
- `records`: bundle ID, record ID, type, timestamp, content, embedding and structured flag.
- `people`: bundle ID, person ID and directory fields.
- `cases`: bundle ID, account ID, run ID, accepted and removed claims, owner status, purpose status, ghost type, model and latency.
- `decisions`: case ID, reviewer ID, action, timestamp and authorization ID.
- `memory`: bundle ID, account ID, verified fact, source record ID, verifying reviewer and timestamp.

### 4.2 Indexes and retrieval

Create appropriate indexes for:

- Unique `(bundle_id, record_id)` evidence records.
- `(bundle_id, type)` record filtering.
- `(bundle_id, account_id)` account and case lookups.
- Vector retrieval over record embeddings, filtered by `bundle_id`, if Atlas Vector Search is enabled.

An open embedding model such as `all-MiniLM-L6-v2` may be used after verifying its actual embedding dimension. The intended record embedding dimension is 384.

Atlas Vector Search is a later-stage enhancement if setup or time prevents its use in the MVP.

### 4.3 Persistence rules

- Ingestion must be idempotent.
- Duplicate record IDs within a bundle must be rejected.
- Malformed documents must fail validation.
- Retrieval must never return records from a different bundle.
- Memory may contain only human-verified facts.
- Demo uploads must expire.
- Database errors must be reported without leaking credentials, stack traces, or local filesystem paths.

## 5. Backend rules

### 5.1 Deterministic verifier

Implement the verifier as pure application code without model calls. Unit-test it independently.

The normalization function must:

1. Apply Unicode NFKC normalization.
2. Convert text to lowercase.
3. Remove zero-width characters.
4. Normalize quotation marks and dashes.
5. Collapse repeated whitespace.

For every claim, perform these checks in order:

1. Validate the claim schema. Failure: `R4`.
2. Confirm the referenced record exists in the current bundle. Failure: `R1`.
3. Confirm that the normalized quote occurs within the normalized record content and contains at least 12 characters. Failure: `R2` for a mismatch or `R5` for a quote below the minimum length.
4. For owner claims, confirm the referenced person exists in the directory. Failure: `R3`.

A failed claim must not be used to establish verified ownership.

### 5.2 Owner verification status

Use these statuses:

- **Verified:** a structured evidence field maps to a directory handle for the person, or two distinct free-text records independently support the same owner.
- **Supported:** exactly one accepted free-text record supports the owner.
- **Conflicting:** accepted claims support different people.
- **No evidence:** no owner claim survives verification.

`No evidence` is a valid investigation result, not an error.

Employment status comes exclusively from the directory. A single injected sentence must never be sufficient to establish Verified ownership.

Apply the owner status rules separately from purpose verification.

### 5.3 Ghost classification

Compute the classification in code, in the following precedence order:

1. **LOST:** owner status is Verified or Supported, and the directory marks the owner as departed.
2. **FORGOTTEN:** owner status is No evidence or Conflicting.
3. **LONELY:** owner is active, the account has been unused for at least 90 days, and it has a privileged permission.
4. **INNOCENT:** account was created within the last 30 days, its name or tags indicate a temporary account, it is privileged, and it has no expiry.
5. Otherwise: not classified as a ghost.

Use the authoritative timestamps and directory data. Never accept a model-generated ghost type without computing it independently.

### 5.4 Gemma investigation contract

Make one model call per account. Provide account fields and up to eight retrieved records, clearly delimited and labelled as untrusted evidence.

Expected output:

- `claims`: array of claims matching the shared contract.
- `abstain`: boolean.

Use temperature zero. Validate output against Zod and the corresponding JSON Schema. If validation fails, retry once; if it still fails, abstain.

Store the model name and latency with the case. Empty evidence must result in abstention, not fabricated claims.

### 5.5 Offline TabPFN ranking

Run TabPFN as an offline Python job. The runtime must load the resulting precomputed scores rather than loading TabPFN weights.

Use behaviour-only features, including:

- Days since last use.
- Regularity of inactivity gaps.
- Number of distinct hosts.
- Permission count.
- Administrative-privilege indicator.
- Key age.
- Commits associated with any handle in the last 90 days.

Do not include owner identities, gold labels, or target class information in the feature set.

Produce `scores.csv` and a manifest recording the TabPFN version, weights file and random seed. Verify the official licence and permitted usage before distributing weights or reporting public results.

### 5.6 Human approval and revocation

The intended high-assurance flow is:

1. A reviewer proposes revocation for a specific account.
2. Build an authorization request containing the account identity, supporting evidence quotes, and the exact intended action.
3. Request CIBA approval.
4. On explicit approval, obtain a GitHub token restricted to the sandbox repository through Token Vault.
5. Call the GitHub API endpoint that deletes the selected deploy key.
6. Record the decision and authorization reference.

On denial, timeout, missing approval, or token failure, make no changes.

**Fallback:** if CIBA or Token Vault is unavailable on the tenant, implement a clearly labelled in-app step-up consent flow behind Auth0 login. Document that this fallback is weaker and do not claim that it provides CIBA or Token Vault guarantees.

The GitHub token must not authorize actions against any repository other than the dedicated sandbox.

### 5.7 API endpoints

| Method | Endpoint                     | Purpose                                        |
| ------ | ---------------------------- | ---------------------------------------------- |
| POST   | `/api/bundles`               | Validate and ingest a bundle                   |
| GET    | `/api/bundles/:id/ghosts`    | List classified accounts                       |
| GET    | `/api/cases/:id`             | Retrieve an investigation case                 |
| GET    | `/api/records/:id`           | Retrieve a source evidence record              |
| POST   | `/api/cases/:id/revocations` | Request an approved revocation; login required |
| GET    | `/api/revocations/:id`       | Retrieve revocation status                     |
| GET    | `/api/eval/latest`           | Return the latest evaluation results           |
| GET    | `/healthz`                   | Report database, model and score availability  |

The demo bundle may be read without login. Any revocation request requires authentication and explicit authorization. Return documented status codes and validated response bodies.

## 6. Frontend requirements

### 6.1 Stack

- React, Vite and TypeScript.
- Vitest and Testing Library.
- Playwright for end-to-end tests.
- Accessibility checks using axe.

### 6.2 Screens

1. **Book landing:** an interactive book-like introduction to the investigation.
2. **Intake:** upload or select the synthetic audit bundle.
3. **Ghost chapters:** LOST, FORGOTTEN, LONELY and INNOCENT, with counts.
4. **Tombstone case card:** ownership status, purpose status, classification and concise narrative.
5. **Evidence viewer:** show the source record and highlight the exact supporting quote.
6. **Removed claims:** show rejected claims and their reason codes.
7. **Approval modal:** display the proposed action and evidence before human approval.
8. **Results page:** show the evaluation table and comparisons.

The design should make evidence and uncertainty visible. The investigation narrative must be central; the interface must not reduce the product to a generic pass/fail tool.

### 6.3 Interaction, accessibility and responsiveness

- Every screen must have loading, empty, error and partial-result states.
- Statuses must use readable text and icons; colour must never be the only indicator.
- The book must support mouse and keyboard activation, including Enter, and provide a skip path.
- Respect reduced-motion preferences.
- Clicking a claim must highlight the exact quote in its source record.
- No claim may be displayed without a link to its source.
- Removed claims must show their reason codes.
- Prevent duplicate approval submissions.
- At 390 px viewport width, the layout must not scroll horizontally.
- Axe must report no critical accessibility violations.

## 7. Test plan and stage gates

**Rule:** a stage is complete only when its tests pass in CI and its acceptance gate is satisfied.

### Stage 0 — Setup

- `S0-1`: Entire creates a checkpoint after the first commit.
- `S0-2`: Missing environment variables stop startup with a clear message.
- `S0-3`: CI runs linting, type checking and unit tests.
- `S0-4`: Secret scanning finds no exposed credentials.

### Stage 1 — Generator and gold data

- `G-1`: Identical seeds produce byte-identical output.
- `G-2`: Every gold owner exists in the directory.
- `G-3`: Category counts equal 8/8/6/6/6/6.
- `G-4`: Gold data is absent from runtime bundles.
- `G-5`: At least three prompt-injection records exist.
- `G-6`: All generated records validate against their schemas.
- `G-7`: The frozen test split hash matches the recorded value.

### Stage 2 — Verifier

- `V-1`: Equivalent quotes with changed whitespace, case or quote marks pass.
- `V-2`: A one-character quote mutation fails with `R2`.
- `V-3`: A nonexistent record fails with `R1`.
- `V-4`: A quote shorter than 12 characters fails with `R5`.
- `V-5`: An unknown person fails with `R3`.
- `V-6`: Structured owner evidence yields Verified.
- `V-7`: Two agreeing free-text records yield Verified.
- `V-8`: One free-text record yields Supported.
- `V-9`: Different accepted owners yield Conflicting.
- `V-10`: No accepted owner claims yield No evidence.
- `V-11`: An injected sentence alone cannot yield Verified.
- `V-12`: Employment status ignores model-provided values.
- `V-13`: Fuzzing 1,000 random strings produces no crash.
- `V-14`: Ten table-driven cases validate ghost-type precedence.

### Stage 3 — Gemma extraction

- `M-1`: Output parses against the schema or the model abstains.
- `M-2`: Schema failure triggers one retry, then abstention.
- `M-3`: Timeout displays the model-unavailable state.
- `M-4`: Repeated identical input at temperature zero produces consistent claims.
- `M-5`: Empty evidence causes abstention.
- `M-6`: Injection cases cannot upgrade verification status.
- `M-7`: The evaluation harness generates the three-way comparison table on the development split.

### Stage 4 — TabPFN

- `T-1`: Inference works without a network connection after weights are cached.
- `T-2`: The feature list excludes ownership and target labels.
- `T-3`: A fixed seed gives a reproducible ranking.
- `T-4`: AUROC and precision@10 are computed against the inactivity-rule and Isolation Forest baselines.
- `T-5`: The manifest records the version and weights file.

### Stage 5 — MongoDB Atlas

- `D-1`: Ingestion is idempotent.
- `D-2`: Duplicate record IDs are rejected.
- `D-3`: Malformed documents fail validation.
- `D-4`: Measure retrieval recall@8 on gold queries, targeting 0.9.
- `D-5`: Queries cannot return records from another bundle.
- `D-6`: Memory is written only from human decisions.
- `D-7`: Connection failures return a readable error.
- `D-8`: Demo uploads expire.

### Stage 6 — API

- `A-1`: Each endpoint has documented response schemas and status codes.
- `A-2`: Oversized, wrong-type and invalid-schema uploads return safe errors without local paths or stack traces.
- `A-3`: Rate limiting works.
- `A-4`: `/healthz` reports unhealthy when the database, model or scores are unavailable.
- `A-5`: Revocation without a valid token returns 401.
- `A-6`: Raw, unvalidated model output never reaches the client.

### Stage 7 — Frontend

- `F-1`: Book opens with click or Enter; skip works; reduced motion is respected.
- `F-2`: All screens have loading, empty and error states.
- `F-3`: Chapter counts match API counts.
- `F-4`: Statuses remain readable without colour.
- `F-5`: Selecting a claim highlights its exact source quote.
- `F-6`: Removed claims display reason codes.
- `F-7`: Approval cannot be submitted twice.
- `F-8`: The 390 px layout has no horizontal overflow.
- `F-9`: Axe finds no critical accessibility violations.
- `F-10`: The Playwright golden path passes.

### Stage 8 — Auth0 approval

- `U-1`: Login works.
- `U-2`: Revocation without approval fails.
- `U-3`: Approval revokes the sandbox key.
- `U-4`: Denial leaves the key unchanged.
- `U-5`: Timeout leaves the key unchanged.
- `U-6`: The decision log records the reviewer ID.
- `U-7`: The GitHub token cannot access other repositories.
- `U-8`: Repeated approval requests are idempotent.

If CIBA or Token Vault is unavailable, tests must validate the explicitly documented fallback without claiming that the original features are present.

### Stage 9 — Render

- `R-1`: Deployment succeeds from a clean clone using the deployment blueprint.
- `R-2`: Cold start displays a waking message and then the real result.
- `R-3`: `/healthz` is healthy after deployment.
- `R-4`: The smoke-test script passes against the live URL.
- `R-5`: The public demo-mode banner is visible.

### Stage 10 — Submission

- `W-1`: A script verifies that every reported number matches the results files.
- `W-2`: The demo video is under 90 seconds.
- `W-3`: Submission checklist covers required tags, prize-category details, links and Entire session evidence.

## 8. Implementation rules

1. Build shared contracts before generator, verifier or UI implementation.
2. Write tests before implementing critical verification logic.
3. Keep model reasoning separate from deterministic verification and classification.
4. Keep the gold dataset outside the runtime bundle.
5. Never claim real-world accuracy or breach prevention from synthetic data.
6. Do not revoke any resource without explicit human approval.
7. Limit live destructive actions to the dedicated GitHub sandbox.
8. Verify optional service features, model licences, embedding dimensions and provider availability before depending on them.
9. Use clear fallbacks instead of pretending an unavailable integration works.
10. Do not mark a stage complete until its tests and acceptance gate pass.
