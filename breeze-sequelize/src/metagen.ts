import { readdirSync, existsSync, fstat, write, writeFileSync } from "fs";
import { join, resolve } from "path";
import { Sequelize, Dialect } from "sequelize";
import { EntityManager, breeze } from "breeze-client";
import { ModelMapper } from "./ModelMapper";
import { ModelLibraryBackingStoreAdapter } from "breeze-client/adapter-model-library-backing-store";

// Generates Breeze metadata from Sequelize models

let args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: " + process.argv[0] + " " + process.argv[1] + " [modeldir] [namespace]\n" + 
  "Generates Breeze metadata from Sequelize models in [modeldir], putting entities in [namespace]\n" +
  "writes file metadata.json in the current directory.");
  process.exit(1);
}
let modeldir = resolve(args[0]);
let namespace = args[1];

if (!existsSync(modeldir)) {
  console.log("Directory '" + modeldir + "' does not exist.");
  process.exit(2);
}

// dialect is required but meaningless when we are just loading the models
let sq = new Sequelize({ dialect: 'mysql'});

let files = readdirSync(modeldir);
files.forEach(file => {
  sq.import(join(modeldir, file));
});

ModelLibraryBackingStoreAdapter.register(breeze.config);
let metadataStore = new EntityManager().metadataStore;
let mm = new ModelMapper(metadataStore);

mm.addModels(sq, namespace);

let metadata = metadataStore.exportMetadata();

writeFileSync("metadata.json", metadata);
console.log("Wrote metadata.json");




