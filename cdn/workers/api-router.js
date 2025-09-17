/**
 * Encore Platform - Cloudflare Worker API Router
 *
 * Worker de Cloudflare para routing inteligente de APIs,
 * cache distribuido y optimización de responses
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Manejador principal de requests
 */
async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // Routing basado en path
  if (path.startsWith('/api/')) {
    return handleAPIRoute(request, url)
  }

  if (path.startsWith('/images/')) {
    return handleImageRoute(request, url)
  }

  if (path.startsWith('/assets/')) {
    return handleAssetRoute(request, url)
  }

  // Default: proxy al frontend
  return proxyToFrontend(request)
}

/**
 * Manejo de rutas de API
 */
async function handleAPIRoute(request, url) {
  const path = url.pathname

  // Configuración de backends
  const backends = {
    '/api/auth': API_BASE_URL || 'http://localhost:3001',
    '/api/music': API_BASE_URL || 'http://localhost:3002',
    '/api/queue': API_BASE_URL || 'http://localhost:3003',
    '/api/points': API_BASE_URL || 'http://localhost:3004',
    '/api/analytics': API_BASE_URL || 'http://localhost:3005',
    '/api/menu': API_BASE_URL || 'http://localhost:3006'
  }

  // Encontrar el backend apropiado
  let backendUrl = API_BASE_URL || 'http://localhost:3001'
  for (const [route, url] of Object.entries(backends)) {
    if (path.startsWith(route)) {
      backendUrl = url
      break
    }
  }

  // Construir URL del backend
  const backendRequestUrl = backendUrl + path + url.search

  // Verificar cache para requests GET
  if (request.method === 'GET') {
    const cacheKey = `api:${request.method}:${backendRequestUrl}`
    const cachedResponse = await API_CACHE.get(cacheKey)

    if (cachedResponse) {
      // Devolver respuesta cacheada
      const cachedData = JSON.parse(cachedResponse)
      return new Response(cachedData.body, {
        status: cachedData.status,
        headers: {
          ...cachedData.headers,
          'CF-Cache-Status': 'HIT',
          'X-Cache': 'HIT'
        }
      })
    }
  }

  // Proxy al backend
  const backendRequest = new Request(backendRequestUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  })

  // Añadir headers de Cloudflare
  backendRequest.headers.set('CF-Connecting-IP', request.headers.get('CF-Connecting-IP') || '')
  backendRequest.headers.set('CF-IPCountry', request.headers.get('CF-IPCountry') || '')
  backendRequest.headers.set('CF-Ray', request.headers.get('CF-Ray') || '')

  try {
    const response = await fetch(backendRequest)

    // Cachear responses exitosas de GET
    if (request.method === 'GET' && response.ok) {
      const responseClone = response.clone()
      const responseBody = await responseClone.text()
      const cacheData = {
        body: responseBody,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      }

      // Cache por 5 minutos para analytics, 1 minuto para otros
      const cacheTtl = path.includes('/analytics') ? 300 : 60
      await API_CACHE.put(`api:${request.method}:${backendRequestUrl}`, JSON.stringify(cacheData), {
        expirationTtl: cacheTtl
      })
    }

    // Añadir headers de respuesta
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('CF-Cache-Status', 'MISS')
    newResponse.headers.set('X-Cache', 'MISS')
    newResponse.headers.set('X-API-Gateway', 'Cloudflare Worker')
    newResponse.headers.set('X-Response-Time', Date.now().toString())

    return newResponse

  } catch (error) {
    console.error('API routing error:', error)

    // Respuesta de error con información de debugging
    return new Response(JSON.stringify({
      error: 'API Gateway Error',
      message: 'Unable to connect to backend service',
      timestamp: new Date().toISOString(),
      cf_ray: request.headers.get('CF-Ray'),
      request_id: crypto.randomUUID()
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Source': 'Cloudflare Worker',
        'X-Error-Timestamp': new Date().toISOString()
      }
    })
  }
}

/**
 * Manejo de rutas de imágenes con optimización
 */
async function handleImageRoute(request, url) {
  const path = url.pathname

  // Extraer parámetros de optimización
  const params = url.searchParams
  const width = params.get('w') || params.get('width')
  const height = params.get('h') || params.get('height')
  const quality = params.get('q') || params.get('quality') || 85
  const format = params.get('f') || params.get('format') || 'auto'

  // Construir URL de imagen original
  const originalUrl = `https://encore-images.s3.amazonaws.com${path}`

  try {
    // Fetch de la imagen original
    const imageResponse = await fetch(originalUrl)

    if (!imageResponse.ok) {
      return new Response('Image not found', { status: 404 })
    }

    // Aplicar transformaciones usando Cloudflare Images
    const transformedResponse = await fetch(`https://encore-images.cloudflare.com/cdn-cgi/image/${getImageOptions(width, height, quality, format)}${originalUrl}`)

    // Añadir headers de cache
    const response = new Response(transformedResponse.body, transformedResponse)
    response.headers.set('Cache-Control', 'public, max-age=86400') // 24 horas
    response.headers.set('CDN-Cache-Status', 'HIT')
    response.headers.set('X-Image-Optimized', 'true')

    return response

  } catch (error) {
    console.error('Image optimization error:', error)
    return new Response('Image processing error', { status: 500 })
  }
}

/**
 * Generar opciones de optimización de imagen
 */
function getImageOptions(width, height, quality, format) {
  const options = []

  if (width) options.push(`w=${width}`)
  if (height) options.push(`h=${height}`)
  if (quality) options.push(`q=${quality}`)
  if (format) options.push(`f=${format}`)

  options.push('fit=cover') // Ajuste por defecto
  options.push('metadata=none') // Remover metadata

  return options.join(',')
}

/**
 * Manejo de rutas de assets estáticos
 */
async function handleAssetRoute(request, url) {
  // Proxy a Cloudflare R2 o similar
  const assetUrl = `https://encore-assets.s3.amazonaws.com${url.pathname}`

  try {
    const response = await fetch(assetUrl)

    if (!response.ok) {
      return new Response('Asset not found', { status: 404 })
    }

    // Añadir headers de cache agresivo para assets
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable') // 1 año
    newResponse.headers.set('CDN-Cache-Status', 'HIT')

    return newResponse

  } catch (error) {
    console.error('Asset serving error:', error)
    return new Response('Asset serving error', { status: 500 })
  }
}

/**
 * Proxy al frontend (fallback)
 */
async function proxyToFrontend(request) {
  const frontendUrl = FRONTEND_URL || 'http://localhost:3000'

  try {
    const response = await fetch(`${frontendUrl}${request.url.pathname}${request.url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body
    })

    // Añadir headers de Cloudflare
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('X-Served-By', 'Cloudflare Worker')
    newResponse.headers.set('X-Frontend-Proxy', 'true')

    return newResponse

  } catch (error) {
    console.error('Frontend proxy error:', error)
    return new Response('Frontend unavailable', { status: 503 })
  }
}

/**
 * Middleware de logging
 */
async function logRequest(request, response, startTime) {
  const duration = Date.now() - startTime
  const logData = {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    status: response.status,
    duration: `${duration}ms`,
    cf_ray: request.headers.get('CF-Ray'),
    country: request.headers.get('CF-IPCountry'),
    user_agent: request.headers.get('User-Agent'),
    cache_status: response.headers.get('CF-Cache-Status') || 'MISS'
  }

  console.log(JSON.stringify(logData))
}

/**
 * Middleware de rate limiting básico
 */
class RateLimiter {
  constructor() {
    this.requests = new Map()
  }

  async check(request) {
    const clientIP = request.headers.get('CF-Connecting-IP')
    const key = `${clientIP}:${Math.floor(Date.now() / 60000)}` // Por minuto

    const current = this.requests.get(key) || 0

    if (current >= 100) { // 100 requests por minuto
      return false
    }

    this.requests.set(key, current + 1)

    // Limpiar entradas antiguas
    if (this.requests.size > 10000) {
      const cutoff = Date.now() - 3600000 // 1 hora
      for (const [k, v] of this.requests.entries()) {
        if (parseInt(k.split(':')[1]) * 60000 < cutoff) {
          this.requests.delete(k)
        }
      }
    }

    return true
  }
}

const rateLimiter = new RateLimiter()

/**
 * Middleware de seguridad
 */
function addSecurityHeaders(response) {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  response.headers.set('X-CDN-Provider', 'Cloudflare')

  return response
}

/**
 * Wrapper principal con middlewares
 */
async function handleRequestWithMiddleware(request) {
  const startTime = Date.now()

  try {
    // Rate limiting
    const allowed = await rateLimiter.check(request)
    if (!allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retry_after: 60
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      })
    }

    // Procesar request
    const response = await handleRequest(request)

    // Añadir headers de seguridad
    const secureResponse = addSecurityHeaders(response)

    // Logging
    await logRequest(request, secureResponse, startTime)

    return secureResponse

  } catch (error) {
    console.error('Worker error:', error)

    const errorResponse = new Response(JSON.stringify({
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Source': 'Cloudflare Worker'
      }
    })

    await logRequest(request, errorResponse, startTime)
    return errorResponse
  }
}

// Exportar handler principal
export default {
  async fetch(request) {
    return handleRequestWithMiddleware(request)
  }
}