import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { supabase } from "../lib/supabase";
import { TERMS_URL, TERMS_VERSION } from "../lib/terms";

const GREEN = "#1C5C38";
const AMBER = "#C8860A";
const DARK = "#111827";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

type Props = {
  onAccepted: () => void;
};

export default function TermsGate({ onAccepted }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const accept = async () => {
    if (!agreed) {
      Alert.alert("Agreement required", "Please agree to the Terms to continue.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
    if (error) {
      // Fallback if RPC not deployed yet: direct update
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: upErr } = await supabase
          .from("users")
          .update({
            terms_accepted_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
          })
          .eq("id", user.id);
        if (upErr) {
          setLoading(false);
          Alert.alert("Could not save", upErr.message);
          return;
        }
      } else {
        setLoading(false);
        Alert.alert("Could not save", error.message);
        return;
      }
    }
    setLoading(false);
    onAccepted();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>
          <Text style={{ color: DARK }}>Plenty</Text>
          <Text style={{ color: AMBER }}>Left</Text>
        </Text>
        <Text style={styles.title}>Terms of Use</Text>
        <Text style={styles.body}>
          PlentyLeft has zero tolerance for objectionable content and abusive users.
          You may not post illegal, harassing, hateful, or unsafe content. Listings,
          photos, and notes are user-generated and may be reported by others.
        </Text>
        <Text style={styles.body}>
          Users can report and block others. We review reports within 24 hours and
          will remove violating content and suspend or eject offending accounts.
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
          <Text style={styles.link}>Read the full Terms →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>
            I agree to the Terms of Use and Community Standards (version {TERMS_VERSION}).
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, (!agreed || loading) && styles.btnDisabled]}
          onPress={accept}
          disabled={!agreed || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Accept & continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, paddingTop: 48 },
  brand: { fontSize: 28, fontWeight: "700", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "700", color: DARK, marginBottom: 12 },
  body: { fontSize: 15, color: GRAY, lineHeight: 22, marginBottom: 12 },
  link: { fontSize: 15, color: GREEN, fontWeight: "700", marginBottom: 28 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 24 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: GREEN, borderColor: GREEN },
  checkMark: { color: "#fff", fontWeight: "700", fontSize: 14 },
  checkLabel: { flex: 1, fontSize: 15, color: DARK, lineHeight: 22 },
  btn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
