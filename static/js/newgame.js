const gameStatsObject = {
    // legacy
    currentCountry: {},
    gameStarted: false,
    gameEnded: false,
    duration: 30000,
    increment: 0,
    timeLeft: 30000,
    get displayedTimeLeft() {
        return (this.timeLeft / 1000).toFixed(1);
        // these are accessed like a property
    },

    // new
    startTime: 0,
    endTime: 0,
    get currentDuration() {
        return (this.endTime - this.startTime)
    },
    score: 0,
    attempts: 0
}

const roundData = {
    // claude's right, using a map here is unnecessary since we're not interested in looking up rounds by a unique key; we're more interested in the order they occurred
    score: 0,
    attempts: 0,
    history: [],
    /*
        history = [
            {index: int, country: theCorrectAns, userAnswer: userAns, validity: true/false}
            ...
        ]
    */
    flagContainer: document.querySelector('flag-container'),
    userAnsInterface: document.getElementById('user-ans-interface'),
    infoHeader: document.getElementById('info-header'),

    updateHistory(correctAns, userAns, validity) {
        this.history.push({
            index: this.history.length,
            country: correctAns,
            userAnswer: userAns,
            validity: validity
        })
    },

    showPerformance() {
        this.infoHeader = document.getElementById('info-header');
        this.flagContainer = document.querySelector('.flag-container');
        this.userAnsInterface = document.getElementById('user-ans-interface');
        if (!this.flagContainer || !this.userAnsInterface || !this.infoHeader) {
            console.error('Necessary elements could not be found');
            return;
        }
        console.log(this.infoHeader);
        this.infoHeader.innerHTML = `<a href="/"><button id="restart-button" type="button" class="btn btn-lg btn-outline-primary">restart</button></a>`
        this.userAnsInterface.classList.add('d-none');
        this.flagContainer.classList.remove('border', 'border-primary');

        let tableHTML = `
            <table class="table table-striped-columns text-center align-middle fs-5">
                <tr>
                    <th class="col-5">Flag</th>
                    <th class="col-2">Country</th>
                    <th class="col-2">Your Answer</th>
                </tr>
        `;
    
        this.history.forEach(round => {
            const bgClass = round.validity ? 'bg-success-subtle' : 'bg-danger-subtle';
            tableHTML += `
                <tr>
                    <td class="${bgClass}">
                        <div id="flag-svg-${round.index}" style="height: 150px; display: flex; justify-content: center; align-items: center;"></div>
                    </td>
                    <td class="${bgClass}">${round.country}</td>
                    <td class="${bgClass}">${round.userAnswer}</td>
                </tr>
            `;
        });
    
        tableHTML += `</table>`;
        this.flagContainer.innerHTML = tableHTML;
    
        // Now, load the SVGs for each flag
        this.history.forEach(async (round) => {
            const svgContainer = document.getElementById(`flag-svg-${round.index}`);
            if (svgContainer) {
                try {
                    const response = await fetch('/fetch_specific_svg', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ country: round.country })
                    });
                    const data = await response.json();
                    svgContainer.innerHTML = data.svg;
                    this.styleSvg(svgContainer);
                } catch (error) {
                    console.error(`Error loading SVG for ${round.country}:`, error);
                }
            }
        });
    },

    styleSvg(container) {
        const svgElement = container.querySelector('svg');
        if (svgElement) {
            if (!svgElement.getAttribute('viewBox')) {
                const width = svgElement.getAttribute('width') || svgElement.getBoundingClientRect().width;
                const height = svgElement.getAttribute('height') || svgElement.getBoundingClientRect().height;
                svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
            
            // Remove any hardcoded width and height
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
    
            // Set a fixed height of 150px while maintaining aspect ratio
            const viewBox = svgElement.getAttribute('viewBox').split(' ');
            const aspectRatio = viewBox[2] / viewBox[3]; // aspect ratio = width divided by height
            const newWidth = 150 * aspectRatio;
            
            svgElement.style.width = `${newWidth}px`;
            svgElement.style.height = '150px';
        }    
    }
}

const repeatedValues = {
    get emptyInput() {
        const getRandomColNumber = () => Math.floor(Math.random() * 8) + 3; // Random number between 3 and 10

        return `
            <li class="first-option list-group-item list-group-item-secondary placeholder-glow bg-primary-subtle text-primary">
                <span class="placeholder col-${getRandomColNumber()}"></span>
            </li>
            <li class="list-group-item list-group-item-secondary placeholder-glow">
                <span class="placeholder col-${getRandomColNumber()}"></span>
            </li>
            <li class="list-group-item list-group-item-secondary placeholder-glow">
                <span class="placeholder col-${getRandomColNumber()}"></span>
            </li>
            <li class="list-group-item list-group-item-secondary placeholder-glow">
                <span class="placeholder col-${getRandomColNumber()}"></span>
            </li>
            <li class="last-option list-group-item list-group-item-secondary placeholder-glow">
                <span class="placeholder col-${getRandomColNumber()}"></span>
            </li>
        `.trim();
    },

    gameScoreBoard: `
                    <div class="justify-content-center my-0">
                        <div>
                            <div id="info-header" class="display-4 mb-0 fw-semibold fst-italic font-monospace">${gameStatsObject.displayedTimeLeft}</div>
                            <div class="row justify-content-center align-items-center">
                                <span class="col-auto fs-5 mb-0">Score: <span id="score" class="font-monospace display-5">${gameStatsObject.score}</span></span>
                                <span class="col-auto fs-5 mb-0">Tries: <span id="attempts" class="font-monospace display-5">${gameStatsObject.attempts}</span></span>
                            </div>
                        </div>
                   `,
    rightAnsFeedback: `
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" height="160px" width="160px" viewBox="0 -960 960 960" fill="#198754"><path d="M716-120H272v-512l278-288 39 31q6 5 9 14t3 22v10l-45 211h299q24 0 42 18t18 42v81.84q0 7.16 1.5 14.66T915-461L789-171q-8.88 21.25-29.59 36.12Q738.69-120 716-120Zm-384-60h397l126-299v-93H482l53-249-203 214v427Zm0-427v427-427Zm-60-25v60H139v392h133v60H79v-512h193Z"/></svg>
                </div>
            `,
    wrongAnsFeedback(correctAns) { 
        return `
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" height="160px" width="160px" viewBox="0 -960 960 960" fill="#dc3545"><path d="M242-840h444v512L408-40l-39-31q-6-5-9-14t-3-22v-10l45-211H103q-24 0-42-18t-18-42v-81.84q0-7.16-1.5-14.66T43-499l126-290q8.88-21.25 29.59-36.13Q219.31-840 242-840Zm384 60H229L103-481v93h373l-53 249 203-214v-427Zm0 427v-427 427Zm60 25v-60h133v-392H686v-60h193v512H686Z"/></svg>
                    <p class="fs-3 my-0 text-center">${correctAns}</p>
                </div>
            `
        },
    increment(value) {
        return `
            <p class="fs-6 bg-warning-subtle border-bottom border-warning">+${value/1000}s for every right answer</p>
            `
    }
}

const svgMethods = {

    async getFirstSvg() {
        const response = await fetch('/fetch_first_svg', {
            method: 'post',
            headers: {
                'Content-Type' : 'application/json'
            },  
            body: JSON.stringify({
            })
        })
        const data = await response.json();
        return data;
    },

    async getRandomSvg() {
        const response = await fetch('/fetch_random_svg', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
            })
        })
        const data = await response.json();
        return data;
    },

    async loadFlagSvg() {
        // """Loads flag and defines current_country depending on game state"""  
        try {
            // """Places a flag svg into svg container and current_country into placeholder if game_started"""
            const svgContainer = document.getElementById('flag-svg');
            const flagInput = document.getElementById('flag-input');
            if (!svgContainer || !flagInput) {
                console.error('Required DOM elements not found');
                return;
            }

            if (!gameStatsObject.gameStarted && !gameStatsObject.gameEnded){
        // FIRST FLAG
                let svgData = await this.getFirstSvg();
                gameStatsObject.currentCountry = {
                    'common': svgData.common,
                    'official': svgData.official
                }
                svgContainer.innerHTML = svgData.svg;
                flagInput.placeholder = svgData.common;
            } else if (gameStatsObject.gameStarted && !gameStatsObject.gameEnded){
        // SUBSEQUENT FLAGS
                const svgData = await this.getRandomSvg();
                svgContainer.innerHTML = svgData.svg;
                flagInput.placeholder = "your answer";
            }
        // ALL FLAGS
            this.styleSvg(svgContainer);
            gameInitialiser.midGameReset();
        } catch (error) {
            console.error('Error loading flag:', error);
        }
    },

    styleSvg(container){
        // """determines current dimensions of svg inside container to accurately set aspect ratio according to predermined fixed height"""
        const svgElement = container.querySelector('svg');
        if (svgElement) {
            if (!svgElement.getAttribute('viewBox')) {
                const width = svgElement.getAttribute('width') || svgElement.getBoundingClientRect().width;
                const height = svgElement.getAttribute('height') || svgElement.getBoundingClientRect().height;
                svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
            this.setSvgDimensions(svgElement, container);
        }   
    },

    setSvgDimensions(svgElement, container) {
        // Remove any hardcoded width and height
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');

        // Set a fixed height (adjust this value as needed)
        const fixedHeight = 300; // in pixels

        // Get the viewBox
        let viewBox = svgElement.getAttribute('viewBox');
        if (!viewBox) {
            // If viewBox doesn't exist, create one based on the SVG's current dimensions
            const width = svgElement.width.baseVal.value;
            const height = svgElement.height.baseVal.value;
            viewBox = `0 0 ${width} ${height}`;
            svgElement.setAttribute('viewBox', viewBox);
        }

        // Parse the viewBox values
        const [minX, minY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        // Calculate the aspect ratio
        const aspectRatio = vbWidth / vbHeight;
        // Calculate the width based on the fixed height and aspect ratio
        const width = fixedHeight * aspectRatio;

        // Set the SVG dimensions
        svgElement.style.width = `${width}px`;
        svgElement.style.height = `${fixedHeight}px`;
        // Ensure the viewBox covers the entire SVG area
        svgElement.setAttribute('viewBox', `${minX} ${minY} ${vbWidth} ${vbHeight}`);

        // Style the container
        container.style.width = '100%';  // Changed from fixed width to 100%
        container.style.height = `${fixedHeight}px`;
        container.style.overflow = 'hidden';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';

        // Style the SVG
        container.style.width = '100%';     // Ensure SVG doesn't overflow container
        container.style.height = '300px';   // Set a fixed height
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
    }

}

const localStorageHandlers = {
    getStoredDuration() {
        return localStorage.getItem('gameDuration');
    },

    setStoredDuration(duration) {
        localStorage.setItem('gameDuration', duration);
    },

    getStoredIncrement() {
        return localStorage.getItem('gameIncrement');
    },

    setStoredIncrement(increment) {
        localStorage.setItem('gameIncrement', increment);
    },

    selectStoredDurationButton() {
        const storedDuration = this.getStoredDuration();
        if (storedDuration) {
            const button = document.querySelector(`input[name="game-duration"][data-duration="${storedDuration}"]`);
            if (button) {
                button.checked = true;
                gameStatsObject.duration = parseInt(storedDuration);
                userPreferences.infoBoard.textContent = `${gameStatsObject.duration / 1000} seconds!`
            }
        } else {
            const button = document.querySelector(`input[name="game-duration"][data-duration="30000"]`);
            if (button) {
                button.checked = true;
                gameStatsObject.duration = 30000;
                userPreferences.infoBoard.textContent = `${gameStatsObject.duration / 1000} seconds!`
            }
        }
    },

    selectStoredIncrementButton() {
        const storedIncrement = this.getStoredIncrement();
        if (storedIncrement) {
            const button = document.querySelector(`input[name="game-addition"][data-increment="${storedIncrement}"]`);
            if (button) {
                button.checked = true;
                gameStatsObject.increment = parseInt(storedIncrement);
                if (gameStatsObject.increment !== 0){
                    userPreferences.incrementNoticeParent.innerHTML = repeatedValues.increment(gameStatsObject.increment);
                }
            }
        } else {
            const button = document.querySelector(`input[name="game-addition"][data-increment="0"]`);
            if (button) {
                button.checked = true;
                gameStatsObject.increment = 0;
                // userPreferences.incrementNoticeParent.innerHTML = repeatedValues.increment(0);
            }
        }
    }
};

const userPreferences = {
    durationInputs: document.querySelectorAll('input[name="game-duration"]'),
    incrementInputs: document.querySelectorAll('input[name="game-addition"]'),
    infoBoard: document.getElementById('info-duration'),
    incrementNoticeParent: document.getElementById('increment-notice-parent'),

    chooseDuration(){
        if (!gameStatsObject.gameStarted && !gameStatsObject.gameEnded){
            this.durationInputs.forEach(input => {
                input.addEventListener('change', () => {
                    if (input.checked) {
                        const duration = parseInt(input.dataset.duration);
                        // TODO: Implement API call to verify allowed duration
                        this.infoBoard.textContent = `${duration / 1000} seconds!`
                        gameStatsObject.duration = duration;
                        localStorageHandlers.setStoredDuration(duration);
                    }
                })
            })
        }
    },

    chooseIncrement(){
        if (!gameStatsObject.gameStarted && !gameStatsObject.gameEnded){
            this.incrementInputs.forEach(input => {
                input.addEventListener('change', () => {
                    if (input.checked) {
                        const increment = parseInt(input.dataset.increment);
                        gameStatsObject.increment = increment;
                        this.incrementNoticeParent.innerHTML = repeatedValues.increment(input.dataset.increment);
                        if (increment !== 0){
                            userPreferences.incrementNoticeParent.innerHTML = repeatedValues.increment(increment);
                        } else {
                            userPreferences.incrementNoticeParent.innerHTML = '';
                        }
                        localStorageHandlers.setStoredIncrement(increment);
                    }
                })
            })
        }
    },

    init() {
        this.infoBoard = document.getElementById('info-duration');
        this.durationInputs = document.querySelectorAll('input[name="game-duration"]');
        this.incrementInputs = document.querySelectorAll('input[name="game-addition"]');
        this.durationInputs = document.querySelectorAll('input[name="game-duration"]');
        this.incrementInputs = document.querySelectorAll('input[name="game-addition"]');
        this.incrementNoticeParent = document.getElementById('increment-notice-parent');

        localStorageHandlers.selectStoredDurationButton();
        localStorageHandlers.selectStoredIncrementButton();
        this.chooseDuration();
        this.chooseIncrement();
    }
}

const processSuggestions = {
    flagInput: document.getElementById("flag-input"),
    countryUl: document.getElementById("country-options"),
    get inputValue() {
        return this.flagInput.value.trim();
    },
    optionsHTML: '',
    currentOption: null,
    firstOption: null,
    lastOption: null,

    async populateOptions() {
        // THE ONLY input eventListener for our input
        this.flagInput.addEventListener('input', async () => {
            if (this.inputValue !== '') {
                try {
                    const response = await fetch('/autocomplete_country?q=' + this.inputValue);
                    const optionsData = await response.json();
                    optionsData.forEach((country, index) => {
                        const option = country.common.replace(/</g, '&lt;').replace(/&/g, '&amp;'); // filters dangerous chars out 
                        if (index === 0) {
                            this.optionsHTML += `<li id="selected-option" class="first-option list-group-item list-group-item-secondary bg-primary-subtle text-primary">${option}</li>`;
                        } else if (index === optionsData.length - 1) {
                            this.optionsHTML += `<li class="last-option list-group-item list-group-item-secondary">${option}</li>`;
                        } else {
                            this.optionsHTML += `<li class="list-group-item list-group-item-secondary">${option}</li>`;
                        }
                    })
                    this.countryUl.innerHTML = this.optionsHTML;
                    this.optionsHTML = '';
                } catch (error) {
                    console.log(`populateOptions encountered an error:\n${error}`);
                }
            } else {
                this.countryUl.innerHTML = repeatedValues.emptyInput;
            }
        })
    },

    moveOptions(event){
        this.currentOption = document.getElementById('selected-option')
        this.firstOption = document.querySelector('.first-option');
        this.lastOption = document.querySelector('.last-option')
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if(this.currentOption && this.currentOption != this.lastOption){
                const nextOption = this.currentOption.nextElementSibling;
                if(nextOption){
                    this.styleOptions(this.currentOption, nextOption);
                }
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if(this.currentOption && this.currentOption != this.firstOption){
                const prevousOption = this.currentOption.previousElementSibling;
                if(prevousOption){
                    this.styleOptions(this.currentOption, prevousOption);
                }
            }
        }
    },

    styleOptions(currentOption, newOption) {
        currentOption.removeAttribute('id');
        newOption.id = 'selected-option';
        newOption.classList.add(...['bg-primary-subtle', 'text-primary'])
        currentOption.classList.remove(...['bg-primary-subtle', 'text-primary'])
    },

    async init (){
        this.flagInput = document.getElementById("flag-input");
        this.countryUl = document.getElementById("country-options");
        await this.populateOptions();
    }
}

async function checkAnswer(userAnswer) {
    const response = await fetch('/check_country_ans', {
        method: 'post',
        headers: {
            'Content-Type' : 'application/json'
        },
        body: JSON.stringify({
            'userAnswer': userAnswer
        })
    })
    const data = await response.json();
    return data;
}

const gameInitialiser = {
    // present at all times
    flagInput: document.getElementById("flag-input"),
    get flagInputValue() {
        return this.flagInput.value.trim().toLowerCase();
    },
    selectedOption: document.getElementById('selected-option'),
    allOptions: document.getElementById('country-options'),
    feedBackParent: document.getElementById('feedback-parent'),
    infoBoard: document.getElementById('info-board'),
    // present only when game is ongoing
    progressBar: document.querySelector('.progress-bar'),
    infoHeader: document.getElementById('info-header'), // mainly used for displaying time left
    scoreDisplay: document.getElementById('score'),
    attemptsDisplay: document.getElementById('attempts'),
    timerInterval: null,

    autofillSelectedOption(event) {
        if (event) {
            event.preventDefault();
            if (this.flagInput.value.trim() !== "") {
                this.selectedOption = document.getElementById('selected-option'); // QUESTION why is this necessary?
                if (this.selectedOption) {
                    this.flagInput.value = this.selectedOption.textContent;
                    // this.flagInput.dispatchEvent(new KeyboardEvent('keydown', {key: event.key, bubbles: true, cancelable: true}));       // the new KeyboardEvent above causes unlimited recursion  

                    // this.flagInput.dispatchEvent(new Event('input', { bubbles: true }));                                                 //<- BREAKTHROUGH this was the cause of all the problems with the second flag!
                } 
            } else {
                this.midGameReset(event);
            }
        }
    },

    midGameReset(event) {
        if (event) {
            event.preventDefault();
            // this.flagInput.dispatchEvent(new KeyboardEvent('keydown', {key: event.key, bubbles: true, cancelable: true}));
            // the new KeyboardEvent above causes unlimited recursion
        }
        this.flagInput.value = '';
        this.allOptions.innerHTML = repeatedValues.emptyInput;
        this.flagInput.dispatchEvent(new Event('input', { bubbles: true }));
    },

    formatInfoBoard() {
        this.infoBoard = document.getElementById('info-board');
        this.infoBoard.innerHTML = repeatedValues.gameScoreBoard;
    },

    updateTimer(){
        if (gameStatsObject.gameEnded) {
            console.log('Game has ended, stopping timer updates');
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            return;
        }

        gameStatsObject.timeLeft = Math.max(0, gameStatsObject.endTime - Date.now())
        if (gameStatsObject.timeLeft === 0) {
            this.endGame();
        } else {
            this.updateTimerDisplay(gameStatsObject.displayedTimeLeft);
        }
    },

    updateTimerDisplay(numberDisplayed) {
        this.infoHeader = document.getElementById('info-header');
        this.infoHeader.textContent = numberDisplayed;
        this.progressBar.style.width = `${(gameStatsObject.timeLeft / gameStatsObject.duration) * 100}%`;
    },

    endGame() {
        clearInterval(this.timerInterval);
        gameStatsObject.startTime = 0;
        gameStatsObject.endTime = 0;
        gameStatsObject.gameEnded = true;
        this.updateTimerDisplay("Game Over");

        roundData.score = gameStatsObject.score;
        roundData.attempts = gameStatsObject.attempts;
        roundData.showPerformance();
    },

    async startGame() {
        console.log('ending game...');
        // Clear any existing interval
        if (this.timerInterval) {
            console.log('Clearing timer interval');
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        // initialise gameStats variables
        gameStatsObject.gameStarted = true;
        gameStatsObject.gameEnded = false;
        gameStatsObject.score = 0;
        gameStatsObject.attempts = 0;

        this.formatInfoBoard();

        // Starts timer
        this.progressBar.style.width='100%';
        gameStatsObject.startTime = Date.now();
        gameStatsObject.endTime = Date.now() + gameStatsObject.duration;
        this.updateTimer();
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 100);

        // loadFlagSvg is called last as it uses gameStarted and gameEnded
        await svgMethods.loadFlagSvg();
    },

    showFeedback(validity, correctAns){
        if (validity) {
            this.feedBackParent.innerHTML = repeatedValues.rightAnsFeedback;
        } else {
            this.feedBackParent.innerHTML = repeatedValues.wrongAnsFeedback(correctAns);
        }
        setTimeout(() => {
            this.feedBackParent.innerHTML = ``;
        }, 400);
    },

    updateScoreDisplay() {
        this.scoreDisplay = document.getElementById('score');
        this.attemptsDisplay = document.getElementById('attempts');             
        if (this.scoreDisplay) this.scoreDisplay.textContent = gameStatsObject.score;
        if (this.attemptsDisplay) this.attemptsDisplay.textContent = gameStatsObject.attempts;
    },

    processIllegalChars(event) {
        // blocks illegal characters and checks if the key is not a control key (like Backspace, Arrow keys, etc.)
        if (event) {
            event.preventDefault();
        }
        this.flagInput.classList.add("bg-danger-subtle", "border-danger");
        const illegalCharTimeout = setTimeout(() => {
            this.flagInput.classList.remove("bg-danger-subtle", "border-danger");
        }, 100);
    },

    nextQuestionReset() {
        this.flagInput.style.caretColor = 'transparent';
    },

    async inputKeydownListener() {
        this.flagInput.addEventListener('keydown', async (event) => {
        //  THE ONLY keydown event lisener for our input
            if (event.key === 'Enter') {
                this.nextQuestionReset();
                this.autofillSelectedOption(event);

                if(!gameStatsObject.gameStarted && !gameStatsObject.gameEnded) {
            // GAME HASN'T STARTED YET
                    if(this.flagInputValue === gameStatsObject.currentCountry.common.toLowerCase() || this.flagInputValue === gameStatsObject.currentCountry.official.toLowerCase()){
                // START GAME  
                        this.showFeedback(true);
                        console.log('Game is starting!');
                        await this.startGame();
                    } else {
                        this.showFeedback(false, gameStatsObject.currentCountry.common);
                        console.log(`First ans: ${this.flagInputValue} is wrong.`);
                    }
                } else if (gameStatsObject.gameStarted && !gameStatsObject.gameEnded) {
            // GAME IS ONGOING
                    const ansData = await checkAnswer(this.flagInputValue);
                    if(ansData.answer){
                        console.log('Answer is correct!')
                        gameStatsObject.score++;
                        gameStatsObject.endTime += gameStatsObject.increment;
                        this.showFeedback(ansData.answer);
                    } else {
                        console.log('Answer is incorrect!')
                        this.showFeedback(ansData.answer, ansData.correctAnswer);
                    }
            // REGARDLESS OF VALIDITY
                    gameStatsObject.attempts++;
                    this.updateScoreDisplay();

                    // RECORD FLAG AND ANSWER
                    roundData.updateHistory(ansData.correctAnswer, this.flagInputValue, ansData.answer);

                    await svgMethods.loadFlagSvg();
                }
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                processSuggestions.moveOptions(event);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                this.flagInput.style.caretColor = 'auto';
            } else if (event.key.length === 1 && !/^[a-zA-Z\s-]$/.test(event.key)) {
                this.processIllegalChars(event);
            }
        })
    },

    async init() {
        // I don't know why the following initilisations are necessary but oh well it works now
        this.flagInput = document.getElementById("flag-input");
        this.allOptions = document.getElementById('country-options');
        this.feedBackParent = document.getElementById('feedback-parent');
        this.infoHeader = document.getElementById('info-header');
        this.scoreDisplay = document.getElementById('score');
        this.attemptsDisplay = document.getElementById('attempts');
        this.progressBar = document.querySelector('.progress-bar');

        
        if (!this.flagInput || !this.allOptions || !this.feedBackParent) {
            console.error('Required DOM elements not found');
            return false;
        }
        
        await this.inputKeydownListener();
        return true;
    }
}

// do this before dom is loaded to prevent flickering upon reload
try {
    userPreferences.init();
} catch (error) {
    console.log(`userPreferences failed to load. Here's the error:\n${error}`)
}

// do these after dom is loaded to make sure necessary elements are present
document.addEventListener('DOMContentLoaded', async () => {
    if (await gameInitialiser.init()){
        try {
            await svgMethods.loadFlagSvg();
            await processSuggestions.init();
        } catch(error) {
            console.log(`DOMContentLoaded failed to initiialise javascript:\n${error}`)
        }
    } else {
        return console.log("Failed to initialize game. Some elements might be missing")
    }
});

    
