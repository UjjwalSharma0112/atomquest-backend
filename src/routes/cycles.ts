import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { roleGuard } from "../middleware/roleGuard";

const router = Router();

// POST /api/cycles — create a cycle (admin only)
router.post(
  "/",
  authMiddleware,
  roleGuard("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const { year, phase, windowOpen, windowClose } = req.body;
    try {
      const cycle = await prisma.cycle.create({
        data: {
          year,
          phase,
          windowOpen: new Date(windowOpen),
          windowClose: new Date(windowClose),
        },
      });
      res.status(201).json(cycle);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to create cycle", error: String(err) });
    }
  },
);

// GET /api/cycles — list all cycles
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cycles = await prisma.cycle.findMany({
      orderBy: { windowOpen: "desc" },
    });
    res.json(cycles);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch cycles" });
  }
});

// GET /api/cycles/active — get currently active cycle
router.get(
  "/active",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const now = new Date();
    try {
      const cycle = await prisma.cycle.findFirst({
        where: {
          windowOpen: { lte: now },
          windowClose: { gte: now },
        },
        orderBy: { windowOpen: "desc" },
      });
      if (!cycle) {
        res.status(404).json({ message: "No active cycle found" });
        return;
      }
      res.json(cycle);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch active cycle" });
    }
  },
);

// GET /api/cycles/:id — get single cycle
// GET /api/cycles/:id
router.get("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  try {
    const cycle = await prisma.cycle.findUnique({ where: { id } });
    if (!cycle) {
      res.status(404).json({ message: "Cycle not found" });
      return;
    }
    res.json(cycle);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch cycle" });
  }
});

// PUT /api/cycles/:id
router.put(
  "/:id",
  authMiddleware,
  roleGuard("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { windowOpen, windowClose, phase } = req.body;
    try {
      const cycle = await prisma.cycle.update({
        where: { id },
        data: {
          ...(windowOpen ? { windowOpen: new Date(windowOpen) } : {}),
          ...(windowClose ? { windowClose: new Date(windowClose) } : {}),
          ...(phase ? { phase } : {}),
        },
      });
      res.json(cycle);
    } catch (err) {
      res.status(500).json({ message: "Failed to update cycle" });
    }
  },
);

// PUT /api/cycles/:id — update window dates (admin only)
router.put(
  "/:id",
  authMiddleware,
  roleGuard("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const { windowOpen, windowClose, phase } = req.body;
    try {
      const cycle = await prisma.cycle.update({
        where: { id },
        data: {
          ...(windowOpen ? { windowOpen: new Date(windowOpen) } : {}),
          ...(windowClose ? { windowClose: new Date(windowClose) } : {}),
          ...(phase ? { phase } : {}),
        },
      });
      res.json(cycle);
    } catch (err) {
      res.status(500).json({ message: "Failed to update cycle" });
    }
  },
);

export default router;
