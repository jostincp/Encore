/**
 * Encore Platform - Kong JWT Authentication Plugin
 *
 * Plugin personalizado de Kong para autenticación JWT integrada con AWS Secrets Manager
 */

const jwt = require('jsonwebtoken');
const { getSecretsManager } = require('../backend/shared/utils/secrets');

// Configuración del plugin
const PLUGIN_NAME = 'encore-jwt-auth';
const PLUGIN_VERSION = '1.0.0';

// Cache para claves públicas (para mejorar rendimiento)
let publicKeysCache = new Map();
const CACHE_TTL = 300000; // 5 minutos

/**
 * Función principal del plugin
 */
function execute(config) {
  // Obtener configuración del plugin
  const secretName = config.secret_name || 'encore/jwt';
  const algorithm = config.algorithm || 'RS256';
  const claimsToVerify = config.claims_to_verify || ['exp', 'iat', 'nbf'];
  const anonymous = config.anonymous || null;

  return async function (request) {
    try {
      // Obtener token del header Authorization
      const authHeader = request.headers['authorization'] || request.headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (anonymous) {
          // Usuario anónimo permitido
          request.consumer = { id: anonymous };
          return;
        }
        return kong.response.exit(401, { error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.substring(7); // Remover 'Bearer '

      // Verificar y decodificar token
      const decoded = await verifyJWTToken(token, secretName, algorithm, claimsToVerify);

      if (!decoded) {
        return kong.response.exit(401, { error: 'Invalid token' });
      }

      // Verificar claims adicionales si están configurados
      if (config.required_claims) {
        const missingClaims = config.required_claims.filter(claim => !decoded[claim]);
        if (missingClaims.length > 0) {
          return kong.response.exit(403, {
            error: 'Missing required claims',
            missing_claims: missingClaims
          });
        }
      }

      // Establecer consumer basado en el token
      request.consumer = {
        id: decoded.sub || decoded.user_id,
        username: decoded.username || decoded.email,
        custom_id: decoded.custom_id
      };

      // Añadir información del usuario al request
      request.user = {
        id: decoded.sub || decoded.user_id,
        email: decoded.email,
        role: decoded.role || 'user',
        bar_id: decoded.bar_id
      };

      // Log de autenticación exitosa
      kong.log.info(`JWT authentication successful for user: ${request.consumer.username}`);

    } catch (error) {
      kong.log.err(`JWT authentication error: ${error.message}`);
      return kong.response.exit(401, { error: 'Authentication failed' });
    }
  };
}

/**
 * Verificar token JWT
 */
async function verifyJWTToken(token, secretName, algorithm, claimsToVerify) {
  try {
    // Obtener clave secreta de AWS Secrets Manager
    const secret = await getSecretFromCache(secretName);

    if (!secret) {
      throw new Error('Unable to retrieve JWT secret');
    }

    // Configurar opciones de verificación
    const verifyOptions = {
      algorithms: [algorithm],
      ignoreExpiration: false
    };

    // Añadir claims específicos a verificar
    if (claimsToVerify.includes('exp')) verifyOptions.ignoreExpiration = false;
    if (claimsToVerify.includes('nbf')) verifyOptions.ignoreNotBefore = false;
    if (claimsToVerify.includes('iat')) verifyOptions.ignoreIssuedAt = false;

    // Verificar token
    const decoded = jwt.verify(token, secret.secret, verifyOptions);

    return decoded;

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      kong.log.warn('JWT token expired');
    } else if (error.name === 'JsonWebTokenError') {
      kong.log.warn(`JWT verification failed: ${error.message}`);
    } else {
      kong.log.err(`JWT verification error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Obtener secreto de AWS Secrets Manager con cache
 */
async function getSecretFromCache(secretName) {
  // Verificar cache primero
  const cached = publicKeysCache.get(secretName);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.secret;
  }

  try {
    // Obtener secreto de AWS
    const secretsManager = getSecretsManager();
    const secret = await secretsManager.getSecret(secretName);

    if (!secret || !secret.secret) {
      throw new Error('Invalid secret format');
    }

    // Cachear el secreto
    publicKeysCache.set(secretName, {
      secret: secret,
      expiresAt: Date.now() + CACHE_TTL
    });

    kong.log.debug(`JWT secret retrieved and cached for: ${secretName}`);

    return secret;

  } catch (error) {
    kong.log.err(`Error retrieving JWT secret ${secretName}: ${error.message}`);
    return null;
  }
}

/**
 * Limpiar cache de claves
 */
function clearKeysCache() {
  publicKeysCache.clear();
  kong.log.info('JWT keys cache cleared');
}

/**
 * Configuración del schema del plugin
 */
const PLUGIN_SCHEMA = {
  name: PLUGIN_NAME,
  fields: [
    {
      config: {
        type: 'record',
        fields: [
          {
            secret_name: {
              type: 'string',
              default: 'encore/jwt',
              required: false
            }
          },
          {
            algorithm: {
              type: 'string',
              default: 'RS256',
              one_of: ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
              required: false
            }
          },
          {
            claims_to_verify: {
              type: 'array',
              elements: { type: 'string' },
              default: ['exp', 'iat', 'nbf'],
              required: false
            }
          },
          {
            required_claims: {
              type: 'array',
              elements: { type: 'string' },
              required: false
            }
          },
          {
            anonymous: {
              type: 'string',
              required: false
            }
          }
        ]
      }
    }
  ]
};

/**
 * Handlers del plugin (Patrón de Kong)
 */
const handlers = {
  access: execute,
  header_filter: function(config) {
    // Añadir headers de seguridad después de la autenticación
    kong.response.set_header('X-Authenticated-User', kong.ctx.shared.consumer && kong.ctx.shared.consumer.username);
    kong.response.set_header('X-API-Version', '1.0');
  }
};

// Exportar para uso en Kong
module.exports = {
  PLUGIN_NAME,
  PLUGIN_VERSION,
  PLUGIN_SCHEMA,
  handlers,
  execute,
  verifyJWTToken,
  getSecretFromCache,
  clearKeysCache
};

// Para desarrollo/testing
if (require.main === module) {
  console.log('Encore JWT Auth Plugin loaded');
  console.log(`Version: ${PLUGIN_VERSION}`);
  console.log('Available functions: execute, verifyJWTToken, getSecretFromCache, clearKeysCache');
}