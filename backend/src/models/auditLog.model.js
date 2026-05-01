import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    target_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    ip_address: {
      type: String,
      default: null
    },
    user_agent: {
      type: String,
      default: null
    },
    result: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS',
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

auditLogSchema.index({ created_at: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
