import pytest

from backend.setting import validate_password


def test_password_rejects_too_short():
    with pytest.raises(Exception):
        validate_password("abc1234")


def test_password_rejects_too_long():
    with pytest.raises(Exception):
        validate_password("abcdefghij12345678901")


def test_password_accepts_8_to_20_characters_with_letter_and_number():
    validate_password("abcde123")
    validate_password("abcdefghij1234567890")


def test_statistics_requires_login(client):
    response = client.get("/api/profile/statistics")

    assert response.status_code == 401


def test_quiz_proficiency_updates_and_is_returned_in_statistics(client):
    register = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "abcde123",
        },
    )

    assert register.status_code == 201

    update = client.post(
        "/api/profile/statistics/proficiency",
        params={
            "noongar": "baat",
            "isCorrect": "true"
        },
    )

    assert update.status_code == 200
    assert update.json()["value"] == 1

    stats = client.get("/api/profile/statistics")

    assert stats.status_code == 200
    assert stats.json()["proficiency"]["baat"] == 1


def test_proficiency_cannot_go_below_zero(client):
    register = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "abcde123",
        },
    )

    assert register.status_code == 201

    update = client.post(
        "/api/profile/statistics/proficiency",
        params={
            "noongar": "baat",
            "isCorrect": "false"
        },
    )

    assert update.status_code == 200
    assert update.json()["value"] == 0