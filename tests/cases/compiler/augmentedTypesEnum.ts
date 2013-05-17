// enum then var
enum e1111 { One }
// BUG 694387
var e1111 = 1; // error

// enum then function
enum e2 { One }
function e2() { } // error

enum e3 { One }
// BUG 694387
var e3 = () => { } // error

// enum then class
enum e4 { One }
// BUG 694387
class e4 { public foo() { } } // error

// enum then enum
enum e5 { One }
enum e5 { Two }

enum e5a { One }
enum e5a { One } // error

// enum then internal module
enum e6 { One } 
// BUG 694381
module e6 { } // should be error

enum e6a { One }
module e6a { var y = 2; } // should be error

enum e6b { One }
module e6b { export var y = 2; } // should be error

// enum then import
enum e7 { One }
import e7 = require(''); // should be error