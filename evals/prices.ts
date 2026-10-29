// What a run cost (S11): USD per million tokens by model, for the report's cost column. The table lives with the model
// list since S12 (src/agent/models.ts: KNOWN_MODELS' prices plus the stubs, which cost nothing); unknown models cost 0
// and the report says so.
export { PRICES, priced, costOf, type Price } from '../src/agent/models'
