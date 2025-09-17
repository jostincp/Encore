#!/bin/bash

# Vault Initialization Script for Encore Platform
# This script sets up Vault with secrets and policies for the points service

set -e

echo "🚀 Initializing HashiCorp Vault for Encore Platform..."

# Wait for Vault to be ready
echo "⏳ Waiting for Vault to be ready..."
sleep 5

# Check if Vault is initialized
if ! vault status | grep -q "Initialized.*true"; then
  echo "❌ Vault is not initialized. Please initialize Vault first."
  exit 1
fi

# Check if Vault is unsealed
if vault status | grep -q "Sealed.*true"; then
  echo "❌ Vault is sealed. Please unseal Vault first."
  exit 1
fi

echo "✅ Vault is ready!"

# Create AppRole for points service
echo "🔐 Creating AppRole for points service..."
vault auth enable approle 2>/dev/null || echo "AppRole already enabled"

# Create role for points service
vault write auth/approle/role/points-service \
  secret_id_ttl=24h \
  token_ttl=1h \
  token_max_ttl=24h \
  policies=points-service-policy \
  token_bound_cidrs="0.0.0.0/0" \
  secret_id_bound_cidrs="0.0.0.0/0"

echo "📋 Creating policies..."

# Create policy for points service
vault policy write points-service-policy /vault/scripts/../policies/points-service-policy.hcl

echo "🔑 Setting up initial secrets..."

# Create initial secrets for Stripe
vault kv put secret/encore/stripe \
  secretKey="sk_test_your_stripe_secret_key_here" \
  webhookSecret="whsec_your_webhook_secret_here" \
  publishableKey="pk_test_your_publishable_key_here" \
  rotatedAt="$(date -Iseconds)"

# Create initial database secrets
vault kv put secret/encore/database \
  url="postgresql://encore_user:encore_password@localhost:5432/encore_db" \
  password="encore_password" \
  rotatedAt="$(date -Iseconds)"

# Create initial JWT secrets
vault kv put secret/encore/jwt \
  secret="your_jwt_secret_here_make_it_very_long_and_secure" \
  algorithm="HS256" \
  expiresIn="24h" \
  refreshExpiresIn="7d" \
  rotatedAt="$(date -Iseconds)"

# Create initial Redis secrets
vault kv put secret/encore/redis \
  url="redis://localhost:6379" \
  password="" \
  rotatedAt="$(date -Iseconds)"

echo "🎫 Getting AppRole credentials..."

# Get role ID and secret ID for the application
ROLE_ID=$(vault read auth/approle/role/points-service/role-id -format=json | jq -r '.data.role_id')
SECRET_ID=$(vault write -f auth/approle/role/points-service/secret-id -format=json | jq -r '.data.secret_id')

echo "📝 AppRole Credentials for points-service:"
echo "VAULT_ROLE_ID: $ROLE_ID"
echo "VAULT_SECRET_ID: $SECRET_ID"
echo ""
echo "⚠️  IMPORTANT: Save these credentials securely!"
echo "   They will be needed by the points-service application."
echo ""

# Create environment file for the application
cat > /vault/scripts/../.env.vault << EOF
# Vault Configuration for Encore Points Service
VAULT_ENDPOINT=http://localhost:8200
VAULT_ROLE_ID=$ROLE_ID
VAULT_SECRET_ID=$SECRET_ID
VAULT_NAMESPACE=encore

# Application Configuration
NODE_ENV=development
PORT=3004
EOF

echo "📄 Created .env.vault file with Vault configuration"
echo ""
echo "🎉 Vault initialization completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the VAULT_ROLE_ID and VAULT_SECRET_ID to your application"
echo "2. Use the .env.vault file or set environment variables"
echo "3. Start your points-service with Vault integration"
echo ""
echo "🔍 To check Vault status: vault status"
echo "🔍 To list secrets: vault kv list secret/encore/"
echo "🔍 To read a secret: vault kv get secret/encore/stripe"