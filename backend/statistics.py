# Import the API router used by the My Statistics screen.
from fastapi import APIRouter, Cookie, Response

from backend.flashcards import load_wordlist
from backend.setting import current_user, secure_headers


# Create the router that supplies the vocabulary needed for statistics calculations.
router = APIRouter()


# Return the complete vocabulary so the frontend can classify every word.
@router.get("/api/words")
def all_words(response: Response, noongar_session: str | None = Cookie(default=None)):
    """Return the vocabulary to an authenticated statistics screen only."""
    current_user(noongar_session)
    words = load_wordlist()
    secure_headers(response)
    return {"count": len(words), "words": words}
