import { Allocation } from '../models/allocation.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { Project } from '../models/project.model.js';
import { Resource } from '../models/resource.model.js';
import { UserInvitationToken } from '../models/userInvitationToken.model.js';
import { User } from '../models/user.model.js';

const managedModels = [Resource, Project, Allocation, User, UserInvitationToken, AuditLog];

export async function syncSchema() {
  for (const model of managedModels) {
    await model.createCollection();
    await model.syncIndexes();
  }
}
