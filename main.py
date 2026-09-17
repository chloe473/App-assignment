from pathlib import Path
import csv
import random

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Noongar Vocabulary API")

# Allow the separate frontend development server to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For a university prototype; restrict this in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).parent / "data" / "noongar_dictionary.csv"


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


@app.get("/api/health")
def health():
    return {"status": "ok"}


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


@app.get("/api/word-count")
def word_count():
    """Return the total number of words available in the data tier."""
    return {"count": len(load_wordlist())}
