# Multi-Bot Telegram Platform (Telegraf + Express + MongoDB + Redis)

Production-grade scaffold for a **multi-bot Telegram system** with a centralized dark-themed admin panel.

## Features
- Phase 1 core bot engine: Telegraf bot flow, force join, agent claim, invite logic
- Phase 2 admin panel: dark responsive dashboard for bot/channel/agent/settings operations
- Phase 3 integration: shared DB + webhook runtime + queue worker connecting bot and panel
- Multi-bot lifecycle management (add / remove / enable / disable)
- Webhook-based Telegraf runtime (no polling)
- Force-join flow with channel verification via `getChatMember`
- Referral + invite progression + leaderboard
- FIFO agent/phone assignment with duplicate-claim protection
- Message editor stored in DB, hot-applied
- Broadcast with BullMQ queue + real-time progress (SSE)
- JWT admin authentication
- Modular architecture ready for horizontal scaling

## Stack
- **Bot Runtime:** Node.js + Telegraf
- **Admin API/UI:** Express + Vanilla HTML/CSS/JS (dark responsive cards)
- **DB:** MongoDB (Mongoose)
- **Queue/Cache:** Redis + BullMQ

## Quick Start
1. Create `.env`:
```env
PORT=5000
BASE_URL=https://your-domain.com
MONGODB_URI=mongodb://127.0.0.1:27017/multi_bot_platform
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=change-this
ADMIN_USER=admin
ADMIN_PASS=strong-password
WEBHOOK_SECRET=another-secret
```
2. Install dependencies:
```bash
npm install
```
3. Start server:
```bash
npm start
```
4. Open admin panel:
```
http://localhost:5000/admin
```

## Production Notes
- Put behind reverse proxy (Nginx/Traefik) with TLS.
- Ensure Telegram webhook endpoint is publicly reachable at `BASE_URL`.
- Use Redis cluster and Mongo replica set for high throughput.
- Scale horizontally: multiple app instances sharing Mongo + Redis.
- Add rate-limiter and audit logs in front of admin APIs.
