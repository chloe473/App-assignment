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

const homeView = document.getElementById("homeView");
const statisticsView = document.getElementById("statisticsView");
const exploreView = document.getElementById("exploreView");
const flashcardView = document.getElementById("flashcardView");
const quizView = document.getElementById("quizView");
const statisticsLink = document.getElementById("statisticsLink");
const exploreLink = document.getElementById("exploreLink");
const flashcardsLink = document.getElementById("flashcardsLink");
const quizLink = document.getElementById("quizLink");
const homeFromStatistics = document.getElementById("homeFromStatistics");
const homeFromExplore = document.getElementById("homeFromExplore");
const homeFromFlashcards = document.getElementById("homeFromFlashcards");
const homeFromQuiz = document.getElementById("homeFromQuiz");
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
const wordsComplete = document.getElementById("wordsComplete");
const studiedWordsLabel = document.getElementById("studiedWordsLabel");
const studyingCount = document.getElementById("studyingCount");
const masteredCount = document.getElementById("masteredCount");
const progressChart = document.getElementById("progressChart");
const progressLegend = document.getElementById("progressLegend");
const statisticsList = document.getElementById("statisticsList");
const statisticsFilters = document.querySelectorAll(".statistics-filter");
const searchInput = document.getElementById("searchInput");
const clearSearchButton = document.getElementById("clearSearchButton");
const searchResults = document.getElementById("searchResults");

// Keep the current search request identifiable so an older response cannot overwrite newer results.
let searchRequestNumber = 0;

let questions = [];
let quizIndex = 0;
let score = 0;
let selectedAnswer = null;
let vocabulary = [];
let activeStatisticsFilter = "all";

// Keep quiz progress on this browser so statistics remain available after a page refresh.
const PROFICIENCY_STORAGE_KEY = "noongarVocabularyProficiency";

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

function showHome(event) {
    event.preventDefault();
    homeView.hidden = false;
    statisticsView.hidden = true;
    exploreView.hidden = true;
    flashcardView.hidden = true;
    quizView.hidden = true;
    history.replaceState(null, "", "index.html#home");
}

// Read the saved proficiency map and tolerate an empty or damaged browser-storage value.
function readProficiency() {
    try {
        return JSON.parse(localStorage.getItem(PROFICIENCY_STORAGE_KEY) || "{}");
    } catch (error) {
        return {};
    }
}

// Save the latest proficiency map so every quiz attempt contributes to future statistics.
function saveProficiency(proficiency) {
    localStorage.setItem(PROFICIENCY_STORAGE_KEY, JSON.stringify(proficiency));
}

// Convert a numeric proficiency into the category shown on the statistics page.
function getProficiencyStatus(value) {
    if (value >= 5) return "mastered";
    if (value >= 1) return "studying";
    return "not studied yet";
}

// Apply one quiz result, clamping every word between zero and five progress points.
function recordQuizResult(question, isCorrect) {
    const proficiency = readProficiency();
    const currentValue = Number(proficiency[question.noongar] || 0);
    const nextValue = isCorrect
        ? Math.min(5, currentValue + 1)
        : Math.max(0, currentValue - 1);
    proficiency[question.noongar] = nextValue;
    saveProficiency(proficiency);
}

// Build the list for the selected filter and show a progress bar for each vocabulary word.
function renderStatisticsList() {
    const proficiency = readProficiency();
    const filteredWords = vocabulary.filter((word) => {
        const status = getProficiencyStatus(Number(proficiency[word.noongar] || 0));
        return activeStatisticsFilter === "all" || status === activeStatisticsFilter;
    });

    statisticsList.replaceChildren();
    if (filteredWords.length === 0) {
        statisticsList.innerHTML = `<div class="statistics-empty"><h3>No words here yet</h3><p>Answer quiz questions to build your word progress.</p></div>`;
        return;
    }

    filteredWords.forEach((word) => {
        const value = Number(proficiency[word.noongar] || 0);
        const status = getProficiencyStatus(value);
        const row = document.createElement("article");
        row.className = "statistics-word-row";
        row.innerHTML = `
            <div class="statistics-word-details">
                <h3>${escapeHtml(word.noongar)}</h3>
                <p>${escapeHtml(word.english)}</p>
            </div>
            <div class="statistics-word-progress">
                <span class="word-status status-${status.replaceAll(" ", "-")}">${status}</span>
                <div class="proficiency-dots" aria-label="${value} out of 5 proficiency">
                    ${Array.from({ length: 5 }, (_, index) => `<span class="proficiency-dot${index < value ? " filled" : ""}"></span>`).join("")}
                </div>
                <span class="proficiency-number">${value} / 5</span>
            </div>
        `;
        statisticsList.appendChild(row);
    });
}

// Update the summary cards using only words that have been tested at least once.
function renderStatisticsSummary() {
    const proficiency = readProficiency();
    const values = vocabulary.map((word) => Number(proficiency[word.noongar] || 0));
    const mastered = values.filter((value) => value >= 5).length;
    const studying = values.filter((value) => value >= 1 && value < 5).length;
    const studied = mastered + studying;
    const complete = studied === 0 ? 0 : Math.round((mastered / studied) * 100);

    wordsComplete.textContent = `${complete}%`;
    studiedWordsLabel.textContent = `of studied words (${studied} total)`;
    studyingCount.textContent = String(studying);
    masteredCount.textContent = String(mastered);
    renderProgressChart({ studying, mastered, notStudied: vocabulary.length - studied });
}

// Render the full-list distribution as a CSS pie chart and a text-based accessible legend.
function renderProgressChart(counts) {
    const total = vocabulary.length;
    const segments = [
        { key: "studying", label: "Studying", count: counts.studying, color: "#d2ae52" },
        { key: "mastered", label: "Mastered", count: counts.mastered, color: "#39745b" },
        { key: "notStudied", label: "Not studied yet", count: counts.notStudied, color: "#d9d3ca" },
    ];
    let currentPercentage = 0;
    const gradient = segments.map((segment) => {
        const percentage = total === 0 ? 0 : (segment.count / total) * 100;
        const start = currentPercentage;
        currentPercentage += percentage;
        return `${segment.color} ${start}% ${currentPercentage}%`;
    }).join(", ");

    progressChart.style.background = total === 0
        ? "#d9d3ca"
        : `conic-gradient(${gradient})`;
    progressChart.setAttribute(
        "aria-label",
        `${counts.studying} studying, ${counts.mastered} mastered, and ${counts.notStudied} not studied yet out of ${total} words`,
    );
    progressLegend.replaceChildren();

    segments.forEach((segment) => {
        const percentage = total === 0 ? 0 : Math.round((segment.count / total) * 100);
        const item = document.createElement("div");
        item.className = "progress-legend-item";
        item.innerHTML = `
            <span class="legend-swatch" style="background: ${segment.color}"></span>
            <span class="legend-label">${segment.label}</span>
            <strong>${percentage}%</strong>
            <span class="legend-count">${segment.count} ${segment.count === 1 ? "word" : "words"}</span>
        `;
        progressLegend.appendChild(item);
    });
}

// Load the shared CSV-backed vocabulary before rendering the statistics view.
async function loadStatistics() {
    statisticsList.innerHTML = `<div class="statistics-empty"><p>Loading your word progress...</p></div>`;
    try {
        const response = await fetch(`${API_URL}/api/words`);
        if (!response.ok) throw new Error("Could not load the vocabulary.");
        const data = await response.json();
        vocabulary = data.words;
        renderStatisticsSummary();
        renderStatisticsList();
    } catch (error) {
        console.error(error);
        statisticsList.innerHTML = `<div class="statistics-empty"><h3>Statistics unavailable</h3><p>Could not connect to the vocabulary service.</p></div>`;
    }
}

// Open the statistics page and refresh it so the latest quiz result is immediately visible.
function showStatistics(event) {
    event.preventDefault();
    homeView.hidden = true;
    statisticsView.hidden = false;
    exploreView.hidden = true;
    flashcardView.hidden = true;
    quizView.hidden = true;
    history.replaceState(null, "", "index.html#statistics");
    loadStatistics();
}

// Switch to the explore screen, reset its transient state, and focus the search field immediately.
function showExplore(event) {
    event.preventDefault();
    homeView.hidden = true;
    statisticsView.hidden = true;
    exploreView.hidden = false;
    flashcardView.hidden = true;
    quizView.hidden = true;
    history.replaceState(null, "", "index.html#explore");
    searchInput.value = "";
    clearSearchButton.hidden = true;
    renderSearchPrompt();
    window.requestAnimationFrame(() => searchInput.focus());
}

// Show the initial explore message before the user has entered a search term.
function renderSearchPrompt() {
    searchResults.innerHTML = `
        <div class="search-message">
            <span class="message-mark" aria-hidden="true">✦</span>
            <h2>Start with a word</h2>
            <p>Search the dictionary to discover a Noongar word, its meaning, and how to say it.</p>
        </div>
    `;
}

// Render a friendly empty state when a term does not match the dictionary.
function renderNoResults(query) {
    searchResults.innerHTML = `
        <div class="search-message empty-message">
            <span class="message-mark" aria-hidden="true">?</span>
            <h2>No words found for “${escapeHtml(query)}”</h2>
            <p>Try searching for the English meaning, such as <button class="suggestion-button" type="button">water</button> or <button class="suggestion-button" type="button">bird</button>.</p>
        </div>
    `;
    searchResults.querySelectorAll(".suggestion-button").forEach((button) => {
        button.addEventListener("click", () => {
            searchInput.value = button.textContent;
            searchWords();
            searchInput.focus();
        });
    });
}

// Escape API text before placing it into the small amount of result markup created below.
function escapeHtml(value) {
    return String(value).replace(/[&<>']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
    }[character]));
}

// Build one result card with the matched word, metadata, and audio action.
function createSearchResult(word) {
    const result = document.createElement("article");
    result.className = "result-card";
    result.innerHTML = `
        <div class="result-card-topline">
            <span class="result-type">${escapeHtml(word.wordType || "word")}</span>
            <span class="result-pronunciation">${escapeHtml(word.pronunciation || "Pronunciation unavailable")}</span>
        </div>
        <div class="result-word-row">
            <div>
                <h2>${escapeHtml(word.noongar)}</h2>
                <p class="result-meaning">${escapeHtml(word.english)}</p>
            </div>
            <button class="hear-button" type="button" aria-label="Hear ${escapeHtml(word.noongar)}" title="Hear this Noongar word">◖ <span>Hear it</span></button>
        </div>
    `;
    result.querySelector(".hear-button").addEventListener("click", () => speakWord(word.noongar, result.querySelector(".hear-button")));
    return result;
}

// Use the browser voice available on the user's device to make the Noongar word audible.
function speakWord(word, button) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.8;
    button.classList.add("speaking");
    utterance.onend = () => button.classList.remove("speaking");
    window.speechSynthesis.speak(utterance);
}

// Fetch matches across all four dictionary fields and keep results in the order returned by the API.
async function searchWords() {
    const query = searchInput.value.trim();
    clearSearchButton.hidden = query.length === 0;
    if (!query) {
        renderSearchPrompt();
        return;
    }

    const currentRequest = ++searchRequestNumber;
    searchResults.setAttribute("aria-busy", "true");
    try {
        const response = await fetch(`${API_URL}/api/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Could not search the dictionary.");
        const data = await response.json();
        if (currentRequest !== searchRequestNumber) return;

        searchResults.replaceChildren();
        if (data.results.length === 0) {
            renderNoResults(query);
            return;
        }

        const heading = document.createElement("p");
        heading.className = "result-count";
        heading.textContent = `${data.count} ${data.count === 1 ? "word" : "words"} found`;
        searchResults.appendChild(heading);
        data.results.forEach((word) => searchResults.appendChild(createSearchResult(word)));
    } catch (error) {
        console.error(error);
        searchResults.innerHTML = `<div class="search-message"><h2>Search is unavailable</h2><p>Could not connect to the dictionary. Is the Python backend running?</p></div>`;
    } finally {
        searchResults.setAttribute("aria-busy", "false");
    }
}

function showFlashcards(event) {
    event.preventDefault();
    homeView.hidden = true;
    statisticsView.hidden = true;
    exploreView.hidden = true;
    quizView.hidden = true;
    flashcardView.hidden = false;
    history.replaceState(null, "", "index.html#flashcards");
    generateSet();
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

    const currentQuestion = questions[quizIndex];
    const isCorrect = selectedAnswer === currentQuestion.answer;
    recordQuizResult(currentQuestion, isCorrect);

    if (isCorrect) {
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
    homeView.hidden = true;
    statisticsView.hidden = true;
    exploreView.hidden = true;
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
statisticsLink.addEventListener("click", showStatistics);
exploreLink.addEventListener("click", showExplore);
flashcardsLink.addEventListener("click", showFlashcards);
quizLink.addEventListener("click", showQuiz);
homeFromExplore.addEventListener("click", showHome);
homeFromFlashcards.addEventListener("click", showHome);
homeFromQuiz.addEventListener("click", showHome);
homeFromStatistics.addEventListener("click", showHome);
nextQuestion.addEventListener("click", goToNextQuestion);
newQuiz.addEventListener("click", generateQuiz);
statisticsFilters.forEach((filterButton) => {
    filterButton.addEventListener("click", () => {
        activeStatisticsFilter = filterButton.dataset.filter;
        statisticsFilters.forEach((button) => {
            const isActive = button === filterButton;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
        renderStatisticsList();
    });
});
searchInput.addEventListener("input", searchWords);
clearSearchButton.addEventListener("click", () => {
    searchInput.value = "";
    searchWords();
    searchInput.focus();
});

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
if (window.location.hash === "#statistics") {
    showStatistics({ preventDefault: () => {} });
} else if (window.location.hash === "#explore") {
    showExplore({ preventDefault: () => {} });
} else if (window.location.hash === "#quiz") {
    homeView.hidden = true;
    statisticsView.hidden = true;
    exploreView.hidden = true;
    flashcardView.hidden = true;
    quizView.hidden = false;
    generateQuiz();
} else if (window.location.hash === "#flashcards") {
    showFlashcards({ preventDefault: () => {} });
} else {
    homeView.hidden = false;
    statisticsView.hidden = true;
    exploreView.hidden = true;
    flashcardView.hidden = true;
    quizView.hidden = true;
}
