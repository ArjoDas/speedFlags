let current_country = {};
let game_started = false;
let game_ended = false;
let GAME_DURATION = 30;
let GAME_INCREMENT = 0;
let timeLeft = 30;

    //
    async function getFirstSvg() {
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
    }
    // 
    async function getRandomSvg() {
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
    }
    // 
    async function loadFlagSvg() {
        // """Loads flag and defines current_country depending on game state"""  
        try {
            // """Places a flag svg into svg container and current_country into placeholder if game_started"""
            const svgContainer = document.getElementById('flag-svg');
            const flagInput = document.getElementById('flag-input');
            if (!svgContainer || !flagInput) {
                console.error('Required DOM elements not found');
                return;
            }

            if (!game_started && !game_ended){
                let svgData = await getFirstSvg();
                current_country = {
                    'common': svgData.common,
                    'official': svgData.official
                }
                svgContainer.innerHTML = svgData.svg;
                flagInput.placeholder = svgData.common;
            } else if (game_started && !game_ended){
                const svgData = await getRandomSvg();
                svgContainer.innerHTML = svgData.svg;
                flagInput.placeholder = "your answer";
            }
            styleSvg(svgContainer);
            resetAll();
        } catch (error) {
            console.error('Error loading flag:', error);
        }

        function styleSvg(container){
            // """determines current dimensions of svg inside container to accurately set aspect ratio according to predermined fixed height"""
            const svgElement = container.querySelector('svg');
            if (svgElement) {
                if (!svgElement.getAttribute('viewBox')) {
                    const width = svgElement.getAttribute('width') || svgElement.getBoundingClientRect().width;
                    const height = svgElement.getAttribute('height') || svgElement.getBoundingClientRect().height;
                    svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
                }
                setSvgDimensions(svgElement, container);
            }   
        }

        function setSvgDimensions(svgElement, container) {
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
    // 
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
    
    // 
    async function autocomplete(){
        // """Suggests up to 5 countries based on users input"""
        var flagInput = document.getElementById("flag-input");
        var countryUl = document.getElementById("country-options"); // change id here and in html to countryUl later

        flagInput.addEventListener('input', async function(){
            const inputValue = this.value.trim();
            if (inputValue !== '') {
                try {
                    let response = await fetch('/autocomplete_country?q=' + flagInput.value);
                    let country_data = await response.json();
                    
                    let optionsHtml = '';
                    country_data.forEach((country, index) => {
                        const option = country.common.replace(/</g, '&lt;').replace(/&/g, '&amp;'); // filters out things that could mess up html 
                            if (index === 0) {
                                optionsHtml += `<li id="selected-option" class="first-option list-group-item list-group-item-secondary bg-primary bg-opacity-75 text-light">${option}</li>`;
                            } else if (index === country_data.length - 1) {
                                optionsHtml += `<li class="last-option list-group-item list-group-item-secondary">${option}</li>`;
                            } else {
                                optionsHtml += `<li class="list-group-item list-group-item-secondary">${option}</li>`;
                            }
                    })
                    countryUl.innerHTML = optionsHtml;
                } catch (error) {
                    console.error('Error fetching autocomplete data:', error);
                }
            } else {
                const countryUl = document.getElementById('country-options')
                countryUl.innerHTML = `
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
        })
    }
    //
    function move_selected_option(){
        const flag_input = document.getElementById('flag-input')
        flag_input.addEventListener('keydown', function(event) {
            // console.log(event.key);
            let current_option = document.getElementById('selected-option')
            let first_option = document.querySelector('.first-option');
            let last_option = document.querySelector('.last-option')

            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                event.preventDefault();
                // select below
                if(current_option && current_option != last_option){
                    let next_option = current_option.nextElementSibling;
                    if(next_option){
                        styleOptions(current_option, next_option);
                    }
                }
            }
            else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault()
                // select above
                if(current_option && current_option != first_option){
                    let prev_option = current_option.previousElementSibling;
                    if(prev_option){
                        styleOptions(current_option, prev_option);
                    }
                }
            }
        }) 
        function styleOptions(currentOption, newOption) {
            currentOption.removeAttribute('id');
            newOption.id = 'selected-option';
            // newOption.classList.add(...['border-primary', 'border-3'])
            // currentOption.classList.remove(...['border-primary', 'border-3'])
            newOption.classList.add(...['bg-primary', 'bg-opacity-75', 'text-light'])
            currentOption.classList.remove(...['bg-primary', 'bg-opacity-75', 'text-light'])

        }        
    }

    // TODO NEED TO CHECK THIS
    function detectWrongChars() {
        const flagInput = document.getElementById("flag-input");
        let removeInvalidClassTimeout;

        flagInput.addEventListener('input', function() {
            const inputValue = this.value;
            const lastChar = inputValue.charAt(inputValue.length - 1);
            
            if (!/^[a-zA-Z\s-]$/.test(lastChar) && lastChar !== '') {
                // Remove the invalid character
                this.value = inputValue.slice(0, -1);
                
                // Add the is-invalid class
                flagInput.classList.add("is-invalid");
                
                // Clear any existing timeout
                clearTimeout(removeInvalidClassTimeout);
                
                // Set a new timeout to remove the class
                removeInvalidClassTimeout = setTimeout(() => {
                    flagInput.classList.remove("is-invalid");
                }, 200);
            } else {
                // If the input is valid, remove the invalid class immediately
                flagInput.classList.remove("is-invalid");
                clearTimeout(removeInvalidClassTimeout);
            }
        });
    }


    // STARTS GAME
    async function initialise_game(){
        // game_started = false , game_ended   = false , current_country{}    are predefined
        let infoHeader, scoreDisplay, attemptsDisplay;
        let score = 0, attempts = 0;
        
        // const options = document.getElementById('country-options')
        const flagInput = document.getElementById("flag-input");

        // STARTS GAME, CHECKS ANS V2
        flagInput.addEventListener('keydown', async function(event){
            if(event.key === 'Enter'){

                if(this.value.trim() !== ""){
                    // function SELECT SELECTED OPTION ()
                    const selectedOption = document.getElementById('selected-option');
                    event.preventDefault(); 
                    if (selectedOption){
                        this.value = selectedOption.textContent;
                        this.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        console.log('No selected option');
                    }
                } else{
                    resetAll();
                }

                const inputValue = this.value.trim().toLowerCase();
                if(!game_started && !game_ended){
                    // GAME HAS NOT STARTED -> CHECK USING current_country
                    if(inputValue === current_country.common.toLowerCase() || inputValue === current_country.official.toLowerCase()){
                        // START GAME NOW  
                        console.log('Game has started!');
                        game_started = true;
                        await startGame();
                        flashThumb(true);
                    }
                    else {
                        console.log('Wrong first ans!');
                        resetAll();
                    }
                }  
                if (game_started && !game_ended){
                    // GAME HAS ALREADY STARTED -> CHECK USING checkAnswer(userAnswer)
                    const ansData = await checkAnswer(inputValue);
                    if(ansData.answer){
                        // SUBSEQUENT ANS IS RIGHT
                        console.log('Correct Ans!')
                        await loadFlagSvg();
                        score++, attempts++;
                        updateScoreDisplay();
                        flashThumb(ansData.answer);
                    } else if (!ansData.answer){
                        // SUBSEQUENT ANS IS WRONG
                        console.log('Wrong Ans')
                        await loadFlagSvg();
                        attempts++;
                        updateScoreDisplay();
                        flashThumb(ansData.answer);
                    }
                }
                // resetAll();
            }
        })


        function flashThumb(right){
            const thumbsUp = document.getElementById('thumbs-up')
            const thumbsDown = document.getElementById('thumbs-down')
            if (right){
                thumbsUp.classList.remove('d-none');
                setTimeout(() => {
                    thumbsUp.classList.add('d-none');
                }, 300);                
            } else{
                thumbsDown.classList.remove('d-none');
                setTimeout(() => {
                    thumbsDown.classList.add('d-none');
                }, 300);  
            }
        }

        async function startGame(){
            game_started = true;
            game_ended = false; 
            await loadFlagSvg();
            formatInfoBoard();
            startTimer(GAME_DURATION);
        }

        function updateScoreDisplay(){
            if (scoreDisplay) scoreDisplay.textContent = score;
            if (attemptsDisplay) attemptsDisplay.textContent = attempts;
        }

        function formatInfoBoard(){
            const infoBoard = document.getElementById('info-board');
            infoBoard.innerHTML = `
                <div class="row justify-content-center my-0 align-items-center">
                    <div class="col-4 d-flex justify-content-end align-items-center">
                        <!-- wrong icon -->
                        <div id="thumbs-down" class="d-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" fill="#dc3545" class="bi bi-hand-thumbs-down-fill" viewBox="0 0 16 16">
                                <path d="M6.956 14.534c.065.936.952 1.659 1.908 1.42l.261-.065a1.38 1.38 0 0 0 1.012-.965c.22-.816.533-2.512.062-4.51q.205.03.443.051c.713.065 1.669.071 2.516-.211.518-.173.994-.68 1.2-1.272a1.9 1.9 0 0 0-.234-1.734c.058-.118.103-.242.138-.362.077-.27.113-.568.113-.856 0-.29-.036-.586-.113-.857a2 2 0 0 0-.16-.403c.169-.387.107-.82-.003-1.149a3.2 3.2 0 0 0-.488-.9c.054-.153.076-.313.076-.465a1.86 1.86 0 0 0-.253-.912C13.1.757 12.437.28 11.5.28H8c-.605 0-1.07.08-1.466.217a4.8 4.8 0 0 0-.97.485l-.048.029c-.504.308-.999.61-2.068.723C2.682 1.815 2 2.434 2 3.279v4c0 .851.685 1.433 1.357 1.616.849.232 1.574.787 2.132 1.41.56.626.914 1.28 1.039 1.638.199.575.356 1.54.428 2.591"/>
                            </svg>
                        </div>
                    </div>
                    <div class="col-4">
                        <div id="info-header" class="display-4 mb-0 fw-semibold fst-italic font-monospace">30</div>
                        <div class="row justify-content-center">
                            <span class="col-6 fs-4 mb-0">Attempts: <span id="attempts" class="font-monospace">0</span></span>
                            <span class="col-6 fs-4 mb-0">Score: <span id="score" class="font-monospace">0</span></span>    
                        </div>
                        <p class="fs-6 fw-light m-0">press shift to skip | refresh page to restart</p>    
                    </div>
                    <div class="col-4 d-flex justify-content-start align-items-center">
                        <!-- correct icon -->
                        <div id="thumbs-up" class="d-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" fill="#198754" class="bi bi-hand-thumbs-up-fill" viewBox="0 0 16 16">
                                <path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733q.086.18.138.363c.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z"/>
                            </svg>
                        </div>
                    </div>
                </div>
            `
            infoHeader = document.getElementById('info-header'); 
            scoreDisplay = document.getElementById('score');
            attemptsDisplay = document.getElementById('attempts');
        }

        function startTimer(duration){
            const progressBar = document.querySelector('.progress-bar')
            progressBar.style.width='100%'
            const startTime = Date.now();

            const gameTimer = setInterval(() => {
                const elapsedTime = (Date.now() - startTime) / 1000;
                timeLeft = Math.max(duration - elapsedTime, 0);
                if(timeLeft > 0){
                    // game is still running
                    infoHeader.textContent = Math.trunc(timeLeft);
                    progressBar.style.width = `${(timeLeft / duration) * 100}%`;
                } else{
                    // end game now
                    clearInterval(gameTimer);
                    endGame();
                }
            }, 250);
        }

        function endGame(){
            game_ended = true;
            infoHeader.classList.remove('font-monospace')
            infoHeader.textContent = "Time's up!"
            // add more performace summary later
        }
    }

    function chooseDuration(){
        if (!game_started && !game_ended){
            const durationInputs = document.querySelectorAll('input[name="game-duration"]');
            const infoBoard = document.getElementById('info-duration')
            durationInputs.forEach(input => {
                input.addEventListener('change', function(){
                    if (this.checked) {
                        const duration = parseInt(this.dataset.duration);
                        // console.log(`Selected duration: ${duration} seconds`);
                        // Implement api call to check whether duration is allowed
                        infoBoard.textContent = `${duration} seconds!`
                        GAME_DURATION = duration;
                    }
                })
            })
        }
    }

    function chooseIncrement(){
        if (!game_started && !game_ended){
            const incrementInputs = document.querySelectorAll('input[name="game-addition"]');
            incrementInputs.forEach(input => {
                input.addEventListener('change', function(){
                    if (this.checked) {
                        const increment = parseInt(this.dataset.increment);
                        GAME_INCREMENT = increment;
                    }
                })
            })
        }
    }

    function resetAll() {
        const options = document.getElementById('country-options')
        const flagInput = document.getElementById("flag-input");

        flagInput.value = '';
        options.innerHTML = `
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
        flagInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Call the function to initialize the game when the page loads
    
    document.addEventListener('DOMContentLoaded', async () => {
        loadFlagSvg();
        autocomplete();
        detectWrongChars();
        move_selected_option();
        // select_option();
        chooseDuration();
        chooseIncrement();
        initialise_game();
        // listenAndResetAll();
    });


    