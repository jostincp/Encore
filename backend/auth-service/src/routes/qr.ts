import { Router } from 'express';
import { generateQRCodes, getBarQRCodes, validateQRCode } from '../controllers/qrController';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '../constants/roles';

const router: Router = Router();

/**
 * POST /api/qr/generate
 * Generar códigos QR para las mesas de un bar
 * 
 * Body:
 * {
 *   "numberOfTables": 10,
 *   "baseUrl": "https://encoreapp.pro",
 *   "generatePDF": false
 * }
 */
router.post('/generate', 
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  generateQRCodes
);

/**
 * GET /api/qr/bar/:barId
 * Obtener códigos QR existentes de un bar
 */
router.get('/bar/:barId', 
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  getBarQRCodes
);

/**
 * GET /api/qr/validate
 * Validar un código QR escaneado
 * 
 * Query:
 * ?barId=uuid&table=5
 */
router.get('/validate', validateQRCode);

export default router;
