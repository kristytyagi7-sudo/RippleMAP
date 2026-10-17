import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeAction } from "./lib/analyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const dataPath = path.join(__dirname, "data", "project.json");
const projectData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "RIPPLEMAP demo API",
    mode: "sample-data",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/project", (_req, res) => {
  res.json({
    project: projectData.project,
    files: projectData.files,
    dependencies: projectData.dependencies,
    actions: projectData.actions
  });
});

app.post("/api/analyze", (req, res) => {
  const { action, targetFile } = req.body ?? {};
  const result = analyzeAction({
    action,
    targetFile,
    projectData
  });

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  return res.json(result);
});

// Serve the built frontend when `npm run build` has been run.
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(PORT, () => {
  console.log(`RIPPLEMAP API listening at http://127.0.0.1:${PORT}`);
});
