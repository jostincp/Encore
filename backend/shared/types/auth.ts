import { Request } from 'express';
import { User, UserRole } from './index';

// JWT Payload interface
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  barId?: string;
  iat?: number;
  exp?: number;
}

// Authenticated Request interface
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  token?: string;
}

// Auth response interfaces
export interface LoginResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
    expiresIn: number;
  };
  message?: string;
}

export interface RegisterResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
    expiresIn: number;
  };
  message?: string;
}

// Auth request interfaces
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role?: UserRole;
  barId?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ConfirmResetPasswordRequest {
  token: string;
  newPassword: string;
}