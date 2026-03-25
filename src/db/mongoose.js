const mongoose = require('mongoose');
const env = require('../config/env');

async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongodbUri, {
    autoIndex: true,
    maxPoolSize: 30,
  });
  // eslint-disable-next-line no-console
  console.log('[db] MongoDB connected');
}

module.exports = { connectDb };
