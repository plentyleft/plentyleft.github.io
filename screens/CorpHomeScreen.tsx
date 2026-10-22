import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, RefreshControl, SafeAreaView, Alert, ActivityIndicator, Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { formatLbs } from "../lib/units";
import { sendPushNotification } from "../lib/notifications";
import { getBlockedOrganizationIds } from "../lib/moderation";
import CreateListingScreen from "./CreateListingScreen";
import ImpactScreen from "./ImpactScreen";
import ReportBlockMenu from "../components/ReportBlockMenu";

function formatPickup(start: string, end: string) {
  if (!start || !end) return "No pickup time set";
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr}, ${startTime} – ${endTime}`;
}

type ListingRow = {
  id: string;
  title: string;
  pickup_address?: string;
  pickup_start?: string;
  pickup_end?: string;
  quantity_kg?: number;
  serves_approx?: number;
  status?: string;
  photo_url?: string | null;
  removed_at?: string | null;
  matches?: {
    id: string;
    nonprofit_id: string;
    status?: string;
    nonprofit_name?: string;
  }[];
};

export default function CorpHomeScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<"post" | "claimed" | "listings" | "impact">("post");
  const [claimedListings, setClaimedListings] = useState<ListingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [myListings, setMyListings] = useState<ListingRow[]>([]);
  const [loadingClaimed, setLoadingClaimed] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);
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
    if (!orgId) return;
    setLoadingClaimed(true);
    const blocked = await getBlockedOrganizationIds();

    const { data, error } = await supabase
      .from("listings")
      .select("*, matches(id, nonprofit_id, status, pickup_confirmed_by_corp)")
      .eq("status", "matched")
      .eq("organization_id", orgId)
      .is("removed_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("fetchClaimed error", error);
      setLoadingClaimed(false);
      return;
    }

    const rows = (data || []) as ListingRow[];
    const npIds = Array.from(
      new Set(
        rows
          .map((r) => r.matches?.[0]?.nonprofit_id)
          .filter(Boolean) as string[],
      ),
    );

    let nameById: Record<string, string> = {};
    if (npIds.length) {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", npIds);
      for (const o of orgs || []) nameById[o.id] = o.name;
    }

    const enriched = rows
      .map((r) => {
        const match = r.matches?.[0];
        if (!match) return r;
        return {
          ...r,
          matches: [
            {
              ...match,
              nonprofit_name: nameById[match.nonprofit_id] || "Nonprofit",
            },
          ],
        };
      })
      .filter((r) => {
        const npId = r.matches?.[0]?.nonprofit_id;
        if (npId && blocked.includes(npId)) return false;
        return true;
      });

    setClaimedListings(enriched);
    setLoadingClaimed(false);
  };

  const fetchMyListings = async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("organization_id", orgId)
      .is("removed_at", null)
      .order("created_at", { ascending: false });
    if (!error) setMyListings((data as ListingRow[]) || []);
    setLoadingListings(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClaimed();
    setRefreshing(false);
  }, [orgId]);

  const onBlockedOrg = (blockedOrgId: string) => {
    setClaimedListings((prev) =>
      prev.filter((r) => r.matches?.[0]?.nonprofit_id !== blockedOrgId),
    );
  };

  const handleConfirmPickup = async (listing: ListingRow) => {
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

      const { data: nonprofitUser } = await supabase
        .from("users")
        .select("push_token")
        .eq("organization_id", match.nonprofit_id)
        .eq("role", "nonprofit")
        .maybeSingle();
      if (nonprofitUser?.push_token) {
        await sendPushNotification(
          nonprofitUser.push_token,
          "Pickup Confirmed! ✅",
          `Your pickup for "${listing.title}" has been confirmed. See you soon!`,
        );
      }
      Alert.alert("Confirmed!", "Pickup has been confirmed. The nonprofit will be notified.");
      fetchClaimed();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setConfirming(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          <Text style={styles.titlePlenty}>Plenty</Text>
          <Text style={styles.titleLeft}>Left</Text>
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Settings" as never)} hitSlop={8}>
          <Text style={styles.accountLink}>Account</Text>
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
            Listings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "impact" && styles.tabActive]}
          onPress={() => setActiveTab("impact")}
        >
          <Text style={[styles.tabText, activeTab === "impact" && styles.tabTextActive]}>
            Impact
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "post" ? (
        <CreateListingScreen />
      ) : activeTab === "impact" ? (
        <ImpactScreen orgId={orgId} role="admin" />
      ) : activeTab === "listings" ? (
        <FlatList
          data={myListings}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={loadingListings ? <ActivityIndicator style={{marginTop:60}} color={GREEN} size="large" /> : <Text style={styles.empty}>No listings posted yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.photo} />
              ) : null}
              <Text style={styles.cardMeta}>📍 {item.pickup_address || "No address"}</Text>
              <Text style={styles.cardMeta}>🕐 {formatPickup(item.pickup_start || "", item.pickup_end || "")}</Text>
              {item.quantity_kg ? <Text style={styles.cardMeta}>⚖️ {formatLbs(item.quantity_kg)}</Text> : null}
              {item.serves_approx ? <Text style={styles.cardMeta}>👥 Serves ~{item.serves_approx}</Text> : null}
              <View style={[styles.statusBadge, item.status === "completed" ? styles.statusCompleted : item.status === "matched" ? styles.statusMatched : styles.statusOpen]}>
                <Text style={[styles.statusText, item.status === "completed" ? styles.statusTextCompleted : item.status === "matched" ? styles.statusTextMatched : styles.statusTextOpen]}>
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
          ListEmptyComponent={loadingClaimed ? <ActivityIndicator style={{marginTop:60}} color={GREEN} size="large" /> : <Text style={styles.empty}>No claimed listings yet.</Text>}
          renderItem={({ item }) => {
            const match = item.matches?.[0];
            const npName = match?.nonprofit_name || "Nonprofit";
            const npId = match?.nonprofit_id;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{item.title}</Text>
                  {npId ? (
                    <ReportBlockMenu
                      listingId={item.id}
                      targetOrganizationId={npId}
                      targetOrganizationName={npName}
                      onBlocked={onBlockedOrg}
                    />
                  ) : null}
                </View>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.photo} />
                ) : null}
                <Text style={styles.cardMeta}>📍 {item.pickup_address || "No address"}</Text>
                <Text style={styles.cardMeta}>🕐 {formatPickup(item.pickup_start || "", item.pickup_end || "")}</Text>
                {item.quantity_kg ? <Text style={styles.cardMeta}>⚖️ {formatLbs(item.quantity_kg)}</Text> : null}
                {item.serves_approx ? <Text style={styles.cardMeta}>👥 Serves ~{item.serves_approx}</Text> : null}
                <View style={[styles.statusBadge, styles.statusMatched]}>
                  <Text style={[styles.statusText, styles.statusTextMatched]}>
                    🔔 Claimed by {npName}
                  </Text>
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

const GREEN = "#1C5C38";
const AMBER = "#C8860A";
const DARK = "#111827";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  title: { fontSize: 20, fontWeight: "700" },
  titlePlenty: { color: DARK },
  titleLeft: { color: AMBER },
  accountLink: { fontSize: 14, color: GREEN, fontWeight: "600" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: AMBER },
  tabText: { fontSize: 13, color: "#999", fontWeight: "500" },
  tabTextActive: { color: DARK, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 60, color: "#999", fontSize: 16 },
  card: { backgroundColor: "#fff", margin: 12, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: "600", marginBottom: 6 },
  photo: { width: "100%", height: 160, borderRadius: 10, marginBottom: 8, backgroundColor: "#F3F4F6" },
  cardMeta: { fontSize: 13, color: "#666", marginTop: 4 },
  statusBadge: { marginTop: 10, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start" },
  statusMatched: { backgroundColor: "#FDF6E8" },
  statusCompleted: { backgroundColor: "#E8F5EE" },
  statusOpen: { backgroundColor: "#E8F5EE" },
  statusText: { fontSize: 13, fontWeight: "500" },
  statusTextMatched: { color: AMBER },
  statusTextCompleted: { color: GREEN },
  statusTextOpen: { color: GREEN },
  confirmBtn: { marginTop: 12, backgroundColor: GREEN, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  confirmBtnDisabled: { backgroundColor: "#a0a0a0" },
  confirmBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
