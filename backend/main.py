from pathlib import Path

# Import the API framework and feature routers.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from explore import router as explore_router
from flashcards import router as flashcards_router
from quiz import router as quiz_router
from setting import router as setting_router
from statistics import router as statistics_router

# Resolve the frontend directory relative to this module for both local and Render deployments.
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

# Create the API app so the frontend can talk to the backend.
app = FastAPI(title="Noongar Vocabulary API")

# Allow credentialed browser requests from the local frontend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500", "https://noongar-language-learning.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quiz_router)
app.include_router(flashcards_router)
app.include_router(explore_router)
app.include_router(statistics_router)
app.include_router(setting_router)


# Health check endpoint to confirm the API is running.
@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the static website from the same origin as the API on Render.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
