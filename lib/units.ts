const KG_PER_LB = 0.45359237;

export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

export function formatLbs(kg: number | null | undefined, digits = 1): string {
  if (kg == null || isNaN(kg)) return "0 lbs";
  const lbs = kgToLbs(kg);
  const rounded = Math.round(lbs * 10 ** digits) / 10 ** digits;
  return `${rounded} lbs`;
}
