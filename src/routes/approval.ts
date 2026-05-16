import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { roleGuard } from "../middleware/roleGuard";
import { logAudit } from "../services/auditService";

const router = Router();

// GET /api/approvals/team — all pending goals for manager's team
router.get(
  "/team",
  authMiddleware,
  roleGuard("MANAGER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const subordinates = await prisma.user.findMany({
        where: { managerId: req.user!.id },
        select: { id: true },
      });

      const subordinateIds = subordinates.map((s) => s.id);

      const goals = await prisma.goal.findMany({
        where: {
          employeeId: { in: subordinateIds },
          status: "PENDING_APPROVAL",
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          cycle: true,
          approvals: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      res.json(goals);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to fetch team goals", error: String(err) });
    }
  },
);

// GET /api/approvals/team/all — all goals for manager's team (any status)
router.get(
  "/team/all",
  authMiddleware,
  roleGuard("MANAGER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const { cycleId } = req.query;
    try {
      const subordinates = await prisma.user.findMany({
        where: { managerId: req.user!.id },
        select: { id: true },
      });

      const subordinateIds = subordinates.map((s) => s.id);

      const goals = await prisma.goal.findMany({
        where: {
          employeeId: { in: subordinateIds },
          ...(cycleId ? { cycleId: String(cycleId) } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          cycle: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      res.json(goals);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch team goals" });
    }
  },
);

// POST /api/approvals/:goalId/approve — approve + lock goal
router.post(
  "/:goalId/approve",
  authMiddleware,
  roleGuard("MANAGER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const goalId = String(req.params.goalId);
    const { comment } = req.body;

    try {
      const goal = await prisma.goal.findUnique({
        where: { id: goalId },
        include: { employee: true },
      });

      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }
      if (goal.status !== "PENDING_APPROVAL") {
        res.status(400).json({ message: "Goal is not pending approval" });
        return;
      }

      // Check manager owns this employee
      if (
        req.user!.role === "MANAGER" &&
        goal.employee.managerId !== req.user!.id
      ) {
        res.status(403).json({ message: "This employee is not in your team" });
        return;
      }

      const before = { status: goal.status, isLocked: goal.isLocked };

      // Approve + lock
      const updated = await prisma.goal.update({
        where: { id: goalId },
        data: { status: "APPROVED", isLocked: true },
      });

      // Create approval record
      await prisma.approval.create({
        data: {
          goalId,
          managerId: req.user!.id,
          action: "APPROVED",
          comment: comment || null,
        },
      });

      // Audit log
      await logAudit({
        entityType: "Goal",
        entityId: goalId,
        goalId,
        changedBy: req.user!.id,
        before,
        after: { status: "APPROVED", isLocked: true },
      });

      res.json({ message: "Goal approved and locked", goal: updated });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to approve goal", error: String(err) });
    }
  },
);

// POST /api/approvals/:goalId/reject — reject with comment
router.post(
  "/:goalId/reject",
  authMiddleware,
  roleGuard("MANAGER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const goalId = String(req.params.goalId);
    const { comment } = req.body;

    try {
      const goal = await prisma.goal.findUnique({
        where: { id: goalId },
        include: { employee: true },
      });

      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }
      if (goal.status !== "PENDING_APPROVAL") {
        res.status(400).json({ message: "Goal is not pending approval" });
        return;
      }

      if (
        req.user!.role === "MANAGER" &&
        goal.employee.managerId !== req.user!.id
      ) {
        res.status(403).json({ message: "This employee is not in your team" });
        return;
      }

      const updated = await prisma.goal.update({
        where: { id: goalId },
        data: { status: "REJECTED" },
      });

      await prisma.approval.create({
        data: {
          goalId,
          managerId: req.user!.id,
          action: "REJECTED",
          comment: comment || null,
        },
      });

      await logAudit({
        entityType: "Goal",
        entityId: goalId,
        goalId,
        changedBy: req.user!.id,
        before: { status: "PENDING_APPROVAL" },
        after: { status: "REJECTED", comment },
      });

      res.json({ message: "Goal rejected", goal: updated });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to reject goal", error: String(err) });
    }
  },
);

// PUT /api/approvals/:goalId/edit — manager edits inline before approving
router.put(
  "/:goalId/edit",
  authMiddleware,
  roleGuard("MANAGER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const goalId = String(req.params.goalId);
    const { target, weightage, comment } = req.body;

    try {
      const goal = await prisma.goal.findUnique({
        where: { id: goalId },
        include: { employee: true },
      });

      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }
      if (goal.status !== "PENDING_APPROVAL") {
        res.status(400).json({ message: "Goal is not pending approval" });
        return;
      }

      if (
        req.user!.role === "MANAGER" &&
        goal.employee.managerId !== req.user!.id
      ) {
        res.status(403).json({ message: "This employee is not in your team" });
        return;
      }

      if (weightage && weightage < 10) {
        res.status(400).json({ message: "Minimum weightage per goal is 10%" });
        return;
      }

      const before = { target: goal.target, weightage: goal.weightage };

      const updated = await prisma.goal.update({
        where: { id: goalId },
        data: {
          ...(target !== undefined ? { target } : {}),
          ...(weightage !== undefined ? { weightage } : {}),
        },
      });

      await prisma.approval.create({
        data: {
          goalId,
          managerId: req.user!.id,
          action: "RETURNED",
          comment: comment || "Manager edited goal inline",
        },
      });

      await logAudit({
        entityType: "Goal",
        entityId: goalId,
        goalId,
        changedBy: req.user!.id,
        before,
        after: { target: updated.target, weightage: updated.weightage },
      });

      res.json({ message: "Goal updated by manager", goal: updated });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to edit goal", error: String(err) });
    }
  },
);

export default router;
