Assumes the [mocha](https://mochajs.org/) test runner is installed.

## Setup for Development

From the `breeze-sequelize/src` directory, install the breeze-sequelize package locally:

    npm install

Then create a global symbolic link to the package.  (You may need to be root or Administrator to run the `npm link` command):

	npm link

Then go back to this `breeze-sequelize/test` directory, and link to the breeze-sequelize package:

    npm link breeze-sequelize

That way, you will run the test with your local breeze-sequelize code.  Finally build/install the test package:

    npm install

## Running the unit tests

    mocha -b *.test.js

will run all the unit tests, stopping at the first failure.  Remove the `-b` to run them all without stopping.  See [mocha usage](https://mochajs.org/#usage) for more info.

## Debugging the unit tests

See [How to Debug Mocha Tests with Chrome](http://blog.andrewray.me/how-to-debug-mocha-tests-with-chrome/).
