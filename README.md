# LAN Monitor Dashboard

Dashboard giám sát mạng LAN tích hợp Suricata IDS/IPS, ntopng traffic monitor, MikroTik router, và AI (DeepSeek) để phân tích và tự động block. **Bảo mật bằng 2FA TOTP (Google Authenticator).**

## 🚀 Deploy bằng Docker

```bash
# 1. Clone repo
git clone <repo-url> lan-monitor
cd lan-monitor

# 2. Cấu hình
cp .env.example .env
# Sửa các dòng sau trong .env:
#   DEEPSEEK_API_KEY=sk-...        (bắt buộc)
#   TOTP_SECRET=                   (để trống, tự sinh khi chạy)
#   JWT_SECRET=                    (để trống hoặc tự đặt)

# 3. Build & run
docker compose up -d --build

# 4. Lấy TOTP Secret (chạy lần đầu)
docker compose logs backend | grep "TOTP Secret"
# 👉 Quét QR code bằng Google Authenticator

# 5. Truy cập
# Dashboard: http://localhost:3000
# API Docs:  http://localhost:8000/docs
```

## 🔐 Đăng nhập 2FA

1. Lần đầu chạy backend, TOTP secret được in ra console
2. Mở **Google Authenticator** / **Authy** → quét mã QR hoặc nhập secret
3. Mỗi 30s có mã 6 chữ số mới → nhập mã để đăng nhập
4. JWT token tồn tại 24h (hoặc 30 ngày nếu chọn "Remember me")

## 📊 Trang Dashboard

| Trang | Dữ liệu | Chức năng |
|-------|---------|----------|
| **Dashboard** | Tổng hợp | KPI cards, traffic chart, recent alerts, top talkers, device map |
| **Suricata** | SSH→`10.100.101.250` | Alert table, filter/search, stats, detail modal, live ticker |
| **ntopng** | SSH tunnel→port 3000 | Bandwidth chart, live throughput, protocol pie, top talkers |
| **MikroTik** | SSH→`10.100.101.1` | CPU/Memory, interfaces, firewall rules, quick block, ARP |
| **AI Security** | DeepSeek API | Analyze alerts, auto-block, analysis history, block history |

## 🏗️ Kiến trúc

```
Browser → :3000 (nginx/React) → :8000 (FastAPI) → SSH → 10.100.101.250 (Suricata + ntopng)
                                                   → SSH → 10.100.101.1   (MikroTik)
                                                   → HTTPS → api.deepseek.com
```

## 📁 Dev local (không Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev
# → http://localhost:5173
```

## ⚙️ Biến môi trường (.env)

```bash
# SSH Server (Suricata + ntopng)
SURICATA_SERVER_HOST=10.100.101.250
SURICATA_SERVER_USER=dns
SURICATA_SERVER_PASS=1
SURICATA_EVE_PATH=/var/log/suricata/eve.json

# ntopng
NTOPNG_USER=admin
NTOPNG_PASS=Cuongdt@94

# MikroTik Router
MIKROTIK_HOST=10.100.101.1
MIKROTIK_USER=cuongdt
MIKROTIK_PASS=123@123pP

# AI
DEEPSEEK_API_KEY=sk-your-api-key-here

# Auth
JWT_SECRET=your-random-secret
TOTP_SECRET=              # Để trống, backend tự sinh
```

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12, FastAPI, asyncssh, SQLAlchemy 2.0, SQLite |
| Frontend | React 19, Vite 6, Tailwind CSS 4, Recharts, Framer Motion |
| Auth | 2FA TOTP (pyotp) + JWT |
| AI | DeepSeek API (OpenAI SDK) |
| Deploy | Docker + nginx |
