const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema(
  {
    botId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
    channelId: { type: String, required: true },
    username: { type: String, default: null },
    url: { type: String, default: null },
    title: { type: String, default: null },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

ChannelSchema.index({ botId: 1, channelId: 1 }, { unique: true });

module.exports = mongoose.model('Channel', ChannelSchema);
