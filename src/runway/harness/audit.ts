import { readdir } from "node:fs/promises";
import { relative } from "node:path";
import { harnessTargets } from "./app-registry.js";
import { getGeneratedArtifacts } from "./generate.js";

export type HarnessAuditResult = {
  ok: boolean;
  errors: string[];
  auditedRoots: string[];
  candidateFiles: string[];
};

type AuditOptions = {
  candidateFiles?: string[];
};

function toRepoPath(path: string): string {
  return path.split("\\").join("/");
}

function matchesPrefix(file: string, prefix: string): boolean {
  return file === prefix || file.startsWith(`${prefix}/`);
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = `${root}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(nextPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(toRepoPath(nextPath));
    }
  }

  return files;
}

export async function runHarnessAudit(options: AuditOptions = {}): Promise<HarnessAuditResult> {
  const auditedRoots = [...new Set(harnessTargets.flatMap((target) => target.auditedRoots))].sort();
  const coveredPrefixes = new Set<string>(
    harnessTargets.flatMap((target) =>
      target.validationSurfaces.flatMap((surface) => surface.pathPrefixes),
    ),
  );

  for (const target of harnessTargets) {
    for (const path of target.requiredDocs) {
      coveredPrefixes.add(path);
    }
  }

  for (const artifact of getGeneratedArtifacts()) {
    coveredPrefixes.add(artifact.path);
  }

  const candidateFiles =
    options.candidateFiles?.length
      ? [...options.candidateFiles].sort()
      : (
          await Promise.all(
            auditedRoots.map(async (root) => {
              try {
                const files = await collectFiles(root);
                return files.map((file) => toRepoPath(relative(process.cwd(), file)));
              } catch {
                return [];
              }
            }),
          )
        )
          .flat()
          .sort();

  const errors = candidateFiles
    .filter((file) => ![...coveredPrefixes].some((prefix) => matchesPrefix(file, prefix)))
    .map((file) => `Uncovered files: ${file}`);

  return {
    ok: errors.length === 0,
    errors,
    auditedRoots,
    candidateFiles,
  };
}
