import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import routes from "./routes";

const PORT = Number(process.env.PORT ?? 4001);
const WEB_DIST = path.resolve(__dirname, "../../../web/dist");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", routes);

// Serve the built frontend if it exists (production-style local run); in dev,
// the Vite dev server handles the frontend separately and proxies /api here.
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(WEB_DIST, "index.html")));
}

app.listen(PORT, () => {
  console.log(`BrandOS API listening on http://localhost:${PORT}`);
});
