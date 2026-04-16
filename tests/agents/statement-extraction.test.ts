import { describe, expect, it, vi } from "vitest";
import {
  classifyStatementPath,
  extractStatementText,
} from "../../src/runway/statement-intake/index.js";

describe("statement extraction", () => {
  it("classifies supported file extensions", () => {
    expect(classifyStatementPath("/tmp/card.pdf")).toBe("pdf");
    expect(classifyStatementPath("/tmp/card.png")).toBe("image");
    expect(classifyStatementPath("/tmp/card.JPG")).toBe("image");
  });

  it("uses embedded pdf text when available", async () => {
    const extractPdfText = vi.fn().mockResolvedValue({
      text: "Statement balance $6400",
      warnings: [],
    });
    const extractPdfOcrText = vi.fn();
    const extractImageText = vi.fn();

    const result = await extractStatementText("/tmp/card.pdf", {
      extractPdfText,
      extractPdfOcrText,
      extractImageText,
    });

    expect(result).toMatchObject({
      file_path: "/tmp/card.pdf",
      extraction_method: "pdf-text",
      raw_text: "Statement balance $6400",
      warnings: [],
      candidates: [],
      errors: [],
    });
    expect(extractPdfText).toHaveBeenCalledWith("/tmp/card.pdf");
    expect(extractPdfOcrText).not.toHaveBeenCalled();
    expect(extractImageText).not.toHaveBeenCalled();
  });

  it("falls back to pdf OCR when the text layer is empty", async () => {
    const extractPdfText = vi.fn().mockResolvedValue({
      text: "   ",
      warnings: ["No embedded text found."],
    });
    const extractPdfOcrText = vi.fn().mockResolvedValue("OCR statement text");
    const extractImageText = vi.fn();

    const result = await extractStatementText("/tmp/card.pdf", {
      extractPdfText,
      extractPdfOcrText,
      extractImageText,
    });

    expect(result).toMatchObject({
      file_path: "/tmp/card.pdf",
      extraction_method: "ocr-pdf",
      raw_text: "OCR statement text",
      candidates: [],
      errors: [],
    });
    expect(result.warnings).toContain("No embedded text found.");
    expect(result.warnings).toContain("Fell back to OCR for PDF extraction.");
    expect(extractPdfOcrText).toHaveBeenCalledWith("/tmp/card.pdf");
    expect(extractImageText).not.toHaveBeenCalled();
  });

  it("routes images directly through OCR", async () => {
    const extractPdfText = vi.fn();
    const extractPdfOcrText = vi.fn();
    const extractImageText = vi.fn().mockResolvedValue("Image OCR text");

    const result = await extractStatementText("/tmp/card.jpeg", {
      extractPdfText,
      extractPdfOcrText,
      extractImageText,
    });

    expect(result).toMatchObject({
      file_path: "/tmp/card.jpeg",
      extraction_method: "ocr-image",
      raw_text: "Image OCR text",
      warnings: [],
      candidates: [],
      errors: [],
    });
    expect(extractImageText).toHaveBeenCalledWith("/tmp/card.jpeg");
    expect(extractPdfText).not.toHaveBeenCalled();
    expect(extractPdfOcrText).not.toHaveBeenCalled();
  });

  it("rejects unsupported statement files", async () => {
    await expect(extractStatementText("/tmp/card.txt")).rejects.toThrow(
      "Unsupported statement file",
    );
  });
});
