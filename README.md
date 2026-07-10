# 🛡️ AI Shield — Headless Monitoring & Security Shield

A lightweight, containerized network security automation system for home/office networks. Monitors Suricata IDS alerts, aggregates threats, uses DeepSeek AI to classify malicious activity, and automatically blocks confirmed threats on a MikroTik router.

---

## Architecture

```
Suricata eve.json → Tailer → Normalizer → Whitelist → Aggregator
  → Threshold Filter → DeepSeek AI Analysis → Risk Decision
  → Dry-Run Gate → MikroTik Firewall Block → Audit Log → Telegram Alert
```

**Dashboard:** React + TailwindCSS, protected by JWT + TOTP authentication.

---

## Prerequisites

- Docker & Docker Compose
- Suricata running on the host (providing `/var/log/suricata/eve.json`)
- ntopng running (optional, for network stats)
- MikroTik router with SSH access
- DeepSeek API key (optional, for AI analysis)

---

## Quick Start

### 1. Clone & Configure

```bash
cd /opt  # or your preferred location
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
DEEPSEEK_API_KEY=sk-your-key
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=your-router-password
JWT_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")

# Optional (disable with empty string)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### 2. Configure MikroTik Firewall (one-time setup)

SSH into your MikroTik router and run:

```routeros
# Create the address-list (the backend will populate this)
/ip/firewall/address-list

# Add firewall rules to drop traffic from blacklisted IPs
/ip/firewall/filter
add chain=input src-address-list=ai_blacklist action=drop comment="AI Shield blacklist input"
add chain=forward src-address-list=ai_blacklist action=drop comment="AI Shield blacklist forward"

# Move these rules to the top if needed
/ip/firewall/filter move [find comment="AI Shield blacklist input"] destination=0
/ip/firewall/filter move [find comment="AI Shield blacklist forward"] destination=1
```

### 3. Start the Services

```bash
# Start backend + frontend
docker compose up -d

# Or with reverse proxy (unified port 80)
docker compose --profile proxy up -d

# Check logs
docker compose logs -f shield-backend
```

### 4. Create Admin User

```bash
# Without TOTP (add --totp for 2FA)
docker compose exec shield-backend python scripts/init_admin.py \
  --username admin \
  --password your-secure-password \
  --totp
```

### 5. Access the Dashboard

- **Direct:** http://your-server:3500
- **With reverse proxy:** http://your-server
- **Backend API:** http://your-server:8088

Login with the admin credentials created above.

---

## Directory Structure

```
├── .env                          # Secrets (NOT committed)
├── docker-compose.yml            # Production compose
├── config/
│   ├── whitelist.txt             # IPs/CIDRs never to block (hot-reloaded)
│   └── thresholds.yaml           # Aggregation rules (hot-reloaded)
├── shield-backend/               # FastAPI backend
│   ├── app/
│   │   ├── main.py               # App factory + lifespan
│   │   ├── config.py             # Pydantic Settings
│   │   ├── database.py           # Async SQLAlchemy
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── services/             # Business logic services
│   │   ├── api/                  # REST API routers
│   │   ├── auth/                 # JWT + TOTP auth
│   │   └── workers/              # Background pipeline
│   └── scripts/
│       ├── init_admin.py         # Create admin user
│       └── export_reports.py     # Export data to CSV/SQLite
├── shield-frontend/              # React + TailwindCSS
└── data/ logs/ exports/          # Runtime data (mounted volumes)
```

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DRY_RUN` | `true` | If true, never pushes firewall rules — safe default |
| `AI_BLOCK_RISK_SCORE` | `8` | Minimum risk score (0-10) to block an IP |
| `DEEPSEEK_TIMEOUT_SECONDS` | `8` | Timeout for each AI API call |
| `AI_MAX_CONCURRENT_REQUESTS` | `2` | Max concurrent DeepSeek calls |
| `MIKROTIK_BLACKLIST_TIMEOUT` | `7d` | Auto-expiry for blocked IPs |
| `RETENTION_ALERT_DAYS` | `7` | Days to keep Suricata alerts |
| `RETENTION_AI_REPORT_DAYS` | `30` | Days to keep AI reports |
| `RETENTION_AUDIT_DAYS` | `90` | Days to keep audit logs |
| `PRUNE_INTERVAL_HOURS` | `6` | How often to clean old data |

### Thresholds (thresholds.yaml)

```yaml
rules:
  ssh_bruteforce:
    min_count: 10        # 10+ SSH attempts in 5 min → analyze
    window_seconds: 300
  port_scan:
    min_unique_ports: 20 # 20+ unique ports in 5 min → analyze
    window_seconds: 300
  critical_suricata:
    match_severity: 1    # Any severity-1 alert → 3+ triggers analysis
    min_count: 3
    window_seconds: 300
```

### Whitelist (whitelist.txt)

One CIDR or IP per line. These are **never** blocked, even if the AI says malicious:

```text
10.100.101.0/24
10.100.101.1       # MikroTik router
10.100.101.250     # Ubuntu Server
192.168.0.0/16
172.16.0.0/12
```

---

## API Endpoints

All endpoints except `/health` and `/api/auth/login` require JWT authentication.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check (all services) |
| `POST` | `/api/auth/login` | No | Login (username + password + totp) |
| `POST` | `/api/auth/setup-totp` | Yes | Enable TOTP |
| `GET` | `/api/auth/me` | Yes | Current user info |
| `GET` | `/api/overview` | Yes | Dashboard overview stats |
| `GET` | `/api/alerts` | Yes | Suricata alerts (paginated) |
| `GET` | `/api/alerts/stats` | Yes | Alert statistics |
| `GET` | `/api/ai-reports` | Yes | AI threat reports |
| `GET` | `/api/blocked-ips` | Yes | Blocked IP history |
| `GET` | `/api/mikrotik/health` | Yes | Router CPU/RAM/interfaces |
| `GET` | `/api/ntopng/stats` | Yes | ntopng network statistics |
| `GET` | `/api/ntopng/top-hosts` | Yes | Top bandwidth consumers |
| `GET` | `/api/ntopng/active-flows` | Yes | Active network flows |
| `GET` | `/api/audit-logs` | Yes | Audit trail |
| `GET` | `/api/settings` | Yes | Current configuration |
| `PUT` | `/api/settings` | Admin | Update settings |

---

## Exporting Data

```bash
# Export all data to CSV
docker compose exec shield-backend python scripts/export_reports.py \
  --output /exports/security_report.csv

# Export only blocked IPs
docker compose exec shield-backend python scripts/export_reports.py \
  --output /exports/blocked.csv --type blocked-ips

# Export as SQLite copy
docker compose exec shield-backend python scripts/export_reports.py \
  --output /exports/backup.db --format sqlite

# Filter by date range
docker compose exec shield-backend python scripts/export_reports.py \
  --output /exports/recent.csv --since 2026-07-01 --until 2026-07-10
```

---

## Troubleshooting

### "eve.json not found"
Ensure Suricata is running and the path is correctly mounted:
```bash
ls -la /var/log/suricata/eve.json
docker compose exec shield-backend ls -la /var/log/suricata/eve.json
```

### "MikroTik SSH down" health status
- Verify SSH is enabled on the router: `/ip ssh print`
- Check credentials in `.env`
- Test: `ssh admin@10.100.101.1`

### "DeepSeek API key not configured"
- Without a key, AI analysis is skipped and all traffic is allowed
- Set `DEEPSEEK_API_KEY` in `.env` and restart

### Config hot-reload not working
- The watcher checks mtime every 5 seconds
- Ensure files are mounted correctly: `docker compose exec shield-backend ls -la /app/config/`

---

## Security Notes

- **Dry-run is the default.** Set `DRY_RUN=false` only when you've verified the pipeline works.
- **Whitelist always wins.** Local IPs, router IP, and trusted ranges are never blocked.
- **No secrets in the frontend.** The dashboard never receives API keys or credentials.
- **Use strong JWT secrets.** Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
- **Enable TOTP.** Run `init_admin.py --totp` for two-factor authentication.
- **All external calls have timeouts.** A slow DeepSeek or dead MikroTik won't crash the service.

---

## License

Internal use. Review your local laws before deploying automated firewall blocking.
