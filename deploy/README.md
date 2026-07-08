# Dalil — First-Deploy Runbook

End-to-end deploy guide for the production stack (backend on VPS, frontend on
Cloudflare Pages). Assumes a clean Linux VPS with root/sudo and a domain with
DNS control.

## 1. VPS prep

- Install Docker Engine + Docker Compose v2.
- Point a DNS **A record** for `DOMAIN` (e.g. `api.yourdomain.tld`) at the VPS
  public IP. Wait for propagation: `dig +short ${DOMAIN}`.
- Clone the repo onto the VPS.
- `cp deploy/.env.prod.example deploy/.env.prod` and edit every secret:
  - Set a strong `POSTGRES_PASSWORD` (≥ 24 random chars).
  - Use the **same** value inside `DATABASE_URL`, `DATABASE_URL_SYNC` and
    `POSTGRES_PASSWORD` (keep them consistent).
  - Set `DOMAIN`, `LETSENCRYPT_EMAIL`, and `CORS_ORIGINS` to the
    **Cloudflare Pages frontend domain** (e.g. `https://dalil.pages.dev`).

## 2. First launch WITHOUT TLS

The nginx config ships a 443 (TLS) server block that references certs we
don't have yet. Bootstrap port 80 only.

- Edit `deploy/nginx/conf.d/dalil.conf` and **comment out** the 443 server
  block (the one referencing `/etc/letsencrypt/live/...`). Keep only the
  port-80 block that serves `/var/www/certbot` for ACME challenges and proxies
  to backend.
- From the `deploy/` directory:
  ```sh
  docker compose -f docker-compose.prod.yml up -d db redis backend nginx
  ```
- Verify the ACME challenge path is reachable:
  ```sh
  curl http://${DOMAIN}/.well-known/acme-challenge/test
  ```
- Obtain the certificate:
  ```sh
  DOMAIN=${DOMAIN} LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL} ./init-letsencrypt.sh
  ```
  Run `init-letsencrypt.sh` **from `deploy/`** so it finds
  `docker-compose.prod.yml`. The script invokes certbot via
  `docker compose run --rm certbot` with `--webroot -w /var/www/certbot`.
  If a cert already exists certbot will say so and exit `0` (idempotent-ish).

## 3. Enable 443

- Uncomment the 443 block in `deploy/nginx/conf.d/dalil.conf`.
- Reload nginx: `docker compose -f docker-compose.prod.yml restart nginx`.
- Verify TLS + backend health:
  ```sh
  curl https://${DOMAIN}/healthz
  # -> {"status":"ok"}
  ```

## 4. Re-ingest data + embeddings

- Ingest raw sources:
  ```sh
  docker compose -f docker-compose.prod.yml exec backend python data/scripts/ingest.py
  ```
- Trigger embedding generation:
  ```sh
  docker compose -f docker-compose.prod.yml exec celery-worker \
    celery -A app.celery_app call app.tasks.embeddings.embed_all
  ```
- Wait for the queue to drain (check for active tasks):
  ```sh
  docker compose -f docker-compose.prod.yml exec celery-worker \
    celery -A app.celery_app inspect active
  ```
  Repeat until `inspect active` shows no running jobs.

## 5. Cloudflare Pages (frontend)

- In the Cloudflare dashboard → Pages → Create project → Connect Git repo.
- Build settings:
  - **Framework preset:** Vite
  - **Build command:** `npm run build`
  - **Build output directory:** `dist`
  - **Root directory:** `frontend`
- **Environment variables** (Pages → Settings → Environment variables):
  - `BACKEND_URL` = `https://${DOMAIN}` (the VPS backend domain, e.g.
    `https://api.yourdomain.tld`).
- Deploy. Your frontend will be at a Pages URL like
  `https://dalil.pages.dev` (or a custom domain you add in Pages). Call this
  `${FRONTEND_DOMAIN}` below. Pages will auto-discover
  `frontend/functions/api/[[...path]].ts` and compile it into the deployment.
  The function proxies any `/api/*` request to `${BACKEND_URL}/api/*`,
  forwarding method, headers, body and query string, and returning the
  upstream response verbatim. `frontend/public/_redirects` provides SPA
  fallback (`/* /index.html 200`) only — the `/api` proxy is NOT a redirect.
- Verify the proxy end-to-end:
  ```sh
  curl https://${FRONTEND_DOMAIN}/api/v1/health
  # -> {"status":"ok"}
  ```

> Note on types: `functions/api/[[...path]].ts` uses `PagesFunction<Env>` from
> `@cloudflare/workers-types`, which is provided by the Pages build
> environment. If a local `tsc --noEmit` fails to resolve the type, install
> `@cloudflare/workers-types` as a dev dependency — it does NOT need to ship
> to the runtime; Pages injects its own types at build time.

## 6. Post-install checklist

- `DEBUG=false` in `.env.prod`:
  ```sh
  docker compose -f docker-compose.prod.yml exec backend \
    python -c "from app.core.config import settings; assert not settings.debug"
  ```
- `/docs` returns 404 (docs disabled in production):
  ```sh
  curl -o /dev/null -w "%{http_code}\n" https://${DOMAIN}/docs
  # -> 404
  ```
- `CORS_ORIGINS` is set to the Cloudflare Pages frontend domain (the browser
  still needs CORS even though the Pages Function proxies server-side).
- Healthchecks green: `docker compose -f docker-compose.prod.yml ps`.

## 7. Backups

Embeddings are regenerable but cost hours of Celery work, so back the DB up.

- One-off:
  ```sh
  docker compose -f docker-compose.prod.yml exec -T db \
    pg_dump -U dalil dalil | gzip > /backups/dalil-$(date +%F).sql.gz
  ```
- Cron (root, daily at 03:00), with 14-day rotation and offsite copy:
  ```cron
  0 3 * * * /usr/bin/docker compose -f /path/to/deploy/docker-compose.prod.yml exec -T db pg_dump -U dalil dalil | gzip > /backups/dalil-$(date +\%F).sql.gz && find /backups -name 'dalil-*.sql.gz' -mtime +14 -delete && rsync -az /backups/ offsite:/backups/dalil/
  ```

## 8. Secrets rotation

To rotate `POSTGRES_PASSWORD` (db data is preserved on the `pgdata` volume):

```sh
# 1. Change the password inside the live DB.
docker compose -f docker-compose.prod.yml exec db \
  psql -U dalil -c "ALTER USER dalil PASSWORD 'newstrongpw'"
# 2. Update .env.prod: POSTGRES_PASSWORD, DATABASE_URL, DATABASE_URL_SYNC.
# 3. Recreate containers (pgdata volume keeps your data).
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

## 9. Certbot renewal (weekly cron)

Let's Encrypt certs expire every 90 days. Renew automatically:

```cron
0 3 * * 0 cd /path/to/deploy && docker compose -f docker-compose.prod.yml run --rm certbot renew && docker compose -f docker-compose.prod.yml restart nginx
```

`certbot renew` only re-issues certs near expiry, so running it weekly is
safe. `restart nginx` picks up the new certificate chain.