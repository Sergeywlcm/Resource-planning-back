import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 24
    },
    status: {
      type: String,
      required: true,
      enum: ['planned', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'planned'
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

projectSchema.index({ code: 1 }, { unique: true });
projectSchema.index({ name: 1, status: 1 });

export const Project = mongoose.model('Project', projectSchema);
