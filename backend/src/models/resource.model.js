import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    capacity_hours: {
      type: Number,
      default: 8,
      min: 1,
      max: 24
    },
    is_active: {
      type: Boolean,
      default: true
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

resourceSchema.index({ name: 1 }, { unique: true });

export const Resource = mongoose.model('Resource', resourceSchema);
