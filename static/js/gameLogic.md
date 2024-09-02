## all functions and eventListeners here
- getFirstSvg
    - returns the following
        ```
        svgData = { 
                    "svg": "svgCode...", 
                    "common": "common name", 
                    "official": "official name"
                  }
        ```
- getRandomSvg
    - returns the following
        ```
        svgData = {"svg": "svgCode..."}
        ```
        common and official are not returned to prevent cheating

- loadFlagSvg  
    if game has not started:
        calls getFirstSvg()  
            updates current_country{} with common and official  
            
    - styleSvg
    - setSvgDimensions
- checkAnswer
- autocomplete
- move_selected_option
    - styleOptions
- detectWrongChars
- initialseGame
    - eventListener1
    - flashThumb
    - startGame
    - updateScoreDisplay
    - formatInfoBoard
    - startTimer(duration)
    - endgame
- chooseDuration
- chooseIncrement
- resetAll
- domContentLoaded ...