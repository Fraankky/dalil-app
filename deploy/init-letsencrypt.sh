#!/bin/sh
# First-time TLS bootstrap. Run from the deploy/ directory:
#   DOMAIN=yourdomain.tld LETSENCRYPT_EMAIL=you@example.com ./init-letsencrypt.sh
set -e

DOMAIN="${DOMAIN:?DOMAIN env var required}"
EMAIL="${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL env var required}"

echo "Obtaining TLS cert for ${DOMAIN} ..."

docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email "${EMAIL}" -d "${DOMAIN}" \
  --agree-tos --no-eff-email

echo "Done. Restart nginx to pick up the cert:"
echo "  docker compose -f docker-compose.prod.yml restart nginx"