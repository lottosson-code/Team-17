import MathProblem from "./MathProblem";

export type ProblemType = "addition" | "subtraction" | "multiplication" | "division";

export default class ProblemGenerator implements MathProblem {
    
    private static answers_list: number[] = [];
    private ADD_SUB_MAX = 99;  
    private ADD_SUB_MIN = 1;    
    private MULT_DIV_MAX = 12;  
    private MULT_DIV_MIN = 1;
    first_operand;
    second_operand;
    result;
    operator;

    public constructor(type: ProblemType) {
        let results = this.compute(type);
        this.first_operand = results.first_operand;
        this.second_operand = results.second_operand;
        this.result = results.result;
        this.operator = results.operator;
    } 

    private generate(type: ProblemType) {
        let first_generated: number;
        let second_generated: number;
        let MAX: number;
        let MIN: number;

        switch(type) {
            case "addition":
            case "subtraction":
                MAX = this.ADD_SUB_MAX;
                MIN = this.ADD_SUB_MIN;
                break;
            case "division":
            case "multiplication":
                MAX = this.MULT_DIV_MAX;
                MIN = this.MULT_DIV_MIN;
                break;
        }

        first_generated = Math.floor(Math.random() * (MAX - 
            MIN + 1)) + MIN;
        //Generates a random int from max to min inclusive
        second_generated = Math.floor(Math.random() * (MAX - 
            MIN + 1)) + MIN;
        return {first_generated, second_generated};
    }

    private operate(type: ProblemType) {
        switch(type) {
            case "addition":
                return "+";
            case "subtraction":
                return "-";
            case "multiplication":
                return "x";
            case "division":
                return "/";
        }
    }

    public compute(type: ProblemType): MathProblem {
        //Variables below are initialized, otherwise compiler complains, a, b, 
        //and c should never be 0 as long as min is 1 or higher
        
        let first_operand: number = 0;      //One number of the problem
        let second_operand: number = 0;      //Another number of the problem
        let result: number = 0;      //The answer to the add problem
        let operator = this.operate(type);

        let duplicate = true;
        while (duplicate) {    //If c is in answers_list, tries again

            let generated = this.generate(type);
            first_operand = generated.first_generated;
            second_operand = generated.second_generated;

            switch (type) {
                case "addition":
                    result = first_operand + second_operand;
                    break;
                case "subtraction":
                    //Keeping it positive
                    first_operand = Math.max(generated.first_generated, generated.second_generated);
                    second_operand = Math.min(generated.first_generated, generated.second_generated);
                    result = first_operand - second_operand;
                    break;
                case "multiplication":
                    result = first_operand * second_operand;
                    break;
                case "division":
                    //Keeping it to a whole number
                    first_operand = first_operand * second_operand;
                    result = first_operand / second_operand;
                    break;
            }

            //Boolean, if c in answers_list
            duplicate = ProblemGenerator.answers_list.includes(result);
        }
        //Add the answer to answers_list to prevent duplicates
        ProblemGenerator.answers_list.push(result); 

        return {first_operand, second_operand, result, operator};
    }

    //For testing, I don't think answers will be needed during runtime
    public static answers() {
        return this.answers_list;
    }

    //Reset the this.answers_list to point to a new empty array
    public static reset() {
        this.answers_list = [];
    }

    public static remove(answer: number): boolean {
        let index = this.answers_list.indexOf(answer);
        if (index != -1) {
            this.answers_list.splice(index, 1);
            return true;
        }
        return false;
    }
}