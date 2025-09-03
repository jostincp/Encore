import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Encore Music Service API',
      version: '1.0.0',
      description: 'API documentation for Encore Music Service - handles song management, search, and queue operations',
      contact: {
        name: 'Encore Development Team',
        email: 'dev@encore.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Development server'
      },
      {
        url: 'https://api.encore.com/music',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        Song: {
          type: 'object',
          required: ['id', 'title', 'artist', 'duration'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique identifier for the song'
            },
            title: {
              type: 'string',
              description: 'Song title',
              example: 'Bohemian Rhapsody'
            },
            artist: {
              type: 'string',
              description: 'Artist name',
              example: 'Queen'
            },
            album: {
              type: 'string',
              description: 'Album name',
              example: 'A Night at the Opera'
            },
            duration: {
              type: 'integer',
              description: 'Song duration in seconds',
              example: 355
            },
            genre: {
              type: 'string',
              description: 'Music genre',
              example: 'Rock'
            },
            release_year: {
              type: 'integer',
              description: 'Year of release',
              example: 1975
            },
            youtube_id: {
              type: 'string',
              description: 'YouTube video ID',
              example: 'fJ9rUzIMcZQ'
            },
            spotify_id: {
              type: 'string',
              description: 'Spotify track ID',
              example: '4u7EnebtmKWzUH433cf5Qv'
            },
            thumbnail_url: {
              type: 'string',
              format: 'uri',
              description: 'URL to song thumbnail image'
            },
            popularity_score: {
              type: 'number',
              format: 'float',
              description: 'Popularity score (0-100)',
              example: 85.5
            },
            is_available: {
              type: 'boolean',
              description: 'Whether the song is available for play',
              example: true
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        QueueEntry: {
          type: 'object',
          required: ['id', 'bar_id', 'song_id', 'user_id', 'position', 'status'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique identifier for the queue entry'
            },
            bar_id: {
              type: 'string',
              format: 'uuid',
              description: 'Bar identifier'
            },
            song_id: {
              type: 'string',
              format: 'uuid',
              description: 'Song identifier'
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              description: 'User identifier'
            },
            position: {
              type: 'integer',
              description: 'Position in queue',
              example: 3
            },
            status: {
              type: 'string',
              enum: ['pending', 'playing', 'played', 'skipped', 'rejected'],
              description: 'Queue entry status'
            },
            priority_play: {
              type: 'boolean',
              description: 'Whether this is a priority play',
              example: false
            },
            points_used: {
              type: 'integer',
              description: 'Points used for this request',
              example: 10
            },
            requested_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the song was requested'
            },
            played_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the song was played (if applicable)'
            },
            song: {
              $ref: '#/components/schemas/Song'
            },
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid'
                },
                first_name: {
                  type: 'string'
                },
                last_name: {
                  type: 'string'
                }
              }
            }
          }
        },
        SearchFilters: {
          type: 'object',
          properties: {
            artist: {
              type: 'string',
              description: 'Filter by artist name'
            },
            album: {
              type: 'string',
              description: 'Filter by album name'
            },
            genre: {
              type: 'string',
              description: 'Filter by genre'
            },
            year_from: {
              type: 'integer',
              description: 'Filter by minimum release year'
            },
            year_to: {
              type: 'integer',
              description: 'Filter by maximum release year'
            },
            duration_min: {
              type: 'integer',
              description: 'Filter by minimum duration (seconds)'
            },
            duration_max: {
              type: 'integer',
              description: 'Filter by maximum duration (seconds)'
            },
            sources: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['youtube', 'spotify', 'local']
              },
              description: 'Filter by music sources'
            }
          }
        },
        Error: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          required: ['items', 'total', 'page', 'limit'],
          properties: {
            items: {
              type: 'array',
              description: 'Array of items'
            },
            total: {
              type: 'integer',
              description: 'Total number of items',
              example: 150
            },
            page: {
              type: 'integer',
              description: 'Current page number',
              example: 1
            },
            limit: {
              type: 'integer',
              description: 'Items per page',
              example: 20
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
              example: 8
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Swagger UI setup
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Encore Music API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  }));

  // JSON endpoint for the OpenAPI spec
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export { specs };