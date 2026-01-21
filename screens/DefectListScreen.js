import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { supabase } from "../supabase";
import { useIsFocused } from "@react-navigation/native";

// Status colours for badges
const STATUS_COLORS = {
  Reported: "#ff4d4d",
  "In Progress": "#ffa31a",
  Completed: "#28a745",

  // fallback if old entries say "Open"
  Open: "#ff4d4d",
};

export default function DefectListScreen({ navigation }) {
  const [defects, setDefects] = useState([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    loadDefects();
  }, [isFocused]); // reload list whenever screen becomes active

  async function loadDefects() {
    const { data, error } = await supabase
      .from("defects")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setDefects(data);
  }

  function renderItem({ item }) {
    const status = item.status || "Reported";
    const color = STATUS_COLORS[status] || "#999";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("DefectDetails", { defect: item })}
      >
        {/* TOP ROW: Asset + Status badge */}
        <View style={styles.row}>
          <Text style={styles.asset}>{item.asset}</Text>

          <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>

        <Text style={styles.title}>{item.title}</Text>

        {/* Category */}
        <Text style={styles.category}>Category: {item.category}</Text>

        {/* Priority */}
        <Text style={styles.priority}>Priority: {item.priority}</Text>

        {/* Date */}
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={defects}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
      />
    </View>
  );
}

// -------------------------
// STYLES
// -------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    padding: 15,
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  asset: {
    fontSize: 20,
    fontWeight: "bold",
  },

  title: {
    fontSize: 16,
    marginTop: 4,
    marginBottom: 4,
  },

  category: {
    fontSize: 14,
    color: "#444",
    marginBottom: 4,
  },

  priority: {
    fontSize: 14,
    color: "#333",
  },

  date: {
    marginTop: 6,
    color: "#666",
    fontSize: 12,
  },

  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },

  statusText: {
    color: "white",
    fontWeight: "700",
    fontSize: 12,
  },
});
