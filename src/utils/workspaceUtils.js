export function getProfileName(profile) {
  return profile?.name || profile?.tag || profile?.handle || "User";
}

export function getInitials(name) {
  return String(name || "U")
    .split(/[\s_.@-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
