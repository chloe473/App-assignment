from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_quiz_minimum_and_maximum_question_counts():
    for count in (5, 20):
        response = client.get(f"/api/quiz?count={count}")

        assert response.status_code == 200

        data = response.json()

        assert data["count"] == count
        assert len(data["questions"]) == count


def test_quiz_rejects_counts_outside_limits():
    for count in (4, 21):
        response = client.get(f"/api/quiz?count={count}")

        assert response.status_code == 422


def test_quiz_questions_have_three_distractors_and_correct_answer():
    response = client.get("/api/quiz?count=5")

    assert response.status_code == 200

    for question in response.json()["questions"]:
        assert len(question["options"]) == 4
        assert question["answer"] in question["options"]