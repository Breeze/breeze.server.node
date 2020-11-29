import { breeze } from "breeze-client";
import { connect } from "./dbUtils";
import { ModelMapper } from "./ModelMapper";
import { SaveMap } from './SaveMap';
import { KeyGenerator, SequelizeManager } from "./SequelizeManager";
import { SequelizeQuery, SequelizeQueryResult, urlToEntityQuery } from "./SequelizeQuery";
import { SequelizeSaveHandler, ServerEntity, ServerEntityAspect, ServerEntityInfo, ServerEntityState, ServerSaveResult } from "./SequelizeSaveHandler";

const Sequelize = SequelizeManager.Sequelize;

export {
  Sequelize, SequelizeQuery, SequelizeManager, SequelizeSaveHandler, KeyGenerator,
  SequelizeQueryResult, ServerSaveResult as SequelizeSaveResult, SaveMap,
  ServerEntity, ServerEntityAspect, ServerEntityInfo, ServerEntityState, ModelMapper,
  urlToEntityQuery, connect, breeze
};
