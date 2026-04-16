import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    capacityHoursPerWeek: {
      type: Number,
      required: true,
      min: 1,
      max: 168
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

resourceSchema.index({ name: 1, role: 1 }, { unique: true });

export const Resource = mongoose.model('Resource', resourceSchema);
