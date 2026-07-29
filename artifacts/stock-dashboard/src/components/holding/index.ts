/**
 * Holding Stocks UI components.
 *
 * The analysis panel is composed from the shared ai-analysis primitives rather
 * than a parallel design system, so Holding, Options and Intraday read as one
 * product (§12).
 */
export { HoldingAnalysisPanel, type HoldingAnalysisPanelProps } from "./HoldingAnalysisPanel";
export { PickRow, PickCard } from "./PickRow";
export { PreviousPicks } from "./PreviousPicks";
export { SummaryCards } from "./SummaryCards";
export {
  CLASSIFICATION_STYLE,
  IMPACT_STYLE,
  RISK_STYLE,
  fmtInr,
  fmtPct,
  scoreColor,
  toneClass,
} from "./shared";
