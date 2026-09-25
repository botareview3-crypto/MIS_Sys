export const USER_ROLES = ["Admin", "Secondary Admin", "Reception", "Technician"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

export function isValidFullName(v: string) {
  return v.length >= 3 && v.length <= 150;
}
export function isValidUsername(v: string) {
  return USERNAME_PATTERN.test(v);
}
export function isValidNewPassword(v: string) {
  return v.length >= 8 && v.length <= 255;
}
