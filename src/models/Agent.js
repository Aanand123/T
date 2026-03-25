const mongoose = require('mongoose');

const AgentSchema = new mongoose.Schema(
  {
    botId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
    number: { type: String, required: true },
    used: { type: Boolean, default: false, index: true },
    assignedToUserId: { type: Number, default: null },
    assignedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AgentSchema.index({ botId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model('Agent', AgentSchema);
