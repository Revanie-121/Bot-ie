import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifyJwtToken } from '../utils/sonoraLogic.ts';

export const JWT_SECRET = process.env.JWT_SECRET_KEY || 'sonora-lucidadl-production-jwt-secret-2026';

export interface AuthUser {
  uid: string;
  email: string;
  role: string;
  telegramChatId?: string;
  authMethod: 'firebase' | 'jwt';
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // 1. Check HS256 JWT Session Token first
  const jwtCheck = verifyJwtToken(token, JWT_SECRET);
  if (jwtCheck.valid && jwtCheck.payload) {
    req.user = {
      uid: jwtCheck.payload.sub,
      email: jwtCheck.payload.email,
      role: jwtCheck.payload.role || 'operator',
      telegramChatId: jwtCheck.payload.telegramChatId,
      authMethod: 'jwt',
    };
    return next();
  }

  // 2. Fallback to Firebase Auth ID Token verification
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || `${decodedToken.uid}@sonora.local`,
      role: 'operator',
      authMethod: 'firebase',
    };
    return next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
