# LAN Monitor Dashboard

Dashboard giám sát mạng LAN tích hợp Suricata IDS/IPS, ntopng traffic monitor, MikroTik router, và AI (DeepSeek) để phân tích và tự động block.

## Kiến trúc

| Data Source | Host | Method |
|-------------|------|--------|
| Suricata | 10.100.101.250 | SSH tail eve.json |
| ntopng | 10.100.101.250 | SSH tunnel → REST API |
| MikroTik | 10.100.101.1 | SSH RouterOS |
| DeepSeek AI | api.deepseek.com | OpenAI-compatible API |

## Deploy với Docker

```bash
# 1. Clone repo
git clone <repo-url> lan-monitor
cd lan-monitor

# 2. Cấu hình
cp .env.example .env
# Sửa DEEPSEEK_API_KEY trong .env

# 3. Build & run
docker compose up -d --build

# 4. Truy cập
# Dashboard: http://<server-ip>:3000
# API Docs: http://<server-ip>:8000/docs
```

## Dev local

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env  # Chỉnh API key
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev
# → http://localhost:5173
```

## Tính năng

- **Dashboard** — Tổng quan alerts, traffic, devices, blocks
- **Suricata** — Real-time alerts từ eve.json, filter/search/pagination
- **ntopng** — Bandwidth chart, top talkers, protocol breakdown
- **MikroTik** — Router status, interfaces, firewall rules, quick block
- **AI Security** — DeepSeek phân tích alert, tự động block IP qua MikroTik khi confidence > 70%
- **Real-time WebSocket** — Alert mới hiển thị ngay lập tức
- **Responsive** — Mobile, tablet, desktop

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12, FastAPI, asyncssh, SQLAlchemy 2.0, SQLite |
| Frontend | React 19, Vite 6, Tailwind CSS 4, Recharts, Framer Motion |
| AI | DeepSeek API (OpenAI SDK) |
| Deploy | Docker + nginx |
