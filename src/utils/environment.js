const envStates = {
  active: "active",
  deactive: "deactive",
  inactive: "deactive",
  debug: "debug",
  dev: "dev",
  development: "dev",
  local: "dev",
  prod: "active",
  production: "active",
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

export function hasSuperAdminPermission(profile) {
  const permissions = Array.isArray(profile?.permissions)
    ? profile.permissions.map((permission) => String(permission).trim().toLowerCase())
    : [];

  return Boolean(profile?.is_super_admin) || permissions.includes("super_admin");
}

export function canUseAdminPanel(profile, environment) {
  const role = String(profile?.role || "").trim().toLowerCase();

  return hasSuperAdminPermission(profile) && role === "owner" && ["active", "dev"].includes(environment.state);
}
