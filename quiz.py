from pathlib import Path
import csv
import random

from fastapi import APIRouter, HTTPException


router = APIRouter()
DATA_FILE = Path(__file__).parent / "data" / "noongar_dictionary.csv"


def load_quiz_words():
    """Read the vocabulary needed to build multiple-choice questions."""
    words = []

    with DATA_FILE.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            noongar = (row.get("Noongar Word") or "").strip()
            english = (row.get("English Translation") or "").strip()

            if noongar and english:
                words.append({"noongar": noongar, "english": english})

    return words


@router.get("/api/quiz")
def generate_quiz():
    """Generate ten Noongar-to-English multiple-choice questions."""
    words = load_quiz_words()

    if len(words) < 10:
        raise HTTPException(
            status_code=500,
            detail="At least 10 vocabulary entries are required to generate a quiz.",
        )

    questions = []
    for word in random.sample(words, 10):
        distractor_pool = list({
            item["english"] for item in words if item["english"] != word["english"]
        })
        distractors = random.sample(
            distractor_pool,
            3,
        )
        options = distractors + [word["english"]]
        random.shuffle(options)

        questions.append(
            {
                "noongar": word["noongar"],
                "options": options,
                "answer": word["english"],
            }
        )

    return {"count": len(questions), "questions": questions}
