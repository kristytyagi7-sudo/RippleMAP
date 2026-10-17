const actionLabels = {
  rename: "Rename",
  modify: "Modify",
  extension: "Change extension",
  delete: "Delete"
};

export function analyzeAction({ action, targetFile, projectData }) {
  const supportedActions = Object.keys(actionLabels);
  const files = projectData.files;
  const target = files.find((file) => file.id === targetFile);
  const isSingleFile = projectData.scanScope === "single-file";
  const isSample = projectData.mode !== "real-scan";

  if (!supportedActions.includes(action)) {
    return { error: "Unsupported action. Choose rename, modify, or delete." };
  }
  if (!target) {
    return { error: "Target file was not found in the selected project." };
  }

  // Sample dependency edges are directional: source depends on target.
  // Walk backwards from the target to find files that may depend on it.
  const affectedIds = new Set([target.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of projectData.dependencies) {
      if (affectedIds.has(edge.to) && !affectedIds.has(edge.from)) {
        affectedIds.add(edge.from);
        changed = true;
      }
    }
  }

  const affectedFiles = files
    .filter((file) => affectedIds.has(file.id))
    .map((file) => ({
      ...file,
      isTarget: file.id === target.id,
      relation: file.id === target.id ? "target" : "downstream dependency",
      evidence: file.id === target.id
        ? "Selected target file"
        : `Found in ${isSample ? "sample" : "uploaded project"} dependency map`
    }));

  const directDependents = new Set(
    projectData.dependencies
      .filter((edge) => edge.to === target.id)
      .map((edge) => edge.from)
  );
  directDependents.delete(target.id);
  const indirectDependents = Math.max(0, affectedIds.size - directDependents.size - 1);
  const baseRisk = {
    rename: 15,
    modify: 22,
    extension: 20,
    delete: 32
  };
  const score = Math.min(
    98,
    baseRisk[action] + directDependents.size * 12 + indirectDependents * 6
  );
  const level = score >= 65 ? "HIGH" : score >= 36 ? "MEDIUM" : "LOW";
  const labelByAction = {
    rename: "References may need path updates",
    modify: "Dependent behaviour may change",
    extension: "Imports may not resolve after extension change",
    delete: "Dependent files may fail"
  };
  const risk = {
    level,
    score,
    label: labelByAction[action],
    directDependents: directDependents.size,
    indirectDependents,
    affectedCount: Math.max(0, affectedIds.size - 1),
    safeCount: Math.max(0, files.length - affectedIds.size)
  };

  const alternatives = {
    rename: [
      "Search the repository for references before renaming.",
      "Update import paths, build scripts, and tests together.",
      "Run the test suite after the rename."
    ],
    modify: [
      "Review callers and expected input/output contracts.",
      "Add or update a focused regression test.",
      "Make the change in a branch so it can be reverted."
    ],
    extension: [
      "Check every listed import to confirm its path and extension still resolve.",
      "Update bundler, compiler, and runtime extension rules if needed.",
      "Run the project build and relevant tests after the change."
    ],
    delete: [
      "Check whether any listed files still import or read this file.",
      "Remove or replace dependent references before deletion.",
      "Create a backup or use version control before proceeding."
    ]
  };

  const scopedAlternatives = isSingleFile
    ? [
      "Upload the complete project folder or ZIP to map files that depend on this target.",
        "Search the project locally for references before applying the change.",
        "Run the project's relevant tests and build after the change."
      ]
    : alternatives[action];

  const recovery = isSingleFile
    ? [
        "No files are changed by this preview.",
        "Review the target file and locate its project references before changing it.",
        "Run relevant tests and revert the change if verification fails."
      ]
    : [
        "Record the current version in version control or make a backup.",
        `Review the ${affectedFiles.length} file(s) shown in this impact report.`,
        "Apply the change on a branch and run relevant tests.",
        "If checks fail, revert the change and inspect the failing references."
      ];

  const verbByAction = {
    rename: "Renaming",
    modify: "Modifying",
    extension: "Changing the extension of",
    delete: "Deleting"
  };
  const summary = isSingleFile
    ? `${verbByAction[action]} ${target.name}; project dependencies could not be checked from a single-file upload.`
    : `${verbByAction[action]} ${target.name}: ${risk.affectedCount} dependent file(s) detected and ${risk.safeCount} file(s) outside the detected impact path.`;

  return {
    project: projectData.project,
    mode: isSample ? "sample-data" : "real-scan",
    disclaimer: isSample
      ? "This is a rule-based demonstration using bundled sample data. It does not scan your computer or modify files."
      : isSingleFile
        ? "Only the selected file is available. This preview cannot determine project dependencies or verify code behaviour; no file is changed."
        : "This is local static analysis of supported relative imports in the selected files. It does not use AI, run code or tests, or change files. Unresolved imports and unsupported languages may be missed.",
    action: { id: action, label: actionLabels[action] },
    target: { ...target },
    risk,
    summary,
    affectedFiles,
    dependencyEdges: projectData.dependencies,
    impactedFileIds: [...affectedIds],
    alternatives: scopedAlternatives,
    recoveryChecklist: recovery,
    generatedAt: new Date().toISOString()
  };
}
