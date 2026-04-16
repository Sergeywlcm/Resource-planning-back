import { Allocation } from '../models/allocation.model.js';
import { Project } from '../models/project.model.js';
import { Resource } from '../models/resource.model.js';

const managedModels = [Resource, Project, Allocation];

export async function syncSchema() {
  for (const model of managedModels) {
    await model.createCollection();
    await model.syncIndexes();
  }
}
