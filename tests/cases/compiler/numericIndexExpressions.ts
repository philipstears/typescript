// bug 728545: No error for duplicate properties when one is a string named property

interface Numbers1 {
    1: string;
}
interface Strings1 {
    '1': string;
}
 
 
var x: Numbers1;
x[1] = 4; // error
x['1'] = 4; // error

var y: Strings1;
y['1'] = 4; // should be error (bug 728545)
y[1] = 4; // should be error (bug 728545)