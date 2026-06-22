import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { supabase } from "../lib/supabase";

type Mode = "login" | "signup";
type OrgType = "corporate" | "nonprofit";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("corporate");
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({ DMSerifDisplay_400Regular });

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Login failed", error.message);
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!email || !password || !orgName) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup failed");

      // 2. Create organization
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName,
          type: orgType,
          is_verified: orgType === "corporate", // corps auto-verified, nonprofits need review
        })
        .select("id")
        .single();
      if (orgError) throw orgError;

      // 3. Create user record linking to org
      const { error: userError } = await supabase.from("users").insert({
        id: authData.user.id,
        organization_id: orgData.id,
        email: email,
        role: orgType === "nonprofit" ? "nonprofit" : "admin",
      });
      if (userError) throw userError;

    } catch (err: any) {
      Alert.alert("Signup failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Logo / brand */}
        <View style={styles.brand}>
          <Text style={styles.logo}>🥡  🍽️</Text>
          <Text style={styles.appName}>
            <Text style={{ color: DARK }}>Plenty</Text>
            <Text style={{ color: AMBER }}>Left</Text>
          </Text>
          <Text style={styles.tagline}>Surplus food, redistributed.</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "login" && styles.modeBtnActive]}
            onPress={() => setMode("login")}
          >
            <Text style={[styles.modeBtnText, mode === "login" && styles.modeBtnTextActive]}>
              Log in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "signup" && styles.modeBtnActive]}
            onPress={() => setMode("signup")}
          >
            <Text style={[styles.modeBtnText, mode === "signup" && styles.modeBtnTextActive]}>
              Sign up
            </Text>
          </TouchableOpacity>
        </View>

        {/* Signup: in-app form in dev only; production uses website */}
          <View>
            <Text style={styles.label}>Organization name</Text>
            <TextInput
              style={styles.input}
              placeholder="Acme Catering Co."
              value={orgName}
              onChangeText={setOrgName}
            />
            <Text style={[styles.label, { marginTop: 20 }]}>Organization type</Text>
            <View style={styles.orgTypeRow}>
              <TouchableOpacity
                style={[styles.orgTypeBtn, orgType === "corporate" && styles.orgTypeBtnActive]}
                onPress={() => setOrgType("corporate")}
              >
                <Text style={styles.orgTypeIcon}>🏢</Text>
                <Text style={[styles.orgTypeBtnText, orgType === "corporate" && styles.orgTypeBtnTextActive]}>
                  Corporate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.orgTypeBtn, orgType === "nonprofit" && styles.orgTypeBtnActive]}
                onPress={() => setOrgType("nonprofit")}
              >
                <Text style={styles.orgTypeIcon}>🤝</Text>
                <Text style={[styles.orgTypeBtnText, orgType === "nonprofit" && styles.orgTypeBtnTextActive]}>
                  Nonprofit
                </Text>
              </TouchableOpacity>
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
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Create account →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Email & password - only show for login */}
        {mode === "login" && (
          <View>
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
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Log in →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = "#1C5C38";
const AMBER = "#C8860A";
const DARK = "#111827";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";
const LIGHT = "#F9FAFB";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, paddingTop: 140 },

  brand: { alignItems: "center", marginBottom: 36 },
  logo: { fontSize: 48, marginBottom: 8 },
  appName: { fontSize: 32, fontFamily: 'DMSerifDisplay_400Regular', letterSpacing: -1 },
  tagline: { fontSize: 15, color: GRAY, marginTop: 4 },

  modeToggle: {
    flexDirection: "row", backgroundColor: LIGHT, borderRadius: 12,
    padding: 4, marginBottom: 24,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 15, fontWeight: "500", color: GRAY },
  modeBtnTextActive: { color: DARK, fontWeight: "600" },

  label: { fontSize: 14, fontWeight: "600", color: DARK, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: DARK,
  },

  orgTypeRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  orgTypeBtn: {
    flex: 1, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12,
    padding: 16, alignItems: "center",
  },
  orgTypeBtnActive: { borderColor: GREEN, backgroundColor: "#F0FDF4" },
  orgTypeIcon: { fontSize: 28, marginBottom: 6 },
  orgTypeBtnText: { fontSize: 14, fontWeight: "600", color: GRAY, marginBottom: 4 },
  orgTypeBtnTextActive: { color: GREEN },
  orgTypeDesc: { fontSize: 11, color: GRAY, textAlign: "center" },

  submitBtn: {
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 18,
    alignItems: "center", marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  disclaimer: { fontSize: 12, color: GRAY, textAlign: "center", marginTop: 16, lineHeight: 18 },
  webSignupBox: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 8 },
  webSignupTitle: { fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 12, textAlign: "center" },
  webSignupDesc: { fontSize: 15, color: GRAY, textAlign: "center", marginBottom: 28, lineHeight: 22 },
  webSignupBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, alignItems: "center" },
  webSignupBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
