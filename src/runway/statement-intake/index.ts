export { normalizeStatementText } from "./normalize.js";
export { ingestStatementsIntoProfile, mergeConfirmedStatementCandidate } from "./review.js";
export { extractStatementText, type PdfTextExtraction, type StatementExtractionDeps } from "./extract.js";
export { classifyStatementPath, type StatementFileKind } from "./file-intake.js";
export type {
  StatementAprCandidate,
  StatementDebtCandidate,
  StatementExtractionMethod,
  StatementFieldSnippet,
  StatementIngestionResult,
} from "./contracts.js";
