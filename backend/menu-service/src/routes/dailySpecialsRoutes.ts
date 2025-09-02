import { Router, Request, Response, NextFunction } from 'express';
import { DailySpecialsController } from '../controllers/dailySpecialsController';
import { authenticateToken } from '../middleware/auth';
// Validation middleware would be imported here when implemented

const router = Router();

// Public routes
router.get('/bars/:barId/daily-specials', (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.getDailySpecials(req, res, next);
});

router.get('/bars/:barId/daily-specials/:specialId', (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.getDailySpecial(req, res, next);
});

// Protected routes - Create daily special
router.post('/bars/:barId/daily-specials', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.createDailySpecial(req, res, next);
});

// Protected routes - Update daily special
router.put('/daily-specials/:specialId', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.updateDailySpecial(req, res, next);
});

// Protected routes - Delete daily special
router.delete('/daily-specials/:specialId', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.deleteDailySpecial(req, res, next);
});

// Protected routes - Toggle daily special status
router.patch('/daily-specials/:specialId/toggle', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.toggleDailySpecialStatus(req, res, next);
});

// Utility routes
router.get('/bars/:barId/daily-specials/active', (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.getActiveDailySpecials(req, res, next);
});

router.get('/bars/:barId/daily-specials/expired', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.getExpiredDailySpecials(req, res, next);
});

router.get('/bars/:barId/daily-specials/upcoming', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  DailySpecialsController.getUpcomingDailySpecials(req, res, next);
});

export default router;