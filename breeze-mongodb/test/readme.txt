
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
