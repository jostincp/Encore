/**
 * Encore Platform - Cloudflare CDN Configuration
 *
 * Configuración completa para optimización de activos estáticos
 * con Cloudflare Pages, Workers y reglas de cache inteligentes
 */

module.exports = {
  // =============================================================================
  // CLOUDFLARE PAGES CONFIGURATION
  // =============================================================================

  pages: {
    // Configuración de build
    build: {
      command: 'npm run build',
      cwd: 'frontend',
      outputDir: 'dist'
    },

    // Variables de entorno para Pages
    env: {
      production: {
        NODE_ENV: 'production',
        API_BASE_URL: 'https://api.encore-platform.com',
        CDN_BASE_URL: 'https://encore-platform.pages.dev'
      },
      preview: {
        NODE_ENV: 'development',
        API_BASE_URL: 'https://api-staging.encore-platform.com',
        CDN_BASE_URL: 'https://encore-platform-staging.pages.dev'
      }
    },

    // Configuración de compatibilidad
    compatibility_flags: [
      'nodejs_compat'
    ],

    // Configuración de funciones (Edge Functions)
    functions: {
      directory: 'functions'
    }
  },

  // =============================================================================
  // CLOUDFLARE WORKERS CONFIGURATION
  // =============================================================================

  workers: {
    // Worker principal para API routing
    main: {
      name: 'encore-api-router',
      main: 'src/workers/api-router.js',
      compatibility_date: '2024-01-01',
      compatibility_flags: [
        'nodejs_compat'
      ],

      // Variables de entorno
      vars: {
        API_BASE_URL: 'https://api.encore-platform.com',
        FRONTEND_URL: 'https://encore-platform.pages.dev'
      },

      // Bindings para servicios externos
      bindings: {
        // KV para cache de API responses
        KV_API_CACHE: {
          binding: 'API_CACHE',
          id: 'api_cache_namespace_id'
        },

        // Durable Objects para sesiones
        DURABLE_OBJECTS: {
          USER_SESSIONS: 'user-sessions'
        },

        // R2 para storage de archivos
        R2_STORAGE: {
          binding: 'R2_STORAGE',
          bucket_name: 'encore-assets'
        }
      },

      // Configuración de triggers
      triggers: {
        crons: [
          '*/5 * * * *'  // Cada 5 minutos para cleanup
        ]
      }
    },

    // Worker para optimización de imágenes
    imageOptimizer: {
      name: 'encore-image-optimizer',
      main: 'src/workers/image-optimizer.js',
      compatibility_date: '2024-01-01',

      bindings: {
        R2_IMAGES: {
          binding: 'R2_IMAGES',
          bucket_name: 'encore-images'
        }
      }
    }
  },

  // =============================================================================
  // CLOUDFLARE RULES CONFIGURATION
  // =============================================================================

  rules: {
    // Reglas de cache para activos estáticos
    cache: [
      {
        name: 'Cache Static Assets',
        match: {
          request: {
            url: {
              query: null,
              path: [
                '/_next/static/*',
                '/static/*',
                '/assets/*',
                '/images/*'
              ]
            }
          }
        },
        action: {
          cache: {
            ttl: 31536000, // 1 año
            respectRange: true
          },
          headers: {
            set: [
              {
                name: 'Cache-Control',
                value: 'public, max-age=31536000, immutable'
              },
              {
                name: 'CDN-Cache-Status',
                value: 'HIT'
              }
            ]
          }
        }
      },

      {
        name: 'Cache API Responses',
        match: {
          request: {
            url: {
              path: '/api/analytics/*'
            },
            method: 'GET'
          }
        },
        action: {
          cache: {
            ttl: 300, // 5 minutos para analytics
            respectRange: false
          },
          headers: {
            set: [
              {
                name: 'Cache-Control',
                value: 'public, max-age=300'
              }
            ]
          }
        }
      },

      {
        name: 'Cache Music Thumbnails',
        match: {
          request: {
            url: {
              path: '/api/music/*/thumbnail'
            }
          }
        },
        action: {
          cache: {
            ttl: 3600, // 1 hora
            respectRange: true
          },
          headers: {
            set: [
              {
                name: 'Cache-Control',
                value: 'public, max-age=3600'
              }
            ]
          }
        }
      }
    ],

    // Reglas de transformación de requests
    transform: [
      {
        name: 'Add Security Headers',
        match: {
          request: {
            url: {
              path: '/*'
            }
          }
        },
        action: {
          headers: {
            set: [
              {
                name: 'X-Frame-Options',
                value: 'DENY'
              },
              {
                name: 'X-Content-Type-Options',
                value: 'nosniff'
              },
              {
                name: 'Referrer-Policy',
                value: 'strict-origin-when-cross-origin'
              },
              {
                name: 'Permissions-Policy',
                value: 'geolocation=(), microphone=(), camera=()'
              },
              {
                name: 'X-CDN-Provider',
                value: 'Cloudflare'
              }
            ]
          }
        }
      },

      {
        name: 'API Version Header',
        match: {
          request: {
            url: {
              path: '/api/*'
            }
          }
        },
        action: {
          headers: {
            set: [
              {
                name: 'X-API-Version',
                value: '1.0'
              },
              {
                name: 'X-Powered-By',
                value: 'Encore Platform'
              }
            ]
          }
        }
      }
    ],

    // Reglas de compresión
    compression: [
      {
        name: 'Compress Text Responses',
        match: {
          response: {
            status: [200],
            headers: [
              {
                name: 'Content-Type',
                value: 'text/*'
              },
              {
                name: 'Content-Type',
                value: 'application/json*'
              },
              {
                name: 'Content-Type',
                value: 'application/javascript*'
              }
            ]
          }
        },
        action: {
          compression: {
            algorithm: 'gzip',
            level: 9
          }
        }
      },

      {
        name: 'Compress Static Assets',
        match: {
          response: {
            status: [200],
            headers: [
              {
                name: 'Content-Type',
                value: 'image/*'
              },
              {
                name: 'Content-Type',
                value: 'font/*'
              }
            ]
          }
        },
        action: {
          compression: {
            algorithm: 'brotli',
            level: 11
          }
        }
      }
    ],

    // Reglas de rate limiting
    rateLimit: [
      {
        name: 'API Rate Limit',
        match: {
          request: {
            url: {
              path: '/api/*'
            }
          }
        },
        action: {
          rateLimit: {
            requests: 100,
            period: 60, // por minuto
            burst: 20,
            action: 'block',
            timeout: 300
          }
        }
      },

      {
        name: 'Static Assets Rate Limit',
        match: {
          request: {
            url: {
              path: [
                '/_next/static/*',
                '/static/*',
                '/assets/*'
              ]
            }
          }
        },
        action: {
          rateLimit: {
            requests: 1000,
            period: 60,
            burst: 200,
            action: 'block',
            timeout: 60
          }
        }
      }
    ],

    // Reglas de redireccionamiento
    redirect: [
      {
        name: 'HTTP to HTTPS Redirect',
        match: {
          request: {
            scheme: 'http'
          }
        },
        action: {
          redirect: {
            to: 'https://encore-platform.com${request.uri}',
            status: 301
          }
        }
      },

      {
        name: 'WWW Redirect',
        match: {
          request: {
            url: {
              hostname: 'www.encore-platform.com'
            }
          }
        },
        action: {
          redirect: {
            to: 'https://encore-platform.com${request.uri}',
            status: 301
          }
        }
      }
    ]
  },

  // =============================================================================
  // CLOUDFLARE IMAGES CONFIGURATION
  // =============================================================================

  images: {
    // Configuración de optimización de imágenes
    optimization: {
      format: 'auto', // WebP, AVIF según soporte del navegador
      quality: 85,
      metadata: 'none', // Remover metadata EXIF
      sharpening: 1
    },

    // Variants para diferentes tamaños
    variants: {
      thumbnail: {
        width: 150,
        height: 150,
        fit: 'cover'
      },
      medium: {
        width: 400,
        height: 400,
        fit: 'cover'
      },
      large: {
        width: 800,
        height: 600,
        fit: 'cover'
      },
      original: {
        width: null,
        height: null,
        fit: 'scale-down'
      }
    },

    // Configuración de cache
    cache: {
      ttl: 31536000, // 1 año
      respectRange: true
    }
  },

  // =============================================================================
  // CLOUDFLARE ANALYTICS CONFIGURATION
  // =============================================================================

  analytics: {
    // Configuración de Web Analytics
    webAnalytics: {
      token: 'your_web_analytics_token',
      respectDoNotTrack: true,
      autoTrack: true
    },

    // Configuración de Real User Monitoring
    rum: {
      token: 'your_rum_token',
      sampleRate: 0.1, // 10% de las requests
      environment: 'production'
    },

    // Configuración de Bot Management
    botManagement: {
      enabled: true,
      mode: 'block',
      challengeValidity: 30
    }
  },

  // =============================================================================
  // DEPLOYMENT CONFIGURATION
  // =============================================================================

  deployment: {
    // Configuración de CI/CD
    github: {
      repo: 'encore-platform/frontend',
      branch: 'main',
      buildCommand: 'npm run build',
      rootDir: 'frontend',
      outputDir: 'dist'
    },

    // Configuración de preview deployments
    preview: {
      enabled: true,
      branchPattern: 'feature/*',
      commentPattern: 'deploy-preview'
    },

    // Configuración de staging
    staging: {
      enabled: true,
      branch: 'develop',
      domain: 'staging.encore-platform.com'
    },

    // Configuración de production
    production: {
      enabled: true,
      branch: 'main',
      domain: 'encore-platform.com'
    }
  }
};