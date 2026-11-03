import {describe, expect, test } from "vitest";
import Enemy from "../MainLevel/Enemy";

describe("Test set for Enemy", () => {
    describe("Constructor tests", () => {
        test("Testing the Enemy constructor with 1, add", () => {
            //This call focuses on type:add and assuring all other parameters are 
            //as assumed
            let created: Enemy = new Enemy(1, "addition");
            //Ensuring all the variables are as expected
            expect(created.health).toBe(1);
            expect(created.speed).toBe(1);
            expect(created.lane).toBe(1);
            expect(created.positionX).toBe(0);
            expect(created.positionY).toBe(0);

            //Ensuring problem has operator + and is therefore from the addition 
            //function
            expect(created.problem.operator).toBe("+");
        });

        test("Testing the Enemy constructor with 2, sub", () => {
            //This call focuses on type:sub and assuring all other parameters are 
            //as assumed
            let created: Enemy = new Enemy(2, "subtraction");
            //Ensuring all the variables are as expected
            expect(created.health).toBe(1);
            expect(created.speed).toBe(1);
            expect(created.lane).toBe(2);
            expect(created.positionX).toBe(0);
            expect(created.positionY).toBe(0);
            
            //Ensuring problem has operator - and is therefore from the subtraction 
            //function
            expect(created.problem.operator).toBe("-");
        });

        test("Testing the Enemy constructor with 3, multiplication", () => {
            //This call focuses on type:multiplication
            //and assuring all other parameters are as assumed
            let created: Enemy = new Enemy(3, "multiplication");
            //Ensuring all the variables are as expected
            expect(created.health).toBe(1);
            expect(created.speed).toBe(1);
            expect(created.lane).toBe(3);
            expect(created.positionX).toBe(0);
            expect(created.positionY).toBe(0);
            
            //Ensuring problem has operator * and is therefore from the 
            //multiplication call
            expect(created.problem.operator).toBe("x");
        });

        test("Testing the Enemy constructor with 3, division", () => {
            //This call focuses on type:division
            //and assuring all other parameters are as assumed
            let created: Enemy = new Enemy(4, "division");
            //Ensuring all the variables are as expected
            expect(created.health).toBe(1);
            expect(created.speed).toBe(1);
            expect(created.lane).toBe(4);
            expect(created.positionX).toBe(0);
            expect(created.positionY).toBe(0);
            
            //Ensuring problem has operator / and is therefore from the 
            //division
            expect(created.problem.operator).toBe("/");
        });
    });

    describe("Function tests", () => {
        let enemy: Enemy = new Enemy(1, "addition");
        test("function advance", () => {
            let starterPos = enemy.positionX;
            enemy.advance();
            expect(enemy.positionX).toBe(starterPos - 50 * enemy.speed);
        });
        
        test("function takeHit", () => {
            let starterHealth = enemy.health;
            expect(enemy.takeHit(1)).toBe(starterHealth - 1);
        });

        test("function hasReachedPlayer", () => {
            //Testing obvious range calls
            enemy.positionX = 1000;
            expect(enemy.hasReachedPlayer()).toBe(false);
            enemy.positionX = 100;
            expect(enemy.hasReachedPlayer()).toBe(true);
            enemy.positionX = 99;
            expect(enemy.hasReachedPlayer()).toBe(true);
        });

        test("function attack", () => {
            //TODO
        })
    });
});