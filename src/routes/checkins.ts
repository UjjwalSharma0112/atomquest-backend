import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { roleGuard } from "../middleware/roleGuard";
import { computeScore } from "../services/scoreService";

const router = Router();

// POST /api/checkins — employee logs actual achievement
router.post(
  "/",
  authMiddleware,
  roleGuard("EMPLOYEE"),
  async (req: AuthRequest, res: Response) => {
    const { goalId, quarter, planned, actual, status, completionDate } =
      req.body;
    const employeeId = req.user!.id;

    try {
      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }
      if (goal.employeeId !== employeeId) {
        res.status(403).json({ message: "Not your goal" });
        return;
      }
      if (!goal.isLocked) {
        res
          .status(400)
          .json({ message: "Goal must be approved before check-in" });
        return;
      }

      // Check if check-in already exists for this goal + quarter
      const existing = await prisma.checkIn.findFirst({
        where: { goalId, quarter, employeeId },
      });

      const score = computeScore({
        uomType: goal.uomType,
        target: goal.target,
        actual,
        deadline: goal.deadline,
        completionDate: completionDate ? new Date(completionDate) : null,
      });

      let checkIn;
      if (existing) {
        // Update existing check-in
        checkIn = await prisma.checkIn.update({
          where: { id: existing.id },
          data: {
            planned,
            actual,
            status,
            completionDate: completionDate ? new Date(completionDate) : null,
          },
        });
      } else {
        // Create new check-in
        checkIn = await prisma.checkIn.create({
          data: {
            goalId,
            employeeId,
            quarter,
            planned,
            actual,
            status,
            completionDate: completionDate ? new Date(completionDate) : null,
          },
        });
      }

      res.status(201).json({ checkIn, score: `${score.toFixed(1)}%` });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to log check-in", error: String(err) });
    }
  },
);

// GET /api/checkins/my — employee views their own check-ins
router.get(
  "/my",
  authMiddleware,
  roleGuard("EMPLOYEE"),
  async (req: AuthRequest, res: Response) => {
    const { cycleId } = req.query;
    try {
      const checkIns = await prisma.checkIn.findMany({
        where: {
          employeeId: req.user!.id,
          ...(cycleId ? { goal: { cycleId: String(cycleId) } } : {}),
        },
        include: {
          goal: {
            select: {
              id: true,
              title: true,
              uomType: true,
              target: true,
              weightage: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Attach score to each check-in
      const withScores = checkIns.map((c) => ({
        ...c,
        score:
          c.actual !== null
            ? `${computeScore({
                uomType: c.goal.uomType,
                target: c.goal.target,
                actual: c.actual,
                completionDate: c.completionDate,
              }).toFixed(1)}%`
            : "N/A",
      }));

      res.json(withScores);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch check-ins" });
    }
  },
);

// GET /api/checkins/team — manager views team check-ins
router.get(
  "/team",
  authMiddleware,
  roleGuard("MANAGER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const { cycleId, quarter } = req.query;
    try {
      let subordinateIds: string[] = [];

      if (req.user!.role === "ADMIN") {
        const allEmployees = await prisma.user.findMany({
          where: { role: "EMPLOYEE" },
          select: { id: true },
        });
        subordinateIds = allEmployees.map((e) => e.id);
      } else {
        const subordinates = await prisma.user.findMany({
          where: { managerId: req.user!.id },
          select: { id: true },
        });
        subordinateIds = subordinates.map((s) => s.id);
      }

      if (subordinateIds.length === 0) {
        res.json([]);
        return;
      }

      const checkIns = await prisma.checkIn.findMany({
        where: {
          employeeId: { in: subordinateIds },
          ...(quarter ? { quarter: String(quarter) as any } : {}),
          ...(cycleId ? { goal: { cycleId: String(cycleId) } } : {}),
        },
        include: {
          goal: {
            select: {
              id: true,
              title: true,
              uomType: true,
              target: true,
              weightage: true,
              cycleId: true,
            },
          },
          employee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const withScores = checkIns.map((c) => ({
        ...c,
        score:
          c.actual !== null
            ? `${computeScore({
                uomType: c.goal.uomType,
                target: c.goal.target,
                actual: c.actual,
                completionDate: c.completionDate,
              }).toFixed(1)}%`
            : "N/A",
      }));

      res.json(withScores);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch team check-ins" });
    }
  },
);
// POST /api/checkins/:id/comment — manager adds structured comment
router.post(
  "/:id/comment",
  authMiddleware,
  roleGuard("MANAGER", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { comment } = req.body;
    try {
      const checkIn = await prisma.checkIn.findUnique({ where: { id } });
      if (!checkIn) {
        res.status(404).json({ message: "Check-in not found" });
        return;
      }

      const updated = await prisma.checkIn.update({
        where: { id },
        data: { managerComment: comment },
      });
      res.json({ message: "Comment added", checkIn: updated });
    } catch (err) {
      res.status(500).json({ message: "Failed to add comment" });
    }
  },
);

export default router;
