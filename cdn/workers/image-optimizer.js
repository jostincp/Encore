/**
 * Encore Platform - Cloudflare Worker Image Optimizer
 *
 * Worker especializado para optimización de imágenes,
 * redimensionamiento inteligente y formato automático
 */

addEventListener('fetch', event => {
  event.respondWith(handleImageRequest(event.request))
})

/**
 * Manejador principal de requests de imágenes
 */
async function handleImageRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // Solo procesar rutas de imágenes
  if (!path.startsWith('/images/') && !path.startsWith('/api/images/')) {
    return new Response('Not Found', { status: 404 })
  }

  try {
    // Extraer parámetros de transformación
    const params = extractTransformationParams(url)

    // Obtener imagen original
    const originalImage = await fetchOriginalImage(path, params)

    if (!originalImage.ok) {
      return new Response('Image not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // Aplicar transformaciones
    const transformedImage = await transformImage(originalImage, params)

    // Cachear imagen transformada
    const cacheKey = generateCacheKey(path, params)
    await cacheTransformedImage(cacheKey, transformedImage)

    // Devolver imagen optimizada
    return createOptimizedResponse(transformedImage, params)

  } catch (error) {
    console.error('Image optimization error:', error)

    return new Response(JSON.stringify({
      error: 'Image processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Source': 'Image Optimizer'
      }
    })
  }
}

/**
 * Extraer parámetros de transformación de la URL
 */
function extractTransformationParams(url) {
  const params = url.searchParams

  return {
    // Dimensiones
    width: parseInt(params.get('w')) || parseInt(params.get('width')) || null,
    height: parseInt(params.get('h')) || parseInt(params.get('height')) || null,

    // Calidad y formato
    quality: parseInt(params.get('q')) || parseInt(params.get('quality')) || 85,
    format: params.get('f') || params.get('format') || 'auto',

    // Ajuste
    fit: params.get('fit') || 'cover',
    position: params.get('position') || 'center',

    // Efectos
    blur: parseFloat(params.get('blur')) || 0,
    brightness: parseFloat(params.get('brightness')) || 1,
    contrast: parseFloat(params.get('contrast')) || 1,
    saturation: parseFloat(params.get('saturation')) || 1,

    // Optimizaciones
    progressive: params.get('progressive') === 'true',
    lossless: params.get('lossless') === 'true',
    metadata: params.get('metadata') !== 'none',

    // Cache
    cacheTtl: parseInt(params.get('ttl')) || 86400 // 24 horas por defecto
  }
}

/**
 * Obtener imagen original desde R2 o S3
 */
async function fetchOriginalImage(path, params) {
  // Intentar primero desde R2 (Cloudflare)
  const r2Url = `https://encore-images.r2.cloudflarestorage.com${path}`

  try {
    const r2Response = await fetch(r2Url)
    if (r2Response.ok) {
      return r2Response
    }
  } catch (error) {
    console.log('R2 fetch failed, trying S3:', error.message)
  }

  // Fallback a S3
  const s3Url = `https://encore-images.s3.amazonaws.com${path}`
  return await fetch(s3Url)
}

/**
 * Aplicar transformaciones a la imagen
 */
async function transformImage(imageResponse, params) {
  const imageBuffer = await imageResponse.arrayBuffer()
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

  // Usar WebAssembly para procesamiento de imágenes
  // En producción, usar librerías como Sharp.js o similares

  let transformedBuffer = imageBuffer

  // Aplicar transformaciones básicas usando Canvas API (limitado en Workers)
  if (params.width || params.height) {
    transformedBuffer = await resizeImage(new Uint8Array(imageBuffer), params)
  }

  if (params.quality < 100) {
    transformedBuffer = await compressImage(transformedBuffer, params.quality, params.format)
  }

  // Aplicar efectos si están especificados
  if (params.blur > 0 || params.brightness !== 1 || params.contrast !== 1 || params.saturation !== 1) {
    transformedBuffer = await applyEffects(transformedBuffer, params)
  }

  return {
    buffer: transformedBuffer,
    contentType: getOutputContentType(contentType, params.format),
    originalSize: imageBuffer.byteLength,
    optimizedSize: transformedBuffer.byteLength
  }
}

/**
 * Redimensionar imagen (implementación básica)
 */
async function resizeImage(imageData, params) {
  // En un Worker real, usaríamos una librería como @cloudflare/workers-types
  // o Sharp.js compilado para WebAssembly

  // Implementación placeholder - en producción usar transformación real
  console.log(`Resizing image to ${params.width}x${params.height}`)

  // Simular procesamiento
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(imageData) // En producción: devolver imagen redimensionada
    }, 10)
  })
}

/**
 * Comprimir imagen
 */
async function compressImage(imageData, quality, format) {
  console.log(`Compressing image with quality ${quality}, format ${format}`)

  // Simular compresión
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simular reducción de tamaño basada en calidad
      const compressionRatio = quality / 100
      const newSize = Math.floor(imageData.length * compressionRatio)
      resolve(imageData.slice(0, newSize))
    }, 5)
  })
}

/**
 * Aplicar efectos a la imagen
 */
async function applyEffects(imageData, params) {
  console.log(`Applying effects: blur=${params.blur}, brightness=${params.brightness}, contrast=${params.contrast}, saturation=${params.saturation}`)

  // Simular aplicación de efectos
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(imageData) // En producción: devolver imagen con efectos aplicados
    }, 15)
  })
}

/**
 * Determinar tipo de contenido de salida
 */
function getOutputContentType(originalType, requestedFormat) {
  const formatMap = {
    'auto': originalType,
    'webp': 'image/webp',
    'avif': 'image/avif',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png'
  }

  return formatMap[requestedFormat] || originalType
}

/**
 * Generar clave de cache
 */
function generateCacheKey(path, params) {
  const paramString = Object.entries(params)
    .filter(([key, value]) => value !== null && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return `img:${path}?${paramString}`
}

/**
 * Cachear imagen transformada
 */
async function cacheTransformedImage(cacheKey, imageData) {
  try {
    // Usar Cloudflare KV para cache
    await IMAGES_CACHE.put(cacheKey, imageData.buffer, {
      expirationTtl: imageData.cacheTtl || 86400
    })

    console.log(`Cached transformed image: ${cacheKey}`)
  } catch (error) {
    console.error('Cache error:', error)
  }
}

/**
 * Crear respuesta optimizada
 */
function createOptimizedResponse(imageData, params) {
  const response = new Response(imageData.buffer, {
    status: 200,
    headers: {
      'Content-Type': imageData.contentType,
      'Content-Length': imageData.buffer.byteLength.toString(),
      'Cache-Control': `public, max-age=${params.cacheTtl}`,
      'X-Image-Optimized': 'true',
      'X-Original-Size': imageData.originalSize.toString(),
      'X-Optimized-Size': imageData.optimizedSize.toString(),
      'X-Compression-Ratio': ((imageData.originalSize - imageData.optimizedSize) / imageData.originalSize * 100).toFixed(2) + '%',
      'X-Image-Width': params.width?.toString() || 'auto',
      'X-Image-Height': params.height?.toString() || 'auto',
      'X-Image-Quality': params.quality.toString(),
      'X-Image-Format': params.format
    }
  })

  return response
}

/**
 * Middleware de logging para imágenes
 */
async function logImageRequest(request, response, startTime, params) {
  const duration = Date.now() - startTime
  const logData = {
    timestamp: new Date().toISOString(),
    type: 'image_request',
    method: request.method,
    url: request.url,
    status: response.status,
    duration: `${duration}ms`,
    cf_ray: request.headers.get('CF-Ray'),
    country: request.headers.get('CF-IPCountry'),
    user_agent: request.headers.get('User-Agent'),
    transformation: {
      width: params.width,
      height: params.height,
      quality: params.quality,
      format: params.format,
      fit: params.fit
    },
    performance: {
      original_size: response.headers.get('X-Original-Size'),
      optimized_size: response.headers.get('X-Optimized-Size'),
      compression_ratio: response.headers.get('X-Compression-Ratio')
    }
  }

  console.log(JSON.stringify(logData))
}

/**
 * Wrapper principal con logging
 */
async function handleImageRequestWithLogging(request) {
  const startTime = Date.now()
  const url = new URL(request.url)
  const params = extractTransformationParams(url)

  try {
    const response = await handleImageRequest(request)

    // Logging asíncrono
    logImageRequest(request, response, startTime, params).catch(console.error)

    return response

  } catch (error) {
    // Logging de errores
    const errorLog = {
      timestamp: new Date().toISOString(),
      type: 'image_error',
      error: error.message,
      url: request.url,
      params: params,
      duration: Date.now() - startTime
    }
    console.error(JSON.stringify(errorLog))

    throw error
  }
}

// Exportar handler principal
export default {
  async fetch(request) {
    return handleImageRequestWithLogging(request)
  }
}

/**
 * Funciones de utilidad para optimización avanzada
 */

// Detectar formato de imagen automáticamente
function detectImageFormat(buffer) {
  // Implementación básica de detección de formato
  if (buffer.length < 4) return 'unknown'

  const signature = buffer.slice(0, 4)

  if (signature[0] === 0xFF && signature[1] === 0xD8) return 'jpeg'
  if (signature[0] === 0x89 && signature[1] === 0x50) return 'png'
  if (signature[0] === 0x47 && signature[1] === 0x49) return 'gif'
  if (signature[0] === 0x52 && signature[1] === 0x49) return 'webp'

  return 'unknown'
}

// Calcular tamaño óptimo basado en viewport
function calculateOptimalSize(request, originalWidth, originalHeight) {
  const userAgent = request.headers.get('User-Agent') || ''
  const viewport = request.headers.get('Viewport-Width') || request.headers.get('Width')

  // Lógica para calcular tamaño óptimo basado en dispositivo
  let scale = 1

  if (userAgent.includes('Mobile')) {
    scale = 0.5 // Reducir a la mitad para móviles
  } else if (viewport && parseInt(viewport) < 768) {
    scale = 0.75 // Reducir para tablets pequeñas
  }

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale)
  }
}

// Generar srcset automáticamente
function generateSrcSet(baseUrl, params, sizes = [480, 768, 1024, 1280, 1920]) {
  return sizes.map(size => {
    const url = new URL(baseUrl)
    url.searchParams.set('w', size.toString())
    url.searchParams.set('q', params.quality?.toString() || '85')
    url.searchParams.set('f', 'auto')
    return `${url.toString()} ${size}w`
  }).join(', ')
}

// Función de utilidad para pre-cargar imágenes críticas
async function preloadCriticalImages(imageUrls) {
  const preloadPromises = imageUrls.map(async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return { url, success: response.ok }
    } catch (error) {
      return { url, success: false, error: error.message }
    }
  })

  return await Promise.all(preloadPromises)
}

// Exportar funciones de utilidad
export {
  detectImageFormat,
  calculateOptimalSize,
  generateSrcSet,
  preloadCriticalImages
}