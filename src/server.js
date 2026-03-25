const app = require('./app');
const env = require('./config/env');
const { connectDb } = require('./db/mongoose');
const { bootActiveBots, getRuntimes } = require('./services/botRuntime');
const { ensureWorker } = require('./services/broadcastService');

async function start() {
  await connectDb();
  await bootActiveBots();
  ensureWorker(getRuntimes());

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] running on :${env.port}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] fatal error', err);
  process.exit(1);
});
