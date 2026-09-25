export const REPORTED_PROBLEM_STANDARD = "PC Configuration, SAP and CISCO Installation";
export const REPORTED_PROBLEM_STANDARD_KEY = "pc_configuration_sap_cisco";
export const REPORTED_PROBLEM_OTHER_KEY = "other";

export function resolveReportedProblem(selection: string, customProblem: string): string {
  if (selection === REPORTED_PROBLEM_STANDARD_KEY) return REPORTED_PROBLEM_STANDARD;
  if (selection === REPORTED_PROBLEM_OTHER_KEY) return customProblem.trim();
  return "";
}
