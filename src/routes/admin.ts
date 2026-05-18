import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { roleGuard } from "../middleware/roleGuard";

import bcrypt from 'bcryptjs'
const router = Router();

// GET /api/admin/users — list all users with hierarchy
router.get(
  "/users",
  authMiddleware,
  roleGuard("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managerId: true,
          manager: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
      res.json(users);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  },
);

// PUT /api/admin/users/:id — update role or managerId
router.put(
  "/users/:id",
  authMiddleware,
  roleGuard("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const { role, managerId } = req.body;
    const id = String(req.params.id);
    try {
      const user = await prisma.user.update({
        where: { id: id },
        data: {
          ...(role ? { role } : {}),
          ...(managerId !== undefined ? { managerId } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managerId: true,
        },
      });
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to update user" });
    }
  },
);

// POST /api/admin/goals/:id/unlock — unlock a locked goal
router.post(
  "/goals/:id/unlock",
  authMiddleware,
  roleGuard("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    try {
      const goal = await prisma.goal.findUnique({
        where: { id: id },
      });
      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }
      if (!goal.isLocked) {
        res.status(400).json({ message: "Goal is not locked" });
        return;
      }

      const updated = await prisma.goal.update({
        where: { id: id },
        data: { isLocked: false },
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          entityType: "Goal",
          entityId: goal.id,
          goalId: goal.id,
          changedBy: req.user!.id,
          before: { isLocked: true },
          after: { isLocked: false },
        },
      });

      res.json({ message: "Goal unlocked", goal: updated });
    } catch (err) {
      res.status(500).json({ message: "Failed to unlock goal" });
    }
  },
);

// GET /api/admin/goals — all goals across all employees
router.get(
  "/goals",
  authMiddleware,
  roleGuard("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const cycleId = req.query.cycleId as string | undefined;
    const status = req.query.status as string | undefined;
    try {
      const goals = await prisma.goal.findMany({
        where: {
          ...(cycleId ? { cycleId } : {}),
          ...(status ? { status: status as any } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          cycle: true,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(goals);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  },
);

// GET /api/admin/audit — audit log
router.get(
  "/audit",
  authMiddleware,
  roleGuard("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const { goalId } = req.query;
    try {
      const logs = await prisma.auditLog.findMany({
        where: { ...(goalId ? { goalId: String(goalId) } : {}) },
        include: {
          changer: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  },
);


// POST /api/admin/users — create user
router.post('/users', authMiddleware, roleGuard('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { name, email, password, role, managerId } = req.body

  if (!name || !email || !password || !role) {
    res.status(400).json({ message: 'name, email, password and role are required' })
    return
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(400).json({ message: 'User with this email already exists' })
      return
    }

    const hashed = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        managerId: managerId || null
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        manager: { select: { id: true, name: true } },
        createdAt: true
      }
    })

    res.status(201).json(user)
  } catch (err) {
    res.status(500).json({ message: 'Failed to create user', error: String(err) })
  }
})

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', authMiddleware, roleGuard('ADMIN'), async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id)

  // Prevent admin from deleting themselves
  if (id === req.user!.id) {
    res.status(400).json({ message: 'You cannot delete your own account' })
    return
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    // Clean up dependent data first
    await prisma.auditLog.deleteMany({ where: { changedBy: id } })
    await prisma.checkIn.deleteMany({ where: { employeeId: id } })
    await prisma.approval.deleteMany({ where: { managerId: id } })
    await prisma.goalShare.deleteMany({ where: { recipientId: id } })
    await prisma.goal.deleteMany({ where: { employeeId: id } })

    // Remove managerId from subordinates
    await prisma.user.updateMany({
      where: { managerId: id },
      data: { managerId: null }
    })

    await prisma.user.delete({ where: { id } })

    res.json({ message: `User ${user.name} deleted successfully` })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user', error: String(err) })
  }
})
export default router;
