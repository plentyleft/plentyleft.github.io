import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { supabase } from "../lib/supabase";
import { kgToLbs } from "../lib/units";

const GREEN = "#1C5C38";
const DARK = "#111827";
const GRAY = "#6B7280";

type Props = {
  orgId: string | null;
  role: "admin" | "nonprofit";
};

export default function ImpactScreen({ orgId, role }: Props) {
  const [stats, setStats] = useState({
    totalClaims: 0,
    completedPickups: 0,
    totalLbs: 0,
    totalMeals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId) fetchImpact();
    else setLoading(false);
  }, [orgId, role]);

  const fetchImpact = async () => {
    if (!orgId) return;
    setLoading(true);

    if (role === "nonprofit") {
      const { data, error } = await supabase
        .from("matches")
        .select("status, listings(quantity_kg, serves_approx)")
        .eq("nonprofit_id", orgId);

      if (!error && data) {
        const completed = data.filter((m) => m.status === "accepted");
        const totalKg = completed.reduce((sum, m) => sum + (m.listings?.quantity_kg || 0), 0);
        const totalMeals = completed.reduce((sum, m) => sum + (m.listings?.serves_approx || 0), 0);
        setStats({
          totalClaims: data.length,
          completedPickups: completed.length,
          totalLbs: Math.round(kgToLbs(totalKg) * 10) / 10,
          totalMeals,
        });
      }
    } else {
      const { data, error } = await supabase
        .from("listings")
        .select("status, quantity_kg, serves_approx")
        .eq("organization_id", orgId);

      if (!error && data) {
        const completed = data.filter((l) => l.status === "completed");
        const totalKg = completed.reduce((sum, l) => sum + (l.quantity_kg || 0), 0);
        const totalMeals = completed.reduce((sum, l) => sum + (l.serves_approx || 0), 0);
        setStats({
          totalClaims: data.length,
          completedPickups: completed.length,
          totalLbs: Math.round(kgToLbs(totalKg) * 10) / 10,
          totalMeals,
        });
      }
    }
    setLoading(false);
  };

  const co2Lbs = Math.round(stats.totalLbs * 3.5);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your Impact</Text>
      <Text style={styles.subheading}>Every pickup makes a difference 🌱</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardNumber}>{stats.totalClaims}</Text>
          <Text style={styles.cardLabel}>
            {role === "nonprofit" ? "Total Claims" : "Listings Posted"}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardNumber}>{stats.completedPickups}</Text>
          <Text style={styles.cardLabel}>Pickups Completed</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardNumber}>{stats.totalLbs} lbs</Text>
          <Text style={styles.cardLabel}>Food Rescued</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardNumber}>{stats.totalMeals}</Text>
          <Text style={styles.cardLabel}>Meals Provided</Text>
        </View>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          🌍 You've helped rescue {stats.totalLbs} lbs of food — that's approximately {co2Lbs} lbs of CO₂ emissions avoided!
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 24, fontWeight: "700", color: DARK, marginBottom: 4 },
  subheading: { fontSize: 15, color: GRAY, marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "47%",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    alignItems: "center",
  },
  cardNumber: { fontSize: 26, fontWeight: "700", color: GREEN, marginBottom: 4 },
  cardLabel: { fontSize: 12, color: GRAY, textAlign: "center" },
  banner: { backgroundColor: "#E8F5EE", borderRadius: 12, padding: 16 },
  bannerText: { fontSize: 14, color: GREEN, lineHeight: 22 },
});
