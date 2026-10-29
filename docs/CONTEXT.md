# Keys of the Departed — Agent Context Brief

**Drafted:** October 29, 2026  
**Status:** Authoritative project context. Do not silently modify.

---

## Mode instruction

READ, INSPECT, DOCUMENT, REPORT. Do not implement application features.

You are joining an existing Hacktoberfest 2026 project with a hard deadline of
**November 1, 2026, at 12:29 PM IST**.

Work from three perspectives:

1. Senior full-stack engineer — architecture, contracts, integration boundaries
   and testability.
2. Senior product designer — user workflow, visual identity, accessibility and
   demo quality.
3. Security-minded reviewer — evidence integrity, secret handling, prompt
   injection, approval boundaries and honest evaluation.

---

## 1. Project identity and purpose

**Project:** Keys of the Departed  
**Tagline:** The engineer left. Their access didn't.

The application investigates forgotten machine identities, including deployment
keys, service accounts and bots. It ranks suspicious accounts, retrieves
relevant engineering records, asks Gemma to propose ownership and purpose with
exact quotations, verifies evidence in deterministic code, abstains when
evidence is insufficient, and permits sensitive sandbox actions only after
human approval.

The product is an investigation narrative, not a generic rule-based security
scanner. Do not recreate APK-Xray's heavy rules layer.

The Dia de los Muertos altar calendar provides the visual structure: chapters,
tombstones, candles and an altar. A ghost represents a lingering machine
identity, never a deceased person. Keep the tone respectful and factual.

---

## 2. Hacktoberfest and DEV challenge requirements

For every requirement, distinguish:

- Verified from official source material.
- Verified from repository contents or a successful test.
- A project decision recorded in the context/specification.
- A proposed implementation.
- An unresolved assumption.

Do not invent Challenge 4 rules, partner integrations, eligibility, judging
criteria, submission requirements or prize guarantees.

If the official Challenge 4 instructions are not available, mark those
requirements **UNVERIFIED — SOURCE REQUIRED**. Continue the repository audit
without pretending that the project brief proves the challenge requirements.

---

## 3. DevRelay and agent-session history

The relevant DevRelay session export or transcript will be provided separately.

When it becomes available:

- Read the supplied session material.
- Extract decisions, completed work, commands, test results, agent prompts,
  partner integrations and unresolved issues.
- Separate actual execution results from plans and recommendations.
- Identify contradictions between the session and the current repository.
- Do not expose tokens, API keys, passwords or other secrets.
- Never claim that a session was saved, attached, restored or inspected unless
  the available evidence confirms it.

---

## 4. Locked project decisions

Preserve these decisions unless explicitly approved for change:

- Verification is minimal: exact-quote checks, owner statuses **Verified**,
  **Supported**, **Conflicting** and **No evidence**, plus reason codes R1–R5.
- No scores, severities, confidence values, unnecessary rule IDs or claim
  ledgers in the verification contract.
- Gemma reads retrieved records and proposes claims with record IDs and exact
  quotes; it must abstain when records are silent.
- TabPFN runs offline. The application reads its precomputed scores.
- English only.
- Gold labels never enter runtime contracts, runtime database records or served
  fixtures.
- The pipeline is an explicit state machine, not a free-roaming agent loop.
- Only an approved Auth0 path may change anything outside the application, and
  only in a dedicated sandbox repository.
- No production revocation, real HR/AD/Okta/AWS integrations, automatic
  revocation, multi-tenancy or unsupported claims of real-world accuracy.
- Never claim an integration is working without evidence that it was tested.

Read the exact schema names, fields and enums from `docs/SPEC.md`; do not
invent replacements.

---

## 5. Prize-category architecture

### Gemma

- Local Ollama model and a hosted endpoint for the public demo.
- Structured claims with exact quotations, abstention, model name and latency.
- Evaluation comparing baselines, Gemma and Gemma plus verifier.

### Render

- One web service serves the API, pipeline and built frontend.
- A `render.yaml` blueprint, truthful `/healthz`, demo banner and cold-start
  handling.
- Deploy only after CI passes.

### TabPFN

- Offline Python workflow using behavior-only features.
- Precomputed scores and manifest, compared against inactivity and Isolation
  Forest baselines.
- Verify the official licence before deciding what weights or inference
  artifacts can be distributed or hosted.

### MongoDB Atlas

- Bundle-scoped collections for accounts, records, people, cases, decisions
  and memory.
- Retrieval and human-verified memory with appropriate tests and evidence
  provenance.

### Auth0 for AI Agents

- Human approval for sensitive actions.
- Token Vault supplies a sandbox-scoped GitHub token only after approval.
- A static `GITHUB_TOKEN` is reserved for the setup script, never the revoke
  path.
- CIBA availability and the fallback approval flow remain unresolved until
  verified.

### Entire

- Preserve the existing integration.
- Record non-obvious decisions in `docs/DECISIONS.md` with their rationale.
- Never paste secrets into agent chats.
- Later, verify that real agent work is captured in checkpoints.

Do not assume any of these integrations has been completed merely because the
plan describes it.

---

## 6. Repository and setup context

Previously reported setup facts:

- Repository: `https://github.com/justsamridhi/keys-of-the-departed`
- Initial commit: `a139cf7`, pushed to `origin/main`.
- Node.js 24.19.0 and Python 3.13.3 are installed locally.
- The project targets Node.js 22.
- Gitleaks 8.30.1 works through its installed executable; the bare command
  previously was not found in PowerShell.
- Ollama and `gemma3:4b` were tested successfully.
- Entire is enabled for Antigravity.

Treat these as historical context and verify only what is safe and necessary.
Do not change global runtimes or install packages during this task.

---

## 7. Design direction

The Dia de los Muertos altar calendar is the visual anchor:

- **Chapters** — one per ghost classification (LOST, FORGOTTEN, LONELY,
  INNOCENT).
- **Tombstones** — one per account under investigation.
- **Candles** — decorative section dividers.
- **Altar** — the landing / book introduction screen.

The ghost metaphor refers strictly to lingering machine identities. It must
never reference deceased persons. The tone must be respectful and factual.

Design quality expectations are high. The interface must make evidence,
uncertainty and investigation narrative visible. It must not reduce to a
generic pass/fail security tool.

---

## 8. Open questions and unresolved decisions

1. **CIBA availability** — Whether Auth0 CIBA and Token Vault are available on
   the tenant is unresolved. The fallback in-app consent flow must be clearly
   labelled and must not claim CIBA or Token Vault guarantees.
2. **Hosted Gemma endpoint** — The specific hosted Gemma provider for the
   public demo is not yet confirmed.
3. **Atlas Vector Search** — Whether Vector Search will be enabled depends on
   setup time and cost. Plain text retrieval is the fallback.
4. **TabPFN licence** — The exact distribution and hosting restrictions must be
   verified before including weights or inference artifacts in the repository
   or deployment.
5. **Embedding model dimension** — `all-MiniLM-L6-v2` produces 384-dimensional
   embeddings; this must be confirmed before creating the Atlas index.
6. **DevRelay session export** — Not yet attached. Cannot be evaluated until
   provided.
7. **DEV Challenge 4 official instructions** — Not available at time of this
   brief. All challenge requirements marked UNVERIFIED — SOURCE REQUIRED.

---

## 9. Implementation rules (from SPEC.md, reproduced for agent reference)

1. Build shared contracts before generator, verifier or UI implementation.
2. Write tests before implementing critical verification logic.
3. Keep model reasoning separate from deterministic verification and
   classification.
4. Keep the gold dataset outside the runtime bundle.
5. Never claim real-world accuracy or breach prevention from synthetic data.
6. Do not revoke any resource without explicit human approval.
7. Limit live destructive actions to the dedicated GitHub sandbox.
8. Verify optional service features, model licences, embedding dimensions and
   provider availability before depending on them.
9. Use clear fallbacks instead of pretending an unavailable integration works.
10. Do not mark a stage complete until its tests and acceptance gate pass.

---

## 10. Source document provenance

This file was created from the **Agent Context Brief** supplied directly in the
onboarding USER_REQUEST on 2026-10-29. It is the authoritative project context
document and must be preserved in full. Do not replace requirements with
generic advice or silently omit decisions.

Any future substantive decisions must be recorded in `docs/DECISIONS.md` with
their rationale and approval status.
