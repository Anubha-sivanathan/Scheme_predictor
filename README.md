# AI-Based Government Scheme Predictor

**State Government Sponsored Scheme Eligibility Predictor Engine Utilizing Unified Socio-Economic Data Wallets**

A full-stack application that helps citizens discover government welfare schemes they may be eligible for, using a hybrid rule-based + machine-learning approach.

> ⚠️ This app provides *eligibility estimates*, not official determinations. It always uses wording like "you appear to meet the listed eligibility criteria" rather than "you are officially eligible." The final decision always belongs to the relevant government authority.

---

## 1. Architecture

```
                    CITIZEN
                       ↓
              React + Tailwind (frontend/)
                       ↓
                Spring Boot API (backend/)
                       ↓
       ┌───────────────┼────────────────┐
       ↓               ↓                ↓
    MongoDB       Eligibility       Python AI
                  Rule Engine        Services
                 (authoritative)   (ai-services/)
                                       ↓
                         recommendation-service (XGBoost ranking)
                                 ocr-service (EasyOCR)
```

**Important design decision, per spec:** the rule engine in `backend/.../eligibility/EligibilityRuleEngine.java` is the *sole authority* on whether a citizen is eligible for a scheme. The XGBoost model in `ai-services/recommendation-service` only produces a 0-100 match/relevance score used to **rank** schemes — it can never flip a scheme from ineligible to eligible.

---

## 2. Project Structure

```
scheme-predictor/
├── backend/                    Spring Boot REST API
│   ├── src/main/java/com/schemepredictor/
│   │   ├── controller/         REST endpoints
│   │   ├── service/            Business logic
│   │   ├── eligibility/        Rule-based eligibility engine (core logic)
│   │   ├── repository/         MongoDB repositories
│   │   ├── model/               MongoDB documents
│   │   ├── dto/                 Request/response objects
│   │   ├── security/            JWT auth
│   │   ├── config/               Spring config (CORS, security, Mongo auditing)
│   │   └── exception/            Global error handling
│   ├── seed/seed_schemes.js     Sample scheme data for MongoDB
│   └── pom.xml
│
├── ai-services/
│   ├── recommendation-service/  Flask + XGBoost ranking model
│   │   ├── train_model.py       Generates & trains the model (run once)
│   │   └── app.py               Serves POST /predict
│   └── ocr-service/             Flask + EasyOCR document extraction
│       └── app.py               Serves POST /extract
│
└── frontend/                    React + Tailwind CSS
    └── src/
        ├── pages/                Login, Landing, Scheme Detail, Profile, Wallet, etc.
        ├── components/           NavBar, SchemeCard, Chatbot, loading/error/empty states
        ├── context/              Auth context (JWT session)
        └── api/                  Axios API client modules
```

---

## 3. Running It Locally

### Prerequisites
- Java 17+, Maven
- Python 3.10+
- Node.js 18+
- MongoDB running locally (or a connection string to Atlas)

### Step 1 — MongoDB
Start MongoDB, then seed sample scheme data:
```bash
mongosh scheme_predictor backend/seed/seed_schemes.js         # 10 base schemes (clears the collection first)
mongosh scheme_predictor backend/seed/seed_schemes_extra.js   # +50 schemes with official links (upserts; safe to re-run)
```

### Step 2 — Backend (Spring Boot)
```bash
cd backend
mvn spring-boot:run
```
Runs on `http://localhost:8080`. Configuration is in `src/main/resources/application.properties` — override via environment variables (`MONGODB_URI`, `JWT_SECRET`, etc.) in production.

### Step 3 — Recommendation service (XGBoost)
```bash
cd ai-services/recommendation-service
python -m venv venv && source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python train_model.py      # trains model.joblib (run once, or whenever you retrain)
python app.py               # serves on http://localhost:5001
```

### Step 4 — OCR service (EasyOCR)
```bash
cd ai-services/ocr-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py               # serves on http://localhost:5002
```
Note: EasyOCR downloads its detection/recognition models on first run (needs internet access once).

### Step 5 — Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`.

### Bringing it all together
Visit `http://localhost:5173`, register a citizen account, fill in your Profile, upload a document in Wallet, and the Landing Page will show ranked, explainable recommendations.

If the AI services aren't running, the app **still works**: the backend transparently falls back to rule-based scoring for ranking, and document uploads are stored even if OCR extraction fails — nothing blocks on the AI layer being up.

---

## 4. Key Flows

- **Eligibility check**: `EligibilityRuleEngine` compares a citizen's `Profile` against a scheme's `eligibilityCriteria`, field by field. Missing data is marked `UNKNOWN` (not guessed at) and listed under "missing information."
- **Recommendation ranking**: `RecommendationService` calls the Python service for a match score per scheme, then caps the score for any scheme the rule engine marked ineligible so ML relevance never outranks real eligibility.
- **OCR review**: uploading a document runs OCR server-side, but results land in `extractedFields` (untrusted) until the citizen reviews and confirms them via `PUT /api/wallet/{id}/verify`, at which point they move to `verifiedFields`.
- **Search**: `GET /api/schemes/search?q=...` does substring matching first, then falls back to keyword-token matching for natural-language queries — this can later be swapped for real semantic search without changing the API.

---

## 5. Extending It

- **Real training data**: replace the synthetic dataset generator in `train_model.py` with actual labelled (profile → applied/matched scheme) data once you have usage history.
- **Admin module**: the backend structure (separate `service`/`controller`/`repository` layers) is intentionally set up so an `AdminController` + role-based `@PreAuthorize("hasRole('ADMIN')")` checks can be added later without restructuring.
- **Semantic search / LLM chatbot**: the `Chatbot.jsx` component and `SchemeService.search()` are isolated enough to swap in a real LLM or vector search backend later — the API contracts don't need to change.
- **Notifications**: `NotificationService.notifyDeadlineApproaching(...)` is ready to be called from a scheduled job (e.g. Spring `@Scheduled`) that checks upcoming scheme deadlines daily.

---

## 6. Security Notes

- Passwords are BCrypt-hashed; JWTs are HMAC-SHA256 signed (`app.jwt.secret` — **change this in production**).
- All `/api/**` routes except `/api/auth/**` and `GET /api/schemes/**` require a valid JWT.
- Every wallet/profile/notification endpoint scopes queries to the authenticated user's own ID — a citizen can't read another citizen's documents by guessing an ID.

---

## 7. Week 1 enhancements: languages, secure document sharing, versions

### 7.1 Languages (English, தமிழ், हिन्दी)
- UI text lives in `frontend/src/locales/{en,ta,hi}.json`, loaded with `i18next`. English is bundled; Tamil and Hindi are separate lazy-loaded chunks (~7.5 kB gzipped each).
- The choice is saved in `localStorage` (`lang`) and, when signed in, on the account (`PUT /api/users/me/language`, returned as `language` at login). On sign-in the account's language wins; if the account has none, the device's choice is saved to it.
- `<html lang>` and `dir` update on every switch. All three languages are left-to-right; `directionFor()` in `src/i18n/index.js` is where an RTL language would be added.
- **Not translated, on purpose:** scheme names, descriptions, benefits, eligibility text and application steps stay in their original official wording (a notice says so when a non-English language is active). Add reviewed translations before changing this.
- **Server-generated text** (eligibility status messages, criteria labels and details, "missing information", the AI explanation, deadline notifications) is rendered in the active language by the frontend from stable codes the backend now sends (`code`/`params` on each criterion, `missingInformationCodes`, `params` on notifications). The backend's English text is still sent unchanged and is used for English and as the fallback for any unknown code. Notifications created before this change have no `params` and stay in English.
- **Admin Portal** is translated (the scheme data it edits is not).
- **Translation quality:** the Tamil and Hindi strings were drafted by an AI model and have **not** had a native-speaker review. Have them reviewed, especially legal/government terms, before public launch.
- **OCR** reads English-script text only. Tamil and Hindi documents are not supported by OCR; the wallet tells users to enter those details themselves during review.
- A test fails if `ta`/`hi` have a missing or extra key, or lose an interpolation placeholder, relative to `en`.

### 7.2 Document sharing (per document)
Endpoints (owner, JWT required): `POST/GET /api/wallet/{id}/shares`, `DELETE /api/wallet/{id}/shares/{shareId}` (revoke), `GET /api/wallet/{id}/shares/{shareId}/events`.
Public (token only): `GET /api/share/{token}` (metadata), `/view` (inline), `/download` (attachment, `DOWNLOAD` links only). The web page for a link is `/shared/:token`.

- Tokens are 256-bit `SecureRandom` values; only the SHA-256 hash is stored. The raw token is returned once, at creation.
- Permissions: `VIEW` (inline only) or `DOWNLOAD`. Expiry 1 hour to 7 days (default 24 h). Links can be revoked at any time. A view-only link cannot be saved through the app, but a viewer can still screenshot it; the UI says so.
- Ownership is enforced on every owner endpoint (other users get 404). Expired and revoked links return 410; unknown tokens 404.
- **Aadhaar documents cannot be shared** unless `app.share.allow-sensitive=true` (env `SHARE_ALLOW_SENSITIVE`), and even then need an explicit risk acknowledgement. Other sensitive types (income, caste, residence, disability, land, ration card, bank passbook, employment) require `acknowledgeRisk: true`. The UI shows the risks before any link is created.
- The public endpoints are rate limited per client address (`app.share.rate-limit-per-minute`, default 30/min; HTTP 429 with `Retry-After`). The counter is in memory, so each backend instance enforces its own limit; behind a reverse proxy set `server.forward-headers-strategy=framework` so the real client address is used.
- Every access attempt is recorded (`share_access_events`): outcome and time only, no document content, token or IP address.
- Shared responses are `Cache-Control: no-store` with `X-Content-Type-Options: nosniff`. Deleting a document deletes its links and files.

### 7.3 Uploads and version history
- Uploads accept PDF/JPG/PNG only, validated by extension **and** file signature; the document type must be one of the known types; names are sanitised and files are stored under a generated name inside the upload directory.
- `GET/POST /api/wallet/{id}/versions`, `POST /api/wallet/{id}/versions/{n}/restore`. A new version resets OCR/verification (the file changed). Restoring copies the old file forward as a new latest version, so history is never rewritten. The last 10 versions are kept. Documents created before this change appear as version 1. Shares always serve the current version.

### 7.4 Schemes
`backend/seed/seed_schemes_extra.js` adds 50 schemes (60 in total) across all nine categories. Each has its own official portal as `applicationLink`, plus `dataSource` and `linkVerifiedOn`, shown on the scheme page. **All 50 links returned HTTP 200 on 2026-10-27; that proves the site is reachable, not that the page still matches the summary.** Eligibility criteria include only well-known, stable rules; deadlines are left empty rather than invented. An administrator should review each entry against its official page before go-live.

### 7.5 Tests
```bash
cd backend  && mvn test      # 48 tests: sharing, rate limiting, uploads, versions, language preference, rule engine + codes
cd frontend && npm test      # 43 tests: language switching/persistence, locale parity, server-text localisation, admin page, share dialog, versions, chatbot
cd frontend && npm run build
```
Not covered by automated tests: running the whole stack against a real MongoDB, the OCR service, and a real browser. Test the share flow manually once end to end before release.

### 7.6 Known limitations / next steps (not started)
Offline/PWA support, file-storage abstraction (S3/GridFS), encryption at rest, named-user sharing, ESLint, and a browser-level smoke test. If an administrator changes a scheme's `applicationLink`, its `linkVerifiedOn` is cleared, since the earlier check no longer applies.
