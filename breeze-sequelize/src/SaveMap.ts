import { Entity, EntityState, EntityType, StructuralType } from "breeze-client";
import { SequelizeSaveHandler, ServerEntityError, ServerEntityInfo, ServerEntityState } from "./SequelizeSaveHandler";

/** Maps EntityType names to arrays of EntityInfo */

export class SaveMap {
  private sequelizeSaveHandler: SequelizeSaveHandler;
  entityErrors: ServerEntityError[];
  errorMessage: string;

  constructor(sequelizeSaveHandler: SequelizeSaveHandler) {
    // make sequelizeSaveHandler non-enumerable so it won't be in Object.keys()
    Object.defineProperty(this,  "sequelizeSaveHandler", { value: sequelizeSaveHandler });
  }

  getEntityType(entityTypeName: string): StructuralType {
    return this.sequelizeSaveHandler.metadataStore.getEntityType(entityTypeName);
  }

  getEntityInfosOfType(entityTypeName: string): ServerEntityInfo[] {
    const entityType = this.getEntityType(entityTypeName);
    // entityType.name is fully qualified.
    return this[entityType.name] || [];
  }

  /** Add an entity to the map */
  addEntity(entityTypeName: string, entity: object, entityState: ServerEntityState = "Added" ) {
    const entityType = this.getEntityType(entityTypeName);
    entityTypeName = entityType.name; // fully qualified now.
    const entityInfo = {
      entity: entity, entityType: entityType, wasAddedOnServer: true,
      entityAspect: {
        entityTypeName: entityTypeName,
        entityState: entityState
      }
    } as ServerEntityInfo;
    const entityInfoList = this[entityTypeName];
    if (entityInfoList) {
      entityInfoList.push(entityInfo);
    } else {
      this[entityTypeName] = [entityInfo];
    }
    return entityInfo;
  }

  /** Add an error to the entityErrors collection */
  addEntityError(entityInfo: ServerEntityInfo, errorName: string, errorMessage: string, propertyName: string) {
    if (!this.entityErrors) {
      this.entityErrors = [];
    }

    const entityType = entityInfo.entityType;
    const keyValues = entityType.keyProperties.map(kp => entityInfo.entity[kp.nameOnServer]);
    this.entityErrors.push({
      entityTypeName: entityType.name,
      errorName: errorName,
      errorMessage: errorMessage,
      propertyName: propertyName,
      keyValues: keyValues
    });
  }

  /** Set the error message to return to the client */
  setErrorMessage(errorMessage: string) {
    this.errorMessage = errorMessage;
  }
}

