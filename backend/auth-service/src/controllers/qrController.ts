import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../shared/utils/logger';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '../constants/roles';

/**
 * Generador de Códigos QR para Mesas de Bar
 * 
 * Cada QR contiene:
 * - barId: UUID único del bar
 * - table: Número de mesa específico
 * 
 * URL format: https://encoreapp.pro/client/music?barId={barId}&table={tableNumber}
 */
export const generateQRCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verificar autenticación del administrador del bar
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autorizado. Se requiere autenticación.'
      });
      return;
    }

    const { numberOfTables = 10, baseUrl = 'https://encoreapp.pro' } = req.body;
    const barId = (req.user as any)?.barId || (req.user as any)?.userId; // Del JWT o del bar del admin

    if (numberOfTables < 1 || numberOfTables > 100) {
      res.status(400).json({
        success: false,
        message: 'El número de mesas debe estar entre 1 y 100'
      });
      return;
    }

    logger.info(`Generating ${numberOfTables} QR codes for bar: ${barId}`);

    const qrCodes = [];

    for (let i = 1; i <= numberOfTables; i++) {
      // Generar URL única para cada mesa
      const url = `${baseUrl}/client/music?barId=${barId}&table=${i}`;
      
      // Generar QR code en base64
      const qrCodeDataURL = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      qrCodes.push({
        tableNumber: i,
        qrCodeImage: qrCodeDataURL,
        qrUrl: url,
        barId,
        generatedAt: new Date().toISOString()
      });
    }

    // Opcional: Generar PDF con todos los QR codes
    const pdfRequested = req.body.generatePDF === true;
    let pdfData = null;

    if (pdfRequested) {
      // TODO: Implementar generación de PDF con todos los QR codes
      // Por ahora, devolvemos las imágenes individuales
      logger.info('PDF generation requested - not implemented yet');
    }

    res.json({
      success: true,
      data: {
        barId,
        totalQRCodes: qrCodes.length,
        qrCodes,
        pdfGenerated: pdfRequested,
        generatedAt: new Date().toISOString()
      },
      message: `${qrCodes.length} códigos QR generados exitosamente`
    });

  } catch (error) {
    logger.error('Error generating QR codes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar códigos QR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Obtener QR codes existentes para un bar
 */
export const getBarQRCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
      return;
    }

    const { barId } = req.params;
    
    // TODO: Obtener QR codes guardados en base de datos
    // Por ahora, devolvemos un array vacío
    res.json({
      success: true,
      data: {
        barId,
        qrCodes: [],
        totalQRCodes: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching QR codes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener códigos QR'
    });
  }
};

/**
 * Validar QR code escaneado
 */
export const validateQRCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { barId, table } = req.query;

    if (!barId || !table) {
      res.status(400).json({
        success: false,
        message: 'Se requieren barId y table'
      });
      return;
    }

    // TODO: Validar que el bar exista y la mesa sea válida
    // Por ahora, validamos formato básico
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(barId as string);
    const isValidTable = !isNaN(parseInt(table as string)) && parseInt(table as string) > 0;

    if (!isValidUUID || !isValidTable) {
      res.status(400).json({
        success: false,
        message: 'Código QR inválido'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        barId,
        tableNumber: parseInt(table as string),
        isValid: true
      }
    });

  } catch (error) {
    logger.error('Error validating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar código QR'
    });
  }
};
