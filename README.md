> ##### CS50's README formatting guide
> Your README.md file should be minimally multiple paragraphs in length, and should explain what your project is, what each of the files you wrote for the project contains and does, and if you debated certain design choices, explaining why you made them. Ensure you allocate sufficient time and energy to writing a README.md that documents your project thoroughly. Be proud of it! A README.md in the neighborhood of 750 words is likely to be sufficient for describing your project and all aspects of its functionality. If unable to reach that threshold, that probably means your project is insufficiently complex.

# About this project
Though speedFlags doesn't have many html pages, I learnt a lot of concepts; javascript and beyond. In essance, speedFlags is a simple game where users have to guess all the flags they can in a time limit of their choosing (30, 45, 60 or 120 seconds). They have an option to add 5 seconds with each correct answer.

## User Experience
1. user loads the page 
    1. the page loads according to their browsers `prefers-color-scheme` attribute but if they have previously selected a colour mode of their choice dark or light the page loads according to their selected colour mode. This feature was implemented with bootstrap.
    2. with inspiration from the boostrap code that enabled the detection and setting of the users' preferred theme, I wrote `userPreferences` in newgame.js to allow users to pick their game settings (game duration & increment) and for the browser to remember it upon subsequent reloads.
2. The user can then select their preferences for the game. This includes the duration - 30 to 120 seconds and the increment to the duration with every correct answer - 0 to 5 seconds.
3. They can start the game by clicking on the input box and typing the answer and pressing enter for the first flag displayed. The answer for this flag is provided as the placeholder since it doesn't count towards the score anyway.
    1. The game starts exactly when the user presses enter. Immediately the main text changes and the progress bar starts shrinking. 
4. As the user guesses their answers suggestions pop up form below and they can press enter to select and use to up and down arrow keys to navigate the options.
5. As the game progresses the users score and attempts are displayed
6. When the timer ends the user is presented a table of all the flags that they attempted within the game's span the correct answers to each flag and the answer they attempted. The countdown timer is also replaced with a restart button that reloads the page and allows the user to restart.

## Obtaining the flags, preparing the database, sending the flags to front-end
My initial plan was to fetch the flags from the rest countries api but after writing the frontend js for it, I quickly realised that it was taking too long to fetch the flags from their servers so I decided to serve the flags myself. To do this, I had to write some python scripts to fetch and then save the flag svg codes along with some other details into my database: speedflags.db. 
Now to send the flags to the front-end, I wrote 3 APIs and they are as follows.

## Individual Functions inside newgame.js
### `fetch_first_svg()`
this is to obtain the first flag

### `fetch_random_svg()`

### `fetch_specific_svg()`


# the newgame.js script


# styling


