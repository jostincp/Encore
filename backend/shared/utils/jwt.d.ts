import { Request, Response, NextFunction } from 'express';
export interface JwtPayload {
    userId: string;
    email: string;
    role: 'admin' | 'customer';
    barId?: string;
    iat?: number;
    exp?: number;
}
export interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
}
export declare const generateAccessToken: (payload: Omit<JwtPayload, "iat" | "exp">) => string;
export declare const generateRefreshToken: (userId: string) => string;
export declare const verifyToken: (token: string) => JwtPayload;
export declare const authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireRole: (roles: string | string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireBarAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const extractToken: (req: Request) => string | null;
export declare const generateTableSessionToken: (tableId: string, barId: string) => string;
export declare const verifyTableSessionToken: (token: string) => {
    tableId: string;
    barId: string;
};
export declare const authenticateTableSession: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const decodeTokenUnsafe: (token: string) => any;
export declare const isTokenExpiringSoon: (token: string, minutesThreshold?: number) => boolean;
//# sourceMappingURL=jwt.d.ts.map