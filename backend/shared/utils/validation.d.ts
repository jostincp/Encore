import { ValidationResult, ValidationError } from '../types';
export declare const createValidationResult: (isValid: boolean, errors?: ValidationError[]) => ValidationResult;
export declare const isEmail: (email: string) => boolean;
export declare const isStrongPassword: (password: string) => boolean;
export declare const isValidUUID: (uuid: string) => boolean;
export declare const isPositiveNumber: (value: number) => boolean;
export declare const isNonEmptyString: (value: string) => boolean;
export declare const validateUserRegistration: (userData: any) => ValidationResult;
export declare const validateBarCreation: (barData: any) => ValidationResult;
export declare const validateSongRequest: (requestData: any) => ValidationResult;
export declare const validateMenuItem: (itemData: any) => ValidationResult;
export declare const sanitizeString: (str: string) => string;
export declare const sanitizeEmail: (email: string) => string;
export declare const validatePaginationParams: (query: any) => {
    page: number;
    limit: number;
    errors: ValidationError[];
};
//# sourceMappingURL=validation.d.ts.map