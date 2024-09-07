/*
    Goals:
    Polish up whatever game.js does but make the programme style more object oriented than functional
    make the +5s functional
    Later
    add difficulty modes,     Don't repeat flags,      

*/


const gameState = {
    duration: 30000,
    increment: 0,
    endTime: 0,
    currentCountry: {}
};

const elements = {
    input: document.getElementById('flag-input'),
    optionsList: document.getElementById('country-options'),
    selectedOption: document.getElementById('selected-option')
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


const apiCalls = {
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
        // data = { 'svg': random_country['svg_code'], 'common': random_country['common'], 'official': random_country['official'] }
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
        // data = {'svg': random_country['svg_code']}
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
        /* 
            if game hasn't started :  jsonify({'error': 'No active game session'}), 400
            otherwise              :  jsonify({'answer': is_correct, 'correctAnswer': correct_answers['common']}) # answer is a bool
        */            
    }
};


const gameFunctions = {
    autoComplete() {
        const inputValue = elements.input.value.trim()
        if (inputValue !== '') {
            if (elements.selectedOption) {
                elements.input.value = elements.selectedOption.textContent;
                elements.input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                console.log("gameFunctions.autoComplete could not find selectedOption");
            }
        } else {
            console.log("gameFunctions.autoComplete detected empty input");
            this.resetAll();
        }
    },

    async firstCheck() {
        if (!gameState.currentCountry) {
            console.log("gameFunctions.firstCheck thinks currentCountry is empty");
            return;
        }

        const inputValue = elements.input.value.trim();
        if (inputValue === gameState.currentCountry.common.toLowerCase() || inputValue === gameState.currentCountry.official.toLowerCase()) {
            console.log("gameFunctions.firstCheck detected first answer is right and game is starting soon");
            await startGame();
        }
    },

    subsequentCheck() {

    },

    startGame() {
        console.log("gameFunctions.startGame is starting the game");
        gameState.endTime = Date.now() + gameState.duration;
        this.feedback(right);
    },

    resetAll() {

    },

    feedback(right){
        // same as flashthumb + shows prev correct ans
    }
}


// if user presses any damn key (regardless of whether input has been selected) the input gets selected
// first document event listener
document.addEventListener('keydown', (event) => {
    const currentKey = event.key

    if (/^[a-zA-Z\s-]$/.test(currentKey) || currentKey === 'ArrowUp' || currentKey === 'ArrowDown' || currentKey === 'ArrowRight' || currentKey === 'ArrowLeft' || currentKey === 'Enter') {
        if (document.activeElement !== elements.input){
            elements.input.focus();
            elements.input.value = currentKey;
            event.preventDefault();
            elements.input.dispatchEvent(new KeyboardEvent('keydown', {
                key: currentKey, 
                bubbles: true, 
                cancelable: true
            }));
            elements.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
})

// INPUT SHOULD ONLY HAVE ONE KEYDOWN (happens first) AND ONE INPUT EVENT LISTENER
elements.input.addEventListener('keydown', async (event) => {
    // catch & remove wrong chars
    const latestChar = event.key;

    if (latestChar === 'ArrowRight' || latestChar === 'ArrowLeft') {
        elements.input.style.caretColor = 'auto';   // changed back to transparent upon 'Enter'

    } else if (latestChar === 'ArrowDown'){         // removed arrow right and left to support caret movement
        // select the option below

    } else if (latestChar === 'ArrowUp') {
        // select the option above
        
    } else if (latestChar === 'Enter') {
        event.preventDefault();
        // Autocomplete -> Start Game / Submit Ans
        gameFunctions.autoComplete();

        if (!endTime) {
            // game hasn't started
            await gameFunctions.firstCheck();
        } else {
            // game has begun
            gameFunctions.subsequentCheck();
        }

        elements.input.style.caretColor = 'transparent';
    } else if (!/^[a-zA-Z\s-]$/.test(latestChar) && latestChar !== '') {
        event.preventDefault();
        clearTimeout(removeInvalidFeedbackTimeout);     // to remove any existing timeout
        elements.input.classList.add("is-invalid");
        removeInvalidFeedbackTimeout = setTimeout(() => {
            elements.input.classList.remove("is-invalid");
        }, 200);
    } else {
        elements.input.classList.remove("is-invalid");
        clearTimeout(removeInvalidFeedbackTimeout);
    }
})

elements.input.addEventListener('input', async (event) => {
    // Only needed to present options
    const inputVal = elements.input.value.trim();
    if (inputVal !== '') {
        try {
            const response = await fetch(`autocomplete_country?q=${encodeURIComponent(inputVal)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);  // immediately stops normal execution and looks for a catch block to throw the error at.
            } // boolean property of the Response object. true if the HTTP status code is in the successful range (200-299), and false otherwise.

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
            })
            elements.optionsList.innerHTML = optionsHtml;
        } catch(error) {
            console.error('Error fetching autocomplete data:', error);
        }
    } else {
        elements.optionsList.innerHTML = repeatedValues.defaultOptionsList;
    }
})

// LEFT AT UNDERSTANDING THE BEHAVIOUR OF OBJECT PROPERTIES SINCE WERE STORING OUR VALUES and Inputs THERE INSTEAD OF IN VARIABLES DEFINED BY LET CONST OR VAR.
// LOTS OF THINGS LEFT INTEND TO WORK ON AUTOCOMPLETE / START GAME BY DETECTING WHERTHER GAME HAS STARTED WITH ENDTIME FIRST.

// LEFT AT WRITING START GAME, NEED TO IMPLEMENT ASPECTS OF EXPERIMENT INTO IT SO THAT + TIME CAN BE ADDED AND IT MAKES MORE SENSE
// LOTS OF THINGS LIKE SVG LOADING ARE LEFT UNDONE TO BE DONE LATER, MANY UNDERSTANDING BUTS ARE ALSO TO BE DONE.