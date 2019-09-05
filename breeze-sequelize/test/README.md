Assumes the [mocha](https://mochajs.org/) test runner is installed.

## Setup for Development

From the `breeze-sequelize/src` directory, install the breeze-sequelize package locally:

    npm install

Then create a global symbolic link to the package.  (You may need to be root or Administrator to run the `npm link` command):

	npm link

Then go back to this `breeze-sequelize/test` directory, and link to the breeze-sequelize package:

    npm link breeze-sequelize

That way, you will run the tests with your local breeze-sequelize code from the ../src directory, and any changes that you make to src are used in the tests.  
You only have to do the npm-link once.

Finally build/install the test package:

    npm install

## Running the unit tests

    mocha -b *.test.js

will run all the unit tests, stopping at the first failure.  Remove the `-b` to run them all without stopping.  See [mocha usage](https://mochajs.org/#usage) for more info.

## Debugging the unit tests

See [Debugging Node.js with Chrome DevTools](https://medium.com/@paul_irish/debugging-node-js-nightlies-with-chrome-devtools-7c4a1b95ae27#.pmqejrn8q).

1) Open Chrome and go to `chrome://inspect`

2) Click on the link that says [Open dedicated DevTools for Node]()

3) Put a `debugger;` statement in your code where you want to start debugging

4) Run your Mocha tests in debug mode

    npm run debug {testfile}.js

5) Go back to the browser. The --inspect-brk tells the debugger to break on the first line of the first script. 
You're stopped inside of Mocha.  Now set your breakpoints, and click the arrow (or hit F8) to continue.
