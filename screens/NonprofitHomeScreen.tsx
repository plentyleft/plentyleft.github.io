import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, RefreshControl, SafeAreaView, Alert
} from "react-native";
import { supabase } from "../lib/supabase";
import { sendPushNotification } from "../lib/notifications";
import ImpactScreen from "./ImpactScreen";

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
  const [activeTab, setActiveTab] = useState<"available" | "claims" | "impact">("available");
  const [listings, setListings] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
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

  useEffect(() => {
    if (activeTab === "claims" && orgId) fetchMyClaims();
  }, [activeTab, orgId]);

  const fetchListings = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (!error) setListings(data || []);
  };

  const fetchMyClaims = async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from("matches")
      .select("*, listings(*)")
      .eq("nonprofit_id", orgId)
      .order("matched_at", { ascending: false });
    if (!error) setMyClaims(data || []);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === "available") await fetchListings();
    else await fetchMyClaims();
    setRefreshing(false);
  }, [activeTab, orgId]);

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
      // Notify corp
      const { data: corpUser } = await supabase
        .from("users")
        .select("push_token")
        .eq("organization_id", listing.organization_id)
        .eq("role", "admin")
        .maybeSingle();
      if (corpUser?.push_token) {
        await sendPushNotification(corpUser.push_token, "Donation Claimed! 🎉", `Your listing "${listing.title}" has been claimed by a nonprofit.`);
      }
      Alert.alert("Claimed!", "You\'ve claimed this donation. The corp will be notified to confirm pickup.");
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
        <Text style={styles.title}>plentyleft</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "available" && styles.tabActive]}
          onPress={() => setActiveTab("available")}
        >
          <Text style={[styles.tabText, activeTab === "available" && styles.tabTextActive]}>Available</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "claims" && styles.tabActive]}
          onPress={() => setActiveTab("claims")}
        >
          <Text style={[styles.tabText, activeTab === "claims" && styles.tabTextActive]}>My Claims</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "impact" && styles.tabActive]}
          onPress={() => setActiveTab("impact")}
        >
          <Text style={[styles.tabText, activeTab === "impact" && styles.tabTextActive]}>Impact</Text>
        </TouchableOpacity>
      </View>
      {activeTab === "claims" ? (
        <FlatList
          data={myClaims}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>No claims yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.listings?.title}</Text>
              <Text style={styles.cardMeta}>📍 {item.listings?.pickup_address || "No address"}</Text>
              {item.listings?.pickup_start ? <Text style={styles.cardMeta}>🕐 {formatPickup(item.listings.pickup_start, item.listings.pickup_end)}</Text> : null}
              {item.listings?.quantity_kg ? <Text style={styles.cardMeta}>⚖️ {item.listings.quantity_kg} kg</Text> : null}
              {item.listings?.serves_approx ? <Text style={styles.cardMeta}>👥 Serves ~{item.listings.serves_approx}</Text> : null}
              <View style={[styles.statusBadge, { backgroundColor: item.status === "accepted" ? "#e8f8f0" : "#fff9e6" }]}>
                <Text style={[styles.statusText, { color: item.status === "accepted" ? "#27ae60" : "#f39c12" }]}>
                  {item.status === "accepted" ? "✅ Pickup Confirmed" : "⏳ Pending Confirmation"}
                </Text>
              </View>
            </View>
          )}
        />
      ) : activeTab === "impact" ? (
        <ImpactScreen orgId={orgId} />
      ) : (
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  title: { fontSize: 20, fontWeight: "700", color: "#1a1a1a" },
  signOut: { fontSize: 14, color: "#e74c3c" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#2ecc71" },
  tabText: { fontSize: 15, color: "#999", fontWeight: "500" },
  tabTextActive: { color: "#1a1a1a", fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 60, color: "#999", fontSize: 16 },
  card: { backgroundColor: "#fff", margin: 12, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 17, fontWeight: "600", marginBottom: 6 },
  cardDesc: { fontSize: 14, color: "#555", marginBottom: 8 },
  cardMeta: { fontSize: 13, color: "#666", marginTop: 4 },
  statusBadge: { marginTop: 10, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start" },
  statusText: { fontSize: 13, fontWeight: "500" },
  claimBtn: { marginTop: 14, backgroundColor: "#2ecc71", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  claimBtnDisabled: { backgroundColor: "#a0a0a0" },
  claimBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
