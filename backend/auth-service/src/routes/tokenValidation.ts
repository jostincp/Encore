import { Router, Request, Response } from 'express';
import { getPool } from '../../../shared/database';
import logger from '../../../shared/utils/logger';

const router: Router = Router();

/**
 * GET /api/t/:token
 * Valida un token QR, registra el scan en analytics y redirige al cliente.
 * Endpoint público (no requiere autenticación).
 */
router.get('/:token', async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.params;

        if (!token || token.length < 16) {
            res.status(400).json({
                success: false,
                message: 'Token QR inválido'
            });
            return;
        }

        const pool = getPool();

        // Buscar la mesa por su token
        const tableResult = await pool.query(
            `SELECT t.id, t.bar_id, t.table_number, t.is_active, b.name as bar_name
       FROM tables t
       JOIN bars b ON b.id = t.bar_id
       WHERE t.qr_token = $1`,
            [token]
        );

        if (tableResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Código QR inválido o expirado. Solicita uno nuevo al personal.'
            });
            return;
        }

        const table = tableResult.rows[0];

        if (!table.is_active) {
            res.status(410).json({
                success: false,
                message: 'Esta mesa está desactivada. Contacta al personal.'
            });
            return;
        }

        // Registrar scan en analytics
        const userAgent = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;

        await pool.query(
            `INSERT INTO qr_scans (table_id, bar_id, qr_token, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
            [table.id, table.bar_id, token, userAgent, ipAddress]
        );

        // Actualizar contadores en la mesa
        await pool.query(
            `UPDATE tables SET qr_scan_count = qr_scan_count + 1, qr_last_scanned = NOW() WHERE id = $1`,
            [table.id]
        );

        logger.info(`QR scanned: token=${token.substring(0, 8)}... bar=${table.bar_id} table=${table.table_number}`);

        // Construir URL de redirección al cliente
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3004';
        const redirectUrl = `${baseUrl}/client/music?barId=${table.bar_id}&table=${table.table_number}`;

        // Si la petición es de un navegador, redirigir
        const acceptsHtml = req.headers.accept?.includes('text/html');
        if (acceptsHtml) {
            res.redirect(302, redirectUrl);
            return;
        }

        // Si es una API call (ej: desde el escáner en-app), devolver datos
        res.json({
            success: true,
            data: {
                barId: table.bar_id,
                barName: table.bar_name,
                tableNumber: table.table_number,
                redirectUrl
            }
        });

    } catch (error) {
        logger.error('Error validating QR token:', error);
        res.status(500).json({
            success: false,
            message: 'Error al validar código QR'
        });
    }
});

export default router;
