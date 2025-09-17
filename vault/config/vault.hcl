# Vault Configuration for Encore Platform
# Self-hosted HashiCorp Vault OSS configuration

# Storage backend
storage "file" {
  path = "/vault/data"
}

# Listener configuration
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_disable   = 1
  cluster_addr  = "127.0.0.1:8201"
}

# API configuration
api_addr = "http://127.0.0.1:8200"
cluster_addr = "http://127.0.0.1:8201"

# UI configuration
ui = true

# Logging
log_level = "info"
log_format = "json"

# Telemetry (optional)
# telemetry {
#   prometheus_retention_time = "30s"
#   disable_hostname = true
# }

# Disable mlock to allow running in containers
disable_mlock = true

# Enable raw storage endpoint for debugging
raw_storage_endpoint = true