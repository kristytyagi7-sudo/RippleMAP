import { useMemo, useState } from "react";
import {
  Activity, ArrowRight, Check, ChevronDown, CircleHelp,
  FileCode2, FileCog, FileJson, FileText, GitBranch, LockKeyhole,
  Network, RefreshCw, ScanSearch, ShieldAlert, Sparkles, Terminal,
  TriangleAlert, Upload, Workflow
} from "lucide-react";
import sampleProject from "../data/project.json";
import { analyzeAction } from "./analyzer.js";
import { scanProjectFiles, scanSingleFile, scanZip } from "./zipScanner.js";

const sampleProjectData = {
  ...sampleProject,
  project: sampleProject.project.name
};

const icons = {
  config: FileJson,
  source: FileCode2,
  build: FileCog,
  test: Check,
  docs: FileText,
  pipeline: Workflow
};

function iconFor(type) {
  if (icons[type]) return icons[type];
  if (type === "json") return FileJson;
  if (type === "css") return FileText;
  return FileCode2;
}

function baseName(path) {
  return String(path).split("/").pop();
}

function pickDefaultTarget(project) {
  const count = {};
  for (const e of project.dependencies) count[e.to] = (count[e.to] || 0) + 1;
  let best = project.files[0]?.id;
  let max = -1;
  for (const f of project.files) {
    if ((count[f.id] || 0) > max) { max = count[f.id] || 0; best = f.id; }
  }
  return best;
}

export default function App() {
  const [project, setProject] = useState(sampleProjectData);
  const [action, setAction] = useState("rename");
  const [targetFile, setTargetFile] = useState(pickDefaultTarget(sampleProjectData));
  const [filter, setFilter] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isReal = project.mode === "real-scan";

  function loadProject(p) {
    setProject(p);
    setTargetFile(pickDefaultTarget(p));
    setFilter("");
    setResult(null);
    setError("");
  }

  async function onZipChosen(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (!/\.zip$/i.test(file.name)) throw new Error("Please choose a .zip file.");
      const scanned = await scanZip(file);
      loadProject(scanned);
    } catch (err) {
      setError(err.message || "Could not read this ZIP file.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onFileChosen(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      loadProject(scanSingleFile(file));
    } catch (err) {
      setError(err.message || "Could not read this file.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onFolderChosen(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      loadProject(await scanProjectFiles(files));
    } catch (err) {
      setError(err.message || "Could not scan this project folder.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function analyze() {
    setError("");
    const out = analyzeAction({ action, targetFile, projectData: project });
    if (out.error) {
      setError(out.error);
      return;
    }
    setResult(out);
  }

  const visibleFiles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = project.files.filter((f) => !q || f.name.toLowerCase().includes(q));
    const selected = project.files.find((f) => f.id === targetFile);
    if (selected && !list.some((f) => f.id === selected.id)) list.unshift(selected);
    return list.slice(0, 300);
  }, [project, filter, targetFile]);

  const layout = useMemo(() => {
    if (!result) return null;
    const targetId = result.target.id;
    const depth = { [targetId]: 0 };
    const queue = [targetId];
    while (queue.length) {
      const cur = queue.shift();
      for (const edge of result.dependencyEdges) {
        if (edge.to === cur && depth[edge.from] === undefined) {
          depth[edge.from] = depth[cur] + 1;
          queue.push(edge.from);
        }
      }
    }
    const sorted = [...result.affectedFiles].sort(
      (a, b) => (depth[a.id] ?? 99) - (depth[b.id] ?? 99)
    );
    const MAX_NODES = 20;
    const shown = sorted.slice(0, MAX_NODES);
    const hidden = sorted.length - shown.length;
    const maxDepth = Math.max(...shown.map((f) => depth[f.id] ?? 0), 0);
    const rings = {};
    shown.forEach((f) => {
      const d = depth[f.id] ?? 0;
      (rings[d] = rings[d] || []).push(f);
    });
    const nodes = [];
    Object.entries(rings).forEach(([d, list]) => {
      const dNum = Number(d);
      list.forEach((f, i) => {
        if (dNum === 0) {
          nodes.push({ ...f, pos: [50, 50] });
          return;
        }
        const radius = (dNum / Math.max(1, maxDepth)) * 38;
        const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2 + dNum * 0.6;
        const x = Math.min(90, Math.max(10, 50 + radius * Math.cos(angle) * 1.3));
        const y = Math.min(88, Math.max(12, 50 + radius * Math.sin(angle)));
        nodes.push({ ...f, pos: [x, y] });
      });
    });
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const edges = result.dependencyEdges.filter((e) => byId[e.from] && byId[e.to]);
    return { nodes, byId, edges, hidden };
  }, [result]);

  const riskClass = result?.risk?.level?.toLowerCase() || "medium";

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="RIPPLEMAP home">
          <span className="brand-mark"><Activity size={20} /></span>
          <span>RIPPLE<span className="brand-accent">MAP</span></span>
        </a>
        <nav>
          <a href="#lab">Action Lab</a>
          <a href="#graph">Dependency Map</a>
          <a href="#report">Impact Report</a>
        </nav>
        <div className="demo-pill"><span className="status-dot" /> {project.scanScope === "single-file" ? "SINGLE FILE" : isReal ? "REAL SCAN" : "SAMPLE"}</div>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> CODE CHANGE INTELLIGENCE</div>
            <h1>One change.<br /><span>Many ripples.</span></h1>
            <p className="hero-lede">Upload your project, pick a file, and see what a rename, modify or delete could break before it becomes a problem.</p>
            <div className="hero-actions">
              <a className="primary-btn" href="#lab">Open Action Lab <ArrowRight size={17} /></a>
              <span className="quiet-note"><LockKeyhole size={14} /> Analyzed in your browser · Nothing is uploaded</span>
            </div>
            <div className="hero-stats">
              <div><strong>01</strong><span>Change preview</span></div>
              <div><strong>02</strong><span>Impact paths</span></div>
              <div><strong>03</strong><span>Safer actions</span></div>
            </div>
          </div>
          <div className="hero-visual" aria-label="Decorative ripple network">
            <div className="orbital orbital-a" /><div className="orbital orbital-b" /><div className="orbital orbital-c" />
            <div className="hero-core"><Network size={38} /><span>CHANGE<br />SIGNAL</span></div>
            <span className="orbit-node node-a"><FileJson size={17} /></span>
            <span className="orbit-node node-b"><FileCode2 size={17} /></span>
            <span className="orbit-node node-c"><GitBranch size={17} /></span>
            <span className="orbit-node node-d"><FileText size={17} /></span>
            <div className="visual-caption"><span className="pulse-dot" /> DEPENDENCY FIELD <span>•</span> LIVE VISUAL</div>
          </div>
        </section>

        <section className="section-wrap section-block" id="lab">
          <div className="section-heading">
            <div><div className="eyebrow">01 / SIMULATE</div><h2>Action <span>Lab</span></h2></div>
            <p>Upload a project ZIP to map JavaScript / TypeScript imports, or choose one file from your computer for a standalone preview. A single file cannot show its project dependencies.</p>
          </div>
          <div className="lab-grid">
            <div className="panel action-panel">
              <div className="panel-top"><span className="panel-icon"><Terminal size={17} /></span><span>CHANGE SCENARIO</span><span className="panel-tag">INPUT</span></div>

              <label>Project</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <label className="primary-btn" style={{ cursor: "pointer", margin: 0 }}>
                  <Upload size={16} /> {busy ? "Scanning project..." : "Upload project ZIP"}
                  <input type="file" accept=".zip,application/zip" onChange={onZipChosen} style={{ display: "none" }} disabled={busy} />
                </label>
                <label className="action-option" style={{ width: "auto", padding: "10px 14px", margin: 0, cursor: busy ? "wait" : "pointer" }}>
                  <Upload size={16} /> Upload project folder
                  <input type="file" webkitdirectory="" directory="" multiple onChange={onFolderChosen} style={{ display: "none" }} disabled={busy} />
                </label>
                <label className="action-option" style={{ width: "auto", padding: "10px 14px", margin: 0, cursor: busy ? "wait" : "pointer" }}>
                  <Upload size={16} /> Upload one file
                  <input type="file" onChange={onFileChosen} style={{ display: "none" }} disabled={busy} />
                </label>
                {isReal && (
                  <button type="button" className="action-option" style={{ width: "auto", padding: "10px 14px" }} onClick={() => loadProject(sampleProjectData)}>
                    Use sample instead
                  </button>
                )}
              </div>
              <p className="fine-print" style={{ marginBottom: 14 }}>
                <CircleHelp size={13} /> {project.project} · {project.files.length} supported files · {project.dependencies.length} links found
              </p>
              <p className="fine-print" style={{ marginBottom: 14 }}>
                <LockKeyhole size={13} /> Files stay in this browser. Folder/ZIP scans check relative JavaScript/TypeScript imports; one file is a standalone preview.
              </p>

              <label htmlFor="target">Target file</label>
              <input
                type="text"
                placeholder="Search file name..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ width: "100%", marginBottom: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit" }}
              />
              <div className="select-wrap">
                <select id="target" value={targetFile} onChange={(e) => setTargetFile(e.target.value)}>
                  {visibleFiles.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select><ChevronDown size={16} />
              </div>

              <label>Proposed action</label>
              <div className="action-options">
                {[
                  ["rename", "Rename", "Update a file path"],
                  ["modify", "Modify", "Change file behaviour"],
                  ["delete", "Delete", "Remove a file"]
                ].map(([id, title, sub]) => (
                  <button key={id} className={`action-option ${action === id ? "selected" : ""}`} onClick={() => setAction(id)} type="button">
                    <span className={`action-symbol ${id}`}>{id === "rename" ? <RefreshCw size={17} /> : id === "modify" ? <FileCog size={17} /> : <TriangleAlert size={17} />}</span>
                    <span className="option-copy"><strong>{title}</strong><small>{sub}</small></span>
                    <span className="radio-dot">{action === id && <span />}</span>
                  </button>
                ))}
              </div>
              <button className="primary-btn analyze-btn" onClick={analyze} disabled={busy || !project.files.length}>
                <ScanSearch size={17} /> Analyze Impact <ArrowRight size={16} />
              </button>
              <p className="fine-print"><CircleHelp size={13} /> {project.scanScope === "single-file" ? "Standalone preview only; upload a ZIP to discover project references." : isReal ? "Estimated from import/require statements in your ZIP." : "Showing the built-in sample project."}</p>
              {error && <div className="error-note">{error}</div>}
            </div>

            <div className="panel preview-panel">
              <div className="panel-top"><span className="panel-icon"><Sparkles size={17} /></span><span>ANALYSIS PREVIEW</span><span className="panel-tag">OUTPUT</span></div>
              {result ? (
                <>
                  <div className="result-banner">
                    <div><span className="mini-label">RISK INDICATOR</span><h3>{result.risk.label}</h3><p>{result.summary}</p></div>
                    <div className={`risk-score ${riskClass}`}><strong>{result.risk.score}</strong><small>/100</small></div>
                  </div>
                  <div className="affected-list">
                    {result.affectedFiles.slice(0, 8).map((file) => {
                      const Icon = iconFor(file.type);
                      return <div className="affected-row" key={file.id}><span className="file-icon"><Icon size={16} /></span><span><strong>{file.name}</strong><small>{file.isTarget ? "Selected target" : file.evidence}</small></span><span className={`file-state ${file.isTarget ? "target" : ""}`}>{file.isTarget ? "TARGET" : "AFFECTED"}</span></div>;
                    })}
                    {result.affectedFiles.length > 8 && (
                      <p className="fine-print">+ {result.affectedFiles.length - 8} more affected file(s)</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-preview">
                  <div className="empty-icon"><ScanSearch size={27} /></div>
                  <h3>Impact report awaits</h3>
                  <p>Pick a target file and action, then analyze to reveal potential downstream effects.</p>
                  <div className="empty-lines"><i /><i /><i /></div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="section-wrap section-block" id="graph">
          <div className="section-heading">
            <div><div className="eyebrow">02 / TRACE</div><h2>Dependency <span>Map</span></h2></div>
            <p>The target sits in the centre. Files that depend on it spread outward, closest dependents first.</p>
          </div>
          <div className="panel graph-panel">
            <div className="graph-toolbar"><div><span className="graph-dot" /> {String(project.project).toUpperCase()} / DEPENDENCY GRAPH</div><div className="legend"><span><i className="legend-target" /> Target</span><span><i className="legend-affected" /> Affected</span></div></div>
            <div className="graph-canvas">
              {!layout && (
                <p className="fine-print" style={{ position: "absolute", top: "45%", width: "100%", textAlign: "center" }}>Run an analysis to see the map.</p>
              )}
              {layout && (
                <svg className="graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {layout.edges.map((edge) => {
                    const a = layout.byId[edge.from].pos, b = layout.byId[edge.to].pos;
                    return <g key={`${edge.from}-${edge.to}`}><line x1={`${a[0]}%`} y1={`${a[1]}%`} x2={`${b[0]}%`} y2={`${b[1]}%`} className="edge hot-edge" /><circle cx={`${(a[0]+b[0])/2}%`} cy={`${(a[1]+b[1])/2}%`} r=".6" className="edge-particle" /></g>;
                  })}
                </svg>
              )}
              {layout && layout.nodes.map((file) => {
                const Icon = iconFor(file.type);
                const isTarget = file.isTarget;
                return <div key={file.id} title={file.name} className={`graph-node affected-node ${isTarget ? "target-node" : ""}`} style={{ left: `${file.pos[0]}%`, top: `${file.pos[1]}%` }}>
                  <span className="graph-node-icon"><Icon size={17} /></span><strong>{baseName(file.name)}</strong><small>{isTarget ? "TARGET" : "IN IMPACT PATH"}</small>
                </div>;
              })}
              <div className="graph-watermark">RIPPLEMAP / {project.scanScope === "single-file" ? "SINGLE FILE" : isReal ? "REAL SCAN" : "SAMPLE DATA"}</div>
            </div>
            <div className="graph-footer"><span><Activity size={14} /> {result ? `${result.affectedFiles.length} files in impact path${layout && layout.hidden > 0 ? ` (showing ${layout.nodes.length})` : ""}` : `${project.files.length} files mapped`}</span><span>Arrows follow import / require links</span></div>
          </div>
        </section>

        <section className="section-wrap section-block" id="report">
          <div className="section-heading">
            <div><div className="eyebrow">03 / RESPOND</div><h2>Safer next <span>steps</span></h2></div>
            <p>Impact analysis is most useful when it suggests what to verify before a change.</p>
          </div>
          <div className="recommend-grid">
            <div className="panel recommendation-panel">
              <div className="recommend-icon cyan"><ShieldAlert size={19} /></div><h3>{result ? "Scenario-specific alternatives" : "Safer alternatives"}</h3>
              <p>{result ? "Based on the selected action and your dependency map." : "Run an analysis to receive action-specific guidance."}</p>
              <ul>{(result?.alternatives || ["Search for references before changing a shared file.", "Review dependent tests and build scripts.", "Use a branch so the change can be reverted."]).map((x) => <li key={x}><Check size={15} />{x}</li>)}</ul>
            </div>
            <div className="panel recommendation-panel">
              <div className="recommend-icon violet"><GitBranch size={19} /></div><h3>Recovery checklist</h3>
              <p>A simple rollback-first workflow.</p>
              <ul>{(result?.recoveryChecklist || ["Create a backup or version-control checkpoint.", "Review affected files before applying a change.", "Run focused tests and inspect failures.", "Revert if verification fails."]).map((x) => <li key={x}><Check size={15} />{x}</li>)}</ul>
            </div>
          </div>
          <div className="disclaimer"><LockKeyhole size={15} /><span><strong>How it works:</strong> {result ? result.disclaimer : "Your ZIP is read inside your browser. RIPPLEMAP finds import/require links between files and estimates impact. No files are changed, renamed or deleted."}</span></div>
        </section>
      </main>
      <footer className="footer"><a className="brand" href="#top"><span className="brand-mark"><Activity size={17} /></span><span>RIPPLE<span className="brand-accent">MAP</span></span></a><span>Understand the ripple before the change.</span><span>Prototype · Estimated impact</span></footer>
    </div>
  );
}