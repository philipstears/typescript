var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Action = (function () {
    function Action() {
    }
    return Action;
})();

var ActionA = (function (_super) {
    __extends(ActionA, _super);
    function ActionA() {
        _super.apply(this, arguments);
    }
    return ActionA;
})(Action);

var ActionB = (function (_super) {
    __extends(ActionB, _super);
    function ActionB() {
        _super.apply(this, arguments);
    }
    return ActionB;
})(Action);

var x1 = [
    { id: 2, trueness: false },
    { id: 3, name: "three" }
];

var x2 = [
    new ActionA(),
    new ActionB()
];

var x3 = [
    new Action(),
    new ActionA(),
    new ActionB()
];

var z1 = [
    { id: 2, trueness: false },
    { id: 3, name: "three" }
];

var z2 = [
    new ActionA(),
    new ActionB()
];

var z3 = [
    new Action(),
    new ActionA(),
    new ActionB()
];
