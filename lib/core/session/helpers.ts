import type { CurrentUser } from "@/lib/core/session/types";

/**
 * True iff the current user is authenticated and has the system-level
 * `admin` role. Use to gate admin-only UI surfaces such as the user
 * management screen (`/jdr/users`).
 */
export function isSystemAdmin(user: CurrentUser): boolean {
  return user.status === "authenticated" && user.auth.systemRole === "admin";
}

/**
 * True iff the current user is authenticated, has an active campaign,
 * and is the GM of that campaign. When `campaignId` is provided it must
 * match the active campaign — V1 only exposes a single active campaign
 * via /auth/me, so an unknown id is treated as "not gm there".
 */
export function isCampaignGm(
  user: CurrentUser,
  campaignId?: string | null,
): boolean {
  if (user.status !== "authenticated") return false;
  const camp = user.activeCampaign;
  if (!camp) return false;
  if (campaignId && camp.id !== campaignId) return false;
  return camp.role === "gm";
}

/**
 * True iff the current user is authenticated and a member (gm OR pj)
 * of the active campaign (optionally narrowed to a specific campaignId).
 */
export function isCampaignMember(
  user: CurrentUser,
  campaignId?: string | null,
): boolean {
  if (user.status !== "authenticated") return false;
  const camp = user.activeCampaign;
  if (!camp) return false;
  if (campaignId && camp.id !== campaignId) return false;
  return true;
}
