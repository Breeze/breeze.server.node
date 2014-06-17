(function () {
    return;// disable all tests in this file


function asyncSUT(callback){
    setTimeout(callback, 10);
}
describe("HORRIBLE mocha async assert behavior", function(){
    // cross test pollution.
    it("can't simply assert in callback (times out)", function(done){
        asyncSUT(cb1);
        function cb1(/*err, result*/) {
            // Doesn't work
            (1).should.equal(2); // will fail and throw
            done(); // never called and assertion will not kill it
        }
    });
    it("can't wrap callback assert in try/finally (appears to pass!!!)", function(done){
        asyncSUT(cb2);
        function cb2(/*err, result*/) {
            // Worse ... appears to pass
            try {
                ('A').should.equal('B'); // will fail and throw
            } catch (e) {
                throw e
            } finally {done();}
        }
    });

    it("must use peculiar try/catch with special done(e)", function(done){
        asyncSUT(cb3);
        function cb3(/*err, result*/) {
            asyncAsserts(done, function(){
                (true).should.be.false; //  will fail and throw
            });
        }
    });

    function asyncAsserts(done, asserts){
        try {
            if (asserts) { asserts(); }
            done();
        } catch (e){
            console.log(e);
            done(e); // NB: MUST pass the exception to 'done(e)'
        }
    }
});

})();