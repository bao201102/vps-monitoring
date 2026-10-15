/** Chart time ranges shared by the metric APIs and the UI. */
export const RANGES = {
  '1h': { label: '1 hour', ms: 3_600_000, bucketMs: 60_000 },
  '6h': { label: '6 hours', ms: 6 * 3_600_000, bucketMs: 5 * 60_000 },
  '24h': { label: '24 hours', ms: 24 * 3_600_000, bucketMs: 15 * 60_000 },
  '7d': { label: '7 days', ms: 7 * 86_400_000, bucketMs: 2 * 3_600_000 },
  '30d': { label: '30 days', ms: 30 * 86_400_000, bucketMs: 6 * 3_600_000 },
  '90d': { label: '90 days', ms: 90 * 86_400_000, bucketMs: 24 * 3_600_000 },
} as const;

export type RangeKey = keyof typeof RANGES;

export function parseRange(v: string | null | undefined): RangeKey {
  return v && v in RANGES ? (v as RangeKey) : '1h';
}

/** Mongo expression flooring `$ts` to the bucket size. */
export function bucketExpr(bucketMs: number) {
  return {
    $toDate: { $subtract: [{ $toLong: '$ts' }, { $mod: [{ $toLong: '$ts' }, bucketMs] }] },
  };
}
