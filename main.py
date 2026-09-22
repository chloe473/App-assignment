# Import the API framework and feature routers.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from explore import router as explore_router
from flashcards import router as flashcards_router
from quiz import router as quiz_router
from statistics import router as statistics_router
from setting import router as setting_router

# Create the API app so the frontend can talk to the backend.
app = FastAPI(title="Noongar Vocabulary API")

# Allow credentialed browser requests from the local frontend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
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
