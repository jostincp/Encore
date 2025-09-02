const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = createServer(app);

// Configurar CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Configurar Socket.IO
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'simple-websocket-server',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    websocket: {
      connected_clients: io.engine.clientsCount,
      status: 'active'
    }
  });
});

// Manejar conexiones WebSocket
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);
  
  // Manejar unión a mesa
  socket.on('join_table', (data) => {
    const { tableNumber } = data;
    console.log(`Cliente ${socket.id} se unió a la mesa ${tableNumber}`);
    socket.join(`table_${tableNumber}`);
    
    // Confirmar conexión
    socket.emit('table_joined', {
      success: true,
      tableNumber,
      message: `Conectado a la mesa ${tableNumber}`
    });
  });
  
  // Manejar solicitudes de canciones
  socket.on('request_song', (data) => {
    console.log('Solicitud de canción:', data);
    socket.emit('song_requested', {
      success: true,
      message: 'Canción agregada a la cola'
    });
  });
  
  // Manejar pedidos
  socket.on('place_order', (data) => {
    console.log('Pedido realizado:', data);
    socket.emit('order_placed', {
      success: true,
      message: 'Pedido enviado a la cocina'
    });
  });
  
  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket simple ejecutándose en puerto ${PORT}`);
  console.log(`Health check disponible en http://localhost:${PORT}/health`);
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
});