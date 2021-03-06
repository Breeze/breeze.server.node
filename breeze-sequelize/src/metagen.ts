import { breeze, EntityManager } from "breeze-client";
import { ModelLibraryBackingStoreAdapter } from "breeze-client/adapter-model-library-backing-store";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { Sequelize } from "sequelize";
import { ModelMapper } from "./ModelMapper";

// Generates Breeze metadata from Sequelize models

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: " + process.argv[0] + " " + process.argv[1] + " [modeldir] [namespace] [metadata.json]\n" +
  "Generates Breeze metadata from Sequelize models in [modeldir], putting entities in [namespace]\n" +
  "writes file [metadata.json] in the current directory.");
  process.exit(1);
}
const modeldir = resolve(args[0]);
const namespace = args[1];
const outfile = args.length > 2 ? args[2] : "metadata.json";

if (!existsSync(modeldir)) {
  console.log("Directory '" + modeldir + "' does not exist.");
  process.exit(2);
}

// dialect is required but meaningless when we are just loading the models
const sq = new Sequelize({ dialect: 'mysql'});

ModelMapper.loadSequelizeModels(sq, modeldir);

ModelLibraryBackingStoreAdapter.register(breeze.config);
const metadataStore = new EntityManager().metadataStore;
const mm = new ModelMapper(metadataStore);

mm.addModels(sq, namespace);

const metadata = metadataStore.exportMetadata();

writeFileSync(outfile, metadata);
console.log("Wrote " + outfile);




