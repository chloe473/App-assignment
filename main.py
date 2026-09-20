# Import the libraries needed for file reading, random selection, and the API.
from pathlib import Path
import csv
import random

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

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

# Point to the CSV file that stores the vocabulary list.
DATA_FILE = Path(__file__).parent / "data" / "noongar_dictionary.csv"

# Read all the vocabulary rows from the CSV and convert them into a Python list.
def load_wordlist():
    """Data tier: read vocabulary from the CSV wordlist."""
    words = []

    with DATA_FILE.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            noongar = (row.get("Noongar Word") or "").strip()
            english = (row.get("English Translation") or "").strip()

            if noongar and english:
                words.append({
                    "noongar": noongar,
                    "english": english,
                })

    return words

# Health check endpoint to confirm the API is running.
@app.get("/api/health")
def health():
    return {"status": "ok"}

# Return a random group of vocabulary cards for the app to display.
@app.get("/api/generate-set")
def generate_set(
    count: int = Query(default=20, ge=1, le=50)
):
    """Return a random set of vocabulary cards."""
    words = load_wordlist()

    if not words:
        raise HTTPException(status_code=500, detail="The wordlist is empty.")

    count = min(count, len(words))
    selected = random.sample(words, count)

    return {
        "count": len(selected),
        "cards": selected,
    }

# Count how many words are stored in the vocabulary list.
@app.get("/api/word-count")
def word_count():
    """Return the total number of words available in the data tier."""
    return {"count": len(load_wordlist())}
