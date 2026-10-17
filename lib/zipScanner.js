import JSZip from "jszip";

const CODE_EXT = ["js", "jsx", "ts", "tsx", "mjs", "cjs", "json", "css"];
const RESOLVE_EXT = ["js", "jsx", "ts", "tsx", "mjs", "cjs", "json", "css"];
const SKIP = ["node_modules/", ".git/", "dist/", "build/", ".next/", "coverage/"];
const MAX_FILES = 500;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

function normalize(path) {
  const out = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function dirOf(path) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function findImports(code) {
  const specs = new Set();
  const patterns = [
    /import\s+(?:[\w*\s{},$]+\s+from\s+)?["']([^"']+)["']/g,
    /export\s+[\w*\s{},$]+\s+from\s+["']([^"']+)["']/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
    /import\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) specs.add(m[1]);
  }
  return [...specs];
}

function resolveSpec(fromPath, spec, allPaths) {
  if (!spec.startsWith(".")) return null; // package import, not a project file
  const base = normalize(dirOf(fromPath) + "/" + spec);
  const candidates = [base];
  for (const e of RESOLVE_EXT) candidates.push(`${base}.${e}`);
  for (const e of RESOLVE_EXT) candidates.push(`${base}/index.${e}`);
  return candidates.find((c) => allPaths.has(c)) || null;
}

async function buildProject(entries, projectName, scanScope) {
  if (entries.length === 0) {
    throw new Error("No supported code files found (js, jsx, ts, tsx, mjs, cjs, json, css).");
  }

  const first = entries[0].path.split("/")[0];
  const sharedRoot = entries.every((entry) => entry.path.startsWith(first + "/"));
  if (sharedRoot) {
    entries.forEach((entry) => {
      entry.path = entry.path.slice(first.length + 1);
    });
  }

  const limited = entries.slice(0, MAX_FILES);
  const allPaths = new Set(limited.map((entry) => entry.path));
  const files = limited.map((entry) => ({
    id: entry.path,
    name: entry.path,
    path: entry.path,
    type: entry.ext
  }));
  const dependencies = [];

  for (const entry of limited) {
    if (entry.ext === "json" || entry.ext === "css") continue;
    if (entry.file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`${entry.path} is larger than 2 MB; remove it or upload a smaller project.`);
    }
    const code = await entry.readText();
    for (const spec of findImports(code)) {
      const to = resolveSpec(entry.path, spec, allPaths);
      if (to && to !== entry.path) dependencies.push({ from: entry.path, to });
    }
  }

  return {
    project: projectName,
    mode: "real-scan",
    scanScope,
    files,
    dependencies,
    skippedFiles: entries.length - limited.length
  };
}

export async function scanZip(file) {
  const zip = await JSZip.loadAsync(file);
  const entries = [];
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    if (SKIP.some((segment) => path.includes(segment))) return;
    const ext = path.split(".").pop().toLowerCase();
    if (!CODE_EXT.includes(ext)) return;
    entries.push({
      path,
      ext,
      file: { size: entry._data.uncompressedSize },
      readText: () => entry.async("string")
    });
  });

  return buildProject(entries, file.name.replace(/\.zip$/i, ""), "project-zip");
}

export async function scanProjectFiles(fileList) {
  const selectedFiles = Array.from(fileList);
  const entries = selectedFiles.flatMap((file) => {
    const path = file.webkitRelativePath || file.name;
    if (SKIP.some((segment) => path.includes(segment))) return [];
    const ext = path.split(".").pop().toLowerCase();
    if (!CODE_EXT.includes(ext)) return [];
    return [{ path, ext, file, readText: () => file.text() }];
  });
  const projectName = selectedFiles[0]?.webkitRelativePath?.split("/")[0] || "Uploaded project";
  return buildProject(entries, projectName, "project-folder");
}

export function scanSingleFile(file) {
  const name = file.name || "Untitled file";
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "file";

  return {
    project: name,
    mode: "real-scan",
    scanScope: "single-file",
    files: [{ id: name, name, path: name, type: ext, size: file.size }],
    dependencies: [],
    skippedFiles: 0
  };
}