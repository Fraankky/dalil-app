# Dalil — First-Deploy Runbook

End-to-end deploy guide for the production stack (backend on VPS, frontend on
Cloudflare Pages). Assumes a clean Linux VPS with root/sudo and a domain with
DNS control.

---

## 0. VPS prep (TencentOS Server 4)

Panduan ini untuk TencentOS Server 4 (RHEL/CentOS 8-compatible, pakai `dnf` &
`firewalld`). VPS hanya butuh **git + Docker** — backend di-build di dalam
Docker, frontend di-build di Cloudflare Pages, jadi node/pnpm tidak perlu di
VPS.

### 0a. Install git

```bash
sudo dnf install -y git
```

### 0b. Install Docker CE

TencentOS 4 melapor diri sebagai `$releasever=4`, tapi Docker CE cuma
publish repo untuk CentOS 7/8/9. Override ke `8`. Selain itu TencentOS 4
tidak menyediakan `container-selinux` yang jadi dependency Docker CE, jadi
pakai `--nobest` untuk skip (~Docker tetap jalan, hanya tanpa SELinux policy
module untuk container).

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo sed -i 's/\$releasever/8/g' /etc/yum.repos.d/docker-ce.repo
sudo dnf install -y --nobest docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# logout-login atau: newgrp docker
```

### 0c. Buka firewall (port 80/443)

```bash
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

### 0d. DNS + clone repo

- Point a DNS **A record** for `DOMAIN` (e.g. `api.dalil.app`) at the VPS
  public IP. Wait for propagation: `dig +short ${DOMAIN}`.
- Clone the repo onto the VPS:
  ```bash
  git clone https://github.com/Fraankky/dalil-app.git /opt/dalil
  cd /opt/dalil
  ```

---

## 1. Buat `.env.prod`

```bash
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod
```

`.env.prod` adalah file rahasia — tidak pernah di-commit. Berisi semua
credential. Template sudah siap, tinggal ganti setiap `CHANGE_ME`.

### Variable yang WAJIB diganti

| Variable | Contoh | Penjelasan |
|---|---|---|
| `POSTGRES_PASSWORD` | `gK9$mN4*xQ7!zL2@pR5` | Password database. ≥ 24 karakter random. |
| `DATABASE_URL` | `postgresql+asyncpg://dalil:gK9$...@db:5432/dalil` | Async URL — ganti CHANGE_ME dengan password yang sama dengan POSTGRES_PASSWORD. |
| `DATABASE_URL_SYNC` | `postgresql://dalil:gK9$...@db:5432/dalil` | Sync URL (alembic) — password harus sama dengan DATABASE_URL. |
| `REDIS_PASSWORD` | `aB7#xK2$pL9!mN4@qR5` | Password Redis. ≥ 24 karakter random. **Baru** — sebelumnya Redis tanpa auth. |
| `REDIS_URL` | `redis://:aB7#...@redis:6379/0` | URL Redis dengan password embedded. Format: `redis://:password@host:port/db`. |
| `CELERY_BROKER_URL` | `redis://:aB7#...@redis:6379/1` | DB 1 Redis untuk Celery broker. Password sama dengan REDIS_PASSWORD. |
| `CELERY_RESULT_BACKEND` | `redis://:aB7#...@redis:6379/2` | DB 2 Redis untuk Celery results. Password sama. |
| `DOMAIN` | `api.dalil.app` | Domain VPS (DNS A record pointing ke IP VPS). |
| `CORS_ORIGINS` | `https://dalil.pages.dev` | Domain frontend di Cloudflare Pages. **Bukan** domain VPS. |
| `LETSENCRYPT_EMAIL` | `admin@dalil.app` | Email untuk notifikasi SSL certificate expiry. |

### Variable tambahan di example

`HEALTH_TOKEN` — token untuk akses endpoint `/readyz` (cek status DB +
Redis). Tanpa token, endpoint return 403. Ganti `CHANGE_ME_HEALTH_TOKEN`
dengan random string.

### Catatan penting

- `POSTGRES_PASSWORD` harus sama dengan yang ada di dalam `DATABASE_URL` dan
  `DATABASE_URL_SYNC` (setelah `:dalil:`).
- `REDIS_PASSWORD` harus sama dengan yang ada di dalam `REDIS_URL`,
  `CELERY_BROKER_URL`, dan `CELERY_RESULT_BACKEND` (setelah `redis://:`).
- `DB_SSL=false` — biarkan `false` karena Postgres di Docker internal (satu
  host). Set `true` hanya jika menggunakan database eksternal/managed (Railway,
  Aiven, dll).
- `DEBUG=false` — jika `true` di production, aplikasi akan crash saat startup
  (config validator mencegah).

---

## 2. First launch WITHOUT TLS

Nginx template (`dalil.conf.template`) punya 2 server block: port 80 (ACME
challenge + redirect ke HTTPS) dan port 443 (TLS). Karena sertifikat belum
ada, jalankan port 80 dulu.

```bash
cd /opt/dalil/deploy

# Start hanya service yang dibutuhkan untuk ACME challenge
docker compose -f docker-compose.prod.yml up -d db redis nginx
```

**Penjelasan**: `db` dan `redis` butuh waktu startup, sementara `nginx` akan
melayani ACME challenge di `/.well-known/acme-challenge/`. Backend dan
celery-worker menyusul setelah sertifikat jadi.

Verifikasi ACME path reachable:
```bash
curl http://${DOMAIN}/.well-known/acme-challenge/test
# → harus return sesuatu (404 dari certbot itu normal)
```

Dapatkan sertifikat SSL:
```bash
DOMAIN=api.dalil.app LETSENCRYPT_EMAIL=admin@dalil.app ./init-letsencrypt.sh
```

**Penjelasan**: Script menjalankan `certbot certonly --webroot` via Docker
dengan volume `/var/www/certbot`. Sertifikat disimpan di volume Docker
`certbot-conf`.

---

## 3. Enable TLS + full stack

```bash
# Sekarang cert sudah ada, start backend + celery-worker
docker compose -f docker-compose.prod.yml up -d backend celery-worker
```

Verifikasi TLS dan health:
```bash
curl https://api.dalil.app/healthz
# → {"status":"ok"}

curl -o /dev/null -w "%{http_code}" https://api.dalil.app/docs
# → 404 (docs disabled di production)
```

### Cek security headers dari nginx:
```bash
curl -sI https://api.dalil.app/healthz | grep -i -E 'strict-transport|content-type-options|x-frame|referrer'
# strict-transport-security: max-age=31536000; includeSubDomains
# x-content-type-options: nosniff
# x-frame-options: DENY
# referrer-policy: strict-origin-when-cross-origin
```

---

## 4. Run database migration

```bash
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
```

**Penjelasan perubahan penting**: Migration TIDAK auto-run saat container
start. Ini sengaja diubah dari desain lama. Dulu `entrypoint.sh` menjalankan
`alembic upgrade head` setiap kali container backend start — risiko:
migration destruktif bisa apply tanpa sadar saat deploy.

Sekarang migration adalah step eksplisit yang harus dijalankan sekali:
- Container `migrate` exit setelah selesai (restart: "no").
- Aman untuk rollback — cukup jalankan ulang `docker compose run --rm migrate`
  ketika ada migration baru.
- Tidak ada risiko auto-migrate di deploy berikutnya.

---

## 5. Ingest data & generate embeddings

```bash
# Ingest Quran + Hadith dari raw JSON
docker compose -f docker-compose.prod.yml exec backend python data/scripts/ingest.py

# Generate embeddings via Celery worker
docker compose -f docker-compose.prod.yml exec celery-worker \
  celery -A app.celery_app call app.tasks.embeddings.embed_all

# Cek progress — ulangi sampai inspect menunjukkan empty
docker compose -f docker-compose.prod.yml exec celery-worker \
  celery -A app.celery_app inspect active
```

**Penjelasan**: `ingest.py` membaca file JSON dari `data/raw/` dan insert ke
PostgreSQL. Setelah itu `embed_all` membagi semua teks jadi batch 32,
generate embedding 384-dim menggunakan model `paraphrase-multilingual-MiniLM-L12-v2`,
lalu simpan di tabel `embeddings` dengan vector index HNSW. Proses 10-30
menit tergantung CPU.

---

## 6. Deploy frontend ke Cloudflare Pages

Di dashboard Cloudflare:
1. **Pages** → **Create project** → **Connect Git repo**.
2. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `frontend`
3. **Environment variables** (Pages → Settings → Environment variables):
   - `BACKEND_URL` = `https://api.dalil.app` (domain VPS).
4. Deploy. Frontend akan di `https://<project>.pages.dev`.

### Perubahan frontend yang perlu diketahui

| Perubahan | File | Efek |
|---|---|---|
| **CSP + security headers** | `public/_headers` | Browser enforce `default-src 'self'`, `frame-ancestors 'none'`, HSTS, dll. Cegah XSS, clickjacking. |
| **Proxy path allowlist** | `functions/api/[[...path]].ts` | Hanya izinkan path: `search`, `quran`, `hadith`, `stats`, `meta`. Path lain return 404. |
| **Strip sensitive headers** | `functions/api/[[...path]].ts` | Header `cookie`, `authorization`, `x-forwarded-for` dihapus sebelum proxy ke backend. Cegah hop-by-hop leak. |
| **Search query clamp** | `SearchBar.tsx` + `search.tsx` | `maxLength={200}` + `slice(0, 200)` — cegah ReDoX / payload besar. |

### Verifikasi proxy end-to-end:
```bash
curl https://<project>.pages.dev/api/v1/health
# → {"status":"ok"}
```

---

## 7. Crontab — backup + cert renewal

```bash
sudo crontab -e
```

```cron
# Backup DB — setiap hari jam 3 pagi
0 3 * * * /opt/dalil/deploy/backup.sh

# Renew SSL — setiap Minggu jam 3 pagi
0 3 * * 0 cd /opt/dalil/deploy && docker compose -f docker-compose.prod.yml run --rm certbot renew && docker compose -f docker-compose.prod.yml restart nginx
```

**Penjelasan `backup.sh`**: Script melakukan `pg_dump` → gzip → (opsional
encrypt GPG jika `ENCRYPT_KEY` diset) → simpan di `/backups` → hapus file
lebih dari 14 hari.

Konfigurasi backup via env (sudah ada di `.env.prod.example`):
`DB_NAME`, `DB_USER`, `BACKUP_DIR`, `RETENTION_DAYS`, `ENCRYPT_KEY`.
Kosongkan `ENCRYPT_KEY` jika tidak butuh enkripsi GPG.

---

## 8. Post-install checklist

```bash
# DEBUG=false
docker compose -f docker-compose.prod.yml exec backend \
  python -c "from app.core.config import settings; assert not settings.debug"

# /docs 404
curl -o /dev/null -w "%{http_code}\n" https://api.dalil.app/docs
# → 404

# CORS domain benar
docker compose -f docker-compose.prod.yml exec backend \
  python -c "from app.core.config import settings; print(settings.cors_origin_list)"

# /readyz butuh token (tanpa token → 403)
curl -o /dev/null -w "%{http_code}\n" https://api.dalil.app/readyz
# → 403

# /readyz dengan token → ok
curl -s https://api.dalil.app/readyz -H "X-Health-Token: <HEALTH_TOKEN>"
# → {"status":"ready","db":true,"redis":true}

# Semua container healthy
docker compose -f docker-compose.prod.yml ps
# Semua "Up" atau "healthy"
```

---

## 9. Security changes — ringkasan

Ini adalah perubahan keamanan yang diterapkan di codebase (tidak terlihat saat
deploy tapi kritis):

| Area | Sebelum | Sesudah | Dampak |
|---|---|---|---|
| **Rate-limiter** | Trust `X-Forwarded-For` dari client mana pun | Trust hanya 1 hop dari nginx (`$remote_addr`) | Attacker tidak bisa spoof IP untuk bypass limit 60/mnt |
| **Redis** | Tanpa password | `requirepass` + URL dengan `:password@` | Container compromised di network internal tidak bisa baca/tulis queue |
| **Env nginx** | `env_file: ./.env.prod` (bocor semua secret ke env nginx) | `environment: [DOMAIN]` (hanya domain) | `docker exec nginx env` tidak tampilkan DB/Redis password |
| **Container hardening** | Default Docker | `no-new-privileges`, `cap_drop: [ALL]`, `read_only` | Container tidak bisa `su`, tidak punya privilege berlebih |
| **Migration** | Auto-run di entrypoint | Explicit `--profile migrate run --rm migrate` | Migration destruktif tidak bisa apply tanpa sadar |
| **Config validator** | Tidak ada | Reject `postgres:postgres`, CORS `*`/`null` di prod | Safety net — aplikasi crash startup jika config unsafe |
| **ILIKE search** | `%{query}%` tanpa escape | `%{escaped_query}%` + `ESCAPE '\'` | User tidak bisa pakai `%`/`_` untuk DoS broad-scan |
| **Gunicorn log** | Log query string (`?q=...`) | Log dimatikan, andalkan middleware yang log path only | Query user tidak bocor ke stdout |
| **Security headers** | Hanya di nginx | Nginx + in-app middleware | Protection bahkan tanpa nginx (Vercel preview, dev) |
| **Embedding model** | Tanpa pin revision | Pinned SHA `e8f8c21...` | Model tidak berubah diam-diam dari HF Hub |
| **/readyz** | Publik | Token-gate via `X-Health-Token` | Info infra (DB/Redis status) tidak bocor |
| **Frontend CSP** | Tidak ada | `default-src 'self'`, `frame-ancestors 'none'`, dll | Cegah XSS, clickjacking di browser |
| **Proxy allowlist** | Semua path | Hanya `search|quran|hadith|stats|meta` | Attacker tidak bisa probe path backend sembarangan |

---

## 10. Secrets rotation

### Rotate POSTGRES_PASSWORD
```bash
# 1. Ganti password di live DB
docker compose -f docker-compose.prod.yml exec db \
  psql -U dalil -c "ALTER USER dalil PASSWORD 'newstrongpw'"

# 2. Update .env.prod: POSTGRES_PASSWORD, DATABASE_URL, DATABASE_URL_SYNC

# 3. Recreate containers (pgdata volume menyimpan data)
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Rotate REDIS_PASSWORD
```bash
# 1. Ganti password di live Redis
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli -a <old_password> CONFIG SET requirepass 'newpassword'

# 2. Update .env.prod: REDIS_PASSWORD + semua URL Redis

# 3. Restart container yang connect ke Redis
docker compose -f docker-compose.prod.yml restart backend celery-worker
```

---

## 11. Troubleshooting

| Gejala | Penyebab | Fix |
|---|---|---|
| `backend` restart-loop | Config validator reject config | `docker logs backend` → perbaiki `.env.prod` → `docker compose up -d` |
| Redis connection refused | `REDIS_PASSWORD` mismatch | Cek semua URL Redis di `.env.prod` — password setelah `redis://:` harus konsisten |
| `curl /healthz` 502 | nginx tidak reach backend | `docker compose ps` → backend harus `healthy` |
| Migration error (`psycopg2.OperationalError`) | DB credential salah di sync URL | `docker compose logs migrate` → perbaiki `DATABASE_URL_SYNC` |
| `/docs` masih 200 | `DEBUG=true` di production | Config validator akan reject saat startup — cek `docker logs backend` |
| Embedding model download timeout | HF Hub tidak reachable / slow | Tambah `HF_ENDPOINT=https://hf-mirror.com` ke `.env.prod` |
| Certbot renewal gagal | Port 80 tidak terbuka | Pastikan firewall VPS allow port 80/443: `sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload` |
