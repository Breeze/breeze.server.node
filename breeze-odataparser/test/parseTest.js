var PEG = require("pegjs");
var fs = require("fs");
var shouldGenerateParser = false;
var parser = getParser(shouldGenerateParser);

describe("odata parse", function() {
    this.enableTimeouts(false);


    pc("$orderby=LastName",
       [ { path: "LastName", isAsc: true} ]
    );

    pc("$orderby=LastName, FirstName desc",
        [   { path: "LastName", isAsc: true},
            { path: "FirstName", isAsc: false}
        ]
    );

    pc("$orderby= LastName asc, FirstName ,  Name/Foo    desc",
        [   { path: "LastName", isAsc: true},
            { path: "FirstName", isAsc: true},
            { path: "Name/Foo", isAsc: false}
        ]
    );

    pc("$select=LastName", ["LastName"]);

    pc("$select= LastName ,FirstName, Name/Foo , Name/Foo/Bar",
        ["LastName", "FirstName", "Name/Foo", "Name/Foo/Bar"]
    );

    tp("$filter='xxx'");

    tp("$filter=Name/foo");

    tp("$filter=Orders/any(x1: x1/Freight gt 950m)");

    tp("$filter=Orders/any(x1: startswith(x1/Foo, 'Test'))");

    tp("$filter=((Name eq 'John' and LastName lt 'Doe') and (startswith(x1/Foo, 'Test')))");

    tp("$filter=OrderDetails/any(x1: (x1/UnitPrice ge 50m) and (startswith(x1/Foo, 'Test') ) )");

    tp("$filter=OrderDetails/all(x1: ((x1/Quantity lt 10) and (x1/UnitPrice lt 10m) and (x1/Notes/Foo gt 999))  )");

    tp("$filter=OrderDetails/any(x1: (x1/Notes/any(x4: x4/UnitPrice ge 50m)))");

    tp("$filter=OrderDetails/all(x1: (x1/Notes/any(x4: startswith(x4/Note,'GAB') eq true)))");

    tp("$filter=OrderDetails/all(x1: ((x1/Quantity lt 10) and (x1/UnitPrice lt 10m) and (x1/Notes/any(x4: startswith(x4/Note,'Test') eq true))))");

    pc("$filter=OrderDate gt datetime'1998-04-01T07:00:00.000Z'",
        { type: "op_bool", op: "gt",
            p1: { type: "member", value: "OrderDate" },
            p2: { type: "lit_datetime", value: new Date("1998-04-01T07:00:00.000Z") }
        }
    );

    pc("$filter=_id eq guid'785efa04-cbf2-4dd7-a7de-083ee17b6ad2'",
         { type: "op_bool", op: "eq",
            p1: { type: "member", value: "_id" },
            p2: { type: "lit_guid", value: "785efa04-cbf2-4dd7-a7de-083ee17b6ad2"}
         }
    );


    pc("$filter=startswith(toupper(substring(CompanyName,1,2)),'OM') eq true",
        { type: "op_bool", op: "eq",
            p1: { type: "fn_2", name: "startswith",
                p1: { type: "fn_1", name: "toupper",
                    p1: { type: "fn_3", name: "substring",
                        p1: { type: "member", value: "CompanyName" },
                        p2: { type: "lit_number", value: 1},
                        p3: { type: "lit_number", value: 2}
                    }
                },
                p2: { type: "lit_string", value: "OM"}
            },
            p2: { type: "lit_boolean", value: true }
        }
    );

    pc("$filter=Name eq 'John'",
        { type: "op_bool", op: "eq",
          p1: { type: "member", value: "Name" },
          p2: { type: "lit_string", value: "John"}
        }
    );

    pc("$filter=_name eq 'John'",
        { type: "op_bool", op: "eq",
          p1: { type: "member", value: "_name" },
          p2: { type: "lit_string", value: "John"}
        }
    );

    pc("$filter=Qty eq 6443",
        { type: "op_bool", op: "eq",
          p1: { type: "member", value: "Qty"},
          p2: { type: "lit_number", value: 6443}
        }
    );

    pc("$filter=Qty eq 6443m",
        { type: "op_bool", op: "eq",
            p1: { type: "member", value: "Qty"},
            p2: { type: "lit_number", value: 6443}
        }
    );

    pc("$filter=Name/foo eq 'John'",
        { type: "op_bool", op: "eq",
            p1: { type: "member", value: "Name/foo" },
            p2: { type: "lit_string", value: "John"}
        }
    );

    pc("$filter=Name eq 'John' and LastName lt 'Doe'",
        { type: "op_andOr", op: "and",
            p1: { type: "op_bool", op: "eq",
                p1: { type: "member", value: "Name"},
                p2: { type: "lit_string", value: "John" }
            },
            p2: { type: "op_bool", op: "lt",
                p1: { type: "member", value: "LastName"},
                p2: { type: "lit_string", value: "Doe"}
            }
        }
    );

    pc("$filter=(DoubleValue mod 2) eq 10",
        { type: "op_bool", op: "eq",
            p1: { type: "op_math", op: "mod",
                p1: { type: "member", value: "DoubleValue" },
                p2: { type: "lit_number", value: 2}
            },
            p2: { type: "lit_number", value: 10 }
        }
    );

    pc("$filter=substringof('text', StringValue) ne true",
        { type: "op_bool", op: "ne",
            p1: { type: "fn_2", name: "substringof",
                p1: { type: "lit_string", value: "text"  },
                p2: { type: "member", value: "StringValue"}
            },
            p2: { type: "lit_boolean", value: true }
        }
    );

    tp("$filter=not length(StringValue) eq 1");

    tp("$filter=toupper(StringValue) ne 'text'");

    pc("$filter=DoubleValue div 2 eq 3",
        { type: "op_bool", op: "eq",
            p1: { type: "op_math", op: "div" ,
                p1: { type: "member", value: "DoubleValue"},
                p2: { type: "lit_number", value: 2 }
            },
            p2: { type: "lit_number", value: 3 }
        }
    );


    pc("$filter=(StringValue ne 'text') or IntValue gt 2",
        { type: "op_andOr", op: "or",
            p1: { type: "op_bool", op: "ne",
                p1: { type: "member", value: "StringValue"},
                p2: { type: "lit_string", value: "text"}
            } ,
            p2: { type: "op_bool", op: "gt",
                p1: { type: "member", value: "IntValue"},
                p2: { type: "lit_number", value: 2}
            }
        }
    );

    pc("$filter=(not StringValue ne 'text') or IntValue gt 2",
        { type: "op_andOr", op: "or",
            p1: { type: "op_unary", op: "not ",
                p1: { type: "op_bool", op: "ne",
                    p1: { type: "member", value: "StringValue"},
                    p2: { type: "lit_string", value: "text"}
                }
            },
            p2: { type: "op_bool", op: "gt",
                p1: { type: "member", value: "IntValue"},
                p2: { type: "lit_number", value: 2}
            }
        }
    );

    pc("$filter=(startswith(tolower(StringValue),'foo') eq true and endswith(tolower(StringValue),'1') eq false)",
        { type: "op_andOr", op: "and",
            p1: { type: "op_bool", op: "eq",
                p1: { type: "fn_2", name: "startswith",
                    p1: { type: "fn_1", name: "tolower",
                        p1: { type: "member", value: "StringValue"}
                    },
                    p2: { type: "lit_string", value: "foo"}
                },
                p2: { type: "lit_boolean", value: true}
            },
            p2: { type: "op_bool", op: "eq",
                p1: { type: "fn_2", name: "endswith" ,
                    p1: { type: "fn_1", name: "tolower",
                        p1: { type: "member", value: "StringValue"}
                    },
                    p2: { type: "lit_string", value: "1"}
                },
                p2: { type: "lit_boolean", value: false}
            }
        }
    );


    pc("$filter=DateValue eq datetime'2012-05-06T16:11:00Z'",
        { type: "op_bool", op: "eq",
            p1: { type: "member", value: "DateValue"},
            p2: { type: "lit_datetime", value: new Date('2012-05-06T16:11:00Z') }
        }
    );

    pc("$filter=StringValue eq '''single quotes'' within the text'",
        { type: "op_bool", op: "eq",
            p1: { type: "member", value: "StringValue" },
            p2: { type: "lit_string", value: "'single quotes' within the text"}
        }
    );

    pc("$filter=StringValue eq 'Group1 and Group2'",
        { type: "op_bool", op: "eq",
            p1: { type: "member", value: "StringValue"},
            p2: { type: "lit_string", value: "Group1 and Group2" }
        }
    );

    pc("$filter=StringValue ne 'Group1 not Group2'",
        { type: "op_bool", op: "ne",
            p1: { type: "member", value: "StringValue"},
            p2: { type: "lit_string", value: "Group1 not Group2" }
        }
    );

});

function getParser(shouldGenerateParser) {
    var parser;
    if (shouldGenerateParser) {
        console.log("reading file...");
        var filename = "../odataParser.peg";
        if (!fs.existsSync(filename)) {
            throw new Error("Unable to locate file: " + filename);
        }
        var pegdef = fs.readFileSync(filename, 'utf8');
        console.log("reading file completed");
        try {
            parser = PEG.buildParser(pegdef);
        } catch (e) {
            console.log(e.message);
            throw e;
        }
    } else {
        parser = require("../odataParser")
    }
    return parser;
}


function pc(expr, expectedResult) {
    it("Compare: " + expr, function() {
        var nodeName = expr.substr(0, expr.indexOf("="));
        var r = tryParseCore(expr);
        if (nodeName) r = r[nodeName];
        compare(expr, r, expectedResult);
    });
}

function tp(expr, shouldLog) {
    shouldLog = (shouldLog === undefined) ? true : shouldLog;
    it("Try: " + expr, function() {
        var r = tryParseCore(expr);
        if (shouldLog) {
            console.log("Parse: " + expr);
            console.log(JSON.stringify(r,null, "  ")+"\n");
        }
    });
}

function tryParseCore(s) {
    try {
        return parser.parse(s);
    } catch (e)  {
        throw new Error("Unable to parse: " + s + " --> e.message");
    }
}

function compare(title, o1, o2) {
    try {
        compareCore(o1, o2);
    } catch (e) {
        var err = new Error( "Err: " + title + " --error:" + e.message)
        err.o1 = JSON.stringify(o1),
        err.o2 = JSON.stringify(o2)
        throw err;
    }
}

function compareCore(o1, o2, prevKey) {
    try {
        prevKey = prevKey || "";
        var t = typeof(o1);
        var ok = false;
        if (o1 == null || t === "string" || t === "number" || t==="boolean") {
            ok = o1 === o2;
        } else if ( o1 instanceof Date ) {
            ok =  o1.getTime() === o2.getTime()
        } else {
            for (var k in o1) {
                var v1 = o1[k];
                var v2 = o2[k];
                var r = undefined;
                var key = prevKey + ":" + k;
                compareCore(v1, v2, key);

            }
            ok = true;
        }
        if (!ok) {
            throw new Error("error comparing key: " + prevKey);
        }
    } catch (e) {
        if (e.message.indexOf("key:")>=0) {
            throw e;
        } else {
            throw new Error("error comparing key: " + prevKey);
        }
    }

}

