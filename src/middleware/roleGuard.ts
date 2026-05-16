import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";

export const roleGuard = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Access denied" });
      return;
    }
    next();
  };
};
