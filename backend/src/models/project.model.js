import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    is_active: {
      type: Boolean,
      default: true
    },
    color: {
      type: String,
      default: '#346a55',
      match: /^#[0-9a-fA-F]{6}$/
    },
    hours_type: {
      type: String,
      enum: ['BILLABLE', 'NON_BILLABLE'],
      default: 'BILLABLE',
      required: true
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

projectSchema.index({ name: 1 }, { unique: true });

export const Project = mongoose.model('Project', projectSchema);
