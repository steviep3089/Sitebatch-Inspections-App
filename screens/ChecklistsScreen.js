import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "../supabase";

const COLORS = {
  primaryBlue: "#1e88e5",
  accentGreen: "#2e7d32",
  surface: "#f7fbff",
  border: "#d4e6f7",
};

export default function ChecklistsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadChecklists();
    }
  }, [isFocused]);

  async function loadChecklists() {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      if (!userId) {
        setChecklists([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("inspection_checklists")
        .select(
          `
          id,
          status,
          due_date,
          inspections:inspection_id (
            id,
            asset_items (asset_id, name),
            inspection_types (name)
          )
        `
        )
        .eq("assigned_user_id", userId)
        .order("due_date", { ascending: true });

      if (error) {
        throw error;
      }

      setChecklists(data || []);
    } catch (error) {
      console.error("Error loading checklists:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading checklists...</Text>
        </View>
      ) : checklists.length === 0 ? (
        <Text style={styles.emptyText}>You have no assigned checklists.</Text>
      ) : (
        <FlatList
          data={checklists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("ChecklistDetail", { checklistId: item.id })}
            >
              <Text style={styles.cardTitle}>
                {item.inspections?.inspection_types?.name || "Inspection"}
              </Text>
              <Text style={styles.cardText}>
                Asset: {item.inspections?.asset_items?.asset_id || "N/A"}{" "}
                {item.inspections?.asset_items?.name
                  ? `(${item.inspections?.asset_items?.name})`
                  : ""}
              </Text>
              <Text style={styles.cardText}>
                Due: {item.due_date ? new Date(item.due_date).toLocaleDateString() : "N/A"}
              </Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>
                    {formatStatus(item.status)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
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
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 30,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primaryBlue,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    color: COLORS.primaryBlue,
  },
  cardText: {
    fontSize: 14,
    color: "#444",
    marginBottom: 4,
  },
  statusRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    fontSize: 12,
    color: "#556",
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
});

function formatStatus(status) {
  if (!status) return "unknown";
  if (status === "sent") return "received";
  if (status === "completed") return "complete";
  return status.replace(/_/g, " ");
}
