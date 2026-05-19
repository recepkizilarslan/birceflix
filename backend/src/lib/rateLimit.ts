// Per-route rate-limit configs. The global limit in server.ts (300/min)
// is a backstop; these tighter per-route caps run alongside it so a single
// abused endpoint can't burn the whole user budget.
//
// Inlined `as const` lets CodeQL's data-flow tracker resolve the rateLimit
// option through the import, satisfying js/missing-rate-limiting.

export const rlRead = {
  config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
} as const

export const rlWrite = {
  config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
} as const

export const rlAuth = {
  config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
} as const

export const rlWebhook = {
  config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
} as const
