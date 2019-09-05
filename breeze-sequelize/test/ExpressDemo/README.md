## Express Demo

This is an [Express](http://expressjs.com/en/index.html) application that runs the [Breeze client](http://breeze.github.io/doc-js/) test suite.

### server.js
Sets up the request handling, and starts the server listening on port 3000.  

Specific request URLs (those starting with `/breeze/NorthwindIBModel/`) are passed to `routes.js`.

All others are assumed to be requesting HTML/JS/CS files from the `testCaseDir`.
You will need to pull down the [breeze.js](https://github.com/Breeze/breeze.js) repository, and set `testCaseDir` in server.js, line 14.

Run the server using 

    node server.js

Then open your browser to http://localhost:3000/

### routes.js
Handles AJAX requests for CRUD operations from the Breeze client.  Most queries are handled by the `get` method, which parses the query from the URL.
Other methods are for special scenarios that are being exercised by the test suite.

## Debugging

Perform the npm-link process as described in the README file in the parent (test) directory.

See [Debugging Node.js with Chrome DevTools](https://medium.com/@paul_irish/debugging-node-js-nightlies-with-chrome-devtools-7c4a1b95ae27#.pmqejrn8q).

1) Open Chrome and go to `chrome://inspect`

2) Click on the link that says [Open dedicated DevTools for Node]()

3) Put a `debugger;` statement in your code where you want to start debugging

4) Start the server with the `--inspect` or `--inspect-brk` flag: 

    node --inspect-brk server.js

5) Open a second browser window on http://127.0.0.1:3000/ to see the actual test suite app.  
You may need to temporarily turn off breakpoints in the node-inspector window while the app comes up.

You can choose which test modules to run using the dropdown on the upper right of the page, 
and then click the "Start the tests" checkbox to start the tests running.