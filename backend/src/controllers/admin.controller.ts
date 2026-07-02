import { Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/db';
import { AuthenticatedRequest } from '../middleware/admin.middleware';

// Get all users
export const listUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ users });
  } catch (error: any) {
    console.error('List users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users list.' });
  }
};

import { sendAccountApprovedEmail, sendAccountRejectedEmail } from '../services/email.service';

// Approve user
export const approveUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.params.id);

    const userToApprove = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToApprove) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (userToApprove.isActive) {
      return res.status(400).json({ error: 'User is already active.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    // Send email
    await sendAccountApprovedEmail(updatedUser.email, updatedUser.name);

    return res.json({ message: 'User approved and email sent successfully.', user: updatedUser });
  } catch (error: any) {
    console.error('Approve user error:', error);
    return res.status(500).json({ error: 'Failed to approve user.' });
  }
};

// Reject user
export const rejectUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.params.id);

    const userToReject = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToReject) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (userToReject.isActive) {
      return res.status(400).json({ error: 'Cannot reject an already active user.' });
    }

    // Send email first, before deleting
    await sendAccountRejectedEmail(userToReject.email, userToReject.name);

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.json({ message: 'User rejected and email sent successfully.' });
  } catch (error: any) {
    console.error('Reject user error:', error);
    return res.status(500).json({ error: 'Failed to reject user.' });
  }
};

// Create user
export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'USER';

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: assignedRole,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      message: 'User created successfully.',
      user,
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
};

// Delete user
export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.params.id);

    if (userId === req.user?.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.json({ message: 'User deleted successfully.' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
};
