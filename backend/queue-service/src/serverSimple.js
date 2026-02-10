console.log("!!! QUEUE SERVICE STARTING !!!");
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const Redis = require('ioredis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Configuración Redis
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging simple
const log = (message, data) => {
  console.log(`[${new Date().toISOString()}] [QUEUE] ${message}`, data || '');
};

// Simulación de puntos (en producción vendría del Points Service)
const mockUserPoints = {
  'demo-user-123': 1000,
  'user-456': 500,
  'user-789': 200
};

/**
 * 🎵 Añadir canción a la cola
 */
app.post('/api/queue/add', async (req, res) => {
  try {
    const { bar_id, song_id, video_id, title, artist, thumbnail, priority_play = false } = req.body;
    const userId = 'demo-user-123'; // Simulación - vendría del JWT

    log('🎵 Adding song to queue', { bar_id, title, priority_play });

    // Validaciones básicas
    if (!bar_id || !song_id || !title) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: bar_id, song_id, title'
      });
    }

    // Verificar puntos del usuario
    const userPoints = mockUserPoints[userId] || 0;
    const cost = priority_play ? 25 : 10;

    if (userPoints < cost) {
      return res.status(402).json({
        success: false,
        message: `Insufficient points. You need ${cost} points, but have ${userPoints}`
      });
    }

    // Verificar duplicados en Redis
    const deduplicationKey = `queue:${bar_id}:set`;
    const isDuplicate = await redis.sismember(deduplicationKey, song_id);

    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'This song is already in the queue'
      });
    }

    // Transacción atómica Redis
    const queueKey = priority_play ? `queue:${bar_id}:priority` : `queue:${bar_id}:standard`;

    const multi = redis.multi();

    // Añadir a la cola correspondiente
    multi.rpush(queueKey, JSON.stringify({
      id: song_id,
      video_id,
      title,
      artist,
      thumbnail,
      table_id: req.body.table,  // ← Mesa que pidió la canción
      addedBy: 'Demo User',
      addedAt: new Date().toISOString(),
      isPriority: priority_play,
      userId
    }));

    // Añadir al set de deduplicación
    multi.sadd(deduplicationKey, song_id);

    // Opcional: establecer TTL
    multi.expire(deduplicationKey, 3600); // 1 hora

    const results = await multi.exec();

    if (results[0][1] > 0) {
      // Restar puntos (simulación)
      mockUserPoints[userId] -= cost;

      log('✅ Song added to queue successfully', {
        song_id,
        position: results[0][1],
        cost,
        remainingPoints: mockUserPoints[userId]
      });

      // Emitir evento de socket
      const io = req.app.get('io');
      if (io) {
        io.to(bar_id).emit('queue-updated');
        io.to(bar_id).emit('queueUpdate');
        io.to(bar_id).emit('song-added', { title, artist });
      }

      // 🎵 AUTO-START: Si es la primera canción y no hay nada reproduciéndose, iniciar automáticamente
      const nowPlayingKey = `queue:${bar_id}:nowPlaying`;
      const nowPlaying = await redis.get(nowPlayingKey);
      const isFirstSong = results[0][1] === 1; // Position 1 = primera canción
      let autoStarted = false;

      if (!nowPlaying && isFirstSong) {
        log('🎬 Auto-starting playback: First song added to empty queue');

        // Sacar la canción que acabamos de agregar
        const rawSong = await redis.lpop(queueKey);

        if (rawSong) {
          const songToPlay = JSON.parse(rawSong);

          // Marcar como "now playing"
          await redis.set(nowPlayingKey, rawSong);

          // Remover del set de deduplicación
          await redis.srem(deduplicationKey, song_id);

          autoStarted = true;

          log('✅ Auto-start successful', {
            songId: songToPlay.id,
            title: songToPlay.title
          });

          // Emitir evento de inicio de reproducción
          if (io) {
            io.to(bar_id).emit('now-playing', songToPlay);
            io.to(bar_id).emit('queue-updated');
          }
        }
      }

      return res.json({
        success: true,
        message: `Song "${title}" added to queue${priority_play ? ' with priority' : ''}${autoStarted ? ' and playback started' : ''}`,
        data: {
          position: results[0][1],
          cost,
          remainingPoints: mockUserPoints[userId],
          isPriority: priority_play,
          autoStarted
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to add song to queue'
      });
    }

  } catch (error) {
    log('❌ Error adding song to queue:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * 📋 Obtener cola actual
 */
app.get('/api/queue/:barId', async (req, res) => {
  try {
    const { barId } = req.params;

    log('📋 Getting queue', { barId });

    // Obtener canciones prioritarias y estándar
    const [prioritySongs, standardSongs] = await Promise.all([
      redis.lrange(`queue:${barId}:priority`, 0, -1),
      redis.lrange(`queue:${barId}:standard`, 0, -1)
    ]);

    // Combinar colas (prioridad primero)
    const allSongs = [
      ...prioritySongs.map(song => JSON.parse(song)),
      ...standardSongs.map(song => JSON.parse(song))
    ];

    log('✅ Queue retrieved successfully', {
      barId,
      totalSongs: allSongs.length,
      prioritySongs: prioritySongs.length,
      standardSongs: standardSongs.length
    });

    return res.json({
      success: true,
      data: {
        queue: allSongs,
        totalItems: allSongs.length,
        priorityItems: prioritySongs.length,
        standardItems: standardSongs.length
      }
    });

  } catch (error) {
    log('❌ Error getting queue:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get queue',
      error: error.message
    });
  }
});


/**
 * 🎵 Obtener canción actualmente reproduciéndose
 */
app.get('/api/queue/:barId/now-playing', async (req, res) => {
  try {
    const { barId } = req.params;

    log('🎵 Getting now playing song', { barId });

    const nowPlayingKey = `queue:${barId}:nowPlaying`;
    const rawSong = await redis.get(nowPlayingKey);

    if (!rawSong) {
      return res.json({
        success: true,
        data: null,
        message: 'No song currently playing'
      });
    }

    const song = JSON.parse(rawSong);

    log('✅ Now playing song retrieved', { songId: song.id, title: song.title });

    return res.json({
      success: true,
      data: song
    });

  } catch (error) {
    log('❌ Error getting now playing song:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get now playing song',
      error: error.message
    });
  }
});
/**
 * 🗑️ Eliminar canción de la cola
 */
app.delete('/api/queue/:barId/:songId', async (req, res) => {
  try {
    const { barId, songId } = req.params;
    const userId = 'demo-user-123'; // Simulación

    log('🗑️ Removing song from queue', { barId, songId });

    // Buscar y eliminar de ambas colas
    const [prioritySongs, standardSongs] = await Promise.all([
      redis.lrange(`queue:${barId}:priority`, 0, -1),
      redis.lrange(`queue:${barId}:standard`, 0, -1)
    ]);

    let found = false;
    let removedSong = null;

    // Buscar en cola prioritaria
    for (let i = 0; i < prioritySongs.length; i++) {
      const song = JSON.parse(prioritySongs[i]);
      if (song.id === songId && song.userId === userId) {
        await redis.lrem(`queue:${barId}:priority`, 1, prioritySongs[i]);
        removedSong = song;
        found = true;
        break;
      }
    }

    // Buscar en cola estándar si no se encontró en prioritaria
    if (!found) {
      for (let i = 0; i < standardSongs.length; i++) {
        const song = JSON.parse(standardSongs[i]);
        if (song.id === songId && song.userId === userId) {
          await redis.lrem(`queue:${barId}:standard`, 1, standardSongs[i]);
          removedSong = song;
          found = true;
          break;
        }
      }
    }

    if (found) {
      // Remover del set de deduplicación
      await redis.srem(`queue:${barId}:set`, songId);

      // Reembolsar puntos (simulación)
      const cost = removedSong.isPriority ? 25 : 10;
      mockUserPoints[userId] += cost;

      log('✅ Song removed from queue successfully', {
        songId,
        refundedPoints: cost,
        remainingPoints: mockUserPoints[userId]
      });

      // Emitir evento de socket
      const io = req.app.get('io');
      if (io) {
        io.to(barId).emit('queue-updated');
        io.to(barId).emit('queueUpdate');
      }

      return res.json({
        success: true,
        message: 'Song removed from queue successfully',
        data: {
          refundedPoints: cost,
          remainingPoints: mockUserPoints[userId]
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Song not found in queue or you do not have permission to remove it'
      });
    }

  } catch (error) {
    log('❌ Error removing song from queue:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to remove song from queue',
      error: error.message
    });
  }

});

/**
 * ⏭️ Pop/Skip next song
 * Removes the next song from the queue (priority first, then standard)
 */
app.post('/api/queue/:barId/pop', async (req, res) => {
  try {
    const { barId } = req.params;
    const userId = 'demo-user-123';

    log('⏭️ Popping next song from queue', { barId });

    // Intentar sacar de prioritaria primero
    let rawSong = await redis.lpop(`queue:${barId}:priority`);
    let queueType = 'priority';

    // Si no hay, sacar de estándar
    if (!rawSong) {
      rawSong = await redis.lpop(`queue:${barId}:standard`);
      queueType = 'standard';
    }

    if (!rawSong) {
      return res.status(404).json({
        success: false,
        message: 'Queue is empty'
      });
    }

    const song = JSON.parse(rawSong);

    // Remover del set de deduplicación
    await redis.srem(`queue:${barId}:set`, song.id);

    log('✅ Song popped successfully', {
      songId: song.id,
      title: song.title,
      queueType
    });

    // Emitir evento de socket
    const io = req.app.get('io');
    if (io) {
      io.to(barId).emit('queue-updated');
      io.to(barId).emit('queueUpdate');
    }

    return res.json({
      success: true,
      message: 'Next song retrieved',
      data: song
    });

  } catch (error) {
    log('❌ Error popping song:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to pop song',
      error: error.message
    });
  }
});

/**
 * 🏥 Health check
 */
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión Redis
    await redis.ping();

    return res.json({
      success: true,
      service: 'queue-service-simple',
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      redis: 'connected',
      endpoints: {
        add: '/api/queue/add',
        get: '/api/queue/:barId',
        remove: '/api/queue/:barId/:songId',
        health: '/health'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      service: 'queue-service-simple',
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * 🧹 Limpiar cola (admin)
 */
app.delete('/api/queue/:barId/clear', async (req, res) => {
  try {
    const { barId } = req.params;

    log('🧹 Clearing queue', { barId });

    // Eliminar todas las claves relacionadas con la cola
    const keys = [
      `queue:${barId}:priority`,
      `queue:${barId}:standard`,
      `queue:${barId}:set`
    ];

    await redis.del(...keys);

    log('✅ Queue cleared successfully', { barId });

    return res.json({
      success: true,
      message: 'Queue cleared successfully'
    });

  } catch (error) {
    log('❌ Error clearing queue:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to clear queue',
      error: error.message
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  log('Express error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      'POST /api/queue/add',
      'GET /api/queue/:barId',
      'DELETE /api/queue/:barId/:songId',
      'DELETE /api/queue/:barId/clear',
      'GET /health'
    ]
  });
});

// Configuración Socket.IO
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Permitir cualquier origen en desarrollo
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  log('🔌 Client connected to WebSocket');

  socket.on('join_bar', (barId) => {
    socket.join(barId);
    log(`👤 Client joined bar room: ${barId}`);
  });

  socket.on('disconnect', () => {
    // log('Client disconnected');
  });
});

app.set('io', io);

// Helper para emitir eventos
const emitQueueUpdate = (barId) => {
  io.to(barId).emit('queue-updated');
  io.to(barId).emit('queueUpdate'); // Legacy support
};

// Start server
server.listen(PORT, async () => {
  log(`🚀 Queue Service (Simple) started on port ${PORT}`);
  log(`🔗 Redis: ${process.env.REDIS_URL || 'localhost:6379'}`);
  log(`🌐 Server: http://localhost:${PORT}`);
  log(`📚 Health: http://localhost:${PORT}/health`);
  log(`🎵 Add song: POST http://localhost:${PORT}/api/queue/add`);
  log(`🔌 WebSocket: enabled`);

  // Verificar conexión Redis
  try {
    await redis.ping();
    log(`✅ Redis connected successfully`);
  } catch (error) {
    log(`❌ Redis connection failed:`, error);
  }
});

module.exports = app;
