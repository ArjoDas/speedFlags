const gameState = {
    currentCountry: {},
    gameStarted: false,
    gameEnded: false,
    gameDuration: 30,
    gameIncrement: 1,
    timeLeft: 30,
    score: 0,
    attempts: 0,
    startTime: 0,
    elapsedTime: 0
}

const elements = {
    flagSvg: document.getElementById('flag-svg'),
    flagInput: document.getElementById('flag-input'),
    countryOptions: document.getElementById('country-options'),
    infoBoard: document.getElementById('info-board'),
    progressBar: document.querySelector('.progress-bar'),
    thumbsUp: document.getElementById('thumbs-up'),
    thumbsDown: document.getElementById('thumbs-down'),
    durationInputs: document.querySelectorAll('input[name="game-duration"]'),
    infoDuration: document.getElementById('info-duration'),
    selectedOption: document.getElementById('selected-option')
}

const apiCalls = {
    async getFirstSvg() {
        try {
            const response = await fetch('/fetch_first_svg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            console.log('getFirstSvg got called, response: ', response);
            return await response.json();
        } catch (error) {
            console.error('Error fetching first SVG:', error);
            throw error;
        }
    },

    async getRandomSvg() {
        try {
            const response = await fetch('/fetch_random_svg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            console.log('getRandomSvg got called, response: ', response);
            return await response.json();
        } catch (error) {
            console.error('Error fetching random SVG:', error);
            throw error;
        }
    },

    async checkAnswer(userAnswer) {
        try {
            const response = await fetch('/check_country_ans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAnswer })
            });
            console.log('checkAnswer got called, response: ', response);
            return await response.json();
        } catch (error) {
            console.error('Error checking answer:', error);
            throw error;
        }
    },

    async autocompleteCountry(query) {
        try {
            const response = await fetch(`/autocomplete_country?q=${encodeURIComponent(query)}`);
            console.log('autocompleteCountry got called, response: ', response);
            return await response.json();
        } catch (error) {
            console.error('Error fetching autocomplete data:', error);
            throw error;
        }
    }
};

const gameFunctions ={
    async loadFlagSvg(){
        try {
            let svgData;
            if(!gameState.gameStarted && gameState.gameEnded === false){
                svgData = await apiCalls.getRandomSvg();
                gameState.currentCountry = {
                    common: svgData.common,
                    official: svgData.official
                };
                elements.flagInput.placeholder = svgData.common;
            }else{
                svgData = await apiCalls.getFirstSvg();
                elements.flagInput.placeholder = "your answer";
            }
            elements.flagSvg.innerHTML = svgData.svg;
            this.styleSvg();
        } catch (error){
            console.error('Error in loadFlagSvg: ', error);
        }
    },

    styleSvg() {
        const svgElement = elements.flagSvg.querySelector('svg');
        if (svgElement) {
            if (!svgElement.getAttribute('viewBox')) {
                const width = svgElement.getAttribute('width') || svgElement.getBoundingClientRect().width;
                const height = svgElement.getAttribute('height') || svgElement.getBoundingClientRect().height;
                svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
            this.setSvgDimensions(svgElement);
        }
    },

    setSvgDimensions(svgElement) {
        const fixedHeight = 300;
        const viewBox = svgElement.getAttribute('viewBox');
        const [minX, minY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        const aspectRatio = vbWidth / vbHeight;
        const width = fixedHeight * aspectRatio;

        svgElement.style.width = `${width}px`;
        svgElement.style.height = `${fixedHeight}px`;
        svgElement.setAttribute('viewBox', `${minX} ${minY} ${vbWidth} ${vbHeight}`);

        elements.flagSvg.style.width = '100%';
        elements.flagSvg.style.height = `${fixedHeight}px`;
        elements.flagSvg.style.display = 'flex';
        elements.flagSvg.style.justifyContent = 'center';
        elements.flagSvg.style.alignItems = 'center';
    },

    async startGame(){
        gameState.gameStarted = true;
        gameState.gameEnded = false;
        this.formatInfoBoard();
        this.startTimer(gameState.gameDuration);
        this.formatInfoBoard();
    },

    formatInfoBoard() {
        elements.infoBoard.innerHTML = `
            <div class="row justify-content-center my-0 align-items-center">
                <div class="col-4 d-flex justify-content-end align-items-center">
                    <div id="thumbs-down" class="d-none">
                        <!-- SVG for thumbs down -->
                    </div>
                </div>
                <div class="col-4">
                    <div id="info-header" class="display-4 mb-0 fw-semibold fst-italic font-monospace">${gameState.timeLeft}</div>
                    <div class="row justify-content-center">
                        <span class="col-6 fs-4 mb-0">Attempts: <span id="attempts" class="font-monospace">${gameState.attempts}</span></span>
                        <span class="col-6 fs-4 mb-0">Score: <span id="score" class="font-monospace">${gameState.score}</span></span>    
                    </div>
                    <p class="fs-6 fw-light m-0">press shift to skip | refresh page to restart</p>    
                </div>
                <div class="col-4 d-flex justify-content-start align-items-center">
                    <div id="thumbs-up" class="d-none">
                        <!-- SVG for thumbs up -->
                    </div>
                </div>
            </div>
        `;
    },

    startTimer(duration){
        progressBar.style.width='100%';
        gameState.startTime = Date.now();
        
        const gameTimer = setInterval(() => {
            gameState.elapsedTime = (Date.now() - gameState.startTime) / 1000;
            gameState.timeLeft = Math.max(duration - gameState.elapsedTime, 0);
            if(gameState.timeLeft > 0){
                elements.infoHeader.textContent = Math.trunc(gameState.timeLeft);
                elements.progressBar.style.width = `${(gameState.timeLeft / duration) * 100}%`;
            }else{
                clearInterval(gameTimer);
                this.endGame();
            }
        }, 250)
    },

    endGame(){
        gameState.gameEnded = true;
        elements.infoHeader.classList.remove('font-monospace');
        elements.infoHeader.textContent = "Time's up!";
        elements.flagSvg.innerHTML = '';
        elements.flagInput.value = '';
        elements.countryOptions.innerHTML = '';
    },

    resetAll(){
        elements.flagInput.value = '';
        elements.countryOptions.innerHTML = `
                        <li class="first-option list-group-item list-group-item-secondary placeholder-glow border-primary-subtle">
                            <span class="placeholder col-7"></span>
                        </li>
                        <li class="list-group-item list-group-item-secondary placeholder-glow">
                            <span class="placeholder col-5"></span>
                        </li>
                        <li class="list-group-item list-group-item-secondary placeholder-glow">
                            <span class="placeholder col-4"></span>
                        </li>
                        <li class="list-group-item list-group-item-secondary placeholder-glow">
                            <span class="placeholder col-6"></span>
                        </li>
                        <li class="last-option list-group-item list-group-item-secondary placeholder-glow">
                            <span class="placeholder col-5"></span>
                        </li>
        `
        elements.flagInput.dispatchEvent(new Event('input', { bubbles: true }));        
    },

    chooseDuration(){
        if (!gameState.gameStarted && !gameState.gameEnded){
            elements.durationInputs.forEach(input => {
                input.addEventListener('change', function(){
                    if (this.checked) {
                        const duration = parseInt(this.dataset.duration);
                        // console.log(`Selected duration: ${duration} seconds`);
                        // Implement api call to check whether duration is allowed
                        elements.infoDuration.textContent = `${duration} seconds!`
                        gameState.gameDuration = duration;
                    }
                })
            })
        }
    },

    chooseIncrement(){
        if (!gameState.gameStarted && !gameState.gameEnded){
            elements.incrementInputs.forEach(input => {
                input.addEventListener('change', function(){
                    if (this.checked) {
                        gameState.gameIncrement = parseInt(this.dataset.increment);
                    }
                })
            })
        }
    },
    
    selectSelectedOption(selectedOption){
        let userAnswer;
        if (selectedOption){
            elements.flagInput.value = selectedOption.textContent;
            elements.flagInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            console.log('No option selected');
        }
        userAnswer = elements.flagInput.value;
        this.checkAnswer(userAnswer);
    },

    async checkAnswer(userAns){
        // to start game
        if (!gameState.gameStarted && !gameState.gameEnded){
            const result = (userAns === gameState.currentCountry.common || userAns === gameState.currentCountry.official);
            if (result){
                this.flashThumb(true);
                await this.startGame();
                this.resetAll();
                return;
            } else {
                this.flashThumb(false);
                this.resetAll();
                // return;
            }
        // to check subsequent answers  
        } else if (gameState.gameStarted && !gameState.gameEnded){
            const result = apiCalls.checkAnswer(userAns);
            if (result.isCorrect){
                this.flashThumb(true);
                gameState.score += gameState.gameIncrement;
                gameState.attempts++;
                this.resetAll();
                await this.loadFlagSvg();
                return
            } else {
                this.flashThumb(false);
                gameState.attempts++;
                this.resetAll();
                await this.loadFlagSvg();
                return;
            }
        }
    },

    flashThumb(right){
        if (right){
            elements.thumbsUp.classList.remove('d-none');
            setTimeout(() => {
                elements.thumbsUp.classList.add('d-none');
            }, 300);                
        } else{
            elements.thumbsDown.classList.remove('d-none');
            setTimeout(() => {
                elements.thumbsDown.classList.add('d-none');
            }, 300);  
        }
    },

    gameEventListener(){
        document.addEventListener('keydown', async(event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (document.activeElement !== elements.flagInput) {
                    elements.flagInput.focus();
                    return
                }    
                await this.checkAnswer(elements.flagInput.value);
                return;
            }
        })
    }

}

// document.addEventListener('DOMContentLoaded', () => {
//     gameFunctions.loadFlagSvg();
//     gameFunctions.gameEventListener();
// })

// document.addEventListener('DOMContentLoaded', async () => {
//     await gameFunctions.loadFlagSvg();
//     gameFunctions.gameEventListener();
//     gameFunctions.chooseDuration();
//     gameFunctions.chooseIncrement();
//     apiCalls.autocompleteCountry(elements.flagInput.value);
// });

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await gameFunctions.loadFlagSvg();
        gameFunctions.gameEventListener();
        gameFunctions.chooseDuration();
        gameFunctions.chooseIncrement();
        // Add other necessary initializations here
        elements.flagInput.addEventListener('input', () => apiCalls.autocompleteCountry(elements.flagInput.value));
        // Set up other event listeners as needed
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

