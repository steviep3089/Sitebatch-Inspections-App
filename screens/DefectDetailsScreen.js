// screens/DefectDetailsScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Button,
  Alert,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../supabase";
import DefectActivityLog from "./DefectActivityLog";

// Status styles
const STATUS_STYLES = {
  Reported: { color: "#ff4d4d", text: "Reported" },
  "In Progress": { color: "#ffa31a", text: "In Progress" },
  Completed: { color: "#28a745", text: "Completed" },
};

export default function DefectDetailsScreen({ route, navigation }) {
  const { defect } = route.params;

  const [currentDefect, setCurrentDefect] = useState(defect);

  // Local status + lock state (what the user is currently seeing/editing)
  const [localStatus, setLocalStatus] = useState(defect.status || "Reported");
  const [locked, setLocked] = useState(!!defect.locked);

  const [actionsTaken, setActionsTaken] = useState(defect.actions_taken || "");
  const [repairCompany, setRepairCompany] = useState(
    defect.repair_company || ""
  );
  const [repairPhotos, setRepairPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---------------- LOAD DEFECT FROM DB ----------------
  async function loadDefect(afterUpdate = false) {
    const { data, error } = await supabase
      .from("defects")
      .select("*")
      .eq("id", defect.id)
      .single();

    if (error) {
      console.log("loadDefect error:", error.message);
      return;
    }

    setCurrentDefect(data);

    if (afterUpdate) {
      setLocalStatus(data.status || "Reported");
      setLocked(!!data.locked);
      setActionsTaken(data.actions_taken || "");
      setRepairCompany(data.repair_company || "");
    }
  }

  useEffect(() => {
    loadDefect(false);
  }, []);

  // ---------------- ACTIVITY LOG ENTRY (ONLY ON UPDATE) ----------------
  async function logActivity(message) {
    try {
      const { data: auth } = await supabase.auth.getUser();

      const { error } = await supabase.from("defect_activity").insert({
        defect_id: currentDefect.id,
        message,
        performed_by: auth?.user?.email ?? "Unknown",
      });

      if (error) {
        console.log("logActivity error:", error.message);
      }
    } catch (err) {
      console.log("logActivity exception:", err.message);
    }
  }

  // Helper: if still reported and user starts doing work, bump to In Progress
  // (UI only, no log – log happens when Update Defect is pressed)
  function bumpToInProgressIfReported() {
    if (!locked && localStatus === "Reported") {
      setLocalStatus("In Progress");
    }
  }

  // ---------------- STATUS CYCLE (BEFORE SAVE, NO LOGGING) ----------------
  function cycleStatusBeforeSave() {
    if (locked) {
      Alert.alert("Completed", "This defect is completed and cannot be changed.");
      return;
    }

    if (localStatus === "Reported") {
      setLocalStatus("In Progress");
    } else if (localStatus === "In Progress") {
      setLocalStatus("Completed");
    } else if (localStatus === "Completed") {
      // BEFORE Update Defect, green can go back to orange
      setLocalStatus("In Progress");
    }
  }

  // ---------------- IMAGE PICKING ----------------
  async function pickRepairPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("Photo access needed.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: Platform.OS === "ios",
      quality: 0.7,
    });

    if (!result.canceled) {
      setRepairPhotos((prev) => [...prev, result.assets[0].uri]);
      bumpToInProgressIfReported();
    }
  }

  async function takeRepairPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alert("Camera access needed.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: Platform.OS === "ios",
      quality: 0.7,
    });

    if (!result.canceled) {
      setRepairPhotos((prev) => [...prev, result.assets[0].uri]);
      bumpToInProgressIfReported();
    }
  }

  // ---------------- UPLOAD REPAIR PHOTOS ----------------
  async function uploadRepairPhotos(defectId) {
    const uploaded = [];

    for (let i = 0; i < repairPhotos.length; i++) {
      const uri = repairPhotos[i];
      const fileName = `${defectId}_repair_${Date.now()}_${i}.jpg`;

      try {
        const res = await fetch(uri);
        const blob = await res.blob();

        // Check if blob has content
        if (!blob || blob.size === 0) {
          console.error(`Repair photo blob is empty for photo ${i}, skipping`);
          continue;
        }

        console.log(`Uploading repair photo ${fileName}, size: ${blob.size} bytes`);

        // Convert blob to ArrayBuffer for React Native compatibility
        const arrayBuffer = await new Response(blob).arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);

        const { error } = await supabase.storage
          .from("repair-photos")
          .upload(fileName, fileData, { contentType: "image/jpeg" });

        if (error) {
          console.error("Repair photo upload error:", error);
          // Skip this photo if upload fails
        } else {
          const { data: signed } = await supabase.storage
            .from("repair-photos")
            .createSignedUrl(fileName, 60 * 60 * 24 * 365);

          if (signed?.signedUrl) {
            uploaded.push(signed.signedUrl);
          }
        }
      } catch (err) {
        console.error(`Failed to upload repair photo ${i}:`, err);
      }
    }

    return uploaded;
  }

  // ---------------- UPDATE DEFECT (SAVE + LOG) ----------------
  async function updateDefect() {
    setLoading(true);

    // Lock only if we are saving as Completed
    const finalLocked = locked || localStatus === "Completed";

    let uploadedRepairUrls = [];
    if (repairPhotos.length > 0) {
      uploadedRepairUrls = await uploadRepairPhotos(currentDefect.id);
    }

    // Merge existing repair photos with new ones
    const existingRepairPhotos = Array.isArray(currentDefect.repair_photos) 
      ? currentDefect.repair_photos 
      : [];
    const allRepairPhotos = [...existingRepairPhotos, ...uploadedRepairUrls];

    // Set closed_out timestamp when completing
    const closedOut = finalLocked && !currentDefect.closed_out 
      ? new Date().toISOString() 
      : currentDefect.closed_out;

    const updates = {
      status: localStatus,
      actions_taken: actionsTaken,
      repair_company: repairCompany,
      repair_photos: allRepairPhotos,
      locked: finalLocked,
      closed_out: closedOut,
    };

    const { error } = await supabase
      .from("defects")
      .update(updates)
      .eq("id", currentDefect.id);

    if (error) {
      Alert.alert("Error", error.message);
      setLoading(false);
      return;
    }

    setLocked(finalLocked);

    const previousStatus = currentDefect.status || "Reported";
    const nextActions = (actionsTaken || "").trim();
    const previousActions = (currentDefect.actions_taken || "").trim();
    const previousRepairCompany = currentDefect.repair_company || "";
    const nextRepairCompany = repairCompany || "";
    const updateMessages = [];

    if (localStatus !== previousStatus) {
      updateMessages.push(
        `Status changed from "${previousStatus}" to "${localStatus}"`
      );
    }
    if (nextActions !== previousActions) {
      if (nextActions) {
        updateMessages.push(`Actions updated: ${nextActions}`);
      } else {
        updateMessages.push("Actions cleared");
      }
    }
    if (nextRepairCompany !== previousRepairCompany) {
      if (nextRepairCompany) {
        updateMessages.push(`Repair company set to "${nextRepairCompany}"`);
      } else {
        updateMessages.push("Repair company cleared");
      }
    }
    if (uploadedRepairUrls.length > 0) {
      updateMessages.push(
        `Added ${uploadedRepairUrls.length} repair photo${
          uploadedRepairUrls.length > 1 ? "s" : ""
        }`
      );
    }

    const message =
      updateMessages.length > 0
        ? updateMessages.join("; ")
        : "Defect saved via Mobile App";

    // Single log entry WHEN we save
    await logActivity(message);

    setLoading(false);
    Alert.alert("Success", "Defect updated.", [
      {
        text: "OK",
        onPress: () => navigation.goBack()
      }
    ]);
  }

  const statusStyle = STATUS_STYLES[localStatus] || STATUS_STYLES.Reported;

  // ---------------- UI ----------------
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header row with small lock icon */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.asset}>{currentDefect.asset}</Text>
          <Text style={styles.title}>{currentDefect.title}</Text>
          <Text style={styles.description}>{currentDefect.description}</Text>
        </View>
        <View style={styles.lockIconContainer}>
          <Text style={styles.lockIcon}>{locked ? "🔒" : "🔓"}</Text>
        </View>
      </View>

      {/* Submitted info */}
      <Text style={styles.meta}>
        Submitted: {new Date(currentDefect.created_at).toLocaleString()}
      </Text>
      <Text style={styles.meta}>By: {currentDefect.submitted_by}</Text>

      {/* STATUS BUTTON */}
      <Text style={styles.sectionTitle}>Status</Text>
      <TouchableOpacity
        onPress={cycleStatusBeforeSave}
        style={[
          styles.statusButton,
          { backgroundColor: statusStyle.color },
        ]}
      >
        <Text style={styles.statusButtonText}>{statusStyle.text}</Text>
      </TouchableOpacity>

      {/* ACTIONS TAKEN */}
      <Text style={styles.sectionTitle}>Actions Taken</Text>
      <TextInput
        multiline
        placeholder="Describe repair actions..."
        value={actionsTaken}
        onChangeText={(text) => {
          setActionsTaken(text);
          if (text.trim().length > 0) bumpToInProgressIfReported();
        }}
        style={styles.input}
      />

      {/* REPAIR COMPANY / PERSON */}
      <Text style={styles.sectionTitle}>Repair Company / Person</Text>
      <TextInput
        placeholder="Who repaired this defect?"
        value={repairCompany}
        onChangeText={(text) => {
          setRepairCompany(text);
          if (text.trim().length > 0) bumpToInProgressIfReported();
        }}
        style={styles.input}
      />

      {/* REPAIR PHOTOS */}
      <Text style={styles.sectionTitle}>Repair Photos</Text>
      <View style={styles.photoButtonsRow}>
        <TouchableOpacity style={styles.photoButton} onPress={pickRepairPhoto}>
          <Text>📁 Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoButton} onPress={takeRepairPhoto}>
          <Text>📷 Camera</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal>
        {repairPhotos.map((uri, i) => (
          <Image key={i} source={{ uri }} style={styles.photo} />
        ))}
      </ScrollView>

      {/* UPDATE BUTTON */}
      <View style={{ marginVertical: 20 }}>
        <Button
          title={loading ? "Updating..." : "Update Defect"}
          onPress={updateDefect}
          disabled={loading}
        />
      </View>

      {/* ACTIVITY LOG */}
      <DefectActivityLog defectId={currentDefect.id} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  lockIconContainer: {
    marginLeft: 10,
    alignItems: "flex-end",
  },
  lockIcon: {
    fontSize: 26,
  },

  asset: { fontSize: 26, fontWeight: "bold", marginBottom: 5 },
  title: { fontSize: 22, marginBottom: 2 },
  description: { fontSize: 16, marginBottom: 10 },
  meta: { color: "#555", marginBottom: 3 },

  sectionTitle: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },

  statusButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  statusButtonText: { color: "white", fontSize: 18, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    marginBottom: 15,
  },

  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 10,
    marginBottom: 10,
  },
  photoButtonsRow: { flexDirection: "row", marginBottom: 10 },
  photoButton: {
    padding: 10,
    backgroundColor: "#eee",
    borderRadius: 8,
    marginRight: 10,
  },
});
