import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { ZodError } from "zod";
import { publicRouter } from "./routes/public.js";
import { HttpError } from "./lib/booking.js";
import { manageRouter } from "./routes/manage.js";
import { startReminders } from "./lib/reminders.js";
import { adminRouter } from "./routes/admin.js";
import { db } from "./lib/db.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.APP_URL, credentials: true }));
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());
app.use("/api/lookup", rateLimit({ windowMs: 15 * 60_000, limit: 10, message: { error: "Previše pokušaja, pokušajte kasnije." } }));
app.use(
  "/api/appointments",
  rateLimit({
    windowMs: 10 * 60_000,
    limit: 20,
    message: { error: "Previše pokušaja, pokušajte kasnije." },
    skip: (r) => r.method !== "POST",
  })
);
app.use("/api/admin/login", rateLimit({ windowMs: 15 * 60_000, limit: 10, skip: (r) => r.method !== "POST", message: { error: "Previše pokušaja, pokušajte kasnije." } }));
app.use("/api/admin", adminRouter);
app.use("/api", publicRouter);
app.use("/api", manageRouter);

app.get("/img/:id", async (q, r) => {
  const i = await db.image.findUnique({ where: { id: q.params.id } });
  if (!i) return r.sendStatus(404);
  r.set({
    "Content-Type": i.mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  }).send(Buffer.from(i.data));
});

// produkcija: servira build klijenta
app.use(express.static(path.resolve("../client/dist")));
app.get(/.*/, (_q, r) => r.sendFile(path.resolve("../client/dist/index.html")));

app.use((e: any, _q: express.Request, r: express.Response, _n: express.NextFunction) => {
  if (e instanceof ZodError) return r.status(400).json({ error: "Neispravni podaci" });
  if (e instanceof HttpError) return r.status(e.status).json({ error: e.message });
  console.error(e);
  r.status(500).json({ error: "Greška na serveru" });
});

app.listen(process.env.PORT ?? 3000, () => {
  console.log("Server radi");
  startReminders();
});