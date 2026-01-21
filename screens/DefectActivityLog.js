// screens/DefectActivityLog.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { supabase } from "../supabase";

export default function DefectActivityLog({ defectId }) {
  const [logs, setLogs] = useState([]);

  async function loadLogs() {
    const { data, error } = await supabase
      .from("defect_activity")
      .select("*")
      .eq("defect_id", defectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("loadLogs error:", error.message);
      return;
    }

    setLogs(data || []);
  }

  useEffect(() => {
    loadLogs();
  }, [defectId]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Recent Activity</Text>

      {logs.length === 0 ? (
        <Text style={styles.empty}>No activity yet.</Text>
      ) : (
        <ScrollView>
          {logs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <Text style={styles.message}>{log.message}</Text>
              <Text style={styles.meta}>
                {new Date(log.created_at).toLocaleString()} —{" "}
                {log.submitted_by || "Unknown"}
                {log.locked ? " (Locked)" : ""}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    backgroundColor: "#f8f8f8",
  },
  header: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  empty: {
    color: "#777",
    fontStyle: "italic",
  },
  logItem: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  message: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
});
