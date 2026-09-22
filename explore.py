# Import the API router and query validation used by the Explore screen.
from fastapi import APIRouter, Query

from flashcards import load_wordlist


# Create the router that owns dictionary search requests from the Explore screen.
router = APIRouter()


# Search every vocabulary field so the frontend can use one simple dictionary endpoint.
@router.get("/api/search")
def search_words(query: str = Query(default="", min_length=0, max_length=80)):
    """Return words matching Noongar, English, pronunciation, or word type."""
    search_term = query.strip().casefold()

    if not search_term:
        return {"query": "", "count": 0, "results": []}

    results = [
        word
        for word in load_wordlist()
        if any(
            search_term in str(word[field]).casefold()
            for field in ("noongar", "english", "pronunciation", "wordType")
        )
    ]

    return {"query": query.strip(), "count": len(results), "results": results}
