from pathlib import Path
import csv
import random

from fastapi import APIRouter, HTTPException, Query


router = APIRouter()
DATA_FILE = Path(__file__).parent / "data" / "noongar_dictionary.csv"


def load_wordlist():
    """Read the vocabulary used by the flashcards."""
    words = []

    with DATA_FILE.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            noongar = (row.get("Noongar Word") or "").strip()
            english = (row.get("English Translation") or "").strip()
            pronunciation = (row.get("Pronunciation (approx.)") or "").strip()
            word_type = (row.get("Word Type") or "").strip()

            if noongar and english:
                words.append({
                    "noongar": noongar,
                    "english": english,
                    "pronunciation": pronunciation,
                    "wordType": word_type,
                })

    return words


@router.get("/api/generate-set")
def generate_set(count: int = Query(default=20, ge=1, le=50)):
    """Return a random group of vocabulary cards."""
    words = load_wordlist()

    if not words:
        raise HTTPException(status_code=500, detail="The wordlist is empty.")

    selected = random.sample(words, min(count, len(words)))
    return {"count": len(selected), "cards": selected}


@router.get("/api/word-count")
def word_count():
    """Return the total number of words in the vocabulary list."""
    return {"count": len(load_wordlist())}
