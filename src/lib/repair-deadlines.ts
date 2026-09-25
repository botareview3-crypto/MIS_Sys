/** Ported from validExpectedCompletionDate() in includes/repair-deadlines.php. */
export function validExpectedCompletionDate(value: string): boolean {
  if (value === "") return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
