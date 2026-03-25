const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const env = require('../config/env');

const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
const broadcastQueue = new Queue('broadcasts', { connection });

function createBroadcastWorker(processor) {
  return new Worker('broadcasts', processor, { connection, concurrency: 20 });
}

module.exports = { broadcastQueue, createBroadcastWorker };
