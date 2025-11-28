import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Get all students
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { class: className, search } = req.query;
    
    const where: any = {};
    if (className && className !== 'all') {
      where.class = className;
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { studentId: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get student by id
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student
router.post(
  '/',
  authenticateToken,
  [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('class').notEmpty().withMessage('Class is required'),
    validate,
  ],
  async (req: Request, res: Response) => {
    try {
      const { studentId, name, class: className, fingerprintData } = req.body;

      const existing = await prisma.student.findUnique({
        where: { studentId },
      });

      if (existing) {
        return res.status(400).json({ error: 'Student ID already exists' });
      }

      const student = await prisma.student.create({
        data: {
          studentId,
          name,
          class: className,
          fingerprintData,
        },
      });

      res.status(201).json(student);
    } catch (error) {
      console.error('Create student error:', error);
      res.status(500).json({ error: 'Failed to create student' });
    }
  }
);

// Update student
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, class: className, fingerprintData } = req.body;

    const student = await prisma.student.update({
      where: { id },
      data: {
        name,
        class: className,
        fingerprintData,
      },
    });

    res.json(student);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.student.delete({ where: { id } });

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

export default router;

