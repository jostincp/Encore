# Vault Policy for Encore Points Service
# Grants access to Stripe secrets and database credentials

path "secret/data/encore/stripe" {
  capabilities = ["read"]
}

path "secret/data/encore/database" {
  capabilities = ["read"]
}

path "secret/data/encore/jwt" {
  capabilities = ["read"]
}

path "secret/data/encore/redis" {
  capabilities = ["read"]
}

# Allow rotation of secrets (for automatic rotation)
path "secret/data/encore/stripe" {
  capabilities = ["update", "create"]
}

path "secret/data/encore/database" {
  capabilities = ["update", "create"]
}

path "secret/data/encore/jwt" {
  capabilities = ["update", "create"]
}

# Audit logging access
path "audit/*" {
  capabilities = ["read"]
}

# Health check access
path "sys/health" {
  capabilities = ["read"]
}

# Token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}