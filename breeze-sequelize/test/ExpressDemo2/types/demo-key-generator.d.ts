import { Sequelize } from 'sequelize';
import { KeyGenerator } from 'breeze-sequelize';
export declare class DemoKeyGenerator implements KeyGenerator {
    nextId: number;
    groupSize: number;
    maxId: number;
    _count: number;
    constructor(sequelize: Sequelize, groupSize?: number);
    getNextId(property: any): Promise<number>;
    private _updateNextId;
}
