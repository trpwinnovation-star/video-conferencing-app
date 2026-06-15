import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/db';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const isProduction = process.env.NODE_ENV === 'production';

/** Cross-origin frontend (Render) requires SameSite=None + Secure for credentialed fetch. */
const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // const auditId = uuidv4();
    // const auditCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        // auditId,
        // auditCode,
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, authCookieOptions);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        meetingDefaultPassword: user.meetingDefaultPassword,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, authCookieOptions);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        meetingDefaultPassword: user.meetingDefaultPassword,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
};

export const authRegister = async (req: Request, res: Response) => {
  const { tkn } = req.body;
  if (!tkn) {
    return res.status(400).json({ error: 'Token is required' });
  }
  const { _Id, _TenantKey, _Email, _Name } = jwt.verify(tkn, JWT_SECRET) as { _Id: number, _TenantKey: string, _Email: string, _Name: string }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: _Email,
      auditId: _Id.toString(),
      auditCode: _TenantKey
    },
  })
  const Password = _TenantKey + _Name;
  const hashedPassword = await bcrypt.hash(Password, 10);
  let user;

  if (existingUser) {

    user = existingUser;

  } else {
    user = await prisma.user.create({
      data: {
        email: _Email,
        password: hashedPassword,
        name: _Name,
        auditId: _Id.toString(),
        auditCode: _TenantKey,
      },
    });
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
  res.cookie('token', token, authCookieOptions);

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      meetingDefaultPassword: user.meetingDefaultPassword,
    },
  });
}

export const authStatus = async (req: Request, res: Response) => {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string, email: string, name: string };
    return res.json({
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
      },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token', authCookieOptions);
  return res.json({ message: 'Logged out successfully' });
};

export const getMe = async (req: Request, res: Response) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string, email: string, name: string };

    // Optional: verify user still exists in DB
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      res.clearCookie('token', authCookieOptions);
      return res.status(401).json({ error: 'User no longer exists' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        meetingDefaultPassword: user.meetingDefaultPassword,
      },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
};

import { sendPasswordResetEmail } from '../services/email.service';

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // For security, don't reveal if user exists, just return success
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const resetToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(user.email, resetLink);

    return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: decoded.id },
        data: { password: hashedPassword }
      });

      return res.json({ message: 'Password reset successfully' });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const updateDefaultPassword = async (req: Request, res: Response) => {
  try {
    const { meetingDefaultPassword } = req.body;

    if (meetingDefaultPassword === undefined || meetingDefaultPassword === null) {
      return res.status(400).json({ error: 'meetingDefaultPassword is required' });
    }

    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    const user = await prisma.user.update({
      where: { id: decoded.id },
      data: { meetingDefaultPassword: String(meetingDefaultPassword) }
    });

    return res.json({
      message: 'Default meeting password updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        meetingDefaultPassword: user.meetingDefaultPassword,
      }
    });
  } catch (error) {
    console.error('Update default password error:', error);
    return res.status(500).json({ error: 'Failed to update default meeting password' });
  }
};

