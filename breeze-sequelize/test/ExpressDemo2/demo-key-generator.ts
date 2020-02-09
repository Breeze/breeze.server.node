import { Model, Sequelize, DataTypes } from 'sequelize';
import { KeyGenerator } from 'breeze-sequelize';


export class DemoKeyGenerator implements KeyGenerator {
  nextId: number;
  groupSize: number;
  maxId: number;
  _count =  0;
  nextIdModel: any; // Ugh... can't seem to type this in any way that TS will accept - but this does work.

  constructor(sequelize: Sequelize, groupSize?: number) {
    this.nextId = null;
    this.groupSize = groupSize || 100;

    this.nextIdModel = sequelize.define('nextid', {
      Name: { field: 'Name', type: DataTypes.STRING, primaryKey: true },
      NextId: { field: 'NextId', type: DataTypes.INTEGER }
    }, { 
      freezeTableName: true, 
      timestamps: false 
    });
   
   }

   // returns a promise
  getNextId(property: any) {
    var retId = this.nextId;
    if (retId != null) {
      this.nextId++;
      if (this.nextId > this.maxId) {
        this.nextId = null;
      }
      return Promise.resolve(retId);
    } else {
      return this._updateNextId();
    }
  }

  private async _updateNextId(): Promise<number> {
    const nextIdItem = await this.nextIdModel.findByPk("GLOBAL");
    const nextId = nextIdItem.NextId;
    var nextIdToSave = nextId + this.groupSize;
    const infoArray = await this.nextIdModel.update({ NextId: nextIdToSave }, { where: { Name: "GLOBAL", NextId: nextId }});
    
    if (infoArray[0] == 1) {
      const retId = nextId;
      this.nextId = nextId + 1;
      this.maxId = retId + this.groupSize;
      this._count = 0;
      return retId;
    } else {
      this._count++;
      if (this._count > 3) {
        this._count = 0;
        throw new Error("Unable to generate a nextId");
      }
      return this._updateNextId();
    }
  }
}