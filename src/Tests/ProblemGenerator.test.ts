import {describe, expect, test, beforeEach} from "vitest";
import PG from "../Math/ProblemGenerator";  //ProblemGenerator shortened to PG
import MathProblem from "../Math/MathProblem";

beforeEach(() => {
    PG.reset();
});

describe("PG, testing the constructor on every ProblemType", () => {
    test("addition, 20 unique", () => {
        for (let i = 0; i < 20; i++ ) {
            let created: MathProblem = new PG("addition");
            //Check type
            expect(created.operator).toBe("+");
            //Check equation
            expect(created.first_operand + 
                created.second_operand).toBe(created.result);
            //Check result in answers_list
            expect(PG.answers().includes(created.result)).toBe(true);
        }

        //Check answers_list has 20 unique entries
        let answers: number[] = PG.answers();
        expect(answers.length).toBe(20);
        expect(answers.length == new Set(answers).size).toBe(true);
    });

    test("subtraction", () => {
        for (let i = 0; i < 20; i++ ) {
            let created: MathProblem = new PG("subtraction");
            //Check type
            expect(created.operator).toBe("-");
            //Check equation
            expect(created.first_operand - 
                created.second_operand).toBe(created.result);
            //Check result in answers_list
            expect(PG.answers().includes(created.result)).toBe(true);
        }

        //Check answers_list has 20 unique entries
        let answers: number[] = PG.answers();
        expect(answers.length).toBe(20);
        expect(answers.length == new Set(answers).size).toBe(true);
    });

    test("multiplication", () => {
        for (let i = 0; i < 20; i++ ) {
            let created: MathProblem = new PG("multiplication");
            //Check type
            expect(created.operator).toBe("x");
            //Check equation
            expect(created.first_operand * 
                created.second_operand).toBe(created.result);
            //Check result in answers_list
            expect(PG.answers().includes(created.result)).toBe(true);
        }

        //Check answers_list has 20 unique entries
        let answers: number[] = PG.answers();
        expect(answers.length).toBe(20);
        expect(answers.length == new Set(answers).size).toBe(true);

    });

    test("division", () => {
        //Because I kept division to the times tables, ie result can only be 
        //1-12, I only generate 12 divisions, if we have a purely division 
        //related level with more than 12 enemies, this functionality will need
        //to change.
        for (let i = 0; i < 12; i++ ) {
            let created: MathProblem = new PG("division");
            //Check type
            expect(created.operator).toBe("/");
            //Check equation
            expect(created.first_operand / 
                created.second_operand).toBe(created.result);
            //Check result in answers_list
            expect(PG.answers().includes(created.result)).toBe(true);
        }

        //Check answers_list has 12 unique entries
        let answers: number[] = PG.answers();
        expect(answers.length).toBe(12);
        expect(answers.length == new Set(answers).size).toBe(true);
    });
});
describe("ProblemGenerator remove function", () => {
    test("1 answer in answers_list", () => {
        let created: MathProblem = new PG("addition");
        let answers: number[] = PG.answers();
        expect(answers.length).toBe(1);
        PG.remove(created.result);
        expect(answers.length).toBe(0);
    });
    test("20 answers in answers_list", () => {
        for (let i = 0; i < 20; i++) {
            let created: MathProblem = new PG("addition");
        }
        let answers: number[] = PG.answers();
        expect(answers.length).toBe(20);
        let index = Math.round(Math.random() * 20);
        let answer = answers[index];
        PG.remove(answer);
        expect(answers.length).toBe(19);
        expect(answers.includes(answer)).toBe(false);
    });
});
