# 🏟️ StadiumPulse AI — FIFA World Cup 2026

**GenAI-Enabled Stadium Operations & Fan Experience Platform**

StadiumPulse AI is a real-time, Generative AI-powered dashboard designed for the FIFA World Cup 2026. It enhances stadium operations, crowd safety, sustainable transport, multilingual fan assistance, and real-time operational decision support — all in one unified platform.

---

## 🚀 Live Features

- 🤖 **Gemini AI Co-Pilot** — Dual-role (Fan / Staff) assistant aware of real-time gate congestion, crowd densities, and incidents
- 🗺️ **Interactive SVG Stadium Map** — Live color-coded gate and sector statuses
- 📊 **Operations Simulator** — Trigger 5 matchday scenarios (Normal, Halftime Rush, Gate Bottleneck, Security Incident, Metro Outage)
- 🌿 **Green Transit Carbon Tracker** — Compare transport modes and track eco-pledges
- 🌍 **Multilingual** — English, Spanish, French support with Text-to-Speech narration
- ♿ **Fully Accessible** — High-contrast toggle, font scaling, ARIA labels, keyboard navigation, voice input

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| AI | Google Gemini (`@google/generative-ai`) |
| Frontend | Vanilla HTML5, CSS3, ES Modules |
| Deployment | Google Cloud Run (Docker) |
| Testing | Native Node.js `--test` |

---

## 📁 Project Structure

```
stadium-pulse/
├── public/
│   ├── index.html          # Semantic accessible layout + SVG map
│   ├── style.css           # Dark glassmorphism design system
│   └── js/
│       ├── app.js          # App controller (DOM, events, charts)
│       ├── gemini.js       # AI gateway + TTS + STT voice services
│       ├── simulation.js   # Stadium scenario engine
│       └── transit.js      # Carbon footprint calculator
├── tests/
│   ├── simulation.test.js  # Queue and scenario unit tests
│   ├── transit.test.js     # Carbon math unit tests
│   └── server.test.js      # Security headers + API integration tests
├── server.js               # Secure Express API server
├── Dockerfile              # Cloud Run container build
├── cloudbuild.yaml         # GCP CI/CD pipeline
└── .env.example            # API key template
```

---

## ⚙️ Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your Gemini API key:
# GEMINI_API_KEY=your_key_here
```
Get a free key at: https://aistudio.google.com/app/apikey

### 3. Start the Server
```bash
npm start
```
Open **http://localhost:8080** in your browser.

### 4. Run Tests
```bash
npm test
```

---

## ☁️ Google Cloud Run Deployment

```bash
gcloud builds submit --config cloudbuild.yaml .
```

Or deploy directly:
```bash
gcloud run deploy stadium-pulse \
  --image gcr.io/$PROJECT_ID/stadium-pulse:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars GEMINI_API_KEY=your_key_here
```

---

## 🔒 Security Highlights

- Strict **Content Security Policy** headers on every response
- **X-Frame-Options: DENY** (clickjacking protection)
- **JSON payload limits** (15kb max — prevents DoS attacks)
- Input **sanitization** against XSS injection
- API keys kept strictly **server-side only**
- Graceful `413 Payload Too Large` error handling

---

## ✅ Test Results

```
✅ getWaitTimeRating classifications
✅ setScenario("halftime") transitions
✅ setScenario("gated") transitions
✅ adjustGreenShuttleUsage boundary limits
✅ EV Shuttle zero-emission footprint
✅ Gasoline car footprint & tree-offset equivalents
✅ Health endpoint and security headers
✅ Chat API local fallback (Fan / Accessibility)
✅ Chat API multilingual fallback (Staff / Spanish)
✅ JSON payload size enforcement (413 response)
```

---

*Created for Google's Prompt Wars — FIFA World Cup 2026 Challenge*  
*By B.E. Hemalatha*
