import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
} from "react-native";
import {
  REPORT_REASONS,
  ReportReason,
  blockOrganization,
  confirmBlock,
  submitReport,
} from "../lib/moderation";

const GREEN = "#1C5C38";
const DARK = "#111827";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

type Props = {
  /** Listing being viewed (optional for org-only actions) */
  listingId?: string | null;
  /** Organization to report/block (required for block) */
  targetOrganizationId: string;
  targetOrganizationName: string;
  /** Called after a successful block so parent can drop cards from local state */
  onBlocked?: (organizationId: string) => void;
};

export default function ReportBlockMenu({
  listingId,
  targetOrganizationId,
  targetOrganizationName,
  onBlocked,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<Exclude<ReportReason, "blocked"> | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const closeAll = () => {
    setMenuOpen(false);
    setReportOpen(false);
    setReason(null);
    setNote("");
    setBusy(false);
  };

  const handleReport = async () => {
    if (!reason) {
      Alert.alert("Pick a reason", "Please select why you are reporting this.");
      return;
    }
    setBusy(true);
    const { error } = await submitReport({
      contentType: listingId ? "listing" : "organization",
      contentId: listingId ?? targetOrganizationId,
      reportedOrganizationId: targetOrganizationId,
      reason,
      note,
    });
    setBusy(false);
    if (error) {
      Alert.alert("Could not send report", error);
      return;
    }
    closeAll();
    Alert.alert(
      "Report submitted",
      "Thanks. Our team will review this within 24 hours and take action if needed.",
    );
  };

  const handleBlock = () => {
    setMenuOpen(false);
    confirmBlock(targetOrganizationName || "this organization", async () => {
      setBusy(true);
      const { error } = await blockOrganization({
        organizationId: targetOrganizationId,
        organizationName: targetOrganizationName,
        relatedListingId: listingId,
      });
      setBusy(false);
      if (error) {
        Alert.alert("Could not block", error);
        return;
      }
      onBlocked?.(targetOrganizationId);
      Alert.alert(
        "User blocked",
        `${targetOrganizationName || "That organization"} can no longer appear in your feeds.`,
      );
    });
  };

  return (
    <>
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => setMenuOpen(true)}
        hitSlop={10}
        accessibilityLabel="More actions"
      >
        <Text style={styles.menuBtnText}>⋯</Text>
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{targetOrganizationName || "Actions"}</Text>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
            >
              <Text style={styles.sheetRowText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={handleBlock}>
              <Text style={[styles.sheetRowText, styles.destructive]}>Block user</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetRow, styles.cancelRow]} onPress={() => setMenuOpen(false)}>
              <Text style={styles.sheetRowText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={closeAll}>
        <View style={styles.reportBackdrop}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Report content</Text>
            <Text style={styles.reportSub}>
              Tell us what’s wrong. We review every report within 24 hours.
            </Text>
            {REPORT_REASONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.reasonRow, reason === r.key && styles.reasonRowActive]}
                onPress={() => setReason(r.key)}
              >
                <Text style={[styles.reasonText, reason === r.key && styles.reasonTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.note}
              placeholder="Optional note"
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitBtn, busy && styles.submitDisabled]}
              onPress={handleReport}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit report</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={closeAll} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: GRAY, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  menuBtnText: { fontSize: 20, fontWeight: "700", color: DARK, marginTop: -4 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
    paddingTop: 12,
  },
  sheetTitle: {
    fontSize: 13,
    color: GRAY,
    fontWeight: "600",
    paddingHorizontal: 20,
    paddingBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sheetRow: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  cancelRow: { marginTop: 8 },
  sheetRowText: { fontSize: 17, fontWeight: "600", color: DARK },
  destructive: { color: "#DC2626" },
  reportBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  reportTitle: { fontSize: 18, fontWeight: "700", color: DARK, marginBottom: 6 },
  reportSub: { fontSize: 14, color: GRAY, marginBottom: 14, lineHeight: 20 },
  reasonRow: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  reasonRowActive: { borderColor: GREEN, backgroundColor: "#F0FDF4" },
  reasonText: { fontSize: 15, fontWeight: "600", color: GRAY },
  reasonTextActive: { color: GREEN },
  note: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    minHeight: 72,
    marginTop: 4,
    marginBottom: 16,
    fontSize: 15,
    color: DARK,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
