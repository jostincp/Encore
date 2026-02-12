import { Router } from 'express';
import {
  generateQRCodes,
  generateSingleQR,
  downloadQRCodes,
  validateQRCode,
  getBarQRCodes,
  deleteQRCodes
} from '../controllers/qrController';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '../constants/roles';

const router: Router = Router();

// Todas las rutas requieren autenticación excepto validación
router.use(authenticate);

/**
 * POST /api/qr/generate
 * Generar múltiples QR codes (devuelve JSON con Base64)
 * 
 * Body:
 * {
 *   "numberOfTables": 10,
 *   "baseUrl": "https://encoreapp.pro",
 *   "width": 300,
 *   "errorCorrectionLevel": "M"
 * }
 */
router.post('/generate',
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  generateQRCodes
);

/**
 * POST /api/qr/generate-single
 * Generar un solo QR code para una mesa específica
 * 
 * Body:
 * {
 *   "tableNumber": 5,
 *   "baseUrl": "https://encoreapp.pro"
 * }
 */
router.post('/generate-single',
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  generateSingleQR
);

/**
 * POST /api/qr/download
 * Descargar QR codes como archivos PNG en un ZIP
 * 
 * Body:
 * {
 *   "numberOfTables": 10,
 *   "baseUrl": "https://encoreapp.pro",
 *   "width": 600
 * }
 */
router.post('/download',
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  downloadQRCodes
);

/**
 * GET /api/qr/bar/:barId
 * Obtener QR codes existentes de un bar
 */
router.get('/bar/:barId',
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  getBarQRCodes
);

/**
 * DELETE /api/qr/delete
 * Eliminar QR codes por números de mesa
 * 
 * Body:
 * {
 *   "tableNumbers": [1, 2, 5]
 * }
 */
router.delete('/delete',
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  deleteQRCodes
);

/**
 * GET /api/qr/validate
 * Validar un código QR escaneado (pública, no requiere autenticación)
 * 
 * Query:
 * ?barId=uuid&table=5
 */
router.get('/validate', validateQRCode);

export default router;
