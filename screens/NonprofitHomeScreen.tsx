import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { formatLbs } from "../lib/units";
import ImpactScreen from "./ImpactScreen";

interface Match {
  id: string;
  listings_id: string;
  status: string;
  match_score: number;
  matched_at: string;
  listing: {
    title: string;
    food_types: string[];
    quantity_kg: number;
    serves_approx: number;
    pickup_address: string;
    pickup_start: string;
    pickup_end: string;
    notes: string;
    dietary_flags: string[];
  };
}

export default function NonprofitHomeScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<"food" | "impact">("food");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: userData } = await supabase
      .from("users").select("organization_id").eq("id", user.id).maybeSingle();
    if (!userData?.organization_id) return;
    setOrgId(userData.organization_id);
    const { data, error } = await supabase
      .from("matches")
      .select(`id, listings_id, status, match_score, matched_at,
        listing:listings(title, food_types, quantity_kg, serves_approx,
          pickup_address, pickup_start, pickup_end, notes, dietary_flags)`)
      .eq("nonprofit_id", userData.organization_id)
      .in("status", ["pending", "accepted"])
      .order("matched_at", { ascending: false });
    if (error) { Alert.alert("Error", error.message); return; }
    setMatches((data as any) || []);
  }, []);

  useEffect(() => {
    fetchMatches().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  };

  const acceptMatch = async (matchId: string) => {
    setAccepting(matchId);
    const { error } = await supabase
      .from("matches").update({ status: "accepted" }).eq("id", matchId);
    if (error) { Alert.alert("Error", error.message); }
    else {
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: "accepted" } : m));
      Alert.alert("Accepted", "The food pickup has been confirmed. The donor will be notified.");
    }
    setAccepting(null);
  };

  const formatTime = (iso: string) => {
    if (!iso) return "TBD";
    return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color={GREEN} /></View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>
          <Text style={styles.brandPlenty}>Plenty</Text>
          <Text style={styles.brandLeft}>Left</Text>
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Settings" as never)} hitSlop={8}>
          <Text style={styles.accountLink}>Account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "food" && styles.tabActive]}
          onPress={() => setActiveTab("food")}
        >
          <Text style={[styles.tabText, activeTab === "food" && styles.tabTextActive]}>Available food</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "impact" && styles.tabActive]}
          onPress={() => setActiveTab("impact")}
        >
          <Text style={[styles.tabText, activeTab === "impact" && styles.tabTextActive]}>Impact</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "impact" ? (
        <ImpactScreen orgId={orgId} role="nonprofit" />
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptyText}>When food is matched to your organization, it will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.listing?.title || "Food listing"}</Text>
                <View style={[styles.badge, item.status === "accepted" ? styles.badgeAccepted : styles.badgePending]}>
                  <Text style={[styles.badgeText, item.status === "accepted" ? styles.badgeTextAccepted : styles.badgeTextPending]}>
                    {item.status === "accepted" ? "Accepted" : "New match"}
                  </Text>
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.stat}>{formatLbs(item.listing?.quantity_kg)}</Text>
                <Text style={styles.stat}>Feeds ~{item.listing?.serves_approx}</Text>
              </View>
              {item.listing?.food_types?.length > 0 && (
                <View style={styles.chips}>
                  {item.listing.food_types.map((t: string) => (
                    <View key={t} style={styles.chip}><Text style={styles.chipText}>{t}</Text></View>
                  ))}
                </View>
              )}
              {item.listing?.dietary_flags?.length > 0 && (
                <Text style={styles.dietary}>{item.listing.dietary_flags.join(", ")}</Text>
              )}
              <View style={styles.divider} />
              <Text style={styles.label}>{item.listing?.pickup_address || "Address TBD"}</Text>
              <Text style={styles.label}>{formatTime(item.listing?.pickup_start)} - {formatTime(item.listing?.pickup_end)}</Text>
              {item.listing?.notes ? <Text style={styles.notes}>{item.listing.notes}</Text> : null}
              {item.status === "pending" && (
                <TouchableOpacity
                  style={[styles.acceptBtn, accepting === item.id && styles.acceptBtnDisabled]}
                  onPress={() => acceptMatch(item.id)}
                  disabled={accepting === item.id}
                >
                  {accepting === item.id
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.acceptBtnText}>Accept pickup</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const GREEN = "#1C5C38";
const AMBER = "#C8860A";
const DARK = "#111827";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  brand: { fontSize: 20, fontWeight: "700" },
  accountLink: { fontSize: 14, color: GREEN, fontWeight: "600" },
  brandPlenty: { color: DARK },
  brandLeft: { color: AMBER },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: AMBER },
  tabText: { fontSize: 14, color: "#999", fontWeight: "500" },
  tabTextActive: { color: DARK, fontWeight: "700" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 8 },
  emptyText: { fontSize: 15, color: "#666", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#111", flex: 1, marginRight: 8 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgePending: { backgroundColor: "#FDF6E8" },
  badgeAccepted: { backgroundColor: "#E8F5EE" },
  badgeText: { fontSize: 12, fontWeight: "600" },
  badgeTextPending: { color: AMBER },
  badgeTextAccepted: { color: GREEN },
  row: { flexDirection: "row", gap: 16, marginBottom: 8 },
  stat: { fontSize: 14, color: "#444" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, color: "#555" },
  dietary: { fontSize: 13, color: "#555", marginBottom: 8 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 10 },
  label: { fontSize: 14, color: "#444", marginBottom: 4 },
  notes: { fontSize: 13, color: "#888", marginTop: 4, fontStyle: "italic" },
  acceptBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  acceptBtnDisabled: { opacity: 0.6 },
  acceptBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});