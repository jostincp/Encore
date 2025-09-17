#!/bin/bash

# Secret Rotation Script for Encore Platform
# Automatically rotates secrets in HashiCorp Vault

set -e

echo "🔄 Starting secret rotation for Encore Platform..."

# Function to generate new JWT secret
generate_jwt_secret() {
  openssl rand -hex 64
}

# Function to generate new database password
generate_db_password() {
  openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to generate new Stripe webhook secret
generate_stripe_webhook_secret() {
  openssl rand -hex 32
}

# Rotate JWT secret
echo "🔐 Rotating JWT secret..."
NEW_JWT_SECRET=$(generate_jwt_secret)
vault kv put secret/encore/jwt \
  secret="$NEW_JWT_SECRET" \
  algorithm="HS256" \
  expiresIn="24h" \
  refreshExpiresIn="7d" \
  rotatedAt="$(date -Iseconds)"

echo "✅ JWT secret rotated"

# Rotate database password
echo "🗄️  Rotating database password..."
NEW_DB_PASSWORD=$(generate_db_password)
vault kv put secret/encore/database \
  url="postgresql://encore_user:$NEW_DB_PASSWORD@localhost:5432/encore_db" \
  password="$NEW_DB_PASSWORD" \
  rotatedAt="$(date -Iseconds)"

echo "✅ Database password rotated"

# Rotate Stripe webhook secret
echo "💳 Rotating Stripe webhook secret..."
NEW_WEBHOOK_SECRET=$(generate_stripe_webhook_secret)
vault kv put secret/encore/stripe \
  secretKey="sk_test_your_stripe_secret_key_here" \
  webhookSecret="$NEW_WEBHOOK_SECRET" \
  publishableKey="pk_test_your_publishable_key_here" \
  rotatedAt="$(date -Iseconds)"

echo "✅ Stripe webhook secret rotated"

# Log rotation event
echo "$(date -Iseconds): Secrets rotated successfully" >> /vault/logs/rotation.log

echo "🎉 Secret rotation completed!"
echo ""
echo "⚠️  IMPORTANT: Update your Stripe webhook endpoint with the new secret:"
echo "   New webhook secret: $NEW_WEBHOOK_SECRET"
echo ""
echo "⚠️  IMPORTANT: Update your database with the new password:"
echo "   New database password: $NEW_DB_PASSWORD"
echo ""
echo "📝 Rotation logged to: /vault/logs/rotation.log"