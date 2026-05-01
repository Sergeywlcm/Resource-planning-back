import mongoose from 'mongoose';

const userInvitationTokenSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token_hash: {
      type: String,
      required: true,
      unique: true
    },
    expires_at: {
      type: Date,
      required: true,
      index: true
    },
    used_at: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    versionKey: false
  }
);

userInvitationTokenSchema.index({ user_id: 1, used_at: 1, expires_at: 1 });

export const UserInvitationToken = mongoose.model('UserInvitationToken', userInvitationTokenSchema);
