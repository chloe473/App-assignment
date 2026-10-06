from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_search_finds_baat():
    response = client.get("/api/search?query=baat")

    assert response.status_code == 200

    data = response.json()

    assert data["count"] > 0
    assert any(
        word["noongar"].casefold() == "baat"
        for word in data["results"]
    )


def test_search_finds_water_in_english_translation():
    response = client.get("/api/search?query=water")

    assert response.status_code == 200

    data = response.json()

    assert data["count"] > 0
    assert any(
        "water" in word["english"].casefold()
        for word in data["results"]
    )


def test_search_handles_no_match():
    response = client.get(
        "/api/search?query=thisworddoesnotexist"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["count"] == 0
    assert data["results"] == []


def test_search_handles_empty_query():
    response = client.get("/api/search?query=")

    assert response.status_code == 200

    data = response.json()

    assert data["count"] == 0
    assert data["results"] == []


def test_search_rejects_query_over_80_characters():
    long_query = "a" * 81

    response = client.get(
        "/api/search",
        params={"query": long_query}
    )

    assert response.status_code == 422