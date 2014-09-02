breeze-odataparser
==================

Node package Breeze OData query parsing 


To compile odataParser.peg

    insure that pegjs is installed both globally and locally

    run from cmd.
       pegjs odataParser.peg

    this should generate a 'node' aware js file
       odataParser.js

    that can be used via

    require("./odataParser.js");

To run odataParser testing

    run "mocha" from this dir. 


TODO:
    more precedence work - esp: not

