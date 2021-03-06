class C {
    public static foo() { }
    public get x() {
        return 1;
    }

    public static bar() { }
}

//BUG 733796
class D extends C {
    public static foo() {
        super.bar(); // error
        super.x;  // error
    }    

    constructor() {
        super();
        super.bar(); // error
        super.x;  // error
    }

    public static get y() {
        super.bar(); // error
        super.x; // error
        return 1;
    }
}