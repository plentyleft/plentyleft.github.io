import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from "react-native";
import { supabase } from "../lib/supabase";

export default function ImpactScreen({ orgId }: { orgId: string | null }) {
  const [stats, setStats] = useState({
    totalClaims: 0,
    completedPickups: 0,
    totalKg: 0,
    totalMeals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId) fetchImpact();
  }, [orgId]);

  const fetchImpact = async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*, listings(quantity_kg, serves_approx)")
      .eq("nonprofit_id", orgId);

    if (!error && data) {
      const completed = data.filter(m => m.status === "accepted");
      const totalKg = completed.reduce((sum, m) => sum + (m.listings?.quantity_kg || 0), 0);
      const totalMeals = completed.reduce((sum, m) => sum + (m.listings?.serves_approx || 0), 0);
      setStats({
        totalClaims: data.length,
        completedPickups: completed.length,
        totalKg: Math.round(totalKg * 10) / 10,
        totalMeals,
      });
    }
    setLoading(false);
  };

  if (loading) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your Impact</Text>
      <Text style={styles.subheading}>Every pickup makes a difference 🌱</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardNumber}>{stats.totalClaims}</Text>
          <Text style={styles.cardLabel}>Total Claims</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardNumber}>{stats.completedPickups}</Text>
          <Text style={styles.cardLabel}>Pickups Completed</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardNumber}>{stats.totalKg} kg</Text>
          <Text style={styles.cardLabel}>Food Rescued</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardNumber}>{stats.totalMeals}</Text>
          <Text style={styles.cardLabel}>Meals Provided</Text>
        </View>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          🌍 You've helped rescue {stats.totalKg} kg of food — that's approximately {Math.round(stats.totalKg * 3.5)} kg of CO₂ emissions avoided!
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  content: { padding: 20 },
  loading: { textAlign: "center", marginTop: 60, color: "#999" },
  heading: { fontSize: 24, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  subheading: { fontSize: 15, color: "#666", marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "47%", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, alignItems: "center" },
  cardNumber: { fontSize: 28, fontWeight: "700", color: "#2ecc71", marginBottom: 4 },
  cardLabel: { fontSize: 13, color: "#666", textAlign: "center" },
  banner: { backgroundColor: "#e8f8f0", borderRadius: 12, padding: 16 },
  bannerText: { fontSize: 14, color: "#27ae60", lineHeight: 22 },
});
