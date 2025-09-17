# Encore Platform - CI/CD Pipeline

Sistema completo de Integración Continua y Despliegue Continuo (CI/CD) para Encore Platform, implementado con GitHub Actions.

## 🏗️ Arquitectura del Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Developer  │───▶│     CI      │───▶│   Staging   │───▶│ Production  │
│   Push/PR   │    │   Pipeline  │    │ Deployment │    │ Deployment │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │              │
       │                   │                   │              │
    ┌──▼──┐             ┌──▼──┐             ┌──▼──┐        ┌──▼──┐
    │ Git │             │Tests│             │Smoke│        │Full │
    │     │             │    │             │Tests│        │Tests│
    └─────┘             └────┘             └────┘        └────┘
                                                        ┌──▼──┐
                                                     ┌──▶│Roll-│
                                                     │  │back │
                                                     │  └─────┘
                                                  ┌──▼──┐
                                                  │ Mon- │
                                                  │ itor │
                                                  └─────┘
```

## 📋 Pipelines Disponibles

### 1. **CI Pipeline** (`.github/workflows/ci.yml`)
Pipeline principal de integración continua que se ejecuta en cada push y PR.

#### Características:
- ✅ **Code Quality**: ESLint, TypeScript, Prettier
- ✅ **Unit Tests**: Jest con cobertura > 80%
- ✅ **Integration Tests**: Supertest con base de datos real
- ✅ **E2E Tests**: Playwright en múltiples navegadores
- ✅ **Performance Tests**: Lighthouse CI
- ✅ **Accessibility Tests**: axe-playwright
- ✅ **Security Scan**: Trivy, Snyk, Gitleaks
- ✅ **Docker Build**: Multi-stage builds optimizados

#### Triggers:
```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
```

#### Jobs:
1. **quality**: Linting, type checking, security audit
2. **test**: Unit e integration tests con PostgreSQL + Redis
3. **e2e**: End-to-end tests con Playwright
4. **performance**: Lighthouse performance audits
5. **accessibility**: WCAG compliance testing
6. **security**: Vulnerability scanning
7. **build**: Docker image building and pushing

### 2. **Deploy Pipeline** (`.github/workflows/deploy.yml`)
Pipeline de despliegue que maneja staging y production.

#### Características:
- 🚀 **Blue-Green Deployment**: Zero-downtime deployments
- 🔄 **Auto Rollback**: Rollback automático en caso de fallos
- ✅ **Smoke Tests**: Validación post-deployment
- 📊 **Performance Validation**: Lighthouse post-deployment
- 🔔 **Notifications**: Slack/Discord alerts
- 📦 **Multi-environment**: Staging → Production

#### Environments:
- **Staging**: Despliegue automático desde `develop`
- **Production**: Despliegue desde `main` con aprobación

#### Deployment Strategy:
```yaml
# Blue-Green para Production
- Deploy to blue environment
- Run comprehensive tests
- Switch traffic from green to blue
- Keep green as rollback option
```

### 3. **Release Pipeline** (`.github/workflows/release.yml`)
Pipeline de versionado y releases automatizado.

#### Características:
- 📦 **Semantic Versioning**: v1.2.3, v1.2.3-alpha
- 📋 **Changelog Validation**: Verificación de CHANGELOG.md
- 🏷️ **GitHub Releases**: Releases con assets
- 📦 **NPM Publishing**: Publicación de librerías
- 🔄 **Manifest Updates**: Actualización automática de configs
- 🧹 **Cleanup**: Eliminación de releases antiguos

#### Triggers:
```yaml
on:
  push:
    tags:
      - 'v*'
```

### 4. **Monitoring Pipeline** (`.github/workflows/monitoring.yml`)
Pipeline de monitoreo continuo y alertas.

#### Características:
- ❤️ **Health Checks**: Verificación de servicios cada 6 horas
- ⚡ **Performance Monitoring**: Lighthouse audits diarios
- 🔒 **Security Monitoring**: Vulnerabilidades y certificados
- 📦 **Dependency Monitoring**: Paquetes desactualizados
- 📊 **Comprehensive Reports**: Reportes detallados
- 🔔 **Smart Alerts**: Alertas contextuales por Slack

#### Schedule:
```yaml
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
```

## 🚀 Inicio Rápido

### 1. Configurar Secrets en GitHub

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Docker Hub
DOCKER_USERNAME=your_docker_username
DOCKER_PASSWORD=your_docker_password

# Cloudflare
CLOUDFLARE_API_TOKEN=your_cf_api_token
CLOUDFLARE_ACCOUNT_ID=your_cf_account_id

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# NPM Publishing
NPM_TOKEN=your_npm_token

# Snyk Security
SNYK_TOKEN=your_snyk_token
```

### 2. Configurar Environments

```yaml
# .github/settings.yml
environments:
  staging:
    branches: [develop]
  production:
    branches: [main]
    reviewers: [team-lead, devops]
```

### 3. Ejecutar Pipeline

```bash
# Push a develop (despliega a staging)
git push origin develop

# Crear PR a main (ejecuta CI completo)
gh pr create --base main --head feature-branch

# Crear release
git tag v1.2.3
git push origin v1.2.3
```

## ⚙️ Configuración Detallada

### Variables de Entorno

#### Globales
```bash
NODE_VERSION=18
PYTHON_VERSION=3.9
REGISTRY=ghcr.io
IMAGE_NAME=encore-platform
```

#### Por Servicio
```bash
# Base URLs
BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/encore_test
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=ci_test_secret_not_for_production
```

### Matrices de Testing

#### Navegadores para E2E
```yaml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
    viewport: [desktop, mobile]
```

#### Servicios para Integration Tests
```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: postgres
  redis:
    image: redis:7-alpine
```

### Configuración de Docker

#### Multi-stage Builds
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

#### Build y Push
```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: ./frontend
    push: true
    tags: encore/frontend:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

## 📊 Métricas y Reportes

### Cobertura de Código
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: ./tests/coverage/lcov.info
    flags: unit,integration
```

### Reportes de Performance
```yaml
- name: Upload Lighthouse results
  uses: actions/upload-artifact@v4
  with:
    name: lighthouse-results-${{ github.run_id }}
    path: lighthouse-results.json
```

### Notificaciones Inteligentes
```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: "CI Pipeline failed on ${{ github.ref }}"
    fields: repo,message,commit,author,action
```

## 🔒 Seguridad en CI/CD

### Secret Management
- 🔐 **Encrypted Secrets**: Todos los secrets en GitHub Secrets
- 🚫 **No Secrets in Code**: Nunca secrets en el código
- 🔄 **Rotation Policy**: Rotación automática de tokens
- 📊 **Audit Logs**: Logging de acceso a secrets

### Security Scanning
```yaml
- name: Security audit
  run: npm audit --audit-level moderate

- name: Check for secrets
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Access Control
```yaml
# Environment protection
environment: production
required_reviewers: [team-lead, security]
```

## 🚨 Monitoreo y Alertas

### Health Checks
```yaml
- name: Health check - API
  run: |
    response=$(curl -s -w "%{http_code}" -o /dev/null $API_URL/health)
    [ "$response" -eq 200 ] || exit 1
```

### Performance Monitoring
```yaml
- name: Performance validation
  run: |
    lighthouse $FRONTEND_URL --output json > results.json
    score=$(jq '.categories.performance.score * 100' results.json)
    [ "$score" -gt 90 ] || exit 1
```

### Alertas por Slack
```yaml
- name: Send alert
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: "Deployment ${{ job.status == 'success' && 'successful' || 'failed' }}"
```

## 🔄 Estrategias de Deployment

### Blue-Green Deployment
```yaml
# Deploy to blue
aws ecs update-service --service encore-api-blue --force-new-deployment

# Test blue
curl -f https://api-blue.encore-platform.com/health

# Switch traffic
aws ecs update-service --service encore-api-green --desired-count 0
aws ecs update-service --service encore-api-blue --desired-count 3
```

### Canary Deployment
```yaml
# Deploy 10% traffic to canary
kubectl set image deployment/app app=app:v2
kubectl scale deployment app --replicas=10
kubectl scale deployment app-v1 --replicas=90
```

### Rollback Automático
```yaml
- name: Rollback on failure
  if: failure()
  run: |
    aws ecs update-service \
      --service encore-api-green \
      --task-definition encore-api-previous \
      --force-new-deployment
```

## 📈 Optimización de Performance

### Caching Inteligente
```yaml
# Cache Docker layers
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Parallel Jobs
```yaml
jobs:
  test:
    strategy:
      matrix:
        node: [16, 18, 20]
        os: [ubuntu-latest, windows-latest]
```

### Artifact Management
```yaml
- name: Upload test results
  uses: actions/upload-artifact@v4
  with:
    name: test-results-${{ github.run_id }}
    path: tests/reports/
    retention-days: 30
```

## 🐛 Debugging y Troubleshooting

### Debug Failed Jobs
```bash
# Ver logs del job
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id>

# Debug con SSH (para jobs self-hosted)
# Configurar SSH en el runner y conectar
```

### Common Issues

#### Build Failures
```bash
# Verificar Node.js version
node --version

# Limpiar cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Test Failures
```bash
# Ejecutar tests localmente
npm run test:unit
npm run test:e2e

# Verificar servicios
docker-compose ps
```

#### Deployment Issues
```bash
# Verificar AWS credentials
aws sts get-caller-identity

# Verificar Docker images
docker images | grep encore

# Verificar ECS services
aws ecs describe-services --cluster encore-production
```

## 📚 Mejores Prácticas

### Branch Strategy
```bash
# Git Flow
main      # Production code
develop   # Integration branch
feature/* # Feature branches
hotfix/*  # Hotfix branches
release/* # Release branches
```

### Commit Messages
```bash
# Conventional commits
feat: add user authentication
fix: resolve memory leak in cache service
docs: update API documentation
test: add unit tests for user service
ci: update CI pipeline configuration
```

### Code Review Requirements
```yaml
# Require approvals
required_approvals: 2
require_code_owner_reviews: true
restrict_pushes: true
```

## 🎯 Próximos Pasos

1. **Multi-cloud deployment** (AWS + GCP + Azure)
2. **GitOps integration** (ArgoCD + Flux)
3. **Advanced monitoring** (Datadog + New Relic)
4. **Compliance automation** (SOC2, GDPR)
5. **Feature flags** integration
6. **Chaos engineering** (Gremlin)

---

**Nota**: Este sistema CI/CD proporciona una base sólida para desarrollo, testing y deployment automatizado de Encore Platform. Está diseñado para escalar con el crecimiento del equipo y la complejidad de la aplicación.