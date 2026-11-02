import PG from "../Math/ProblemGenerator"
import Player from "./PlayerCombatant"
import MathProblem from "../Math/MathProblem"

export default class Enemy {
    private _type: string;
    private _health: number;
    private _speed: number;
    private _lane: number;
    private _positionX: number;
    private _positionY: number;
    private _problem: MathProblem;
    private playerPos = 100;
    private adv_mult = 50;

    //Constructor has a lot of generalizations that will be more specific when 
    //we implement more features, ie: speed may be higher or lower than 1
    constructor(lane: number, type: string) {
        //For now health, speed, and type are initialized as one since we only
        //have one monster type
        this._type = type;
        this._health = 1;
        this._speed = 1;
        this._lane = lane;
        //As of now, position should be handled outside of Enemy
        this._positionX = 0;
        this._positionY = 0;
        //Calls ProblemGenerator based on the type
        if (type == "add") {
            this._problem = PG.add();
        } else if (type == "sub") { 
            this._problem = PG.sub();
        } else {
            //Maybe make this will throw an error in the future when we have 
            //all of our specifics sorted out.
            this._problem = PG.add_or_sub();
        }
    }

    public advance() {  
        this._positionX -= this._speed * this.adv_mult;
        // this._positionY += this._speed * adv_mult;
    }

    //Any hit for now one shots, maybe higher with different variants in the future
    public takeHit(dmg: number) {
        this._health -= dmg;
        return this._health;
    }

    //Depending on implementation, this could call this.attack()
    public hasReachedPlayer(): boolean {
        if (this._positionX <= this.playerPos) {
            return true;
        } else {
            return false;
        }
    }

    //This function makes me think there should also be a damage variable, but 
    //since there are no variants yet, maybe in the future.
    //Depending on implementation, this could call this.takeHit() so that Enemy
    //only hits once
    public attack(player: Player) {
        player.takeDamage(1);
    }

    //Setters for positionX and positionY
    public set positionX(posX: number) {
        this._positionX = posX;
    }

    public set positionY(posY: number) {
        this._positionY = posY;
    }

    //Getters for every variable
    public get type() {
        return this._type;
    }

    public get health() {
        return this._health;
    }

    public get speed() {
        return this._speed;
    }

    public get lane() {
        return this._lane;
    }

    public get positionX() {
        return this._positionX;
    }

    public get positionY() {
        return this._positionY;
    }

    public get problem() {
        return this._problem;
    }
}