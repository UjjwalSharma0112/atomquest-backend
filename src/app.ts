import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth";
import cycleRoutes from "./routes/cycles";
import goalRoutes from "./routes/goals";
import adminRoutes from "./routes/admin";
import approvalRoutes from "./routes/approval";
import checkinRoutes from "./routes/checkins";
import reportRoutes from "./routes/reports";

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
];

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRoutes);
app.use("/api/cycles", cycleRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/reports", reportRoutes);

export default app;
