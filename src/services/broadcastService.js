const EventEmitter = require('events');
const User = require('../models/User');
const Bot = require('../models/Bot');
const { broadcastQueue, createBroadcastWorker } = require('./queue');
const { listRuntimeBotIds } = require('./botRuntime');

const progressBus = new EventEmitter();

function ensureWorker(runtimes) {
  createBroadcastWorker(async (job) => {
    const { botId, text, imageUrl } = job.data;
    const runtime = runtimes.get(botId);
    if (!runtime) return;

    const users = await User.find({ botId }).select('userId').lean();
    let done = 0;
    let success = 0;
    let failed = 0;

    for (const user of users) {
      try {
        if (imageUrl) await runtime.bot.telegram.sendPhoto(user.userId, imageUrl, { caption: text });
        else await runtime.bot.telegram.sendMessage(user.userId, text);
        success += 1;
      } catch (err) {
        failed += 1;
      }
      done += 1;
      const percent = users.length ? Math.round((done / users.length) * 100) : 100;
      progressBus.emit(String(job.id), { percent, done, total: users.length, success, failed });
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  });
}

async function queueBroadcast({ botId, text, imageUrl }) {
  const botExists = await Bot.exists({ _id: botId, status: 'active' });
  if (!botExists) throw new Error('Bot not active or not found');
  if (!listRuntimeBotIds().includes(String(botId))) throw new Error('Bot runtime is not started');
  const job = await broadcastQueue.add('broadcast', { botId, text, imageUrl });
  return job.id;
}

module.exports = { progressBus, queueBroadcast, ensureWorker };
