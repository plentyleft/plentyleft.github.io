import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, RefreshControl, SafeAreaView, Alert
} from "react-native";
import { supabase } from "../lib/supabase";

function formatPickup(start: string, end: string) {
  if (!start || !end) return "No pickup time set";
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr}, ${startTime} – ${endTime}`;
}

export default function NonprofitHomeScreen() {
  const [listings, setListings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();
        setOrgId(data?.organization_id || null);
      }
    });
    fetchListings();
  }, []);

  const fetchListings = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (!error) setListings(data || []);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  }, []);

  const handleClaim = async (listing: any) => {
    if (!orgId) {
      Alert.alert("Error", "Your account is not linked to an organization.");
      return;
    }
    setClaiming(listing.id);
    try {
      const { error: matchError } = await supabase
        .from("matches")
        .insert({
          listings_id: listing.id,
          nonprofit_id: orgId,
          status: "pending",
          matched_at: new Date().toISOString(),
        });

      if (matchError) throw matchError;

      const { error: updateError } = await supabase
        .from("listings")
        .update({ status: "matched" })
        .eq("id", listing.id);

      if (updateError) throw updateError;

      Alert.alert("Claimed!", "You've claimed this donation. The corp will be notified to confirm pickup.");
      fetchListings();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setClaiming(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Available Donations</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No listings available yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.notes ? <Text style={styles.cardDesc}>{item.notes}</Text> : null}
            <Text style={styles.cardMeta}>📍 {item.pickup_address || "Address not set"}</Text>
            <Text style={styles.cardMeta}>🕐 {formatPickup(item.pickup_start, item.pickup_end)}</Text>
            {item.quantity_kg ? <Text style={styles.cardMeta}>⚖️ {item.quantity_kg} kg</Text> : null}
            {item.serves_approx ? <Text style={styles.cardMeta}>👥 Serves ~{item.serves_approx}</Text> : null}
            <TouchableOpacity
              style={[styles.claimBtn, claiming === item.id && styles.claimBtnDisabled]}
              onPress={() => handleClaim(item)}
              disabled={claiming === item.id}
            >
              <Text style={styles.claimBtnText}>
                {claiming === item.id ? "Claiming..." : "Claim Donation"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  title: { fontSize: 20, fontWeight: "700", color: "#1a1a1a" },
  signOut: { fontSize: 14, color: "#e74c3c" },
  empty: { textAlign: "center", marginTop: 60, color: "#999", fontSize: 16 },
  card: { backgroundColor: "#fff", margin: 12, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 17, fontWeight: "600", marginBottom: 6 },
  cardDesc: { fontSize: 14, color: "#555", marginBottom: 8 },
  cardMeta: { fontSize: 13, color: "#666", marginTop: 4 },
  claimBtn: { marginTop: 14, backgroundColor: "#2ecc71", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  claimBtnDisabled: { backgroundColor: "#a0a0a0" },
  claimBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
