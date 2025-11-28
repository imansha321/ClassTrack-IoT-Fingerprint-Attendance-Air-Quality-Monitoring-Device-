import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticateToken, isAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// List users (admin only)
router.get('/users', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        schoolName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
router.patch(
  '/users/:id/role',
  authenticateToken,
  isAdmin,
  [
    body('role')
      .isIn(['ADMIN', 'TEACHER', 'STAFF'])
      .withMessage('Role must be one of ADMIN, TEACHER, STAFF'),
    validate,
  ],
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body as { role: 'ADMIN' | 'TEACHER' | 'STAFF' };

      const updated = await prisma.user.update({
        where: { id },
        data: { role },
        select: { id: true, email: true, fullName: true, schoolName: true, role: true },
      });

      res.json(updated);
    } catch (error) {
      console.error('Admin update role error:', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

// Delete user (admin only) - prevent deleting self
router.delete('/users/:id', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // @ts-ignore
    const requesterId = (req as any).user?.id as string | undefined;
    if (requesterId && requesterId === id) {
      return res.status(400).json({ error: "You can't delete your own account" });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
