import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { StatementIngestionResult } from "./contracts.js";
import { classifyStatementPath } from "./file-intake.js";

const execFileAsync = promisify(execFile);

export type PdfTextExtraction = {
  text: string;
  warnings: string[];
};

export type StatementExtractionDeps = {
  extractPdfText(path: string): Promise<PdfTextExtraction>;
  extractPdfOcrText(path: string): Promise<string>;
  extractImageText(path: string): Promise<string>;
};

async function extractPdfText(path: string): Promise<PdfTextExtraction> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfData = new Uint8Array(await readFile(path));
  const document = await getDocument({ data: pdfData }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string }>;
    const pageText = items
      .map((item) => item.str?.trim() ?? "")
      .filter((segment) => segment.length > 0)
      .join(" ");

    if (pageText.length > 0) {
      pageTexts.push(pageText);
    }
  }

  return {
    text: pageTexts.join("\n").trim(),
    warnings: pageTexts.length === 0 ? ["No embedded text found."] : [],
  };
}

async function extractImageText(path: string): Promise<string> {
  const { default: Tesseract } = await import("tesseract.js");
  const result = await Tesseract.recognize(path, "eng");
  return result.data.text.trim();
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function rasterizePdfForOcr(path: string): Promise<{ imagePath: string; cleanup(): Promise<void> }> {
  const tempDir = await mkdtemp(join(tmpdir(), "runway-statement-"));
  const cleanup = async () => {
    await rm(tempDir, { recursive: true, force: true });
  };

  if (await commandExists("pdftoppm")) {
    const outputBase = join(tempDir, "statement");
    await execFileAsync("pdftoppm", ["-png", "-singlefile", path, outputBase]);
    return {
      imagePath: `${outputBase}.png`,
      cleanup,
    };
  }

  if (await commandExists("sips")) {
    const imagePath = join(tempDir, "statement.png");
    await execFileAsync("sips", ["-s", "format", "png", path, "--out", imagePath]);
    return {
      imagePath,
      cleanup,
    };
  }

  await cleanup();
  throw new Error("No local PDF rasterizer is available for OCR fallback.");
}

async function extractPdfOcrText(path: string): Promise<string> {
  const rasterized = await rasterizePdfForOcr(path);

  try {
    return await extractImageText(rasterized.imagePath);
  } finally {
    await rasterized.cleanup();
  }
}

const defaultExtractionDeps: StatementExtractionDeps = {
  extractPdfText,
  extractPdfOcrText,
  extractImageText,
};

export async function extractStatementText(
  path: string,
  deps: StatementExtractionDeps = defaultExtractionDeps,
): Promise<StatementIngestionResult> {
  const kind = classifyStatementPath(path);

  if (kind === "image") {
    return {
      file_path: path,
      extraction_method: "ocr-image",
      raw_text: await deps.extractImageText(path),
      warnings: [],
      candidates: [],
      errors: [],
    };
  }

  const extractedPdfText = await deps.extractPdfText(path);

  if (extractedPdfText.text.trim().length > 0) {
    return {
      file_path: path,
      extraction_method: "pdf-text",
      raw_text: extractedPdfText.text,
      warnings: extractedPdfText.warnings,
      candidates: [],
      errors: [],
    };
  }

  return {
    file_path: path,
    extraction_method: "ocr-pdf",
    raw_text: await deps.extractPdfOcrText(path),
    warnings: [...extractedPdfText.warnings, "Fell back to OCR for PDF extraction."],
    candidates: [],
    errors: [],
  };
}
