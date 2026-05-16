import { prisma } from "../lib/prisma";

export const validateGoals = async (
  employeeId: string,
  cycleId: string,
  excludeGoalId?: string,
) => {
  const goals = await prisma.goal.findMany({
    where: {
      employeeId,
      cycleId,
      ...(excludeGoalId ? { id: { not: excludeGoalId } } : {}),
    },
  });

  if (goals.length >= 8) {
    return {
      valid: false,
      message: "Maximum 8 goals allowed per employee per cycle",
    };
  }

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (totalWeightage > 100) {
    return {
      valid: false,
      message: `Total weightage exceeds 100%. Current total: ${totalWeightage}%`,
    };
  }

  return { valid: true, message: "OK", goals, totalWeightage };
};

export const validateSubmission = async (
  employeeId: string,
  cycleId: string,
) => {
  const goals = await prisma.goal.findMany({
    where: { employeeId, cycleId, status: "DRAFT" },
  });

  if (goals.length === 0) {
    return { valid: false, message: "No draft goals found to submit" };
  }

  if (goals.length > 8) {
    return { valid: false, message: "Maximum 8 goals allowed" };
  }

  for (const goal of goals) {
    if (goal.weightage < 10) {
      return {
        valid: false,
        message: `Goal "${goal.title}" has weightage below 10%`,
      };
    }
  }

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (totalWeightage !== 100) {
    return {
      valid: false,
      message: `Total weightage must equal 100%. Current total: ${totalWeightage}%`,
    };
  }

  return { valid: true, message: "OK", goals };
};
