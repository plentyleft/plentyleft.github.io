import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { supabase } from "../lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  submitBtn: {
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 18,
    alignItems: "center", marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
