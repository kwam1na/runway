export type StatementExtractionMethod = "pdf-text" | "ocr-pdf" | "ocr-image";

export type StatementFieldSnippet = {
  text: string;
  sourceLine?: number;
};

export type StatementAprCandidate = {
  label?: string;
  apr?: number;
  confidence: "high" | "medium" | "low";
  snippet?: StatementFieldSnippet;
};

export type StatementDebtCandidate = {
  issuer?: string;
  label?: string;
  account_tail?: string;
  statement_date?: string;
  due_date?: string;
  balance?: number;
  minimum_payment?: number;
  apr_candidates: StatementAprCandidate[];
  selected_apr?: number;
  field_sources?: Partial<
    Record<"label" | "balance" | "minimum_payment" | "selected_apr", StatementFieldSnippet>
  >;
};

export type StatementIngestionResult = {
  file_path: string;
  extraction_method?: StatementExtractionMethod;
  raw_text?: string;
  warnings: string[];
  candidates: StatementDebtCandidate[];
  errors: string[];
};
