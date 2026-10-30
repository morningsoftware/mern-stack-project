import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { bugReportsRouter } from "./routes/bugReports.js";
import { milestonesRouter } from "./routes/milestones.js";
import { playtestFeedbackRouter } from "./routes/playtestFeedback.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { teamsRouter } from "./routes/teams.js";
import { usersRouter } from "./routes/users.js";

const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/dist"
);

export function createApp(db) {
  const app = express();
  app.locals.db = db;
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/teams", teamsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/milestones", milestonesRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/bug-reports", bugReportsRouter);
  app.use("/api/playtest-feedback", playtestFeedbackRouter);

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    res.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) next();
    });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error?.code === 11000) {
      res.status(409).json({ error: "That record already exists" });
      return;
    }
    const status = error.status || 500;
    res.status(status).json({
      error: status === 500 ? "Internal server error" : error.message,
    });
  });

  return app;
}
