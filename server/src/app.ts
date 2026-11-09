import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import type { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import passport from "passport";
import type { Db } from "mongodb";
import { configureOAuth } from "./oauth.js";
import { checkRequestOrigin } from "./session.js";
import { authRouter } from "./routes/auth.js";
import { oauthRouter } from "./routes/oauth.js";
import { buildsRouter } from "./routes/builds.js";
import { bugReportsRouter } from "./routes/bugReports.js";
import { milestonesRouter } from "./routes/milestones.js";
import { playtestFeedbackRouter } from "./routes/playtestFeedback.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { teamsRouter } from "./routes/teams.js";
import { usersRouter } from "./routes/users.js";

const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/dist",
);

export function createApp(db: Db): Express {
  const app = express();
  app.locals.db = db;
  app.locals.oauth = configureOAuth();

  const clientOrigin =
    app.locals.oauth.clientOrigin || process.env.CLIENT_ORIGIN?.trim();
  app.use(
    cors(clientOrigin ? { origin: clientOrigin, credentials: true } : {})
  );
  app.use(checkRequestOrigin);
  app.use(express.json());
  app.use(passport.initialize());

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/auth/oauth", oauthRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/teams", teamsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/milestones", milestonesRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/builds", buildsRouter);
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

  app.use(
    (error: unknown, req: Request, res: Response, next: NextFunction) => {
      if (res.headersSent) return next(error);
      const err = error as { code?: number; status?: number; message?: string };
      if (err?.code === 11000) {
        res.status(409).json({ error: "That record already exists" });
        return;
      }
      const status = err.status || 500;
      res.status(status).json({
        error: status === 500 ? "Internal server error" : err.message,
      });
    }
  );

  return app;
}
