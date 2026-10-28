export default class MathEngine {
    
    static answers_list: number[] = [];
    static ADD_SUB_MAX = 999;   //Maximum of 1 component in the problem 
    static ADD_SUB_MIN = 1;     //Minimum of 1 component in the problem

    private constructor() {} //static class

    public static add(): {a: number, b: number, c: number} {
        //Variables below are initialized, otherwise compiler complains, a, b, 
        //and c should never be 0 as long as min is 1 or higher
        let a: number = 0;      //One number of the problem
        let b: number = 0;      //Another number of the problem
        let c: number = 0;      //The answer to the add problem

        let duplicate = true;
        while (duplicate) {    //If c is in answers_list, tries again
            a = Math.floor(Math.random() * (this.ADD_SUB_MAX - 
                this.ADD_SUB_MIN + 1)) + this.ADD_SUB_MIN;
            //Generates a random int from max to min inclusive

            b = Math.floor(Math.random() * (this.ADD_SUB_MAX - 
                this.ADD_SUB_MIN + 1)) + this.ADD_SUB_MIN;

            c = a + b;  

            //Boolean, if c in answers_list
            duplicate = this.answers_list.includes(c);
        }
        this.answers_list.push(c); 
        //Add the answer to answers_list to prevent duplicates
        
        return {a, b, c};
    }

    public static sub(): {a: number, b: number, c: number} {
        //Variables below are initialized, otherwise compiler complains, a and 
        //b should never be 0 as long as min is 1 or higher
        //Unlike add, c can be 0 if a and b are equal
        let a: number = 0;      //One number of the problem
        let b: number = 0;      //Another number of the problem
        let c: number = 0;      //The answer to the subtraction problem
        let d: number = 0;      //The larger number of the problem
        let e: number = 0;      //The smaller number of the problem

        let duplicate = true;
        while (duplicate) {    //If c is in answers_list, tries again
            a = Math.floor(Math.random() * (this.ADD_SUB_MAX - 
                this.ADD_SUB_MIN + 1)) + this.ADD_SUB_MIN;
            //Generates a random int from max to min inclusive

            b = Math.floor(Math.random() * (this.ADD_SUB_MAX - 
                this.ADD_SUB_MIN + 1)) + this.ADD_SUB_MIN;

            //Find the maximum and minimum to prevent negative numbers
            d = Math.max(a,b);
            e = Math.min(a,b);
            
            c = d - e;  

            //Boolean, if c in answers_list
            duplicate = this.answers_list.includes(c);
        }
        this.answers_list.push(c); 
        //Add the answer to answers_list to prevent duplicates
        
        return {a: d, b: e, c};
    }

    //Randomly pick addition or subtraction, append add or sub to notify the 
    //receiver what was picked
    public static add_or_sub(): {a: number, b: number, c: number, d: string} {
        let x = Math.random();
        if (x < 0.5) {
            return {...this.add(), d: "add"};
        } else {
            return {...this.sub(), d:"sub"};
        }
    }

    //For testing, I don't think answers will be needed during runtime
    public static answers() {
        return this.answers_list;
    }

    //Reset the this.answers_list to point to a new empty array
    public static reset() {
        this.answers_list = [];
    }
}