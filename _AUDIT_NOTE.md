# Audit Apply Note — AIAutomatepharmaceutical

Source: `_AUDIT/reports/batch_00.md` § 31.

## Original audit recommendations

### Missing AI counterparts
- AI document classification (IND vs. NDA vs. BLA)
- AI adverse event detection
- AI manufacturing deviation flagging

### Missing non-AI features
- Document version control
- Collaboration / commenting
- E-signature workflow
- Regulatory submission prep (CTD format)

### Custom features
- NLP regulatory compliance (FDA guidance flagging)
- Manufacturing deviation detection (batch records)
- Clinical trial data extraction (OCR tables)
- CTD auto-generation
- Regulatory integrations: FDA eSTAR, EMA gateway

## Implemented in this pass (MECHANICAL)

| # | Item | File | Endpoint |
|---|------|------|----------|
| 1 | AI document classification | `backend/src/routes/ai.js` | `POST /api/ai/classify-document/:id` |
| 2 | AI adverse event detection | `backend/src/routes/ai.js` | `POST /api/ai/adverse-event-detect` |
| 3 | AI manufacturing deviation flagging | `backend/src/routes/ai.js` | `POST /api/ai/manufacturing-deviation` |

All three follow the existing `callOpenRouter` / `parseAIJson` / `persistAiResult` / `logUsage` pattern. `node --check` passes.

## Backlog (not implemented)

| Item | Tag | Why deferred |
|------|-----|---------------|
| Document version control | TOO-RISKY | Schema changes, file storage strategy |
| Collaboration / commenting | TOO-RISKY | New entity model + UI |
| E-signature workflow | NEEDS-CREDS | DocuSign / Adobe Sign integration |
| CTD auto-generation | NEEDS-PRODUCT-DECISION | Format/template strategy required |
| FDA eSTAR / EMA gateway integration | NEEDS-CREDS | Regulatory gateway access |
| OCR for trial-report tables | TOO-RISKY | New OCR dependency |

## Apply pass 3 (frontend)

- **FE stack:** CRA React 18 + axios.
- **Action:** LEFT-AS-IS — frontend already wired.
- The three pass-2 endpoints (`/api/ai/classify-document/:id`, `/api/ai/adverse-event-detect`, `/api/ai/manufacturing-deviation`) are exposed in `frontend/src/services/api.js` (`ai.classifyDocument`, `ai.adverseEventDetect`, `ai.manufacturingDeviation`).
- UI lives in `frontend/src/pages/AIToolsExtra.js`, route `/ai-tools/extra` registered in `App.js`, link in `components/Navbar.js` ("Classify / AE / GMP").
- JWT Bearer attached via the axios interceptor in `services/api.js`. 503-no-key handling already present.
- No files modified in this pass.

## Apply pass 4 (mechanical backlog)

**Action:** SKIPPED — no MECHANICAL items remain on the backlog.

All remaining backlog items are tagged TOO-RISKY (Document version control, Collaboration/commenting, OCR for trial-report tables), NEEDS-CREDS (E-signature DocuSign/AdobeSign, FDA eSTAR / EMA gateway), or NEEDS-PRODUCT-DECISION (CTD auto-generation format/template strategy). Per the apply-pass-4 rules these are out of scope.

The three pass-2 endpoints (`/classify-document/:id`, `/adverse-event-detect`, `/manufacturing-deviation`) and their pass-3 frontend wiring (`pages/AIToolsExtra.js`, route `/ai-tools/extra`, navbar link "Classify / AE / GMP") remain in place — re-confirmed during this pass.
