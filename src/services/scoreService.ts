export const computeScore = ({
  uomType,
  target,
  actual,
  deadline,
  completionDate,
}: {
  uomType: string;
  target: number;
  actual: number;
  deadline?: Date | null;
  completionDate?: Date | null;
}): number => {
  switch (uomType) {
    case "MIN":
      // Higher is better (e.g. revenue) — actual / target
      return Math.min((actual / target) * 100, 100);

    case "MAX":
      // Lower is better (e.g. cost, TAT) — target / actual
      if (actual === 0) return 100;
      return Math.min((target / actual) * 100, 100);

    case "ZERO":
      // Zero = success (e.g. safety incidents)
      return actual === 0 ? 100 : 0;

    case "TIMELINE":
      // Date-based — did they finish before deadline?
      if (!deadline || !completionDate) return 0;
      return completionDate <= deadline ? 100 : 0;

    default:
      return 0;
  }
};
