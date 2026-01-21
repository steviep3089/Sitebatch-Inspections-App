import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../supabase";

const COLORS = {
  primaryBlue: "#1e88e5",
  accentGreen: "#2e7d32",
  muted: "#6b7280",
  surface: "#f7fbff",
  border: "#d4e6f7",
};

const STATUS_OPTIONS = [
  { label: "Not checked", value: "not_checked" },
  { label: "Inspected", value: "inspected" },
  { label: "Not available", value: "not_available" },
  { label: "Defective", value: "defective" },
];

export default function ChecklistDetailScreen({ route, navigation }) {
  const { checklistId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState(null);
  const [items, setItems] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [selectedAdmins, setSelectedAdmins] = useState([]);
  const isLocked = checklist?.status === "completed";

  useEffect(() => {
    if (!checklistId) {
      navigation.goBack();
      return;
    }
    loadChecklist();
  }, [checklistId]);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadChecklist() {
    setLoading(true);
    try {
      const { data: checklistData, error: checklistError } = await supabase
        .from("inspection_checklists")
        .select(
          `
          id,
          status,
          due_date,
          inspections:inspection_id (
            id,
            asset_items (asset_id, name, location),
            inspection_types (name)
          )
        `
        )
        .eq("id", checklistId)
        .single();

      if (checklistError) {
        throw checklistError;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("inspection_checklist_items")
        .select("id, label, status, comments, sort_order")
        .eq("checklist_id", checklistId)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        throw itemsError;
      }

      setChecklist(checklistData);
      setItems(
        (itemsData || []).map((item) => ({
          ...item,
          status: item.status || "not_checked",
          comments: item.comments || "",
        }))
      );
    } catch (error) {
      console.error("Error loading checklist:", error);
      Alert.alert("Error", "Unable to load checklist.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAdmins() {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, role")
        .eq("role", "admin")
        .order("email", { ascending: true });

      if (error) {
        throw error;
      }

      const adminList = data || [];
      setAdmins(adminList);
      setSelectedAdmins([]);
    } catch (error) {
      console.error("Error loading admins:", error);
      setAdmins([]);
      setSelectedAdmins([]);
    }
  }

  function toggleAdmin(id) {
    setSelectedAdmins((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function handleSave() {
    if (isLocked) {
      Alert.alert("Checklist Complete", "This checklist is already complete.");
      return;
    }

    if (items.length === 0) {
      navigation.goBack();
      return;
    }

    const incomplete = items.filter(
      (item) => !item.status || item.status === "not_checked"
    );

    if (incomplete.length > 0) {
      Alert.alert(
        "Complete All Items",
        "All items must be categorised before the checklist can be completed."
      );
      return;
    }

    const itemsMissingComments = items.filter(
      (item) =>
        (item.status === "defective" || item.status === "not_available") &&
        (!item.comments || !item.comments.trim())
    );

    if (itemsMissingComments.length > 0) {
      Alert.alert(
        "Comments Required",
        "Please add comments for all Defective or Not available items."
      );
      return;
    }

    const hasIssues = items.some(
      (item) => item.status === "defective" || item.status === "not_available"
    );

    if (hasIssues && selectedAdmins.length === 0) {
      Alert.alert(
        "Select Admins",
        "Please select at least one admin to notify about checklist issues."
      );
      return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;

      for (const item of items) {
        const { error: itemError } = await supabase
          .from("inspection_checklist_items")
          .update({
            status: item.status || "not_checked",
            comments: item.comments || null,
          })
          .eq("id", item.id);

        if (itemError) {
          throw itemError;
        }
      }

      if (hasIssues) {
        const { data: alertData, error: alertError } = await supabase.functions.invoke(
          "send-checklist-issue-alert",
          {
            body: {
              checklist_id: checklistId,
              admin_ids: selectedAdmins,
            },
          }
        );

        if (alertError) {
          console.error("Checklist alert function error:", {
            message: alertError.message,
            context: alertError.context,
          });
          throw alertError;
        }

        if (alertData?.error) {
          console.error("Checklist alert function response error:", alertData.error);
          throw new Error(alertData.error);
        }
      }

      const { error: checklistError } = await supabase
        .from("inspection_checklists")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", checklistId);

      if (checklistError) {
        throw checklistError;
      }

      const inspectionId = checklist?.inspections?.id || null;
      if (inspectionId) {
        const { error: logError } = await supabase
          .from("inspection_logs")
          .insert({
            inspection_id: inspectionId,
            action: hasIssues ? "checklist_completed_with_issues" : "checklist_completed",
            details: hasIssues
              ? `Checklist ${checklistId} completed with issues`
              : `Checklist ${checklistId} completed`,
            created_by: userId,
          });

        if (logError) {
          console.warn("Unable to log checklist completion:", logError.message);
        }
      }

      Alert.alert("Saved", "Checklist saved and marked as completed.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error saving checklist:", error);
      Alert.alert("Error", error.message || "Unable to save checklist.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading checklist...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Complete Checklist</Text>
      {checklist && (
        <>
          <Text style={styles.subtitle}>
            {checklist.inspections?.inspection_types?.name || "Inspection"}{" "}
            {checklist.inspections?.asset_items?.asset_id
              ? `- ${checklist.inspections.asset_items.asset_id}`
              : ""}
          </Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                {formatStatus(checklist.status)}
              </Text>
            </View>
          </View>
        </>
      )}

      {isLocked && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>Checklist complete. Editing is locked.</Text>
        </View>
      )}

      {items.length === 0 ? (
        <Text style={styles.emptyText}>No items found for this checklist.</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={item.status || "not_checked"}
                onValueChange={(value) => updateItem(item.id, "status", value)}
                enabled={!isLocked}
              >
                {STATUS_OPTIONS.map((option) => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Picker>
            </View>
            <TextInput
              value={item.comments || ""}
              onChangeText={(value) => updateItem(item.id, "comments", value)}
              placeholder="Comments"
              style={styles.commentInput}
              editable={!isLocked}
            />
          </View>
        ))
      )}

      {!isLocked &&
        items.some((item) => item.status === "defective" || item.status === "not_available") && (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Notify Admins</Text>
            <Text style={styles.alertText}>
              This checklist has issues that require attention. Select the admins to notify.
            </Text>
            {admins.length === 0 ? (
              <Text style={styles.alertText}>No admins found.</Text>
            ) : (
              admins.map((admin) => {
                const selected = selectedAdmins.includes(admin.id);
                return (
                  <TouchableOpacity
                    key={admin.id}
                    style={styles.adminRow}
                    onPress={() => toggleAdmin(admin.id)}
                  >
                    <View style={styles.checkbox}>
                      {selected && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={styles.adminEmail}>{admin.email}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

      <TouchableOpacity
        style={[
          styles.saveButton,
          (saving || isLocked) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={saving || isLocked}
      >
        <Text style={styles.saveButtonText}>
          {isLocked ? "Completed" : saving ? "Saving..." : "Save & Mark Complete"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#fff",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#555",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    color: COLORS.primaryBlue,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statusPill: {
    backgroundColor: "#e8f5e9",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.accentGreen,
    textTransform: "capitalize",
  },
  lockedBanner: {
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  lockedText: {
    color: COLORS.primaryBlue,
    fontWeight: "600",
  },
  alertBox: {
    backgroundColor: "#e8f5e9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.accentGreen,
    marginBottom: 4,
  },
  alertText: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 8,
  },
  adminRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.accentGreen,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxTick: {
    color: COLORS.accentGreen,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 14,
  },
  adminEmail: {
    fontSize: 13,
    color: "#222",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    marginTop: 20,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    color: COLORS.primaryBlue,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
  },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  saveButton: {
    backgroundColor: COLORS.primaryBlue,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 30,
  },
  saveButtonDisabled: {
    backgroundColor: "#9bbce3",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

function formatStatus(status) {
  if (!status) return "unknown";
  if (status === "sent") return "received";
  if (status === "completed") return "complete";
  return status.replace(/_/g, " ");
}
