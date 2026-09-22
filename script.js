// Connect to the Python API that supplies the vocabulary cards.
const API_URL = "http://127.0.0.1:8000";

// These variables hold the current word set, current card position, and which side is shown first.
let cards = [];
let currentIndex = 0;
let startingSide = "english";

// Grab the main page elements so the script can update them.
const flashcard = document.getElementById("flashcard");
const englishWord = document.getElementById("englishWord");
const noongarWord = document.getElementById("noongarWord");
const noongarPronunciation = document.getElementById("noongarPronunciation");
const noongarWordType = document.getElementById("noongarWordType");
const cardNumber = document.getElementById("cardNumber");
const statusText = document.getElementById("statusText");
const progressBar = document.getElementById("progressBar");

const generateButton = document.getElementById("generateButton");
const flipButton = document.getElementById("flipButton");
const nextButtonBottom = document.getElementById("nextButtonBottom");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const englishFirstButton = document.getElementById("englishFirstButton");
const noongarFirstButton = document.getElementById("noongarFirstButton");

const flashcardView = document.getElementById("flashcardView");
const quizView = document.getElementById("quizView");
const quizLink = document.getElementById("quizLink");
const flashcardLink = document.getElementById("flashcardLink");
const questionNumber = document.getElementById("questionNumber");
const quizStatus = document.getElementById("quizStatus");
const quizProgress = document.getElementById("quizProgress");
const quizWord = document.getElementById("quizWord");
const options = document.getElementById("options");
const nextQuestion = document.getElementById("nextQuestion");
const quizPanel = document.getElementById("quizPanel");
const resultsPanel = document.getElementById("resultsPanel");
const scoreDisplay = document.getElementById("score");
const scoreMessage = document.getElementById("scoreMessage");
const newQuiz = document.getElementById("newQuiz");
const errorMessage = document.getElementById("errorMessage");

let questions = [];
let quizIndex = 0;
let score = 0;
let selectedAnswer = null;

// Update the visible card and progress bar for the current item.
function updateCard() {
    if (cards.length === 0) return;

    const card = cards[currentIndex];

    englishWord.textContent = card.english;
    noongarWord.textContent = card.noongar;
    noongarPronunciation.textContent = card.pronunciation
        ? `Pronunciation: ${card.pronunciation}`
        : "";
    noongarWordType.textContent = card.wordType
        ? `Word type: ${card.wordType}`
        : "";

    cardNumber.textContent = `Card ${currentIndex + 1} of ${cards.length}`;
    statusText.textContent = "Click the card to flip";

    const progress = ((currentIndex + 1) / cards.length) * 100;
    progressBar.style.width = `${progress}%`;

    flashcard.classList.toggle("flipped", startingSide === "noongar");
}

// Change which language is shown first and refresh the selected styling.
function setStartingSide(side) {
    startingSide = side;
    const noongarFirst = side === "noongar";

    englishFirstButton.classList.toggle("active", !noongarFirst);
    noongarFirstButton.classList.toggle("active", noongarFirst);
    englishFirstButton.setAttribute("aria-pressed", String(!noongarFirst));
    noongarFirstButton.setAttribute("aria-pressed", String(noongarFirst));

    updateCard();
}

// Flip the card to reveal the other language.
function flipCard() {
    if (cards.length > 0) {
        flashcard.classList.toggle("flipped");
    }
}

// Move to the next card, wrapping around to the start when needed.
function nextCard() {
    if (cards.length === 0) return;

    currentIndex = (currentIndex + 1) % cards.length;
    updateCard();
}

// Move to the previous card, wrapping around to the end when needed.
function previousCard() {
    if (cards.length === 0) return;

    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
    updateCard();
}

// Request a new set of 20 vocabulary cards from the backend.
async function generateSet() {
    generateButton.disabled = true;
    generateButton.textContent = "Generating...";

    try {
        const response = await fetch(`${API_URL}/api/generate-set?count=20`);

        if (!response.ok) {
            throw new Error("Could not generate the flashcard set.");
        }

        const data = await response.json();

        cards = data.cards;
        currentIndex = 0;

        updateCard();
        statusText.textContent = "20 random words generated";
    } catch (error) {
        console.error(error);
        statusText.textContent =
            "Could not connect to the Python backend. Is it running?";
    } finally {
        generateButton.disabled = false;
        generateButton.textContent = "Generate Set";
    }
}

function showFlashcards() {
    quizView.hidden = true;
    flashcardView.hidden = false;
    history.replaceState(null, "", "index.html");
}

function renderQuestion() {
    const question = questions[quizIndex];
    selectedAnswer = null;
    questionNumber.textContent = `Question ${quizIndex + 1} of ${questions.length}`;
    quizStatus.textContent = "Choose the English translation";
    quizProgress.style.width = `${((quizIndex + 1) / questions.length) * 100}%`;
    quizWord.textContent = question.noongar;
    nextQuestion.disabled = true;
    nextQuestion.textContent = quizIndex === questions.length - 1 ? "See Score" : "Next";
    options.replaceChildren();

    question.options.forEach((option) => {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.className = "option-button";
        optionButton.textContent = option;
        optionButton.addEventListener("click", () => selectAnswer(option, optionButton));
        options.appendChild(optionButton);
    });
}

function selectAnswer(answer, selectedButton) {
    selectedAnswer = answer;
    nextQuestion.disabled = false;
    quizStatus.textContent = "Answer selected";

    document.querySelectorAll(".option-button").forEach((button) => {
        button.classList.remove("selected");
    });
    selectedButton.classList.add("selected");
}

function showResults() {
    quizPanel.hidden = true;
    resultsPanel.hidden = false;
    questionNumber.textContent = "Quiz complete";
    quizStatus.textContent = `${score} correct`;
    quizProgress.style.width = "100%";
    scoreDisplay.textContent = `${score} / ${questions.length}`;
    scoreMessage.textContent = score === questions.length
        ? "Perfect score. Kaartdijin!"
        : "Keep practising and try another quiz.";
}

function goToNextQuestion() {
    if (selectedAnswer === null) return;

    if (selectedAnswer === questions[quizIndex].answer) {
        score += 1;
    }

    if (quizIndex === questions.length - 1) {
        showResults();
        return;
    }

    quizIndex += 1;
    renderQuestion();
}

async function generateQuiz() {
    errorMessage.hidden = true;
    resultsPanel.hidden = true;
    quizPanel.hidden = false;
    quizWord.textContent = "Loading...";
    options.replaceChildren();
    nextQuestion.disabled = true;

    try {
        const response = await fetch(`${API_URL}/api/quiz`);
        if (!response.ok) throw new Error("Could not generate quiz");

        const data = await response.json();
        questions = data.questions;
        quizIndex = 0;
        score = 0;
        renderQuestion();
    } catch (error) {
        console.error(error);
        quizPanel.hidden = true;
        errorMessage.hidden = false;
    }
}

function showQuiz(event) {
    event.preventDefault();
    flashcardView.hidden = true;
    quizView.hidden = false;
    history.replaceState(null, "", "index.html#quiz");
    generateQuiz();
}

// Connect all user actions to the matching functions.
flashcard.addEventListener("click", flipCard);
flipButton.addEventListener("click", flipCard);
nextButton.addEventListener("click", nextCard);
nextButtonBottom.addEventListener("click", nextCard);
previousButton.addEventListener("click", previousCard);
generateButton.addEventListener("click", generateSet);
englishFirstButton.addEventListener("click", () => setStartingSide("english"));
noongarFirstButton.addEventListener("click", () => setStartingSide("noongar"));
quizLink.addEventListener("click", showQuiz);
flashcardLink.addEventListener("click", (event) => {
    event.preventDefault();
    showFlashcards();
});
nextQuestion.addEventListener("click", goToNextQuestion);
newQuiz.addEventListener("click", generateQuiz);

// Allow keyboard use so the flashcard can be flipped with key presses.
flashcard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        flipCard();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") nextCard();
    if (event.key === "ArrowLeft") previousCard();
    if (event.key === " ") {
        event.preventDefault();
        flipCard();
    }
});

// Load the selected view automatically when the page opens.
if (window.location.hash === "#quiz") {
    flashcardView.hidden = true;
    quizView.hidden = false;
    generateQuiz();
} else {
    generateSet();
}
