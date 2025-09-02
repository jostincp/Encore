"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenExpiringSoon = exports.decodeTokenUnsafe = exports.authenticateTableSession = exports.verifyTableSessionToken = exports.generateTableSessionToken = exports.extractToken = exports.optionalAuth = exports.requireBarAccess = exports.requireRole = exports.authenticateToken = exports.verifyToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errors_1 = require("./errors");
const logger_1 = require("./logger");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const generateAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'encore-api',
        audience: 'encore-client'
    });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId, type: 'refresh' }, JWT_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        issuer: 'encore-api',
        audience: 'encore-client'
    });
};
exports.generateRefreshToken = generateRefreshToken;
const verifyToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
            issuer: 'encore-api',
            audience: 'encore-client'
        });
        return decoded;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new errors_1.UnauthorizedError('Token expired');
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            throw new errors_1.UnauthorizedError('Invalid token');
        }
        else {
            throw new errors_1.UnauthorizedError('Token verification failed');
        }
    }
};
exports.verifyToken = verifyToken;
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            throw new errors_1.UnauthorizedError('Access token required');
        }
        const decoded = (0, exports.verifyToken)(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        (0, logger_1.logError)('Authentication failed', error, {
            url: req.url,
            method: req.method,
            headers: req.headers
        });
        next(error);
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new errors_1.UnauthorizedError('User not authenticated');
            }
            const allowedRoles = Array.isArray(roles) ? roles : [roles];
            if (!allowedRoles.includes(req.user.role)) {
                throw new errors_1.ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireRole = requireRole;
const requireBarAccess = (req, res, next) => {
    try {
        if (!req.user) {
            throw new errors_1.UnauthorizedError('User not authenticated');
        }
        const barId = req.params.barId || req.body.barId || req.query.barId;
        if (!barId) {
            throw new errors_1.ForbiddenError('Bar ID required');
        }
        if (req.user.role === 'admin' && req.user.barId !== barId) {
            throw new errors_1.ForbiddenError('Access denied to this bar');
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireBarAccess = requireBarAccess;
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            const decoded = (0, exports.verifyToken)(token);
            req.user = decoded;
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    if (req.cookies && req.cookies.accessToken) {
        return req.cookies.accessToken;
    }
    if (req.query.token && typeof req.query.token === 'string') {
        return req.query.token;
    }
    return null;
};
exports.extractToken = extractToken;
const generateTableSessionToken = (tableId, barId) => {
    return jsonwebtoken_1.default.sign({
        tableId,
        barId,
        type: 'table_session',
        role: 'customer'
    }, JWT_SECRET, {
        expiresIn: '12h',
        issuer: 'encore-api',
        audience: 'encore-client'
    });
};
exports.generateTableSessionToken = generateTableSessionToken;
const verifyTableSessionToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (decoded.type !== 'table_session') {
            throw new errors_1.UnauthorizedError('Invalid session token');
        }
        return {
            tableId: decoded.tableId,
            barId: decoded.barId
        };
    }
    catch (error) {
        throw new errors_1.UnauthorizedError('Invalid table session token');
    }
};
exports.verifyTableSessionToken = verifyTableSessionToken;
const authenticateTableSession = (req, res, next) => {
    try {
        const token = (0, exports.extractToken)(req);
        if (!token) {
            throw new errors_1.UnauthorizedError('Session token required');
        }
        const sessionData = (0, exports.verifyTableSessionToken)(token);
        req.user = {
            userId: `table_${sessionData.tableId}`,
            email: '',
            role: 'customer',
            barId: sessionData.barId
        };
        req.tableSession = sessionData;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authenticateTableSession = authenticateTableSession;
const decodeTokenUnsafe = (token) => {
    return jsonwebtoken_1.default.decode(token);
};
exports.decodeTokenUnsafe = decodeTokenUnsafe;
const isTokenExpiringSoon = (token, minutesThreshold = 15) => {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded || !decoded.exp)
            return false;
        const expirationTime = decoded.exp * 1000;
        const currentTime = Date.now();
        const thresholdTime = minutesThreshold * 60 * 1000;
        return (expirationTime - currentTime) < thresholdTime;
    }
    catch (error) {
        return true;
    }
};
exports.isTokenExpiringSoon = isTokenExpiringSoon;
//# sourceMappingURL=jwt.js.map