# Vault Production Configuration for Encore Platform
# High-availability configuration with TLS and AWS KMS auto-unseal

# Disable mlock in containers
disable_mlock = true

# Storage backend - Raft for high availability
storage "raft" {
  path    = "/vault/data"
  node_id = "vault-prod-01"

  # Performance tuning
  performance_multiplier = 1
  max_entry_size         = "1MB"
}

# Auto-unseal with AWS KMS
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "alias/vault-auto-unseal"
  endpoint   = "https://kms.us-east-1.amazonaws.com"
}

# TLS listener for production
listener "tcp" {
  address                           = "0.0.0.0:8200"
  cluster_address                   = "0.0.0.0:8201"
  tls_cert_file                     = "/vault/tls/vault.crt"
  tls_key_file                      = "/vault/tls/vault.key"
  tls_min_version                   = "tls12"
  tls_cipher_suites                 = ["TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384", "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384"]
  tls_prefer_server_cipher_suites  = true
  tls_disable_client_certs          = true
}

# API and cluster addresses
api_addr     = "https://vault.encore-platform.com:8200"
cluster_addr = "https://vault.encore-platform.com:8201"

# UI configuration
ui = true

# Logging
log_level   = "info"
log_format  = "json"
log_rotate_duration = "24h"
log_rotate_max_files = 7

# Telemetry for monitoring
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true

  # Statsite sink for metrics
  statsite_address = "monitoring.encore-platform.com:8125"

  # DogStatsD sink
  dogstatsd_addr   = "monitoring.encore-platform.com:8125"
  dogstatsd_tags   = ["env:production", "service:vault"]
}

# Rate limiting
# requests_path = "/vault/requests"

# Enable raw storage endpoint for debugging (disable in production)
# raw_storage_endpoint = true

# Max lease TTL
max_lease_ttl = "768h"

# Default lease TTL
default_lease_ttl = "768h"

# Plugin directory (if using custom plugins)
# plugin_directory = "/vault/plugins"

# Enable response wrapping
# allow_response_wrapping = true

# Experiments (if any)
# experiments = ["kv"]

# Create audit logs
audit {
  type = "file"
  options = {
    file_path = "/vault/logs/audit.log"
    log_raw   = true
    hmac_accessor = true
  }
}

# Create audit logs to syslog
# audit {
#   type = "syslog"
#   options = {
#     facility = "AUTH"
#     tag      = "vault"
#     format   = "json"
#   }
# }