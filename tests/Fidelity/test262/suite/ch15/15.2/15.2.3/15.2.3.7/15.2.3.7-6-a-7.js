/// Copyright (c) 2012 Ecma International.  All rights reserved. 
/// Ecma International makes this code available under the terms and conditions set
/// forth on http://hg.ecmascript.org/tests/test262/raw-file/tip/LICENSE (the 
/// "Use Terms").   Any redistribution of this code must retain the above 
/// copyright and this notice and otherwise comply with the Use Terms.
/**
 * @path ch15/15.2/15.2.3/15.2.3.7/15.2.3.7-6-a-7.js
 * @description Object.defineProperties - 'P' is own accessor property that overrides an inherited data property (8.12.9 step 1 ) 
 */


function testcase() {
        var proto = {};
        Object.defineProperty(proto, "prop", {
            value: 11,
            configurable: true
        });
        var Con = function () { };
        Con.prototype = proto;

        var obj = new Con();
        Object.defineProperty(obj, "prop", {
            get: function () {
                return 12;
            },
            configurable: false
        });

        try {
            Object.defineProperties(obj, {
                prop: {
                    value: 13,
                    configurable: true
                }
            });
            return false;
        } catch (e) {
            return (e instanceof TypeError) && obj.prop === 12;
        }
    }
runTestCase(testcase);
