import { Alert } from "react-native";
import { supabase } from "./supabase";

export type ReportReason =
  | "spam"
  | "offensive"
  | "unsafe_food"
  | "harassment"
  | "other"
  | "blocked";

export const REPORT_REASONS: { key: Exclude<ReportReason, "blocked">; label: string }[] = [
  { key: "spam", label: "Spam" },
  { key: "offensive", label: "Offensive content" },
  { key: "unsafe_food", label: "Unsafe food" },
  { key: "harassment", label: "Harassment" },
  { key: "other", label: "Other" },
];

export async function getBlockedOrganizationIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("blocked_organizations")
    .select("blocked_organization_id")
    .eq("blocker_id", user.id);
  if (error) {
    console.warn("getBlockedOrganizationIds", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.blocked_organization_id);
}

export async function submitReport(params: {
  contentType: "listing" | "user" | "organization";
  contentId?: string | null;
  reportedUserId?: string | null;
  reportedOrganizationId?: string | null;
  reason: ReportReason;
  note?: string;
}): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    content_type: params.contentType,
    content_id: params.contentId ?? null,
    reported_user_id: params.reportedUserId ?? null,
    reported_organization_id: params.reportedOrganizationId ?? null,
    reason: params.reason,
    note: params.note?.trim() || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Org-level block. UI label: "Block user".
 * Instantly persists; caller should update local feed state.
 * Also writes a reports row with reason 'blocked' for admin alert.
 */
export async function blockOrganization(params: {
  organizationId: string;
  organizationName?: string;
  relatedListingId?: string | null;
}): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!params.organizationId) return { error: "Missing organization." };

  const { error: blockError } = await supabase.from("blocked_organizations").upsert({
    blocker_id: user.id,
    blocked_organization_id: params.organizationId,
  });
  if (blockError) return { error: blockError.message };

  const { error: reportError } = await submitReport({
    contentType: "organization",
    contentId: params.organizationId,
    reportedOrganizationId: params.organizationId,
    reason: "blocked",
    note: params.organizationName
      ? `User blocked organization: ${params.organizationName}`
      : "User blocked an organization",
  });
  if (reportError) {
    // Block still succeeded; surface report failure softly
    console.warn("block report notify failed", reportError);
  }

  return { error: null };
}

export function confirmBlock(
  orgName: string,
  onConfirm: () => void,
) {
  Alert.alert(
    "Block user?",
    `This blocks all users from ${orgName}. Their listings and matches will disappear from your feeds immediately.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Block user", style: "destructive", onPress: onConfirm },
    ],
  );
}
