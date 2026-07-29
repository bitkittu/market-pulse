export * from "./generated/api";
export * from "./generated/types";

// `generated/api` exports these names as zod schemas while `generated/types`
// exports same-named TypeScript types, so the two `export *` above are
// ambiguous (TS2308). This package exists to hand out runtime schemas, so the
// explicit re-export resolves the tie in favour of the zod object. The
// parameter types stay reachable from `@workspace/api-client-react`.
export {
  GetNseHistoryParams,
  GetStockHistoryParams,
  GetHoldingAnalysisParams,
} from "./generated/api";
