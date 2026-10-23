import type { ConnectMembership, ConnectOrganization } from "@promoven/connect-contracts";

export function safeReturnTo(value: string | null): string {
  return value === "/invite" || (value?.startsWith("/connect") && (value.length === 8 || value[8] === "/" || value[8] === "?")) ? value : "/connect";
}
export function chooseOrganization(organizations: readonly ConnectOrganization[], storedId: string | null): string | null {
  return organizations.find((org) => org.id === storedId)?.id ?? organizations[0]?.id ?? null;
}
export function visibleOrganizations(organizations: readonly ConnectOrganization[], memberships: readonly ConnectMembership[]) {
  const allowed = new Set(memberships.filter((membership) => membership.active).map((membership) => membership.organizationId));
  return organizations.filter((org) => org.status === "active" && allowed.has(org.id));
}
