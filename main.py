# Import the API framework and feature routers.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from flashcards import router as flashcards_router
from quiz import router as quiz_router

# Create the API app so the frontend can talk to the backend.
app = FastAPI(title="Noongar Vocabulary API")

# Allow browser requests from the separate frontend app during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For a university prototype; restrict this in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quiz_router)
app.include_router(flashcards_router)


# Health check endpoint to confirm the API is running.
@app.get("/api/health")
def health():
    return {"status": "ok"}
