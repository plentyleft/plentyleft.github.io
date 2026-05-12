import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, RefreshControl, SafeAreaView, Alert
} from "react-native";
import { supabase } from "../lib/supabase";
import { sendPushNotification } from "../lib/notifications";
import CreateListingScreen from "./CreateListingScreen";

function formatPickup(start: string, end: string) {
  if (!start || !end) return "No pickup time set";
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr}, ${startTime} – ${endTime}`;
}

export default function CorpHomeScreen() {
  const [activeTab, setActiveTab] = useState<"post" | "claimed" | "listings">("post");
  const [claimedListings, setClaimedListings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [myListings, setMyListings] = useState([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();
        if (data?.organization_id) {
          setOrgId(data.organization_id);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (orgId) fetchClaimed();
  }, [orgId]);

  useEffect(() => {
    if (activeTab === "claimed" && orgId) fetchClaimed();
    if (activeTab === "listings" && orgId) fetchMyListings();
  }, [activeTab]);

  const fetchClaimed = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("*, matches(*)")
      .eq("status", "matched").eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    console.log("fetchClaimed orgId:", orgId, "data:", JSON.stringify(data), "error:", JSON.stringify(error));
    if (!error) setClaimedListings(data || []);
  };

  const fetchMyListings = async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (!error) setMyListings(data || []);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClaimed();
    setRefreshing(false);
  }, [orgId]);

  const handleConfirmPickup = async (listing: any) => {
    const match = listing.matches?.[0];
    if (!match) return;
    setConfirming(listing.id);
    try {
      const { error: matchError } = await supabase
        .from("matches")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          pickup_confirmed_by_corp: true,
        })
        .eq("id", match.id);

      if (matchError) throw matchError;

      const { error: listingError } = await supabase
        .from("listings")
        .update({ status: "completed" })
        .eq("id", listing.id);

      if (listingError) throw listingError;

      // Notify nonprofit
      const { data: nonprofitUser } = await supabase
        .from("users")
        .select("push_token")
        .eq("organization_id", match.nonprofit_id)
        .eq("role", "nonprofit")
        .maybeSingle();
      if (nonprofitUser?.push_token) {
        await sendPushNotification(nonprofitUser.push_token, "Pickup Confirmed! ✅", `Your pickup for "${listing.title}" has been confirmed. See you soon!`);
      }
      Alert.alert("Confirmed!", "Pickup has been confirmed. The nonprofit will be notified.");
      fetchClaimed();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setConfirming(null);
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
          style={[styles.tab, activeTab === "post" && styles.tabActive]}
          onPress={() => setActiveTab("post")}
        >
          <Text style={[styles.tabText, activeTab === "post" && styles.tabTextActive]}>
            Post Listing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "claimed" && styles.tabActive]}
          onPress={() => setActiveTab("claimed")}
        >
          <Text style={[styles.tabText, activeTab === "claimed" && styles.tabTextActive]}>
            Claimed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "listings" && styles.tabActive]}
          onPress={() => setActiveTab("listings")}
        >
          <Text style={[styles.tabText, activeTab === "listings" && styles.tabTextActive]}>
            My Listings
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "post" ? (
        <CreateListingScreen />
      ) : activeTab === "listings" ? (
        <FlatList
          data={myListings}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No listings posted yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>📍 {item.pickup_address || "No address"}</Text>
              <Text style={styles.cardMeta}>🕐 {formatPickup(item.pickup_start, item.pickup_end)}</Text>
              {item.quantity_kg ? <Text style={styles.cardMeta}>⚖️ {item.quantity_kg} kg</Text> : null}
              {item.serves_approx ? <Text style={styles.cardMeta}>👥 Serves ~{item.serves_approx}</Text> : null}
              <View style={[styles.statusBadge, { backgroundColor: item.status === "completed" ? "#e8f8f0" : item.status === "matched" ? "#fff9e6" : "#e8f4fd" }]}>
                <Text style={[styles.statusText, { color: item.status === "completed" ? "#27ae60" : item.status === "matched" ? "#f39c12" : "#3498db" }]}>
                  {item.status === "completed" ? "✅ Completed" : item.status === "matched" ? "🔔 Claimed" : "🟢 Open"}
                </Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={claimedListings}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>No claimed listings yet.</Text>
          }
          renderItem={({ item }) => {
            const match = item.matches?.[0];
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>📍 {item.pickup_address || "No address"}</Text>
                <Text style={styles.cardMeta}>🕐 {formatPickup(item.pickup_start, item.pickup_end)}</Text>
                {item.quantity_kg ? <Text style={styles.cardMeta}>⚖️ {item.quantity_kg} kg</Text> : null}
                {item.serves_approx ? <Text style={styles.cardMeta}>👥 Serves ~{item.serves_approx}</Text> : null}
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>🔔 Claimed by nonprofit</Text>
                </View>
                <TouchableOpacity
                  style={[styles.confirmBtn, confirming === item.id && styles.confirmBtnDisabled]}
                  onPress={() => handleConfirmPickup(item)}
                  disabled={confirming === item.id}
                >
                  <Text style={styles.confirmBtnText}>
                    {confirming === item.id ? "Confirming..." : "Confirm Pickup"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
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
  cardMeta: { fontSize: 13, color: "#666", marginTop: 4 },
  statusBadge: { marginTop: 10, backgroundColor: "#fff9e6", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start" },
  statusText: { fontSize: 13, color: "#f39c12", fontWeight: "500" },
  confirmBtn: { marginTop: 12, backgroundColor: "#3498db", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  confirmBtnDisabled: { backgroundColor: "#a0a0a0" },
  confirmBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
