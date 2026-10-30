import {describe, expect, test } from "vitest";
import PG from "../Math/ProblemGenerator";  //ProblemGenerator shortened to PG

describe("PG, all answers should be in answers_list", () => {
    test("add generates a correct Problem, is unique, has 20 answers," +
        "and succesfully resets answers_list afterwards", 
        () => {
        for (let i = 0; i < 20; i++ ) {
            let created: MathProblem = PG.add();
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

        //Check reset replaces answers_list with a new list
        PG.reset();
        expect(PG.answers().length).toBe(0); 
    });

    test("sub generates a correct Problem, is unique, has 20 answers," +
        "and succesfully resets answers_list afterwards", 
        () => {
        for (let i = 0; i < 20; i++ ) {
            let created: MathProblem = PG.sub();
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

        //Check reset replaces answers_list with a new list
        PG.reset();
        expect(PG.answers().length).toBe(0);
    });
    
    test("add_or_sub generates a correct Problem, is unique, has 20 answers," +
        "and succesfully resets answers_list afterwards", 
        () => {
        for (let i = 0; i < 20; i++ ) {
            let created: MathProblem = PG.add_or_sub();

            //Check equation
            if (created.operator == "+") {
                expect(created.first_operand + 
                    created.second_operand).toBe(created.result);
            } else if (created.operator == "-") {
                expect(created.first_operand - 
                    created.second_operand).toBe(created.result);
            } else { //If d is neither + or - which it should be
                expect(true).toBe(false);
            }
            //Check result in answers_list
            expect(PG.answers().includes(created.result)).toBe(true);
        }

        //Check answers_list has 20 unique entries
        let answers: number[] = PG.answers();
        expect(answers.length).toBe(20);
        expect(answers.length == new Set(answers).size).toBe(true);

        //Check reset replaces answers_list with a new list
        PG.reset();
        expect(PG.answers().length).toBe(0);
    });
});