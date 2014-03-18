To compile odataParser.peg

    insure that pegjs is installed both globally and locally

    run from cmd.
       pegjs odataParser.peg

    this should generate a 'node' aware js file
       odataParser.js

    that can be used via

    require("odataParser.js");

To run odataParser testing

    run parseTest
      run from the parseTest dir
      >node parseTest.js   

To run server

    start mongo
       run startdb.bat
    run server.js
    from browser, hit:
       http://localhost:3000/breeze/NorthwindIBModel/Products
       http://localhost:3000/breeze/NorthwindIBModel/Products/?$filter=ReorderLevel gt 25
       http://localhost:3000/breeze/NorthwindIBModel/Products/?$filter=startswith(ProductName, 'S')
       http://localhost:3000/breeze/NorthwindIBModel/Products/?$filter=ReorderLevel%20gt%2025&$select=ProductName

TODO:
    more precedence work - esp: not
