import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { roleGuard } from "../middleware/roleGuard";
import { computeScore } from "../services/scoreService";
import ExcelJS from "exceljs";

const router = Router();

// GET /api/reports/achievement — planned vs actual for all employees
router.get(
  "/achievement",
  authMiddleware,
  roleGuard("ADMIN", "MANAGER"),
  async (req: AuthRequest, res: Response) => {
    const { cycleId, format } = req.query;

    try {
      const checkIns = await prisma.checkIn.findMany({
        where: {
          ...(cycleId ? { goal: { cycleId: String(cycleId) } } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          goal: {
            select: {
              id: true,
              title: true,
              uomType: true,
              target: true,
              weightage: true,
              thrustArea: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const report = checkIns.map((c) => ({
        employee: c.employee.name,
        email: c.employee.email,
        goalTitle: c.goal.title,
        thrustArea: c.goal.thrustArea,
        uomType: c.goal.uomType,
        weightage: c.goal.weightage,
        quarter: c.quarter,
        planned: c.planned,
        actual: c.actual,
        status: c.status,
        score:
          c.actual !== null
            ? `${computeScore({
                uomType: c.goal.uomType,
                target: c.goal.target,
                actual: c.actual,
                completionDate: c.completionDate,
              }).toFixed(1)}%`
            : "N/A",
        managerComment: c.managerComment || "",
      }));

      // CSV/Excel export
      if (format === "csv" || format === "excel") {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Achievement Report");

        sheet.columns = [
          { header: "Employee", key: "employee", width: 20 },
          { header: "Email", key: "email", width: 25 },
          { header: "Goal Title", key: "goalTitle", width: 30 },
          { header: "Thrust Area", key: "thrustArea", width: 20 },
          { header: "UoM Type", key: "uomType", width: 12 },
          { header: "Weightage %", key: "weightage", width: 12 },
          { header: "Quarter", key: "quarter", width: 12 },
          { header: "Planned", key: "planned", width: 12 },
          { header: "Actual", key: "actual", width: 12 },
          { header: "Status", key: "status", width: 15 },
          { header: "Score", key: "score", width: 10 },
          { header: "Manager Comment", key: "managerComment", width: 30 },
        ];

        // Style header row
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F4E79" },
        };
        sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

        sheet.addRows(report);

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=achievement-report.xlsx",
        );

        await workbook.xlsx.write(res);
        return;
      }

      res.json(report);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to generate report", error: String(err) });
    }
  },
);

// GET /api/reports/completion — who has/hasn't completed check-ins
router.get(
  "/completion",
  authMiddleware,
  roleGuard("ADMIN", "MANAGER"),
  async (req: AuthRequest, res: Response) => {
    const { cycleId, quarter } = req.query;

    try {
      const employees = await prisma.user.findMany({
        where: { role: "EMPLOYEE" },
        select: {
          id: true,
          name: true,
          email: true,
          manager: { select: { id: true, name: true } },
          checkIns: {
            where: {
              ...(quarter ? { quarter: String(quarter) as any } : {}),
              ...(cycleId ? { goal: { cycleId: String(cycleId) } } : {}),
            },
            select: { id: true, status: true, quarter: true },
          },
          goals: {
            where: {
              ...(cycleId ? { cycleId: String(cycleId) } : {}),
              isLocked: true,
            },
            select: { id: true },
          },
        },
      });

      const completion = employees.map((e) => ({
        employee: e.name,
        email: e.email,
        manager: e.manager?.name || "No manager",
        totalApprovedGoals: e.goals.length,
        checkInsCompleted: e.checkIns.length,
        completionRate:
          e.goals.length > 0
            ? `${((e.checkIns.length / e.goals.length) * 100).toFixed(1)}%`
            : "N/A",
        status:
          e.checkIns.length >= e.goals.length && e.goals.length > 0
            ? "COMPLETED"
            : "PENDING",
      }));

      res.json(completion);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch completion data" });
    }
  },
);

export default router;
