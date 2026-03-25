const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    botId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
    userId: { type: Number, required: true },
    username: String,
    firstName: String,
    lastName: String,
    joined: { type: Boolean, default: false, index: true },
    completed: { type: Boolean, default: false, index: true },
    invitedBy: { type: Number, default: null, index: true },
    referralCode: { type: String, index: true },
    inviteCount: { type: Number, default: 0 },
    agentAssigned: { type: String, default: null },
    invitedCredited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.index({ botId: 1, userId: 1 }, { unique: true });
UserSchema.index({ botId: 1, referralCode: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', UserSchema);
