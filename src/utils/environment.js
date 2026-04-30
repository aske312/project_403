const envStates = {
  active: "active",
  deactive: "deactive",
  inactive: "deactive",
  debug: "debug",
  dev: "dev",
  development: "dev",
  local: "dev",
  close: "close",
  closed: "close",
};

export function normalizeEnvironment(value) {
  const raw = String(value || "dev").trim();
  const key = raw.toLowerCase();

  return {
    label: raw.toUpperCase(),
    state: envStates[key] || "dev",
  };
}

export function canUseAdminPanel(profile, environment) {
  const role = String(profile?.role || "").trim().toLowerCase();
  const permissions = Array.isArray(profile?.permissions)
    ? profile.permissions.map((permission) => String(permission).trim().toLowerCase())
    : [];
  const hasSuperAdminPermission =
    Boolean(profile?.is_super_admin) || permissions.includes("super_admin");

  return hasSuperAdminPermission && role === "owner" && environment.state === "dev";
}
