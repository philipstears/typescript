var C = (function () {
    function C() {
    }
    C.prototype.a = function () {
        s = 1;
    };
    return C;
})();

// just want to make sure this one doesn't crash the compiler

var Foo = (function () {
    function Foo() {
    }
    return Foo;
})();
