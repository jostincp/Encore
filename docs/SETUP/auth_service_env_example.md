# Auth Service Environment Variables

# Server Configuration
PORT=3001
NODE_ENV=development
SERVICE_NAME=auth-service

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=encore_auth
DB_USER=encore_user
DB_PASSWORD=your_db_password
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=60000

# Redis Configuration (for sessions and cache)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=2
REDIS_SESSION_PREFIX=encore:auth:session:
REDIS_CACHE_PREFIX=encore:auth:cache:
REDIS_CONNECTION_TIMEOUT=5000
REDIS_COMMAND_TIMEOUT=3000
REDIS_RETRY_ATTEMPTS=3

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_secure
JWT_REFRESH_SECRET=your_refresh_token_secret_here_also_very_secure
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=encore-auth-service
JWT_AUDIENCE=encore-users
JWT_ALGORITHM=HS256

# Session Configuration
SESSION_SECRET=your_session_secret_key_here
SESSION_NAME=encore_session
SESSION_MAX_AGE=604800000  # 7 days in milliseconds
SESSION_SECURE=false       # true in production with HTTPS
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3004,http://localhost:5173
CORS_CREDENTIALS=true
CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With,Accept,Origin

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # per IP
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false
RATE_LIMIT_SKIP_FAILED_REQUESTS=false

# Auth-specific Rate Limits
LOGIN_RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
LOGIN_RATE_LIMIT_MAX=5               # per IP
REGISTER_RATE_LIMIT_WINDOW_MS=3600000 # 1 hour
REGISTER_RATE_LIMIT_MAX=3            # per IP
PASSWORD_RESET_RATE_LIMIT_WINDOW_MS=3600000  # 1 hour
PASSWORD_RESET_RATE_LIMIT_MAX=3               # per email

# Password Configuration
BCRYPT_ROUNDS=12
PASSWORD_MIN_LENGTH=8
PASSWORD_MAX_LENGTH=128
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SYMBOLS=true
PASSWORD_SALT_ROUNDS=12

# Email Configuration (for verification and password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=noreply@encore.com
EMAIL_FROM_NAME=Encore Music Platform
EMAIL_VERIFICATION_REQUIRED=true
PASSWORD_RESET_TOKEN_EXPIRES=3600000  # 1 hour

# OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
GOOGLE_SCOPE=openid email profile

FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
FACEBOOK_REDIRECT_URI=http://localhost:3001/auth/facebook/callback
FACEBOOK_SCOPE=email public_profile

APPLE_CLIENT_ID=your_apple_client_id_here
APPLE_TEAM_ID=your_apple_team_id_here
APPLE_KEY_ID=your_apple_key_id_here
APPLE_PRIVATE_KEY_PATH=./keys/apple_private_key.p8
APPLE_REDIRECT_URI=http://localhost:3001/auth/apple/callback

# User Roles and Permissions
DEFAULT_ROLE=GUEST
ROLES_ENABLED=GUEST,USER,STAFF,BAR_OWNER,ADMIN
ROLE_HIERARCHY_GUEST=0
ROLE_HIERARCHY_USER=1
ROLE_HIERARCHY_STAFF=2
ROLE_HIERARCHY_BAR_OWNER=3
ROLE_HIERARCHY_ADMIN=4

# Security Configuration
CSRF_SECRET=your_csrf_secret_key_here
CSRF_COOKIE_NAME=_csrf
CSRF_HEADER_NAME=x-csrf-token
ENABLE_CSRF_PROTECTION=true
SECURE_COOKIES=false  # true in production
HELMET_ENABLED=true

# Account Lockout Configuration
ACCOUNT_LOCKOUT_ENABLED=true
ACCOUNT_LOCKOUT_THRESHOLD=5      # failed attempts
ACCOUNT_LOCKOUT_DURATION=900000  # 15 minutes
ACCOUNT_LOCKOUT_WINDOW=900000    # 15 minutes

# Two-Factor Authentication
TWO_FACTOR_ENABLED=false
TWO_FACTOR_ISSUER=Encore Music Platform
TWO_FACTOR_WINDOW=1
TWO_FACTOR_SECRET_LENGTH=32

# API Keys Configuration
API_KEY_HEADER=x-api-key
INTERNAL_API_KEY=your_internal_api_key_here
API_KEY_LENGTH=32
API_KEY_EXPIRES_IN=2592000000  # 30 days

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_ENABLED=true
LOG_FILE_PATH=logs/auth-service.log
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
LOG_DATE_PATTERN=YYYY-MM-DD
LOG_AUTH_EVENTS=true
LOG_SECURITY_EVENTS=true

# Monitoring and Analytics
MONITORING_ENABLED=true
METRICS_COLLECTION_INTERVAL=60000
ERROR_REPORTING_ENABLED=true
PERFORMANCE_MONITORING_ENABLED=true
AUDIT_LOG_ENABLED=true

# Development/Debug Settings
DEBUG_ENABLED=false
DEBUG_PASSWORD_HASHING=false
DEBUG_JWT_TOKENS=false
DEBUG_SESSIONS=false
VERBOSE_LOGGING=false

# External Service URLs
MUSIC_SERVICE_URL=http://localhost:3002
QUEUE_SERVICE_URL=http://localhost:3003
POINTS_SERVICE_URL=http://localhost:3004
MENU_SERVICE_URL=http://localhost:3005
ANALYTICS_SERVICE_URL=http://localhost:3006

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_RETRIES=3
HEALTH_CHECK_DB=true
HEALTH_CHECK_REDIS=true

# Cache Configuration
CACHE_DEFAULT_TTL=3600
CACHE_USER_SESSION_TTL=604800
CACHE_USER_PROFILE_TTL=1800
CACHE_PERMISSIONS_TTL=900

# Feature Flags
FEATURE_OAUTH_GOOGLE=true
FEATURE_OAUTH_FACEBOOK=false
FEATURE_OAUTH_APPLE=false
FEATURE_TWO_FACTOR_AUTH=false
FEATURE_EMAIL_VERIFICATION=true
FEATURE_PASSWORD_RESET=true
FEATURE_ACCOUNT_LOCKOUT=true
FEATURE_SOCIAL_LOGIN=true

# Deployment Configuration
DEPLOYMENT_ENVIRONMENT=development
CONTAINER_NAME=encore-auth-service
HEALTH_CHECK_PATH=/api/health
READINESS_CHECK_PATH=/api/health/ready
LIVENESS_CHECK_PATH=/api/health/live

# Database Migration Configuration
DB_MIGRATION_AUTO_RUN=true
DB_SEED_SUPER_ADMIN=true
SUPER_ADMIN_EMAIL=admin@encore.com
SUPER_ADMIN_PASSWORD=super_admin_password_123
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin

# Internationalization
DEFAULT_LOCALE=es
SUPPORTED_LOCALES=es,en,fr,de,it,pt
TIMEZONE=America/New_York

# Legal and Compliance
GDPR_COMPLIANCE_ENABLED=true
DATA_RETENTION_DAYS=365
COOKIE_CONSENT_REQUIRED=true
PRIVACY_POLICY_URL=https://encore.com/privacy
TERMS_OF_SERVICE_URL=https://encore.com/terms
