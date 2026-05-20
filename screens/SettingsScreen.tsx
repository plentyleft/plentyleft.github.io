import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { deleteAccount } from "../lib/deleteAccount";

const GREEN = "#1C5C38";
const DARK = "#111827";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const runDelete = async () => {
    setDeleting(true);
    const { error } = await deleteAccount();
    setDeleting(false);
    if (error) {
      Alert.alert("Could not delete account", error);
      return;
    }
    Alert.alert("Account deleted", "Your account and data have been permanently removed.");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your PlentyLeft account and removes your organization if you are the only member. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm deletion",
              "Are you sure? You will be signed out and all account data will be erased.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Yes, delete", style: "destructive", onPress: runDelete },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Signed in as</Text>
        <Text style={styles.email}>{email ?? "—"}</Text>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.dangerDesc}>
            Permanently remove your account and associated data from PlentyLeft, as required for App Store accounts.
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteBtnText}>Delete my account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  back: { fontSize: 16, color: GREEN, fontWeight: "600", width: 72 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: DARK },
  headerSpacer: { width: 72 },
  content: { padding: 20 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: GRAY, textTransform: "uppercase", letterSpacing: 0.5 },
  email: { fontSize: 17, color: DARK, marginTop: 6, marginBottom: 28 },
  signOutBtn: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 32,
  },
  signOutText: { fontSize: 16, fontWeight: "600", color: DARK },
  dangerZone: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  dangerTitle: { fontSize: 16, fontWeight: "700", color: "#B91C1C", marginBottom: 8 },
  dangerDesc: { fontSize: 14, color: GRAY, lineHeight: 20, marginBottom: 16 },
  deleteBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteBtnDisabled: { opacity: 0.6 },
  deleteBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
