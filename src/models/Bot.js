const mongoose = require('mongoose');

const BotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    token: { type: String, required: true, unique: true, index: true },
    botUsername: { type: String, index: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
    webhookPath: { type: String, unique: true, index: true },
    lastError: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bot', BotSchema);
