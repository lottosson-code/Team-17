import {describe, expect, test } from "vitest";
import MathEngine from "../MainLevel/MathEngine";

describe("MathEngine, all answers should be in answers_list", () => {
    test("and generates a correct equation, is unique, has 20 answers," +
        "and succesfully resets answers_list afterwards", 
        () => {
        for (let i = 0; i < 20; i++ ) {
            let created: {a: number, b: number, c: number} = 
                MathEngine.add();
            expect(created.a + created.b).toBe(created.c);
            expect(MathEngine.answers().includes(created.c)).toBe(true);
        }

        let answers: number[] = MathEngine.answers();
        expect(answers.length).toBe(20);
        expect(answers.length == new Set(answers).size).toBe(true);

        MathEngine.reset();
        expect(MathEngine.answers().length).toBe(0); 
    });

    test("sub generates a correct equation, is unique, has 20 answers," +
        "and succesfully resets answers_list afterwards", 
        () => {
        for (let i = 0; i < 20; i++ ) {
            let created: {a: number, b: number, c: number} = 
                MathEngine.sub();
            expect(created.a - created.b).toBe(created.c);
            expect(MathEngine.answers().includes(created.c)).toBe(true);
        }

        let answers: number[] = MathEngine.answers();
        expect(answers.length).toBe(20);
        expect(answers.length == new Set(answers).size).toBe(true);

        MathEngine.reset();
        expect(MathEngine.answers().length).toBe(0);
    });
    
    test("add_sub generates a correct equation, is unique, has 20 answers," +
        "and succesfully resets answers_list afterwards", 
        () => {
        for (let i = 0; i < 20; i++ ) {
            let created: {a: number, b: number, c: number, d: string} = 
                MathEngine.add_or_sub();

            if (created.d == "add") {
                expect(created.a + created.b).toBe(created.c);
            } else if (created.d == "sub") {
                expect(created.a - created.b).toBe(created.c);
            } else { //If d is neither add or sub which it should be
                expect(true).toBe(false);
            }
            expect(MathEngine.answers().includes(created.c)).toBe(true);
        }

        let answers: number[] = MathEngine.answers();
        expect(answers.length).toBe(20);
        expect(answers.length == new Set(answers).size).toBe(true);

        MathEngine.reset();
        expect(MathEngine.answers().length).toBe(0);
    });
});