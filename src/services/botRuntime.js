const crypto = require('crypto');
const { Telegraf, Markup } = require('telegraf');
const Bot = require('../models/Bot');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Channel = require('../models/Channel');
const Setting = require('../models/Setting');
const env = require('../config/env');
const { fillTemplate } = require('../utils/template');

const runtimes = new Map();

function referralCode(userId) {
  return Buffer.from(String(userId)).toString('base64url');
}

async function getSettings(botId) {
  let settings = await Setting.findOne({ botId });
  if (!settings) settings = await Setting.create({ botId });
  return settings;
}

async function verifyJoin(telegram, tgUserId, channels) {
  for (const ch of channels) {
    const member = await telegram.getChatMember(ch.channelId, tgUserId);
    if (!['member', 'administrator', 'creator'].includes(member.status)) return false;
  }
  return true;
}

async function assignAgent(botId, tgUserId) {
  return Agent.findOneAndUpdate(
    { botId, used: false },
    { $set: { used: true, assignedToUserId: tgUserId, assignedAt: new Date() } },
    { sort: { createdAt: 1 }, new: true }
  );
}

async function upsertUser(ctx, runtimeBot) {
  const code = referralCode(ctx.from.id);
  const update = {
    username: ctx.from.username || null,
    firstName: ctx.from.first_name || null,
    lastName: ctx.from.last_name || null,
    referralCode: code,
  };

  const user = await User.findOneAndUpdate(
    { botId: runtimeBot._id, userId: ctx.from.id },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return user;
}

function startKeyboard(settings, channels) {
  const rows = channels
    .map((c) => (c.url ? [Markup.button.url(c.username || c.title || c.channelId, c.url)] : null))
    .filter(Boolean);
  rows.push([Markup.button.callback(settings.messages.checkButton, 'CHECK_JOINED')]);
  return Markup.inlineKeyboard(rows);
}

async function onStart(ctx, runtimeBot) {
  const settings = await getSettings(runtimeBot._id);
  const channels = await Channel.find({ botId: runtimeBot._id }).sort({ order: 1 });
  const user = await upsertUser(ctx, runtimeBot);

  const payload = ctx.startPayload;
  if (payload && payload !== user.referralCode && !user.invitedBy) {
    const inviter = await User.findOne({ botId: runtimeBot._id, referralCode: payload });
    if (inviter && inviter.userId !== user.userId) {
      user.invitedBy = inviter.userId;
      await user.save();
    }
  }

  await ctx.reply(settings.messages.welcome);

  if (channels.length > 0) {
    await ctx.reply(settings.messages.join, startKeyboard(settings, channels));
  } else {
    await ctx.reply(settings.messages.afterJoin, Markup.inlineKeyboard([[Markup.button.callback(settings.messages.claimButton, 'CLAIM_AGENT')]]));
  }
}

async function onCheckJoined(ctx, runtimeBot) {
  const settings = await getSettings(runtimeBot._id);
  const channels = await Channel.find({ botId: runtimeBot._id }).sort({ order: 1 });
  if (!channels.length) {
    await ctx.answerCbQuery('No force-join channels configured.');
    await ctx.reply(settings.messages.afterJoin, Markup.inlineKeyboard([[Markup.button.callback(settings.messages.claimButton, 'CLAIM_AGENT')]]));
    return;
  }

  const ok = await verifyJoin(ctx.telegram, ctx.from.id, channels);
  if (!ok) {
    await ctx.answerCbQuery('Not completed');
    await ctx.reply(settings.messages.fail, startKeyboard(settings, channels));
    return;
  }

  const user = await User.findOneAndUpdate(
    { botId: runtimeBot._id, userId: ctx.from.id },
    { $set: { joined: true } },
    { new: true }
  );

  if (user && user.invitedBy && !user.invitedCredited) {
    const inviter = await User.findOneAndUpdate(
      { botId: runtimeBot._id, userId: user.invitedBy },
      { $inc: { inviteCount: 1 } },
      { new: true }
    );
    user.invitedCredited = true;
    await user.save();
    if (inviter) {
      await ctx.telegram.sendMessage(
        inviter.userId,
        fillTemplate(settings.messages.inviteNotification, { count: inviter.inviteCount })
      ).catch(() => null);
    }
  }

  await ctx.answerCbQuery('Verified');
  await ctx.reply(settings.messages.afterJoin, Markup.inlineKeyboard([
    [Markup.button.callback(settings.messages.claimButton, 'CLAIM_AGENT')],
    [Markup.button.callback(settings.messages.inviteButton, 'INVITE_DASHBOARD')],
  ]));
}

async function onClaim(ctx, runtimeBot) {
  const settings = await getSettings(runtimeBot._id);
  const user = await User.findOne({ botId: runtimeBot._id, userId: ctx.from.id });

  if (!user || !user.joined) {
    await ctx.answerCbQuery('Verify channel join first');
    return;
  }

  if (user.agentAssigned) {
    await ctx.reply(fillTemplate(settings.messages.repeat, { agent: user.agentAssigned }));
    return;
  }

  if (settings.inviteEnabled && user.inviteCount < settings.inviteRequired) {
    await ctx.reply(fillTemplate(settings.messages.inviteProgressText, {
      current: user.inviteCount,
      required: settings.inviteRequired,
      remaining: Math.max(settings.inviteRequired - user.inviteCount, 0),
    }));
    return;
  }

  const agent = await assignAgent(runtimeBot._id, ctx.from.id);
  if (!agent) {
    await ctx.reply(settings.messages.noAgent);
    return;
  }

  user.agentAssigned = agent.number;
  user.completed = true;
  await user.save();

  await ctx.reply(fillTemplate(settings.messages.agentAssigned, { agent: agent.number }));
}

async function onInviteDashboard(ctx, runtimeBot) {
  const settings = await getSettings(runtimeBot._id);
  const user = await User.findOne({ botId: runtimeBot._id, userId: ctx.from.id });
  if (!user) return;

  const botMeta = await Bot.findById(runtimeBot._id).lean();
  const link = `https://t.me/${botMeta.botUsername}?start=${user.referralCode}`;

  const lines = [
    settings.messages.inviteText,
    link,
    fillTemplate(settings.messages.inviteCountText, { count: user.inviteCount }),
    fillTemplate(settings.messages.inviteProgressText, {
      current: user.inviteCount,
      required: settings.inviteRequired,
      remaining: Math.max(settings.inviteRequired - user.inviteCount, 0),
    }),
  ];

  await ctx.reply(lines.join('\n\n'));
}

function generateWebhookPath(botId) {
  return `/webhook/${botId}/${crypto.randomBytes(8).toString('hex')}`;
}

async function launchBot(botDoc) {
  if (runtimes.has(String(botDoc._id))) return runtimes.get(String(botDoc._id));
  const bot = new Telegraf(botDoc.token);

  bot.start((ctx) => onStart(ctx, botDoc).catch(console.error));
  bot.action('CHECK_JOINED', (ctx) => onCheckJoined(ctx, botDoc).catch(console.error));
  bot.action('CLAIM_AGENT', (ctx) => onClaim(ctx, botDoc).catch(console.error));
  bot.action('INVITE_DASHBOARD', (ctx) => onInviteDashboard(ctx, botDoc).catch(console.error));

  const botInfo = await bot.telegram.getMe();
  if (!botDoc.botUsername || botDoc.botUsername !== botInfo.username) {
    botDoc.botUsername = botInfo.username;
  }
  if (!botDoc.webhookPath) {
    botDoc.webhookPath = generateWebhookPath(botDoc._id);
  }

  await bot.telegram.setWebhook(`${env.baseUrl}${botDoc.webhookPath}`, {
    secret_token: env.webhookSecret,
  });
  await botDoc.save();

  const runtime = { bot, botId: String(botDoc._id), webhookPath: botDoc.webhookPath };
  runtimes.set(String(botDoc._id), runtime);
  return runtime;
}

async function stopBot(botId) {
  const runtime = runtimes.get(String(botId));
  if (!runtime) return;
  await runtime.bot.telegram.deleteWebhook().catch(() => null);
  runtime.bot.stop();
  runtimes.delete(String(botId));
}

async function bootActiveBots() {
  const bots = await Bot.find({ status: 'active' });
  for (const botDoc of bots) {
    // Each bot launches with isolated Telegraf instance for scalability and separation.
    await launchBot(botDoc).catch(async (err) => {
      botDoc.lastError = err.message;
      await botDoc.save();
      // eslint-disable-next-line no-console
      console.error('[bot] launch failed', botDoc._id.toString(), err.message);
    });
  }
}

function webhookHandler(req, res) {
  const runtime = [...runtimes.values()].find((r) => r.webhookPath === req.path);
  if (!runtime) return res.status(404).json({ error: 'Unknown webhook' });
  if (req.headers['x-telegram-bot-api-secret-token'] !== env.webhookSecret) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }
  return runtime.bot.handleUpdate(req.body, res);
}

function listRuntimeBotIds() {
  return [...runtimes.keys()];
}

function getRuntimes() {
  return runtimes;
}

module.exports = { launchBot, stopBot, bootActiveBots, webhookHandler, listRuntimeBotIds, getRuntimes };
