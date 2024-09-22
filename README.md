# speedFlags

speedFlags is an interactive web-based game that challenges players to identify country flags as quickly as possible.
While building this game, I learnt many skills, including SASS, Bootstrap, and Vanilla JavaScript. I also learnt many concepts inside the domain of Javascript, such as Object-Orientated Programming, Promises, Event Listeners, Asynchronous Programming, Closures & Scope, DOM Manipulation Techniques, Web debugging, APIs like fetch, and perhaps most importantly, understood how the Javascript event loop worked under the hood.

## Project Overview

speedFlags is built using a combination of Flask (Python) for the backend and vanilla JavaScript for the frontend. The game utilises SVG images for flag rendering, ensuring crisp visuals at any scale. Bootstrap employs their themes and styles, making the game accessible on various devices, while custom aesthetic changes have been added through SCSS.

## File Structure and Functionality

### Backend (Python/Flask)

1. `app.py`
Contains the main Flask application and handles routing, server-side logic, and manages game sessions and data persistence.
`app.py` includes 1 webpage endpoint (index) and 5 API endpoints, of which 3 deliver SVGs and other information to the frontend javascript, while the other 2 are used for the autocomplete and answer checking features.

2. `requirements.txt`
- Lists all Python dependencies required for the project
- Notable packages include Flask and SQLAlchemy.

### Frontend (JavaScript/HTML/CSS)

1. `static/js/newgame.js`
- Core game logic implementation
- Manages game state, timer, and user interactions
- Handles AJAX requests to the server for flag data and answer validation

2. `static/js/theme_toggler.js` (mentioned in layout.html)
- Implements dark/light mode functionality

3. `static/custom.css`
- Custom styles for the application
- Extends and overrides Bootstrap styles for a unique look

4. `templates/layout.html`
- Base template for the application
- Includes common elements like the navbar and theme toggle.

5. `templates/index.html`
Main game interface template
Contains the structure for the game board, timer, and user input.

### Configuration and Assets

1. `package.json`
- Defines project dependencies (Bootstrap)

2. `.gitignore`
- Specifies files and directories to be ignored by version control.

3. `temp_files/temp1.py - temp4.py`
- These scripts were used to obtain the flag svg codes from the REST Countries API. Though my initial plan was to get the svg codes from the REST Countries APIs directly through the front-end. It turned out to take too long and since quick delivery was important I downloaded the SVGs into my own `speedflags.db` and made my own APIs to serve the flags to the front end from there.

## Key Features and Design Choices

1. **Modular JavaScript Architecture**: The game logic is organised into modular objects (e.g., `gameStatsObject`, `svgMethods`, `gameInitialiser`), promoting code organisation and maintainability. The initial version of `game.js` had virtually no use of Javascript objects, which made debugging very hard as functions were all over the place. This led to me eventually giving up on debugging and rewriting the `game.js` from scratch, which I named `newgame.js`.

2. **SVG Flag Rendering**: The decision to use SVG for flags ensures high-quality visuals across different screen sizes and resolutions. I had vastly underestimated how difficult it would be to manipulate the SVGs to be coherent with the rest of the page and had to understand how to use `viewPorts` and 'viewBoxes', which took a while.

3. **Asynchronous Operations**: Extensive use of async/await for smooth user experience and efficient server communication. This took me a pretty long time to fully grasp as I was used to more linear languages like Python and C. But after understanding how JavaScript worked under the hood—how the `heap`, 'queue', and'stack` help a webpage to run—everything fell into place.

4. **Customisable Game Settings**: Players can adjust game duration and scoring rules, enhancing replayability.

5. **Accessibility Considerations**: Keyboard navigation support and clear visual feedback contribute to a more inclusive user experience.

6. **Performance Optimisation**: Techniques like batched DOM updates and efficient event handling are employed to ensure smooth gameplay.

7. **Security Measures**: Basic input sanitisation and server-side answer validation protect against common vulnerabilities.

## Development Decisions and Tradeoffs

1. **Vanilla JS vs. Framework**: The choice to use vanilla JavaScript instead of a framework like React or Vue.js was likely made to reduce complexity and dependencies for a relatively simple game. However, this may limit scalability for future feature additions.

2. **Server-Side Rendering**: Using Flask's templating engine for initial page loads provides faster initial render times but may result in less dynamic content updates compared to a single-page application approach.

3. **CSS Framework**: Bootstrap was chosen for rapid development and responsive design. While this ensures consistency and cross-browser compatibility, it may lead to larger CSS file sizes and potential styling conflicts.

4. **SVG Manipulation**: Custom SVG handling provides precise control over flag rendering but requires more complex code compared to using pre-rendered images.

## Future Improvements

1. Implement a more robust state management solution for complex game states.
2. Enhance accessibility features, including ARIA attributes and screen reader support.
3. Add internationalisation (i18n) for multi-language support.
4. Develop a comprehensive test suite for both frontend and backend components.
5. Optimise performance further, especially for mobile devices.
6. Implement offline support using service workers.
7. Expand the game with additional modes or educational features. We could add accounts where people can use active-recall and spaced-repetition with an alogirthm similiar to Anki's and optally remember flags from there.

## Conclusion

speedFlags demonstrates a well-structured web application that combines educational content with engaging gameplay. The project showcases effective use of modern web technologies while maintaining simplicity in its core design. Its modular architecture and thoughtful feature implementations provide a solid foundation for future enhancements and expansions.
