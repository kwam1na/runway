export type StatementFileKind = "pdf" | "image";

const imageExtensions = new Set([".png", ".jpg", ".jpeg"]);

export function classifyStatementPath(path: string): StatementFileKind {
  const normalized = path.trim().toLowerCase();

  if (normalized.endsWith(".pdf")) {
    return "pdf";
  }

  for (const extension of imageExtensions) {
    if (normalized.endsWith(extension)) {
      return "image";
    }
  }

  throw new Error(`Unsupported statement file: ${path}`);
}
