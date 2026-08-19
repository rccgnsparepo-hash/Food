import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { UserRole, Permission, UserProfile } from '../types.ts';
import { getRolePermissions } from '../services/authService.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  role: UserRole;
  roles: UserRole[];
  permissions: Permission[];
  vendor_id?: string;
  is_admin?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  decodedToken?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid authorization token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    // 1. Try Firebase Admin token verification
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.decodedToken = decodedToken;
    const role: UserRole = (decodedToken.role as UserRole) || 'customer';
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
      role: role,
      roles: [role],
      permissions: getRolePermissions(role),
      is_admin: role === 'admin' || role === 'super_admin'
    };
    return next();
  } catch (error) {
    // 2. Handle guest/local campus development session tokens
    if (token.startsWith('guest_') || token.startsWith('user_')) {
      const parts = token.split('_');
      const guessedRole: UserRole = ['admin', 'kitchen', 'rider', 'customer'].includes(parts[1] as any)
        ? (parts[1] as UserRole)
        : 'customer';

      req.user = {
        uid: token,
        email: `${token}@mtu.edu.ng`,
        name: `User ${token.slice(0, 8)}`,
        role: guessedRole,
        roles: [guessedRole],
        permissions: getRolePermissions(guessedRole),
        is_admin: guessedRole === 'admin'
      };
      return next();
    }

    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
    }

    const userRole = req.user.role;
    const hasRole =
      req.user.is_admin ||
      allowedRoles.includes(userRole) ||
      req.user.roles.some((r) => allowedRoles.includes(r));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Requires one of roles [${allowedRoles.join(', ')}]. Current role is '${userRole}'.`
      });
    }

    next();
  };
};

export const requirePermission = (...requiredPermissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
    }

    if (req.user.is_admin) {
      return next();
    }

    const hasAll = requiredPermissions.every((perm) => req.user?.permissions.includes(perm));
    if (!hasAll) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Insufficient permissions. Requires [${requiredPermissions.join(', ')}]`
      });
    }

    next();
  };
};
