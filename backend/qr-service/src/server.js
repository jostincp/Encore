const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.QR_SERVICE_PORT || 3007;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200
});
app.use(limiter);

// In-memory storage (in production, use PostgreSQL)
const bars = new Map();
const qrcodes = new Map();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Helper function to generate QR data
const generateQRData = (barId, tableNumber) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3004';
  const qrData = {
    b: barId,
    t: tableNumber,
    v: '1.0',
    ts: Date.now()
  };
  
  const qrString = JSON.stringify(qrData);
  const qrUrl = `${baseUrl}/client?b=${barId}&t=${tableNumber}`;
  
  return {
    qrData: qrString,
    qrUrl: qrUrl
  };
};

// Helper function to get or create bar
const getOrCreateBar = (userId) => {
  if (!bars.has(userId)) {
    bars.set(userId, {
      id: uuidv4(),
      name: `Bar ${userId}`,
      totalTables: 20,
      qrPrefix: 'ENCORE',
      customDomain: null,
      owner: userId,
      createdAt: new Date().toISOString()
    });
  }
  return bars.get(userId);
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'qr-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get bar data for authenticated user
app.get('/api/bars/my', authenticateToken, (req, res) => {
  try {
    const bar = getOrCreateBar(req.user.userId);
    
    res.json({
      success: true,
      data: bar
    });
  } catch (error) {
    console.error('Error getting bar data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bar data'
    });
  }
});

// Get all QR codes for bar
app.get('/api/bars/my/qrcodes', authenticateToken, (req, res) => {
  try {
    const bar = getOrCreateBar(req.user.userId);
    const barQRCodes = Array.from(qrcodes.values()).filter(qr => qr.barId === bar.id);
    
    res.json({
      success: true,
      data: barQRCodes,
      count: barQRCodes.length
    });
  } catch (error) {
    console.error('Error getting QR codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get QR codes'
    });
  }
});

// Generate QR code for specific table
app.post('/api/bars/my/qrcodes', authenticateToken, (req, res) => {
  try {
    const { tableNumber, regenerate = false } = req.body;
    const bar = getOrCreateBar(req.user.userId);
    
    if (!tableNumber || tableNumber < 1 || tableNumber > bar.totalTables) {
      return res.status(400).json({
        success: false,
        message: `Table number must be between 1 and ${bar.totalTables}`
      });
    }
    
    // Check if QR already exists
    const existingQR = Array.from(qrcodes.values()).find(qr => 
      qr.barId === bar.id && qr.tableNumber === tableNumber
    );
    
    if (existingQR && !regenerate) {
      return res.json({
        success: true,
        data: existingQR,
        message: 'QR code already exists for this table'
      });
    }
    
    // Generate new QR
    const { qrData, qrUrl } = generateQRData(bar.id, tableNumber);
    const qrCode = {
      id: uuidv4(),
      barId: bar.id,
      tableNumber,
      qrData,
      qrUrl,
      isActive: true,
      scannedCount: 0,
      createdAt: new Date().toISOString(),
      lastScanned: null
    };
    
    // Remove existing QR if regenerating
    if (existingQR && regenerate) {
      qrcodes.delete(existingQR.id);
    }
    
    // Store new QR
    qrcodes.set(qrCode.id, qrCode);
    
    res.json({
      success: true,
      data: qrCode,
      message: `QR code generated for table ${tableNumber}`
    });
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code'
    });
  }
});

// Delete specific QR code
app.delete('/api/bars/my/qrcodes/:qrId', authenticateToken, (req, res) => {
  try {
    const { qrId } = req.params;
    const bar = getOrCreateBar(req.user.userId);
    
    const qrCode = qrcodes.get(qrId);
    
    if (!qrCode || qrCode.barId !== bar.id) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }
    
    qrcodes.delete(qrId);
    
    res.json({
      success: true,
      message: 'QR code deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete QR code'
    });
  }
});

// Track QR scan (public endpoint)
app.post('/api/qrcodes/:qrId/scan', (req, res) => {
  try {
    const { qrId } = req.params;
    const qrCode = qrcodes.get(qrId);
    
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found'
      });
    }
    
    if (!qrCode.isActive) {
      return res.status(403).json({
        success: false,
        message: 'QR code is not active'
      });
    }
    
    // Update scan statistics
    qrCode.scannedCount = (qrCode.scannedCount || 0) + 1;
    qrCode.lastScanned = new Date().toISOString();
    
    res.json({
      success: true,
      data: {
        qrData: qrCode.qrData,
        qrUrl: qrCode.qrUrl,
        barId: qrCode.barId,
        tableNumber: qrCode.tableNumber
      },
      message: 'QR code scanned successfully'
    });
    
  } catch (error) {
    console.error('Error scanning QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scan QR code'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Endpoint not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🔗 QR Service running on port ${PORT}`);
  console.log(`🏠 Base URL: http://localhost:${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /api/bars/my - Get bar data`);
  console.log(`   GET  /api/bars/my/qrcodes - Get all QR codes`);
  console.log(`   POST /api/bars/my/qrcodes - Generate QR code`);
  console.log(`   DELETE /api/bars/my/qrcodes/:id - Delete QR code`);
  console.log(`   POST /api/qrcodes/:id/scan - Track QR scan`);
});

module.exports = app;
