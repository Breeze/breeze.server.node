import { Model, Sequelize, DataTypes } from 'sequelize';
import { KeyGenerator } from 'breeze-sequelize';

class NextIdModel extends Model {
  name: string;
  nextId: number;   
 }

export class DemoKeyGenerator implements KeyGenerator {
  nextId: number;
  groupSize: number;
  maxId: number;
  _count: number;

  constructor(sequelize: Sequelize, groupSize?: number) {
    this.nextId = null;
    this.groupSize = groupSize || 100;

    NextIdModel.init({
      name: { 
        field: 'Name',
        type: DataTypes.STRING, 
        primaryKey: true 
      }, 
      nextId: {
        field: 'NextId',
        type: DataTypes.INTEGER
      }
    }, { 
      sequelize: sequelize,
      tableName: 'nextId',
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
    const nextIdItem = await NextIdModel.findByPk("GLOBAL");
    const nextId = nextIdItem.nextId;
    var nextIdToSave = nextId + this.groupSize;
    const infoArray = await NextIdModel.update({ NextId: nextIdToSave }, { where: { Name: "GLOBAL", NextId: nextId }});
    
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