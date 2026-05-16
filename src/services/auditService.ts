import { prisma } from "../lib/prisma";

export const logAudit = async ({
  entityType,
  entityId,
  goalId,
  changedBy,
  before,
  after,
}: {
  entityType: string;
  entityId: string;
  goalId?: string;
  changedBy: string;
  before?: object;
  after?: object;
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        goalId,
        changedBy,
        before: before ?? {},
        after: after ?? {},
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
};
