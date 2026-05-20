import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";

const GREEN = "#1C5C38";
const AMBER = "#C8860A";
const DARK = "#111827";

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const preview = (route.params as { preview?: boolean } | undefined)?.preview ?? false;
  const [loading, setLoading] = useState(false);

  const handleSelectRole = async (role: "admin" | "nonprofit") => {
    if (preview) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("users")
        .update({ role })
        .eq("id", user.id);

      if (error) throw error;
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {preview && (
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.previewBack}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.emoji}>🌱</Text>
        <Text style={styles.title}>
          Welcome to <Text style={styles.titlePlenty}>Plenty</Text>
          <Text style={styles.titleLeft}>Left</Text>
        </Text>
        <Text style={styles.subtitle}>Surplus food, redistributed.</Text>
        <Text style={styles.question}>How will you use PlentyLeft?</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => handleSelectRole("admin")}
          disabled={loading}
        >
          <Text style={styles.cardEmoji}>🏢</Text>
          <Text style={styles.cardTitle}>I'm a Corporation</Text>
          <Text style={styles.cardDesc}>I have surplus food to donate and want to post listings for nonprofits to claim.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardGreen]}
          onPress={() => handleSelectRole("nonprofit")}
          disabled={loading}
        >
          <Text style={styles.cardEmoji}>🤝</Text>
          <Text style={styles.cardTitle}>I'm a Nonprofit</Text>
          <Text style={styles.cardDesc}>I serve people in need and want to claim surplus food donations from corporations.</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator style={{ marginTop: 20 }} color="#2ecc71" />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  emoji: { fontSize: 48, textAlign: "center", marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", color: "#1a1a1a", marginBottom: 6 },
  subtitle: { fontSize: 16, textAlign: "center", color: "#666", marginBottom: 40 },
  question: { fontSize: 18, fontWeight: "600", color: "#1a1a1a", marginBottom: 16, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, borderWidth: 2, borderColor: "#eee" },
  cardGreen: { borderColor: GREEN },
  previewHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  previewBack: { fontSize: 16, color: GREEN, fontWeight: "600" },
  titlePlenty: { color: DARK },
  titleLeft: { color: AMBER },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  cardDesc: { fontSize: 14, color: "#666", lineHeight: 20 },
});
