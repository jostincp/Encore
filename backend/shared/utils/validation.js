"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePaginationParams = exports.sanitizeEmail = exports.sanitizeString = exports.validateMenuItem = exports.validateSongRequest = exports.validateBarCreation = exports.validateUserRegistration = exports.isNonEmptyString = exports.isPositiveNumber = exports.isValidUUID = exports.isStrongPassword = exports.isEmail = exports.createValidationResult = void 0;
const createValidationResult = (isValid, errors = []) => {
    return { isValid, errors };
};
exports.createValidationResult = createValidationResult;
const isEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isEmail = isEmail;
const isStrongPassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};
exports.isStrongPassword = isStrongPassword;
const isValidUUID = (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};
exports.isValidUUID = isValidUUID;
const isPositiveNumber = (value) => {
    return typeof value === 'number' && value > 0;
};
exports.isPositiveNumber = isPositiveNumber;
const isNonEmptyString = (value) => {
    return typeof value === 'string' && value.trim().length > 0;
};
exports.isNonEmptyString = isNonEmptyString;
const validateUserRegistration = (userData) => {
    const errors = [];
    if (!(0, exports.isNonEmptyString)(userData.email)) {
        errors.push({ field: 'email', message: 'Email es requerido' });
    }
    else if (!(0, exports.isEmail)(userData.email)) {
        errors.push({ field: 'email', message: 'Email no es válido' });
    }
    if (!(0, exports.isNonEmptyString)(userData.password)) {
        errors.push({ field: 'password', message: 'Password es requerido' });
    }
    else if (!(0, exports.isStrongPassword)(userData.password)) {
        errors.push({ field: 'password', message: 'Password debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' });
    }
    if (!['admin', 'customer'].includes(userData.role)) {
        errors.push({ field: 'role', message: 'Role debe ser admin o customer' });
    }
    return (0, exports.createValidationResult)(errors.length === 0, errors);
};
exports.validateUserRegistration = validateUserRegistration;
const validateBarCreation = (barData) => {
    const errors = [];
    if (!(0, exports.isNonEmptyString)(barData.name)) {
        errors.push({ field: 'name', message: 'Nombre del bar es requerido' });
    }
    if (!(0, exports.isNonEmptyString)(barData.address)) {
        errors.push({ field: 'address', message: 'Dirección es requerida' });
    }
    if (!(0, exports.isValidUUID)(barData.ownerId)) {
        errors.push({ field: 'ownerId', message: 'ID del propietario no es válido' });
    }
    if (barData.settings) {
        if (!(0, exports.isPositiveNumber)(barData.settings.pointsPerEuro)) {
            errors.push({ field: 'settings.pointsPerEuro', message: 'Puntos por euro debe ser un número positivo' });
        }
        if (!(0, exports.isPositiveNumber)(barData.settings.songCostPoints)) {
            errors.push({ field: 'settings.songCostPoints', message: 'Costo de canción en puntos debe ser un número positivo' });
        }
        if (!['youtube', 'spotify'].includes(barData.settings.musicProvider)) {
            errors.push({ field: 'settings.musicProvider', message: 'Proveedor de música debe ser youtube o spotify' });
        }
    }
    return (0, exports.createValidationResult)(errors.length === 0, errors);
};
exports.validateBarCreation = validateBarCreation;
const validateSongRequest = (requestData) => {
    const errors = [];
    if (!(0, exports.isValidUUID)(requestData.barId)) {
        errors.push({ field: 'barId', message: 'ID del bar no es válido' });
    }
    if (!(0, exports.isValidUUID)(requestData.tableId)) {
        errors.push({ field: 'tableId', message: 'ID de la mesa no es válido' });
    }
    if (!(0, exports.isValidUUID)(requestData.songId)) {
        errors.push({ field: 'songId', message: 'ID de la canción no es válido' });
    }
    if (!(0, exports.isPositiveNumber)(requestData.pointsSpent)) {
        errors.push({ field: 'pointsSpent', message: 'Puntos gastados debe ser un número positivo' });
    }
    return (0, exports.createValidationResult)(errors.length === 0, errors);
};
exports.validateSongRequest = validateSongRequest;
const validateMenuItem = (itemData) => {
    const errors = [];
    if (!(0, exports.isNonEmptyString)(itemData.name)) {
        errors.push({ field: 'name', message: 'Nombre del producto es requerido' });
    }
    if (!(0, exports.isPositiveNumber)(itemData.price)) {
        errors.push({ field: 'price', message: 'Precio debe ser un número positivo' });
    }
    if (!(0, exports.isPositiveNumber)(itemData.pointsReward)) {
        errors.push({ field: 'pointsReward', message: 'Recompensa en puntos debe ser un número positivo' });
    }
    if (!(0, exports.isNonEmptyString)(itemData.category)) {
        errors.push({ field: 'category', message: 'Categoría es requerida' });
    }
    if (!(0, exports.isValidUUID)(itemData.barId)) {
        errors.push({ field: 'barId', message: 'ID del bar no es válido' });
    }
    return (0, exports.createValidationResult)(errors.length === 0, errors);
};
exports.validateMenuItem = validateMenuItem;
const sanitizeString = (str) => {
    return str.trim().replace(/[<>"'&]/g, '');
};
exports.sanitizeString = sanitizeString;
const sanitizeEmail = (email) => {
    return email.toLowerCase().trim();
};
exports.sanitizeEmail = sanitizeEmail;
const validatePaginationParams = (query) => {
    const errors = [];
    let page = 1;
    let limit = 10;
    if (query.page) {
        const parsedPage = parseInt(query.page);
        if (isNaN(parsedPage) || parsedPage < 1) {
            errors.push({ field: 'page', message: 'Page debe ser un número positivo' });
        }
        else {
            page = parsedPage;
        }
    }
    if (query.limit) {
        const parsedLimit = parseInt(query.limit);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            errors.push({ field: 'limit', message: 'Limit debe ser un número entre 1 y 100' });
        }
        else {
            limit = parsedLimit;
        }
    }
    return { page, limit, errors };
};
exports.validatePaginationParams = validatePaginationParams;
//# sourceMappingURL=validation.js.map