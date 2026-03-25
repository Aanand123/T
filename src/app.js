const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { webhookHandler } = require('./services/botRuntime');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/admin', express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.post('/webhook/:botId/:secret', webhookHandler);

app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.redirect('/admin'));

module.exports = app;
