/// Copyright (c) 2012 Ecma International.  All rights reserved. 
/// Ecma International makes this code available under the terms and conditions set
/// forth on http://hg.ecmascript.org/tests/test262/raw-file/tip/LICENSE (the 
/// "Use Terms").   Any redistribution of this code must retain the above 
/// copyright and this notice and otherwise comply with the Use Terms.
/**
 * @path ch15/15.4/15.4.4/15.4.4.16/15.4.4.16-2-4.js
 * @description Array.prototype.every - 'length' is own data property that overrides an inherited data property on an Array
 */


function testcase() {
        var arrProtoLen = 0;
        function callbackfn1(val, idx, obj) {
            return val > 10;
        }

        function callbackfn2(val, idx, obj) {
            return val > 11;
        }

        try {
            arrProtoLen = Array.prototype.length;
            Array.prototype.length = 0;
            Array.prototype[2] = 9;

            return [12, 11].every(callbackfn1) &&
                ![12, 11].every(callbackfn2);
        } finally {
            Array.prototype.length = arrProtoLen;
            delete Array.prototype[2];
        }

    }
runTestCase(testcase);
