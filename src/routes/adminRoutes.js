const express = require('express');
const mongoose = require('mongoose');
const Bot = require('../models/Bot');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Channel = require('../models/Channel');
const Setting = require('../models/Setting');
const { requireAuth } = require('../middlewares/auth');
const { launchBot, stopBot, listRuntimeBotIds, getRuntimes } = require('../services/botRuntime');
const { queueBroadcast, progressBus } = require('../services/broadcastService');

const router = express.Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res) => {
  const botId = req.query.botId;
  const filter = botId ? { botId: new mongoose.Types.ObjectId(botId) } : {};

  const [totalBots, activeBots, totalUsers, joinedUsers, completedUsers, recentUsers] = await Promise.all([
    Bot.countDocuments(),
    Bot.countDocuments({ status: 'active' }),
    User.countDocuments(filter),
    User.countDocuments({ ...filter, joined: true }),
    User.countDocuments({ ...filter, completed: true }),
    User.find(filter).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  res.json({ totalBots, activeBots, totalUsers, joinedUsers, completedUsers, recentUsers, runtimeActive: listRuntimeBotIds() });
});

router.get('/bots', async (req, res) => res.json(await Bot.find().sort({ createdAt: -1 })));
router.post('/bots', async (req, res) => {
  const bot = await Bot.create({ token: req.body.token, name: req.body.name, status: 'active' });
  await Setting.create({ botId: bot._id });
  await launchBot(bot);
  res.json(bot);
});
router.delete('/bots/:id', async (req, res) => {
  await stopBot(req.params.id);
  await Promise.all([
    Bot.findByIdAndDelete(req.params.id),
    User.deleteMany({ botId: req.params.id }),
    Agent.deleteMany({ botId: req.params.id }),
    Channel.deleteMany({ botId: req.params.id }),
    Setting.deleteMany({ botId: req.params.id }),
  ]);
  res.json({ ok: true });
});
router.patch('/bots/:id/status', async (req, res) => {
  const status = req.body.status === 'active' ? 'active' : 'disabled';
  const bot = await Bot.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (status === 'active') await launchBot(bot);
  else await stopBot(bot._id);
  res.json(bot);
});

router.get('/settings/:botId', async (req, res) => {
  let s = await Setting.findOne({ botId: req.params.botId });
  if (!s) s = await Setting.create({ botId: req.params.botId });
  res.json(s);
});
router.put('/settings/:botId', async (req, res) => {
  const s = await Setting.findOneAndUpdate({ botId: req.params.botId }, req.body, { upsert: true, new: true });
  res.json(s);
});

router.get('/channels/:botId', async (req, res) => res.json(await Channel.find({ botId: req.params.botId }).sort({ order: 1 })));
router.post('/channels/:botId', async (req, res) => {
  const last = await Channel.findOne({ botId: req.params.botId }).sort({ order: -1 });
  const created = await Channel.create({ ...req.body, botId: req.params.botId, order: (last?.order || 0) + 1 });
  res.json(created);
});
router.put('/channels/:botId/:id', async (req, res) => res.json(await Channel.findOneAndUpdate({ _id: req.params.id, botId: req.params.botId }, req.body, { new: true })));
router.delete('/channels/:botId/:id', async (req, res) => {
  await Channel.deleteOne({ _id: req.params.id, botId: req.params.botId });
  res.json({ ok: true });
});
router.post('/channels/:botId/reorder', async (req, res) => {
  const updates = req.body.items || [];
  await Promise.all(updates.map((x, idx) => Channel.updateOne({ _id: x.id, botId: req.params.botId }, { $set: { order: idx + 1 } })));
  res.json({ ok: true });
});

router.get('/agents/:botId', async (req, res) => res.json(await Agent.find({ botId: req.params.botId }).sort({ createdAt: 1 })));
router.post('/agents/:botId', async (req, res) => res.json(await Agent.create({ botId: req.params.botId, number: req.body.number })));
router.post('/agents/:botId/bulk', async (req, res) => {
  const numbers = String(req.body.lines || '')
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((number) => ({ botId: req.params.botId, number }));
  const result = await Agent.insertMany(numbers, { ordered: false }).catch(() => []);
  res.json({ inserted: result.length || 0 });
});
router.delete('/agents/:botId/:id', async (req, res) => {
  await Agent.deleteOne({ _id: req.params.id, botId: req.params.botId });
  res.json({ ok: true });
});
router.delete('/agents/:botId', async (req, res) => {
  await Agent.deleteMany({ botId: req.params.botId });
  res.json({ ok: true });
});

router.get('/leaderboard/:botId', async (req, res) => {
  const rows = await User.find({ botId: req.params.botId }).sort({ inviteCount: -1 }).limit(5).lean();
  res.json(rows);
});

router.post('/broadcast/:botId', async (req, res) => {
  const jobId = await queueBroadcast({ botId: req.params.botId, text: req.body.text, imageUrl: req.body.imageUrl || null });
  res.json({ jobId });
});

router.get('/broadcast/:jobId/stream', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream');
  const handler = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  progressBus.on(req.params.jobId, handler);
  req.on('close', () => progressBus.off(req.params.jobId, handler));
});

router.get('/health/runtimes', async (req, res) => {
  res.json({ ids: listRuntimeBotIds(), size: getRuntimes().size });
});

module.exports = router;
