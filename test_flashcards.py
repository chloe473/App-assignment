from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_generate_set_default_returns_20_cards():
    response = client.get("/api/generate-set")

    assert response.status_code == 200

    data = response.json()

    assert data["count"] == 20
    assert len(data["cards"]) == 20


def test_generate_set_boundary_values():
    for count in (1, 50):
        response = client.get(f"/api/generate-set?count={count}")

        assert response.status_code == 200
        assert response.json()["count"] == count


def test_generate_set_rejects_invalid_counts():
    for count in (0, 51):
        response = client.get(f"/api/generate-set?count={count}")

        assert response.status_code == 422