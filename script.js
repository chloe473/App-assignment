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

// Update the visible card and progress bar for the current item.
function updateCard() {
    if (cards.length === 0) return;

    const card = cards[currentIndex];

    englishWord.textContent = card.english;
    noongarWord.textContent = card.noongar;

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

// Connect all user actions to the matching functions.
flashcard.addEventListener("click", flipCard);
flipButton.addEventListener("click", flipCard);
nextButton.addEventListener("click", nextCard);
nextButtonBottom.addEventListener("click", nextCard);
previousButton.addEventListener("click", previousCard);
generateButton.addEventListener("click", generateSet);
englishFirstButton.addEventListener("click", () => setStartingSide("english"));
noongarFirstButton.addEventListener("click", () => setStartingSide("noongar"));

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

// Load a first deck automatically when the page opens.
generateSet();
