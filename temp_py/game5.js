const gameStats = {
    duration: 30000,
    increment: 0,
    endTime: 0,
    timeLeft: 0,
    currentCountry: {},
    timerInterval: null,
    score: 0,
    attempts: 0
};

const mainElements = {
    input: document.getElementById('flag-input'),
    optionsList: document.getElementById('country-options'),
    selectedOption: document.getElementById('selected-option'),
    feedbackParent: document.getElementById('feedback-parent'),
    infoBoard: document.getElementById('info-board'),
    svgContainer: document.getElementById('flag-svg'),
    durationInputs: document.querySelectorAll('input[name="game-duration"]'),
    incrementInputs: document.querySelectorAll('input[name="game-addition"]'),
    initialDurationDisplay: document.getElementById('info-duration')
};

const repeatedValues = {
    defaultOptionsList: `
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
}

const svgFunctions = {
    styleSvg(container){
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
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');

        const fixedHeight = 300;

        let viewBox = svgElement.getAttribute('viewBox');
        if (!viewBox) {
            const width = svgElement.width.baseVal.value;
            const height = svgElement.height.baseVal.value;
            viewBox = `0 0 ${width} ${height}`;
            svgElement.setAttribute('viewBox', viewBox);
        }

        const [minX, minY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        const aspectRatio = vbWidth / vbHeight;
        const width = fixedHeight * aspectRatio;

        svgElement.style.width = `${width}px`;
        svgElement.style.height = `${fixedHeight}px`;
        svgElement.setAttribute('viewBox', `${minX} ${minY} ${vbWidth} ${vbHeight}`);

        container.style.width = '100%';
        container.style.height = `${fixedHeight}px`;
        container.style.overflow = 'hidden';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';

        container.style.width = '100%';
        container.style.height = '300px';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
    }
}

const apiCallFunctions = {
    async getFirstSvg() {
        const response = await fetch('/fetch_first_svg', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        const data = await response.json();
        return data
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

    async checkAnswer(userAnswer) {
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
};

const gameFunc = {
    autoComplete() {
        const inputValue = mainElements.input.value.trim();
        if (inputValue !== '') {
            if (mainElements.selectedOption) {
                mainElements.input.value = mainElements.selectedOption.textContent;
                mainElements.input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                console.log("gameFunc.autoComplete could not find selectedOption");
            }
        } else {
            console.log("gameFunc.autoComplete detected empty input");
            this.resetAll();
        }
    },

    async firstCheck() {
        if (!gameStats.currentCountry) {
            return console.log("gameFunc.firstCheck thinks currentCountry is empty");
        }

        const inputValue = mainElements.input.value.trim().toLowerCase();
        if (inputValue === gameStats.currentCountry.common.toLowerCase() || inputValue === gameStats.currentCountry.official.toLowerCase()) {
            this.feedback(true);
            console.log("gameFunc.firstCheck detected first answer is right and game is starting soon");
            await this.startGame();
        }
    },

    async subsequentCheck() {
        const inputValue = mainElements.input.value.trim();
        const checkAnsData = await apiCallFunctions.checkAnswer(inputValue);
        if (checkAnsData.error) {
            return console.log(`gameFunc.subsequentCheck encountered an error: ${checkAnsData.error}`);
        }
        if (checkAnsData.answer) {
            this.feedback(true);
            gameStats.score++;
            gameStats.endTime += gameStats.increment;
        } else {
            this.feedback(false, checkAnsData.correctAnswer);
        }
        gameStats.attempts++;
        this.updateDisplay();
        await this.nextFlag();
    },

    async startGame() {
        console.log("gameFunc.startGame is starting the game now");
        gameStats.endTime = Date.now() + gameStats.duration;
        this.updateTimer();
        gameStats.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 100);
        await this.nextFlag();
    },

    updateTimer() {
        gameStats.timeLeft = Math.max(0, gameStats.endTime - Date.now());
        if (gameStats.timeLeft === 0) {
            this.endGame();
        } else {
            this.updateDisplay();
        }
    },  

    updateDisplay() {
        mainElements.infoBoard.innerHTML = `
            <div class="row justify-content-center my-0 align-items-center">
                <div class="col-12">
                    <div id="info-header" class="display-4 mb-0 fw-semibold fst-italic font-monospace">${(gameStats.timeLeft / 1000).toFixed(2)}</div>
                    <div class="row justify-content-center">
                        <span class="col-6 fs-4 mb-0">Attempts: <span id="attempts" class="font-monospace">${gameStats.attempts}</span></span>
                        <span class="col-6 fs-4 mb-0">Score: <span id="score" class="font-monospace">${gameStats.score}</span></span>    
                    </div>
                    <p class="fs-6 fw-light m-0">press 'Enter' to submit / skip, reload page to restart</p>    
                </div>
            </div>
        `;
    },

    async nextFlag() {
        if (!mainElements.svgContainer) {
            return console.log("gameFunc.nextFlag couldn't find svgContainer");
        }

        try {
            const svgData = await apiCallFunctions.getRandomSvg();
            mainElements.svgContainer.innerHTML = svgData.svg;
            mainElements.input.placeholder = "your answer";    
            mainElements.input.value = "";
        } catch (error) {
            return console.log("gameFunc.nextFlag encountered an error: " + error);
        }
        return svgFunctions.styleSvg(mainElements.svgContainer);
    },

    async firstFlag() {
        if (!mainElements.svgContainer) {
            return console.log("gameFunc.firstFlag couldn't find svgContainer");
        }
        try {
            let svgData = await apiCallFunctions.getFirstSvg();
            gameStats.currentCountry = {
                'common': svgData.common,
                'official': svgData.official
            };
            mainElements.svgContainer.innerHTML = svgData.svg;
            mainElements.input.placeholder = svgData.common;    
        } catch (error) {
            return console.log("gameFunc.firstFlag encountered an error: " + error);
        }
        return svgFunctions.styleSvg(mainElements.svgContainer);
    },

    endGame() {
        clearInterval(gameStats.timerInterval);
        gameStats.endTime = 0;
        mainElements.infoBoard.innerHTML = `
            <div class="justify-content-center align-items-center">
                <p class="my-0 display-5 font-monospace">
                    Game Over
                </p>
                <p class="my-0 fs-4">
                    You scored <span class="font-monospace">${gameStats.score}</span> flags in <span class="font-monospace">${gameStats.attempts}</span> attempts
                </p>
                <div class="d-flex justify-content-center align-items-center">   
                    <button id="restart-game" class="btn btn-primary-subtle my-0 mx-1">
                        <i class="bi bi-arrow-repeat me-2"></i>Restart
                    </button>
                    <p class="fs-6 text-muted my-auto">alternatively, press Enter to restart</p>    
                </div>
            </div>
        `;
        this.resetAll();
    },

    resetNumbers() {
        gameStats.endTime = 0;
        gameStats.timeLeft = 0;
        gameStats.currentCountry = {};
        gameStats.timerInterval = null;
        gameStats.score = 0;
        gameStats.attempts = 0;   
    },

    resetVisuals() {
        mainElements.optionsList.innerHTML = repeatedValues.defaultOptionsList;
        mainElements.input.value = "";
        mainElements.feedbackParent.innerHTML = "";
    },

    resetAll() {
        this.resetNumbers();
        this.resetVisuals();
    },

    feedback(right, correctAns) {
        if (!mainElements.feedbackParent) {
            return console.log("in gameFunc.feedback() feedbackParent couldn't be found");
        }

        if (right) {
            mainElements.feedbackParent.innerHTML = `
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" height="160px" width="160px" viewBox="0 -960 960 960" fill="#198754"><path d="M716-120H272v-512l278-288 39 31q6 5 9 14t3 22v10l-45 211h299q24 0 42 18t18 42v81.84q0 7.16 1.5 14.66T915-461L789-171q-8.88 21.25-29.59 36.12Q738.69-120 716-120Zm-384-60h397l126-299v-93H482l53-249-203 214v427Zm0-427v427-427Zm-60-25v60H139v392h133v60H79v-512h193Z"/></svg>
                </div>
            `;
        } else {
            mainElements.feedbackParent.innerHTML = `
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" height="160px" width="160px" viewBox="0 -960 960 960" fill="#dc3545"><path d="M242-840h444v512L408-40l-39-31q-6-5-9-14t-3-22v-10l45-211H103q-24 0-42-18t-18-42v-81.84q0-7.16-1.5-14.66T43-499l126-290q8.88-21.25 29.59-36.13Q219.31-840 242-840Zm384 60H229L103-481v93h373l-53 249 203-214v-427Zm0 427v-427 427Zm60 25v-60h133v-392H686v-60h193v512H686Z"/></svg>
                    <p class="fs-3 my-0 text-center">${correctAns}</p>
                </div>
            `;
        }
        setTimeout(() => {
            mainElements.feedbackParent.innerHTML = '';
        }, 400);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await gameFunc.firstFlag();

    document.addEventListener('keydown', (event) => {
        const currentKey = event.key;
    
        if (/^[a-zA-Z\s-]$/.test(currentKey) || ['ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'Enter'].includes(currentKey)) {
            if (document.activeElement !== mainElements.input) {
                mainElements.input.focus();
                mainElements.input.value = currentKey;
                event.preventDefault();
                mainElements.input.dispatchEvent(new KeyboardEvent('keydown', {
                    key: currentKey, 
                    bubbles: true, 
                    cancelable: true
                }));
                mainElements.input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });

    
    
    let removeInvalidFeedbackTimeout;
    mainElements.input.addEventListener('keydown', async (event) => {
        const latestChar = event.key;
    
        if (latestChar === 'ArrowRight' || latestChar === 'ArrowLeft') {
            mainElements.input.style.caretColor = 'auto';
        } else if (latestChar === 'ArrowDown' || latestChar === 'ArrowUp') {
            // TODO: Implement option selection
        } else if (latestChar === 'Enter') {
            event.preventDefault();
            await gameFunc.autoComplete();
    
            if (!gameStats.endTime) {
                await gameFunc.firstCheck();
            } else {
                await gameFunc.subsequentCheck();
            }
    
            mainElements.input.style.caretColor = 'transparent';
        } else if (!/^[a-zA-Z\s-]$/.test(latestChar) && latestChar !== '') {
            event.preventDefault();
            clearTimeout(removeInvalidFeedbackTimeout);
            mainElements.input.classList.add("is-invalid");
            removeInvalidFeedbackTimeout = setTimeout(() => {
                mainElements.input.classList.remove("is-invalid");
            }, 200);
        } else {
            mainElements.input.classList.remove("is-invalid");
            clearTimeout(removeInvalidFeedbackTimeout);
        }
    });
    
    mainElements.input.addEventListener('input', async (event) => {
        const inputVal = mainElements.input.value.trim();
        if (inputVal !== '') {
            try {
                const response = await fetch(`autocomplete_country?q=${encodeURIComponent(inputVal)}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
    
                const allOptionsData = await response.json();
    
                let optionsHtml = '';
                allOptionsData.forEach((country, index) => {
                    const option = country.common.replace(/</g, '&lt;').replace(/&/g, '&amp;');
                    if (index === 0) {
                        optionsHtml += `<li id="selected-option" class="first-option list-group-item list-group-item-secondary bg-primary bg-opacity-75 text-light">${option}</li>`;
                    } else if (index === allOptionsData.length - 1) {
                        optionsHtml += `<li class="last-option list-group-item list-group-item-secondary">${option}</li>`;
                    } else {
                        optionsHtml += `<li class="list-group-item list-group-item-secondary">${option}</li>`;
                    }
                });
                mainElements.optionsList.innerHTML = optionsHtml;
            } catch(error) {
                console.error('Error fetching autocomplete data:', error);
            }
        } else {
            mainElements.optionsList.innerHTML = repeatedValues.defaultOptionsList;
        }
    });
    
    chooseDuration();
    chooseIncrement();
});

function chooseDuration() {
    if (!gameStats.endTime) {
        mainElements.durationInputs.forEach(input => {
            input.addEventListener('change', function() {
                if (this.checked) {
                    const duration = parseInt(this.dataset.duration);
                    mainElements.initialDurationDisplay.textContent = `${duration} seconds!`;
                    gameStats.duration = duration * 1000; // Convert to milliseconds
                }
            });
        });
    }
}

function chooseIncrement() {
    if (!gameStats.endTime) {
        mainElements.incrementInputs.forEach(input => {
            input.addEventListener('change', function() {
                if (this.checked) {
                    const increment = parseInt(this.dataset.increment);
                    gameStats.increment = increment * 1000; // Convert to milliseconds
                }
            });
        });
    }
}

