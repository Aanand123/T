const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    botId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', unique: true, required: true, index: true },
    messages: {
      welcome: { type: String, default: '👋 Welcome!' },
      join: { type: String, default: 'Please join all channels to continue.' },
      checkButton: { type: String, default: '✅ CHECK JOINED' },
      fail: { type: String, default: '❌ You did not join all channels yet.' },
      afterJoin: { type: String, default: 'Great! You can continue now.' },
      claimButton: { type: String, default: '🎁 CLAIM MY AGENT' },
      agentAssigned: { type: String, default: '✅ Agent assigned: {{agent}}' },
      repeat: { type: String, default: '⚠️ You already claimed your agent: {{agent}}' },
      noAgent: { type: String, default: '😔 No agent currently available.' },
      inviteButton: { type: String, default: '📊 Invite Dashboard' },
      inviteText: { type: String, default: 'Invite friends using your referral link:' },
      inviteCountText: { type: String, default: 'Total invites: {{count}}' },
      inviteProgressText: { type: String, default: 'Progress: {{current}} / {{required}} | Remaining: {{remaining}}' },
      inviteNotification: { type: String, default: '🎉 You got a new verified invite! Total: {{count}}' },
    },
    inviteEnabled: { type: Boolean, default: true },
    inviteRequired: { type: Number, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingsSchema);
