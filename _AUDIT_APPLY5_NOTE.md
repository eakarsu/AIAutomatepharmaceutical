# Apply Pass 5 — AIAutomatepharmaceutical

- **Date:** 2026-05-08
- **Stack:** Node.js + Express + Postgres (`backend/src/`), React (`frontend/`).
- **Audit source:** `_AUDIT/reports/batch_00.md` § 31.
- **Action:** VERIFIED-PRESENT (BE) + IMPLEMENTED-1 (FE wiring).

## Verified-present (existing pre-pass-5 work)

- Pass-2 added 3 AI counterparts: classify-document, adverse-event-detect,
  manufacturing-deviation (in `backend/src/routes/ai.js`).
- `backend/src/routes/extensions.js` (318 lines) — implements all 6 pass-5
  backlog items under `/api/ext/*`.
- All non-AI features (documents, auth, features registry) plus pass-2
  custom AI tools (BatchAnalysis, ComplianceTrends, PromptTemplates,
  AuditTrail, RegulatoryCalendar, CrossDocAnalysis, ApiExport,
  CostAnalytics) present.

## Implemented this pass

| # | Item | File | Lines |
|---|------|------|-------|
| 1 | FE page surfacing the `/api/ext/*` backlog endpoints | `frontend/src/pages/ExtensionsPage.js` (new) | 95 |

App route `/ai-tools/extensions` added in `frontend/src/App.js` (added 2 lines).

Backend pass-5 backlog (already in `extensions.js`):

| BE Endpoint | Backlog tag | Env vars |
|-------------|-------------|----------|
| `GET / POST /api/ext/document-versions/:documentId` | TOO-RISKY → additive table | — |
| `GET / POST /api/ext/document-comments/:documentId`, `POST /api/ext/document-comments/:id/resolve` | TOO-RISKY → additive table | — |
| `POST / GET /api/ext/esign/envelopes` | NEEDS-CREDS | `DOCUSIGN_API_KEY`, `DOCUSIGN_ACCOUNT_ID` |
| `POST / GET /api/ext/ctd/{generate,submissions}` | NEEDS-PRODUCT-DECISION (ICH-CTD modules 1-5) | — |
| `POST / GET /api/ext/regulatory-gateway/{submit,jobs}` | NEEDS-CREDS | `FDA_ESTAR_API_KEY`, `EMA_GATEWAY_API_KEY` |
| `POST / GET /api/ext/ocr-jobs` | TOO-RISKY → in-memory stub | — |

## 503-on-no-key

DocuSign envelopes and FDA/EMA gateway routes return 503 when their
respective env vars are missing (per existing convention in `extensions.js`).

## Files written/modified

- `frontend/src/pages/ExtensionsPage.js` (new, 95 lines)
- `frontend/src/App.js` (added 2 lines: import + Route)

## Smoke test

- `node --check backend/src/routes/extensions.js` PASS
- `node --check backend/src/server.js` PASS
- All schema additions are `CREATE TABLE IF NOT EXISTS`.

## Deferred

None — every audit-listed backlog item has a corresponding endpoint in
`extensions.js`.
