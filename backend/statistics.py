# Import the API router used by the My Statistics screen.
from fastapi import APIRouter

from flashcards import load_wordlist


# Create the router that supplies the vocabulary needed for statistics calculations.
router = APIRouter()


# Return the complete vocabulary so the frontend can classify every word.
@router.get("/api/words")
def all_words():
    """Return the full vocabulary list used by the statistics screen."""
    words = load_wordlist()
    return {"count": len(words), "words": words}
