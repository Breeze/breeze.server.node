// minimal sanity check to insure that the odataParser is available here
// most substantial tests in the breeze-odataparser module.
var parser = require('breeze-odataparser');


describe("odata parse", function() {
    this.enableTimeouts(false);


    pc("$orderby=LastName",
        [ { path: "LastName", isAsc: true} ]
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
});




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

