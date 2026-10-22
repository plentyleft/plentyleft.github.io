import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Linking,
} from "react-native";
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { supabase } from "../lib/supabase";
import { TERMS_URL, TERMS_VERSION } from "../lib/terms";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({ DMSerifDisplay_400Regular });

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    if (!agreed) {
      Alert.alert(
        "Terms required",
        "You must agree to the Terms of Use before logging in. PlentyLeft has no tolerance for objectionable content or abusive users.",
      );
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert("Login failed", error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("users")
        .select("banned")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.banned) {
        await supabase.auth.signOut();
        Alert.alert(
          "Account suspended",
          "This account has been suspended for violating our Terms of Use.",
        );
        setLoading(false);
        return;
      }

      await supabase.rpc("accept_terms", { p_version: TERMS_VERSION }).then(async ({ error: rpcErr }) => {
        if (rpcErr) {
          await supabase
            .from("users")
            .update({
              terms_accepted_at: new Date().toISOString(),
              terms_version: TERMS_VERSION,
            })
            .eq("id", userId);
        }
      });
    }

    setLoading(false);
  };

  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.brand}>
          <Text style={styles.logo}>🥡  🍽️</Text>
          <Text style={styles.appName}>
            <Text style={{ color: DARK }}>Plenty</Text>
            <Text style={{ color: AMBER }}>Left</Text>
          </Text>
          <Text style={styles.tagline}>Surplus food, redistributed.</Text>
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>
            I agree to the{" "}
            <Text style={styles.linkInline} onPress={() => Linking.openURL(TERMS_URL)}>
              Terms of Use
            </Text>
            . PlentyLeft has no tolerance for objectionable content or abusive users.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, (loading || !agreed) && styles.submitBtnDisabled]}
          onPress={handleLogin}
          disabled={loading || !agreed}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Log in →</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = "#1C5C38";
const AMBER = "#C8860A";
const DARK = "#111827";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, paddingTop: 140 },

  brand: { alignItems: "center", marginBottom: 36 },
  logo: { fontSize: 48, marginBottom: 8 },
  appName: { fontSize: 32, fontFamily: 'DMSerifDisplay_400Regular', letterSpacing: -1 },
  tagline: { fontSize: 15, color: GRAY, marginTop: 4 },

  label: { fontSize: 14, fontWeight: "600", color: DARK, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: DARK,
  },

  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 24 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: BORDER,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxOn: { backgroundColor: GREEN, borderColor: GREEN },
  checkMark: { color: "#fff", fontWeight: "700", fontSize: 14 },
  checkLabel: { flex: 1, fontSize: 14, color: DARK, lineHeight: 20 },
  linkInline: { color: GREEN, fontWeight: "700", textDecorationLine: "underline" },

  submitBtn: {
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 18,
    alignItems: "center", marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
