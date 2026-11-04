export type WorkType = { id: string; title: string; unit: string; pricePerUnit: number }

export function calculateEstimate(pricePerUnit: number, quantity: number, complexity: number) {
  if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0 || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(complexity) || complexity <= 0) return 0
  return Math.round(quantity * pricePerUnit * complexity)
}