import { Resource } from '../models/resource.model.js';

const managedModels = [Resource];

export async function syncSchema() {
  for (const model of managedModels) {
    await model.createCollection();
    await model.syncIndexes();
  }
}
