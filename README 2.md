# Noongar Vocabulary — Basic 3-Tier Flashcard Website

This is a simple three-tier web application:

1. Frontend — HTML/CSS/JavaScript in `frontend/`
2. Backend — Python + FastAPI in `backend/main.py`, `backend/flashcards.py`, `backend/explore.py`, `backend/statistics.py`, `backend/setting.py`, and `backend/quiz.py`
3. Data — `backend/data/noongar_dictionary.csv`

## Features

- Home page with separate Flashcards and Translation Quiz activities
- Explore page with live search across Noongar, English, pronunciation, and word type
- Search results with browser audio controls
- My Statistics page with persistent quiz proficiency tracking and word filters
- Settings page with profile controls, study preferences, proficiency guidance, and language information

Account and privacy data is stored in `backend/data/users.json` with scrypt password hashes. The server requires an HttpOnly session cookie for private statistics, settings, and account deletion. In development, registration and password-reset responses show one-time tokens in the UI because no email provider is configured; set `APP_ENV=production` and connect an email service before deployment.
- Flashcard interface with its own view
- English on one side of the card
- Noongar on the other side
- Click the card or Flip to turn it over
- Previous and Next navigation
- Generate Set selects 20 random words from the CSV wordlist
- Ten-question multiple-choice translation quiz
- Progress indicator
- Responsive layout for smaller screens

## 1. Install Python dependencies

Open Terminal in the project folder and run:

```bash
cd backend
python3 -m pip install -r requirements.txt
```

## 2. Start the Python backend

From the `backend` folder:

```bash
uvicorn main:app --reload
```

The API will run at:

```text
http://127.0.0.1:8000
```

You can test it at:

```text
http://127.0.0.1:8000/api/generate-set?count=20
```

## 3. Start the frontend

Open a second Terminal window.

From the project folder:

```bash
cd frontend
python3 -m http.server 5500
```

Then open:

```text
http://127.0.0.1:5500
```

## Deploy the website on Render

The FastAPI service serves both the frontend and API, so the deployed website and API use the same origin. In the existing Render Web Service settings, leave Root Directory blank (the repository root) and set:

- Build Command: `pip install -r backend/requirements.txt`
- Start Command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment Variable: `HTTPS_ONLY=1`

Deploy the updated project to Render. The site will open at `https://noongar-language-learning.onrender.com/`, and the API health check will be at `https://noongar-language-learning.onrender.com/api/health`.

Render's local filesystem may be cleared when the service restarts or redeploys. Attach a persistent disk for the directory used by `backend/data` if account and quiz data must survive those events.

The quiz is available from the **Translation Quiz** button on the home page:

```text
http://127.0.0.1:5500/index.html#quiz
```

Flashcards are available from the **Flashcards** button:

```text
http://127.0.0.1:5500/index.html#flashcards
```

The dictionary explorer is available from the **Explore Words** button:

```text
http://127.0.0.1:5500/index.html#explore
```

The quiz API can be tested at:

```text
http://127.0.0.1:8000/api/quiz
```

The dictionary search API can be tested at:

```text
http://127.0.0.1:8000/api/search?query=water
```

## How the three tiers communicate

```text
User
  ↓
Frontend (HTML + CSS + JavaScript)
  ↓ HTTP request
Backend (Python + FastAPI)
  ↓
Data tier (noongar_dictionary.csv)
  ↑
Random 20 words
  ↑
Backend JSON response
  ↑
Flashcards displayed by frontend
```

The frontend does not choose the words itself. It asks the Python backend for a set, and the backend reads the wordlist and randomly selects 20 entries.

## Important CSV format

The included CSV uses these columns:

```text
Noongar Word,English Translation,Pronunciation (approx.),Word Type
```

If you replace the wordlist, keep those column names.
