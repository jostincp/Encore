import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../shared/utils/logger';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '../constants/roles';

interface QRCodeData {
  tableNumber: number;
  qrCodeDataURL: string; // Imagen en Base64
  url: string; // URL que está codificada en el QR
  barId: string;
  generatedAt: string;
}

/**
 * Genera códigos QR para las mesas de un bar
 * @route POST /api/qr/generate
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

    // Obtener el barId del usuario autenticado (del JWT)
    const barId = (req.user as any)?.barId || (req.user as any)?.userId;
    
    // Obtener configuración del request
    const { 
      numberOfTables = 10, 
      baseUrl = process.env.FRONTEND_URL || 'https://encoreapp.pro',
      width = 300,
      errorCorrectionLevel = 'M'
    } = req.body;

    // Validación
    if (!numberOfTables || numberOfTables < 1 || numberOfTables > 100) {
      res.status(400).json({ 
        success: false,
        error: 'numberOfTables debe ser entre 1 y 100' 
      });
      return;
    }

    logger.info(`Generating ${numberOfTables} QR codes for bar: ${barId}`);

    const qrCodes: QRCodeData[] = [];

    // Generar un QR code para cada mesa
    for (let tableNumber = 1; tableNumber <= numberOfTables; tableNumber++) {
      // Construir la URL con los parámetros necesarios (siguiendo el formato especificado)
      const url = `${baseUrl}/client/music?barId=${barId}&table=${tableNumber}`;
      
      // Generar el QR code como Data URL (Base64) con opciones optimizadas
      const qrCodeDataURL = await QRCode.toDataURL(url, {
        errorCorrectionLevel: errorCorrectionLevel as any, // Nivel de corrección de errores
        type: 'image/png',
        width: width, // Ancho de la imagen en píxeles
        margin: 2, // Margen alrededor del QR
        color: {
          dark: '#000000',  // Color de los módulos (puntos negros)
          light: '#FFFFFF'  // Color del fondo
        }
      });

      qrCodes.push({
        tableNumber,
        qrCodeDataURL,
        url,
        barId,
        generatedAt: new Date().toISOString()
      });
    }

    // TODO: Guardar en la base de datos (opcional pero recomendado)
    // await saveQRCodesToDatabase(barId, qrCodes);

    res.status(200).json({
      success: true,
      barId,
      qrCodes,
      totalQRCodes: qrCodes.length,
      message: `${numberOfTables} códigos QR generados exitosamente` 
    });

  } catch (error) {
    logger.error('Error generando QR codes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno al generar códigos QR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Genera un QR code individual para una mesa específica
 * @route POST /api/qr/generate-single
 */
export const generateSingleQR = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autorizado. Se requiere autenticación.'
      });
      return;
    }

    const barId = (req.user as any)?.barId || (req.user as any)?.userId;
    const { tableNumber, baseUrl = process.env.FRONTEND_URL || 'https://encoreapp.pro' } = req.body;

    if (!tableNumber || tableNumber < 1) {
      res.status(400).json({ error: 'tableNumber es requerido y debe ser mayor a 0' });
      return;
    }

    const url = `${baseUrl}/client/music?barId=${barId}&table=${tableNumber}`;

    const qrCodeDataURL = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.status(200).json({
      success: true,
      barId,
      tableNumber,
      qrCodeDataURL,
      url,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error generando QR code individual:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al generar código QR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Genera QR codes y los descarga como archivos PNG en un ZIP
 * @route POST /api/qr/download
 */
export const downloadQRCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autorizado. Se requiere autenticación.'
      });
      return;
    }

    const barId = (req.user as any)?.barId || (req.user as any)?.userId;
    const { 
      numberOfTables = 10, 
      baseUrl = process.env.FRONTEND_URL || 'https://encoreapp.pro',
      width = 600 // Más grande para impresión
    } = req.body;

    // Importar módulos necesarios para crear ZIP
    const archiver = require('archiver');
    
    // Crear un stream para el ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.attachment(`encore-qr-codes-bar-${barId}.zip`);
    archive.pipe(res);

    for (let tableNumber = 1; tableNumber <= numberOfTables; tableNumber++) {
      const url = `${baseUrl}/client/music?barId=${barId}&table=${tableNumber}`;
      
      // Generar el QR como buffer (más grande para impresión)
      const qrBuffer = await QRCode.toBuffer(url, {
        errorCorrectionLevel: 'M',
        width: width,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Añadir al ZIP con nombre descriptivo
      archive.append(qrBuffer, { name: `mesa-${tableNumber}-qr.png` });
    }

    await archive.finalize();

  } catch (error) {
    logger.error('Error generando descarga de QR codes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al generar descarga',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Validar QR code escaneado
 * @route GET /api/qr/validate
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

    // Validar formato del barId (UUID)
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(barId as string);
    const isValidTable = !isNaN(parseInt(table as string)) && parseInt(table as string) > 0;

    if (!isValidUUID || !isValidTable) {
      res.status(400).json({
        success: false,
        message: 'Código QR inválido'
      });
      return;
    }

    // TODO: Validar que el bar exista en la base de datos
    // const barExists = await checkBarExists(barId);
    // if (!barExists) {
    //   res.status(404).json({
    //     success: false,
    //     message: 'Bar no encontrado'
    //   });
    //   return;
    // }

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
      message: 'Error al validar código QR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Obtener QR codes existentes para un bar
 * @route GET /api/qr/bar/:barId
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
    // const qrCodes = await getQRCodesFromDatabase(barId);
    
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
      message: 'Error al obtener códigos QR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Función auxiliar para guardar en BD (opcional)
async function saveQRCodesToDatabase(barId: string, qrCodes: QRCodeData[]) {
  // TODO: Implementar según tu ORM (Prisma, TypeORM, etc.)
  // Ejemplo con Prisma:
  // await prisma.qrCode.createMany({
  //   data: qrCodes.map(qr => ({
  //     barId,
  //     tableNumber: qr.tableNumber,
  //     url: qr.url,
  //     qrCodeDataURL: qr.qrCodeDataURL,
  //     createdAt: new Date()
  //   }))
  // });
  logger.info(`TODO: Save ${qrCodes.length} QR codes to database for bar: ${barId}`);
}
