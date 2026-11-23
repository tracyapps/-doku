import express from "express";
import { playtestingRouter } from "./playtesting.js";

// The shareable research deployment exposes no account, challenge or player API.
export const playtestApp = express();
playtestApp.disable("x-powered-by");
playtestApp.use("/api/playtesting", playtestingRouter());
playtestApp.use((_req, res) =>
  res.status(404).json({ error: "Testing endpoint not found" }),
);
playtestApp.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = Number(error.status) || 500;
    if(status>=500)console.error('Playtest storage failure',{
      code:error.code||error.name,
      message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database connection]'),
    });
    res
      .status(status)
      .json({
        error:
          status < 500
            ? error.message
            : "The testing service is unavailable. Your draft is still on this device.",
      });
  },
);
