import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticateToken, authenticateDeviceToken, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Get attendance records
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { date, class: className } = req.query;
    
    const where: any = {};
    
    if (date) {
      const targetDate = new Date(date as string);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      where.checkInTime = {
        gte: targetDate,
        lt: nextDay,
      };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        student: true,
        device: true,
      },
      orderBy: { checkInTime: 'desc' },
    });

    // Filter by class if provided
    let filteredAttendances = attendances;
    if (className && className !== 'all') {
      filteredAttendances = attendances.filter(a => a.student.class === className);
    }

    res.json(filteredAttendances);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Record attendance (from ESP32)
router.post(
  '/',
  [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('fingerprintMatch').isBoolean().withMessage('Fingerprint match must be boolean'),
    validate,
  ],
  async (req: Request, res: Response) => {
    try {
      const { studentId, deviceId, fingerprintMatch, reliability } = req.body;

      // Find student
      const student = await prisma.student.findUnique({
        where: { studentId },
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Find device
      const device = await prisma.device.findUnique({
        where: { deviceId },
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Determine status based on time
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const timeInMinutes = hour * 60 + minute;
      const cutoffTime = 8 * 60 + 30; // 8:30 AM

      const status = timeInMinutes <= cutoffTime ? 'PRESENT' : 'LATE';

      // Create attendance record
      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          deviceId: device.id,
          checkInTime: now,
          status,
          fingerprintMatch,
          reliability: reliability || 98,
        },
        include: {
          student: true,
        },
      });

      res.status(201).json(attendance);
    } catch (error) {
      console.error('Record attendance error:', error);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  }
);

// Record attendance using device token (ESP32)
router.post(
  '/device',
  [
    authenticateDeviceToken,
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('fingerprintMatch').isBoolean().withMessage('Fingerprint match must be boolean'),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, fingerprintMatch, reliability } = req.body;
      const tokenDeviceId = req.device?.deviceId;

      if (!tokenDeviceId) {
        return res.status(401).json({ error: 'Device token missing deviceId' });
      }

      const student = await prisma.student.findUnique({ where: { studentId } });
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const device = await prisma.device.findUnique({ where: { deviceId: tokenDeviceId } });
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const timeInMinutes = hour * 60 + minute;
      const cutoffTime = 8 * 60 + 30; // 8:30 AM
      const status = timeInMinutes <= cutoffTime ? 'PRESENT' : 'LATE';

      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          deviceId: device.id,
          checkInTime: now,
          status,
          fingerprintMatch,
          reliability: reliability || 98,
        },
        include: { student: true },
      });

      res.status(201).json(attendance);
    } catch (error) {
      console.error('Record attendance (device) error:', error);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  }
);

// Get attendance statistics
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {};
    if (startDate && endDate) {
      where.checkInTime = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const [total, present, absent, late] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.count({ where: { ...where, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { ...where, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { ...where, status: 'LATE' } }),
    ]);

    res.json({
      total,
      present,
      absent,
      late,
      presentRate: total > 0 ? ((present / total) * 100).toFixed(1) : '0.0',
    });
  } catch (error) {
    console.error('Attendance stats error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance statistics' });
  }
});

// Get student attendance history
router.get('/student/:studentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const { limit = 10 } = req.query;

    const student = await prisma.student.findUnique({
      where: { studentId },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const attendances = await prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { checkInTime: 'desc' },
      take: Number(limit),
      include: { device: true },
    });

    res.json(attendances);
  } catch (error) {
    console.error('Student attendance history error:', error);
    res.status(500).json({ error: 'Failed to fetch student attendance history' });
  }
});

export default router;

