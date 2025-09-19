/**
 * User model interface
 */
export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'guest' | 'member' | 'bar_owner' | 'super_admin';
  isActive: boolean;
  isEmailVerified: boolean;
  phone?: string;
  avatarUrl?: string;
  barId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bar model interface
 */
export interface Bar {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone?: string;
  description?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  timezone: string;
  ownerId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bar settings interface
 */
export interface BarSettings {
  id: string;
  barId: string;
  maxSongsPerUser: number;
  songRequestCooldown: number;
  priorityPlayCost: number;
  autoApproveRequests: boolean;
  allowExplicitContent: boolean;
  maxQueueSize: number;
  pointsPerVisit: number;
  pointsPerPurchase: number;
  enableLoyaltyProgram: boolean;
  openTime?: string;
  closeTime?: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Refresh token model interface
 */
export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session model interface
 */
export interface Session {
  id: string;
  userId: string;
  refreshTokenId: string;
  deviceInfo?: string;
  ipAddress?: string;
  lastActivity: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}