import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { roleGuard } from "../middleware/roleGuard";
import { validateGoals, validateSubmission } from "../services/goalService";

const router = Router();

// POST /api/goals — create a goal
router.post(
  "/",
  authMiddleware,
  roleGuard("EMPLOYEE"),
  async (req: AuthRequest, res: Response) => {
    const {
      cycleId,
      thrustArea,
      title,
      description,
      uomType,
      target,
      weightage,
      deadline,
    } = req.body;
    const employeeId = req.user!.id;

    if (weightage < 10) {
      res.status(400).json({ message: "Minimum weightage per goal is 10%" });
      return;
    }

    const check = await validateGoals(employeeId, cycleId);
    if (!check.valid) {
      res.status(400).json({ message: check.message });
      return;
    }

    if (check.totalWeightage! + weightage > 100) {
      res.status(400).json({
        message: `Adding this goal would exceed 100%. Remaining: ${100 - check.totalWeightage!}%`,
      });
      return;
    }

    try {
      const goal = await prisma.goal.create({
        data: {
          employeeId,
          cycleId,
          thrustArea,
          title,
          description,
          uomType,
          target,
          weightage,
          deadline: deadline ? new Date(deadline) : null,
        },
      });
      res.status(201).json(goal);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to create goal", error: String(err) });
    }
  },
);

// GET /api/goals — get my goals
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  const cycleId = req.query.cycleId as string | undefined;
  try {
    const goals = await prisma.goal.findMany({
      where: {
        employeeId: req.user!.id,
        ...(cycleId ? { cycleId } : {}),
      },
      include: { cycle: true },
    });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch goals" });
  }
});

// GET /api/goals/:id — get single goal
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  try {
    const goal = await prisma.goal.findUnique({
      where: { id },
      include: { approvals: true, checkIns: true },
    });
    if (!goal) {
      res.status(404).json({ message: "Goal not found" });
      return;
    }
    res.json(goal);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch goal" });
  }
});

// PUT /api/goals/:id — update goal
router.put(
  "/:id",
  authMiddleware,
  roleGuard("EMPLOYEE"),
  async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    try {
      const goal = await prisma.goal.findUnique({
        where: { id },
      });
      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }
      if (goal.employeeId !== req.user!.id) {
        res.status(403).json({ message: "Not your goal" });
        return;
      }
      if (goal.isLocked) {
        res
          .status(400)
          .json({ message: "Goal is locked. Contact admin to unlock." });
        return;
      }
      if (goal.status !== "DRAFT") {
        res.status(400).json({ message: "Only draft goals can be edited" });
        return;
      }

      const {
        thrustArea,
        title,
        description,
        uomType,
        target,
        weightage,
        deadline,
      } = req.body;

      if (weightage && weightage < 10) {
        res.status(400).json({ message: "Minimum weightage per goal is 10%" });
        return;
      }

      const updated = await prisma.goal.update({
        where: { id },
        data: {
          thrustArea,
          title,
          description,
          uomType,
          target,
          weightage,
          deadline: deadline ? new Date(deadline) : undefined,
        },
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update goal" });
    }
  },
);

// DELETE /api/goals/:id — delete draft goal
router.delete(
  "/:id",
  authMiddleware,
  roleGuard("EMPLOYEE"),
  async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    try {
      const goal = await prisma.goal.findUnique({
        where: { id },
      });
      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }
      if (goal.employeeId !== req.user!.id) {
        res.status(403).json({ message: "Not your goal" });
        return;
      }
      if (goal.status !== "DRAFT") {
        res.status(400).json({ message: "Only draft goals can be deleted" });
        return;
      }

      await prisma.goal.delete({ where: { id } });
      res.json({ message: "Goal deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete goal" });
    }
  },
);

// POST /api/goals/submit — submit all draft goals for approval
router.post(
  "/submit",
  authMiddleware,
  roleGuard("EMPLOYEE"),
  async (req: AuthRequest, res: Response) => {
    const { cycleId } = req.body;
    const employeeId = req.user!.id;

    const check = await validateSubmission(employeeId, cycleId);
    if (!check.valid) {
      res.status(400).json({ message: check.message });
      return;
    }

    try {
      await prisma.goal.updateMany({
        where: { employeeId, cycleId, status: "DRAFT" },
        data: { status: "PENDING_APPROVAL" },
      });
      res.json({
        message: "Goals submitted for approval",
        count: check.goals!.length,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to submit goals" });
    }
  },
);

// POST /api/goals/share — admin/manager pushes goal to employees
router.post(
  "/share",
  authMiddleware,
  roleGuard("ADMIN", "MANAGER"),
  async (req: AuthRequest, res: Response) => {
    const { goalId, recipientIds, customWeightage } = req.body;
    try {
      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }

      const shares = await prisma.goalShare.createMany({
        data: recipientIds.map((recipientId: string) => ({
          goalId,
          recipientId,
          customWeightage,
        })),
        skipDuplicates: true,
      });
      res.status(201).json({ message: "Goal shared", count: shares.count });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to share goal", error: String(err) });
    }
  },
);

export default router;
