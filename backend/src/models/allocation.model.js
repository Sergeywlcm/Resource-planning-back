import mongoose from 'mongoose';

import { Project } from './project.model.js';
import { Resource } from './resource.model.js';

const allocationSchema = new mongoose.Schema(
  {
    resource_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: true,
      index: true,
      validate: {
        validator: async function validateResourceExists(resourceId) {
          if (!resourceId) {
            return false;
          }

          const existingResource = await Resource.exists({ _id: resourceId });
          return Boolean(existingResource);
        },
        message: 'Allocation must reference an existing resource.'
      }
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
      validate: {
        validator: async function validateProjectExists(projectId) {
          if (!projectId) {
            return false;
          }

          const existingProject = await Project.exists({ _id: projectId });
          return Boolean(existingProject);
        },
        message: 'Allocation must reference an existing project.'
      }
    },
    start_date: {
      type: Date,
      required: true
    },
    end_date: {
      type: Date,
      required: true,
      validate: {
        validator: function validateEndDate(endDate) {
          if (!this.start_date || !endDate) {
            return false;
          }

          return endDate >= this.start_date;
        },
        message: 'start_date cannot be after end_date.'
      }
    },
    hours_per_day: {
      type: Number,
      required: true,
      min: [0.000001, 'hours_per_day must be greater than 0.']
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      }
    }
  }
);

allocationSchema.index({ resource_id: 1, project_id: 1, start_date: 1, end_date: 1 });

export const Allocation = mongoose.model('Allocation', allocationSchema);
