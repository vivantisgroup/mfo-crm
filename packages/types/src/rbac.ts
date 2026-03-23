export type Role = "owner"|"advisor"|"ops"|"compliance"|"client_viewer"|"auditor";
export type Claims = { tenant: string; roles: Role[]; uid: string };
export const hasRole = (claims: Claims, roles: Role|Role[]) => {
  const required = Array.isArray(roles) ? roles : [roles];
  return required.some(r => claims.roles.includes(r));
};
