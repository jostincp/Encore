# Encore Platform - Cloudflare CDN

Sistema completo de Content Delivery Network (CDN) utilizando Cloudflare para optimización global de activos estáticos, distribución de API y mejora de rendimiento.

## 🏗️ Arquitectura del Sistema CDN

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Usuario        │────│   Cloudflare    │────│   Encore API    │
│   Global         │    │   Edge Network  │    │   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
    │  Pages  │             │ Workers │             │   R2    │
    │ (React) │             │ (Edge)  │             │ (Storage│
    │         │             │         │             │         │
    └─────────┘             └─────────┘             └─────────┘
                                                        │
                                                   ┌────▼────┐
                                                   │   S3    │
                                                   │ Fallback│
                                                   └─────────┘
```

## 📋 Características Principales

### ⚡ **Rendimiento Global**
- **200+ centros de datos** en todo el mundo
- **Edge computing** con Cloudflare Workers
- **Compresión automática** (Brotli, Gzip)
- **HTTP/3 y QUIC** para conexiones más rápidas

### 🖼️ **Optimización de Imágenes**
- **Formato automático** (WebP, AVIF según soporte)
- **Redimensionamiento inteligente** basado en dispositivo
- **Compresión avanzada** con calidad configurable
- **Lazy loading** y preload automático

### 🛡️ **Seguridad Avanzada**
- **DDoS protection** automática
- **WAF (Web Application Firewall)** integrado
- **SSL/TLS** automático con Let's Encrypt
- **Bot management** inteligente

### 📊 **Monitoreo y Analytics**
- **Real User Monitoring (RUM)** integrado
- **Core Web Vitals** tracking
- **Analytics detallado** de rendimiento
- **Alertas automáticas** de seguridad

## 🚀 Inicio Rápido

### 1. Instalar Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Configurar Autenticación

```bash
# Login con tu cuenta de Cloudflare
wrangler auth login

# O usar API token
export CLOUDFLARE_API_TOKEN=your_api_token
export CLOUDFLARE_ACCOUNT_ID=your_account_id
```

### 3. Desplegar CDN

```bash
# Despliegue completo automatizado
./cdn/deploy-cloudflare.sh production

# O despliegue por componentes
./cdn/deploy-cloudflare.sh production true  # Skip rules
```

### 4. Verificar Despliegue

```bash
# Verificar Pages
curl -I https://encore-platform.pages.dev

# Verificar Workers
curl -I https://encore-api-router.encore.workers.dev

# Verificar imágenes optimizadas
curl "https://encore-image-optimizer.encore.workers.dev/images/example.jpg?w=400&q=80"
```

## ⚙️ Configuración Detallada

### Cloudflare Pages

#### Configuración de Build

```javascript
// wrangler.toml
name = "encore-platform"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"
cwd = "frontend"
watch_dir = "src"

[build.upload]
format = "service-worker"

[[build.upload.rules]]
type = "ESModule"
globs = ["**/*.js"]

[vars]
NODE_ENV = "production"
API_BASE_URL = "https://api.encore-platform.com"
```

#### Variables de Entorno

```bash
# Producción
NODE_ENV=production
API_BASE_URL=https://api.encore-platform.com
CDN_BASE_URL=https://encore-platform.pages.dev

# Staging
NODE_ENV=staging
API_BASE_URL=https://api-staging.encore-platform.com
CDN_BASE_URL=https://encore-platform-staging.pages.dev
```

### Cloudflare Workers

#### API Router Worker

```javascript
// Configuración del worker
export default {
  async fetch(request) {
    const url = new URL(request.url)

    // Routing inteligente
    if (url.pathname.startsWith('/api/')) {
      return handleAPIRoute(request)
    }

    if (url.pathname.startsWith('/images/')) {
      return handleImageRoute(request)
    }

    return handleStaticRoute(request)
  }
}
```

#### Image Optimizer Worker

```javascript
// Optimización de imágenes en el edge
const params = new URL(request.url).searchParams

const optimizedImage = await fetch(originalImageUrl, {
  cf: {
    image: {
      width: params.get('w'),
      height: params.get('h'),
      quality: params.get('q') || 85,
      format: 'auto' // WebP, AVIF automáticamente
    }
  }
})
```

### Reglas de Cache Inteligentes

#### Cache para Assets Estáticos

```javascript
// Cache agresivo para assets inmutables
{
  expression: '(http.request.uri.path matches "^/_next/static/.*|^/static/.*")',
  action: 'set_cache_settings',
  action_parameters: {
    cache: true,
    edge_ttl: { mode: 'override_origin', duration: 31536000 }, // 1 año
    browser_ttl: { mode: 'override_origin', duration: 31536000 }
  }
}
```

#### Cache para API Responses

```javascript
// Cache inteligente para analytics
{
  expression: '(http.request.uri.path matches "^/api/analytics/.*") and (http.request.method eq "GET")',
  action: 'set_cache_settings',
  action_parameters: {
    cache: true,
    edge_ttl: { mode: 'override_origin', duration: 300 }, // 5 minutos
    respect_range: true
  }
}
```

## 🖼️ Optimización de Imágenes

### Uso Básico

```html
<!-- Imagen responsive automática -->
<img src="/images/photo.jpg?w=800&q=85&f=auto"
     srcset="/images/photo.jpg?w=400 400w,
             /images/photo.jpg?w=800 800w,
             /images/photo.jpg?w=1200 1200w"
     sizes="(max-width: 768px) 100vw, 50vw"
     loading="lazy"
     alt="Optimized image">
```

### Parámetros de Optimización

| Parámetro | Descripción | Valores | Default |
|-----------|-------------|---------|---------|
| `w` | Ancho en píxeles | 1-10000 | Auto |
| `h` | Alto en píxeles | 1-10000 | Auto |
| `q` | Calidad | 1-100 | 85 |
| `f` | Formato | auto, webp, avif, jpeg, png | auto |
| `fit` | Ajuste | cover, contain, scale-down, crop | cover |
| `position` | Posición | center, top, bottom, left, right | center |

### Ejemplos Avanzados

```javascript
// Generar srcset automáticamente
function generateSrcSet(baseUrl, options = {}) {
  const { widths = [480, 768, 1024, 1280], quality = 85 } = options

  return widths.map(width => {
    const url = new URL(baseUrl)
    url.searchParams.set('w', width)
    url.searchParams.set('q', quality)
    url.searchParams.set('f', 'auto')
    return `${url} ${width}w`
  }).join(', ')
}

// Uso
const srcSet = generateSrcSet('/images/hero.jpg', {
  widths: [640, 768, 1024, 1280, 1920],
  quality: 90
})
```

## 📊 Monitoreo y Analytics

### Real User Monitoring

```javascript
// Configuración automática en _app.js
import { initRUM } from '@cloudflare/rum'

initRUM({
  token: 'your_rum_token',
  sampleRate: 0.1, // 10% de usuarios
  environment: process.env.NODE_ENV
})
```

### Core Web Vitals

```javascript
// Tracking automático
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

getCLS(console.log)
getFID(console.log)
getFCP(console.log)
getLCP(console.log)
getTTFB(console.log)
```

### Analytics Dashboard

```bash
# Ver métricas en Cloudflare Dashboard
open https://dash.cloudflare.com/analytics

# Métricas disponibles:
# - Page views y unique visitors
# - Core Web Vitals
# - Cache hit rate
# - Error rates
# - Geographic distribution
```

## 🔧 Configuración de Seguridad

### WAF Rules

```javascript
// Reglas de seguridad automática
{
  name: 'Block SQL Injection',
  expression: '(http.request.uri.query contains "UNION" or http.request.uri.query contains "SELECT")',
  action: 'block',
  action_parameters: {
    response: {
      status: 403,
      content: 'Access Denied'
    }
  }
}
```

### Rate Limiting

```javascript
// Rate limiting por IP
{
  name: 'API Rate Limit',
  expression: 'http.request.uri.path matches "^/api/.*"',
  action: 'rate_limit',
  action_parameters: {
    requests: 100,
    period: 60,
    action: 'block',
    timeout: 300
  }
}
```

### Bot Management

```javascript
// Detección automática de bots
{
  name: 'Bot Protection',
  expression: 'cf.bot_management.score lt 30',
  action: 'managed_challenge'
}
```

## 🚀 Despliegue Automatizado

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install Wrangler
      run: npm install -g wrangler

    - name: Deploy Pages
      run: wrangler pages deploy frontend/dist --project-name=encore-platform
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

    - name: Deploy Workers
      run: |
        cd cdn/workers
        wrangler deploy api-router.js
        wrangler deploy image-optimizer.js
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Preview Deployments

```yaml
# Despliegue automático para PRs
on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Deploy Preview
      run: |
        npm run build
        npx wrangler pages deploy dist \
          --project-name=encore-platform \
          --branch=preview-${{ github.event.number }}
```

## 📈 Optimización de Rendimiento

### Mejoras Esperadas

| Métrica | Sin CDN | Con CDN | Mejora |
|---------|---------|---------|--------|
| **First Contentful Paint** | 2.5s | 1.2s | 52% |
| **Largest Contentful Paint** | 4.2s | 2.1s | 50% |
| **Time to Interactive** | 6.8s | 3.2s | 53% |
| **Cache Hit Rate** | 0% | 85% | 85% |
| **Image Size** | 2.4MB | 800KB | 67% |

### Optimizaciones Implementadas

#### 1. **Edge Computing**
```javascript
// Procesamiento en el edge más cercano al usuario
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})
```

#### 2. **Compresión Automática**
```javascript
// Compresión Brotli para respuestas de texto
response.headers.set('Content-Encoding', 'br')
response.headers.set('Vary', 'Accept-Encoding')
```

#### 3. **Cache Hierárquico**
```javascript
// Browser cache → Edge cache → Origin
Cache-Control: public, max-age=31536000, s-maxage=31536000
```

#### 4. **Preload Inteligente**
```html
<!-- Preload de recursos críticos -->
<link rel="preload" href="/api/user" as="fetch" crossorigin>
<link rel="preload" href="/static/main.css" as="style">
<link rel="preload" href="/static/app.js" as="script">
```

## 🔧 Troubleshooting

### Problemas Comunes

#### Build de Pages falla
```bash
# Verificar configuración de build
cat wrangler.toml

# Verificar dependencias
cd frontend && npm install

# Verificar build manual
npm run build
```

#### Worker no responde
```bash
# Verificar logs del worker
wrangler tail

# Verificar configuración
cat wrangler.toml

# Redeploy
wrangler deploy
```

#### Imágenes no se optimizan
```bash
# Verificar URL de imagen
curl -I "https://encore-image-optimizer.encore.workers.dev/images/test.jpg?w=400"

# Verificar parámetros
curl "https://encore-image-optimizer.encore.workers.dev/images/test.jpg?w=400&q=80&f=webp"
```

#### Cache no funciona
```bash
# Verificar headers de cache
curl -I https://encore-platform.pages.dev/static/app.js

# Limpiar cache manualmente
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything": true}'
```

### Comandos Útiles

```bash
# Ver estado de despliegue
wrangler pages deployment list --project-name=encore-platform

# Ver logs de workers
wrangler tail --format=pretty

# Ver métricas de performance
curl "https://api.cloudflare.com/client/v4/zones/{zone_id}/analytics/dashboard" \
  -H "Authorization: Bearer {api_token}"

# Purgar cache
wrangler pages deployment cache purge --project-name=encore-platform

# Ver configuración actual
wrangler pages deployment info --project-name=encore-platform
```

## 📚 API Reference

### Endpoints de Imágenes

```
GET /images/{path}?w={width}&h={height}&q={quality}&f={format}
```

**Parámetros:**
- `w`: Ancho en píxeles
- `h`: Alto en píxeles
- `q`: Calidad (1-100)
- `f`: Formato (auto, webp, avif, jpeg, png)
- `fit`: Ajuste (cover, contain, scale-down, crop)
- `position`: Posición del crop

### Headers de Respuesta

```http
X-Image-Optimized: true
X-Original-Size: 2048576
X-Optimized-Size: 512000
X-Compression-Ratio: 75%
X-Image-Width: 800
X-Image-Height: 600
X-Image-Quality: 85
X-Image-Format: webp
```

### Web Analytics API

```javascript
// Enviar eventos personalizados
fetch('/api/analytics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'user_action',
    data: { action: 'button_click', page: '/dashboard' }
  })
})
```

## 🎯 Próximos Pasos

1. **Multi-region deployment** con failover automático
2. **Machine Learning** para optimización predictiva
3. **Real-time personalization** basado en ubicación
4. **Advanced bot detection** con IA
5. **Integration con Cloudflare Stream** para video

---

**Nota**: Esta implementación de Cloudflare CDN proporciona una base sólida para distribución global de contenido con optimización automática, seguridad avanzada y monitoreo completo. El sistema está diseñado para escalar automáticamente según la demanda y proporcionar la mejor experiencia de usuario posible.