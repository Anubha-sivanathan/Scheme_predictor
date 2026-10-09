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
mongosh scheme_predictor backend/seed/seed_schemes.js
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
