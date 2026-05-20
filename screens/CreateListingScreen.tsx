import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { kgToLbs, lbsToKg } from "../lib/units";
import DateTimePicker from "@react-native-community/datetimepicker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FoodAnalysis {
  food_types: string[];
  quantity_kg: number;
  serves_approx: number;
  dietary_flags: string[];
  notes: string;
}

interface ListingForm {
  title: string;
  food_types: string[];
  quantity_kg: string;
  serves_approx: string;
  dietary_flags: string[];
  pickup_address: string;
  pickup_start: string;
  pickup_end: string;
  notes: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

const FOOD_TYPE_OPTIONS = [
  "sandwiches", "salads", "hot meals", "produce", "dairy",
  "bakery", "snacks", "beverages", "desserts", "prepared food",
];

const DIETARY_OPTIONS = [
  "vegetarian", "vegan", "halal", "kosher", "gluten-free",
  "nut-free", "dairy-free",
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function CreateListingScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const [form, setForm] = useState<ListingForm>({
    title: "",
    food_types: [],
    quantity_kg: "",
    serves_approx: "",
    dietary_flags: [],
    pickup_address: "",
    pickup_start: "",
    pickup_end: "",
    notes: "",
  });

  // ── Camera ────────────────────────────────────────────────────────────────

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Camera permission required", "Please enable camera access in Settings.");
        return;
      }
    }
    setShowCamera(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
    if (photo) {
      setShowCamera(false);
      setPhotoUri(photo.uri);
      analyzePhoto(photo.base64!);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ["images"],
  base64: true,
  quality: 0.7,
  exif: false,
  allowsEditing: false,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      analyzePhoto(result.assets[0].base64!, result.assets[0].mimeType || "image/jpeg");
    }
  };

  // ── Claude Vision ─────────────────────────────────────────────────────────

  const analyzePhoto = async (base64: string, mimeType: string = "image/jpeg") => {
    setAnalyzing(true);
    console.log('analyzePhoto called, base64 length:', base64?.length, 'mimeType:', mimeType);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: base64,
                  },
                },
                {
                  type: "text",
                  text: `You are analyzing leftover corporate catering food for a food redistribution app.

Look at this image and respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "food_types": ["array", "of", "food", "categories"],
  "quantity_kg": <estimated total weight in kg as a number — we display lbs in the app>,
  "serves_approx": <estimated number of people this could feed as a number>,
  "dietary_flags": ["any", "dietary", "flags", "you", "can", "identify"],
  "notes": "brief description of what you see",
  "title": "short catchy title like Office lunch — sandwiches & salads"
}

For food_types use categories like: sandwiches, salads, hot meals, produce, dairy, bakery, snacks, beverages, desserts, prepared food.
For dietary_flags use: vegetarian, vegan, halal, kosher, gluten-free, nut-free, dairy-free — only include ones you can reasonably identify.
Be conservative with quantity estimates. A typical office lunch for 20 people is about 22-33 lbs.`,
                },
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content[0].text.trim();
      const analysis: FoodAnalysis & { title: string } = JSON.parse(text);

      // Prefill the form
      setForm((prev) => ({
        ...prev,
        title: analysis.title || "",
        food_types: analysis.food_types || [],
        quantity_kg: analysis.quantity_kg
          ? String(Math.round(kgToLbs(analysis.quantity_kg) * 10) / 10)
          : "",
        serves_approx: String(analysis.serves_approx || ""),
        dietary_flags: analysis.dietary_flags || [],
        notes: analysis.notes || "",
      }));
    } catch (err) {
      Alert.alert("Analysis failed", "Couldn't analyze the photo. Please fill in the details manually.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Form Helpers ──────────────────────────────────────────────────────────

  const toggleChip = (value: string, field: "food_types" | "dietary_flags") => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.title || !form.quantity_kg || !form.pickup_address || !form.pickup_start || !form.pickup_end) {
      Alert.alert("Missing fields", "Please fill in title, quantity, address, and pickup window.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!userData) throw new Error(`No public.users row for auth id: ${user.id}`);

      // Upload photo if we have one
      let photoUrl: string | null = null;
      if (photoUri) {
        const ext = "jpg";
        const fileName = `listings/${Date.now()}.${ext}`;
        const blob = await (await fetch(photoUri)).blob();
        const { error: uploadError } = await supabase.storage
          .from("listing-photos")
          .upload(fileName, blob, { contentType: "image/jpeg" });
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("listing-photos")
            .getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from("listings").insert({
        organization_id: userData.organization_id,
        title: form.title,
        food_types: form.food_types,
        quantity_kg: lbsToKg(parseFloat(form.quantity_kg)),
        serves_approx: parseInt(form.serves_approx) || null,
        dietary_flags: form.dietary_flags,
        pickup_address: form.pickup_address,
        pickup_lat: null, // geocode in v2
        pickup_lng: null,
        pickup_start: new Date(form.pickup_start).toISOString(),
        pickup_end: new Date(form.pickup_end).toISOString(),
        status: "open",
        photo_url: photoUrl,
        notes: form.notes,
        expires_at: new Date(form.pickup_end).toISOString(),
      });

      if (error) throw error;

      Alert.alert("🎉 Listed!", "Your surplus food has been posted. We're finding the best match now.", [
        { text: "OK", onPress: () => setForm({ title: "", food_types: [], quantity_kg: "", serves_approx: "", dietary_flags: [], pickup_address: "", pickup_start: "", pickup_end: "", notes: "" }) },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Camera View ───────────────────────────────────────────────────────────

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraHint}>Point at the food spread</Text>
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCamera(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shutterBtn} onPress={takePhoto}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <View style={{ width: 64 }} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Main Form ─────────────────────────────────────────────────────────────

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content} enableOnAndroid extraScrollHeight={120}>
      <Text style={styles.heading}>Log surplus food</Text>

      {/* Photo section */}
      {photoUri ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: photoUri }} style={styles.photo} />
          {analyzing && (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.analyzingText}>Analyzing food...</Text>
            </View>
          )}
          <TouchableOpacity style={styles.retakeBtn} onPress={openCamera}>
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.cameraBtn} onPress={openCamera}>
            <Text style={styles.cameraBtnIcon}>📷</Text>
            <Text style={styles.cameraBtnText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.libraryBtn} onPress={pickFromLibrary}>
            <Text style={styles.libraryBtnText}>Choose from library</Text>
          </TouchableOpacity>
        </View>
      )}

      {analyzing && (
        <View style={styles.analyzingBanner}>
          <ActivityIndicator color="#22C55E" />
          <Text style={styles.analyzingBannerText}>Claude is analyzing your food...</Text>
        </View>
      )}

      {/* Title */}
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Office lunch — sandwiches & salads"
        value={form.title}
        onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
      />

      {/* Food types */}
      <Text style={styles.label}>Food types</Text>
      <View style={styles.chips}>
        {FOOD_TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, form.food_types.includes(opt) && styles.chipActive]}
            onPress={() => toggleChip(opt, "food_types")}
          >
            <Text style={[styles.chipText, form.food_types.includes(opt) && styles.chipTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quantity */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Quantity (lbs)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 33"
            keyboardType="decimal-pad"
            value={form.quantity_kg}
            onChangeText={(v) => setForm((p) => ({ ...p, quantity_kg: v }))}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Serves approx.</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 20"
            keyboardType="number-pad"
            value={form.serves_approx}
            onChangeText={(v) => setForm((p) => ({ ...p, serves_approx: v }))}
          />
        </View>
      </View>

      {/* Dietary flags */}
      <Text style={styles.label}>Dietary info</Text>
      <View style={styles.chips}>
        {DIETARY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, form.dietary_flags.includes(opt) && styles.chipActive]}
            onPress={() => toggleChip(opt, "dietary_flags")}
          >
            <Text style={[styles.chipText, form.dietary_flags.includes(opt) && styles.chipTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pickup address */}
      <Text style={styles.label}>Pickup address</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 350 Fifth Ave, lobby entrance"
        value={form.pickup_address}
        onChangeText={(v) => setForm((p) => ({ ...p, pickup_address: v }))}
      />

      {/* Pickup window */}
      <Text style={styles.label}>Pickup window</Text>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.sublabel}>From</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
            <Text style={{ color: form.pickup_start ? "#1a1a1a" : "#999", fontSize: 15 }}>
              {form.pickup_start ? new Date(form.pickup_start).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Select start"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.halfField}>
          <Text style={styles.sublabel}>To</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
            <Text style={{ color: form.pickup_end ? "#1a1a1a" : "#999", fontSize: 15 }}>
              {form.pickup_end ? new Date(form.pickup_end).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Select end"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {showStartPicker && (
        <DateTimePicker
          value={form.pickup_start ? new Date(form.pickup_start) : new Date()}
          mode="datetime"
          display="spinner"
          onChange={(_, date) => { setShowStartPicker(false); if (date) setForm((p) => ({ ...p, pickup_start: date.toISOString() })); }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={form.pickup_end ? new Date(form.pickup_end) : new Date()}
          mode="datetime"
          display="spinner"
          onChange={(_, date) => { setShowEndPicker(false); if (date) setForm((p) => ({ ...p, pickup_end: date.toISOString() })); }}
        />
      )}

      {/* Notes */}
      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="e.g. Ask for James at the front desk"
        value={form.notes}
        onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
        multiline
        numberOfLines={3}
      />

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Post listing →</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </KeyboardAwareScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#22C55E";
const DARK = "#111827";
const GRAY = "#6B7280";
const LIGHT = "#F3F4F6";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20 },
  heading: { fontSize: 26, fontWeight: "700", color: DARK, marginBottom: 20 },
  // Photo
  photoButtons: { flexDirection: "row", gap: 12, marginBottom: 24 },
  cameraBtn: {
    flex: 1, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 20,
    alignItems: "center", justifyContent: "center",
  },
  cameraBtnIcon: { fontSize: 28, marginBottom: 4 },
  cameraBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  libraryBtn: {
    flex: 1, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  libraryBtnText: { color: GRAY, fontWeight: "500", fontSize: 14 },
  photoContainer: { position: "relative", marginBottom: 24, borderRadius: 14, overflow: "hidden" },
  photo: { width: "100%", height: 220, borderRadius: 14 },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", gap: 10,
  },
  analyzingText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  retakeBtn: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  retakeBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  analyzingBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#F0FDF4", borderRadius: 10, padding: 14, marginBottom: 20,
  },
  analyzingBannerText: { color: "#15803D", fontWeight: "500" },

  // Form
  label: { fontSize: 14, fontWeight: "600", color: DARK, marginBottom: 8, marginTop: 16 },
  sublabel: { fontSize: 13, color: GRAY, marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: DARK,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1 },

  // Chips
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 13, color: GRAY, fontWeight: "500" },
  chipTextActive: { color: "#fff" },

  // Submit
  submitBtn: {
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 18,
    alignItems: "center", marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  // Camera
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1, justifyContent: "space-between",
    paddingTop: 60, paddingBottom: 50,
  },
  cameraHint: {
    textAlign: "center", color: "#fff", fontSize: 16, fontWeight: "500",
    backgroundColor: "rgba(0,0,0,0.4)", alignSelf: "center",
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
  },
  cameraControls: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 40,
  },
  cancelBtn: { width: 64, alignItems: "center" },
  cancelBtnText: { color: "#fff", fontSize: 16, fontWeight: "500" },
  shutterBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  shutterInner: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff",
    borderWidth: 2, borderColor: "#000",
  },
});
