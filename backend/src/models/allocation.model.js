import mongoose from 'mongoose';

const allocationSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: true,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    allocationPercent: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      default: null
    },
    billingType: {
      type: String,
      required: true,
      enum: ['billable', 'non_billable'],
      default: 'billable'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

allocationSchema.index({ resourceId: 1, projectId: 1, startDate: 1 }, { unique: true });
allocationSchema.index({ projectId: 1, startDate: 1, endDate: 1 });

export const Allocation = mongoose.model('Allocation', allocationSchema);
