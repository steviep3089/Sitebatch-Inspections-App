// screens/HomeScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "../supabase";

export default function HomeScreen({ navigation }) {
  const [checklistCount, setChecklistCount] = useState(0);
  const [countLoading, setCountLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadChecklistCount();
    }
  }, [isFocused]);

  async function loadChecklistCount() {
    setCountLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      if (!userId) {
        setChecklistCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("inspection_checklists")
        .select("id", { count: "exact", head: true })
        .eq("assigned_user_id", userId)
        .neq("status", "completed");

      if (error) {
        throw error;
      }

      setChecklistCount(count || 0);
    } catch (error) {
      console.error("Error loading checklist count:", error);
      setChecklistCount(0);
    } finally {
      setCountLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inspections App</Text>

      {/* App logo */}
      <Image
        source={require("../assets/sitebatch-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.welcome}>Welcome to the Inspections App</Text>

      <TouchableOpacity
        style={styles.buttonPrimary}
        onPress={() => navigation.navigate("Checklists")}
      >
        <Text style={styles.buttonPrimaryText}>View Current Checklists</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeBell}>🔔</Text>
          <Text style={styles.badgeCount}>
            {countLoading ? "…" : checklistCount}
          </Text>
        </View>
      </TouchableOpacity>

      {/* SIGN OUT */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* VERSION */}
      <Text style={styles.versionText}>v2.1</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 30,
  },
  logo: {
    width: 260,
    height: 120,
    marginBottom: 30,
  },
  welcome: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 40,
  },
  buttonPrimary: {
    backgroundColor: "#007aff",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 30,
    width: "80%",
    position: "relative",
  },
  buttonPrimaryText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  badge: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "#d32f2f",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeBell: {
    color: "#fff",
    fontSize: 12,
    marginRight: 4,
  },
  badgeCount: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  signOutButton: {
    marginTop: 20,
  },
  signOutText: {
    color: "red",
    fontSize: 18,
    fontWeight: "600",
  },
  versionText: {
    position: "absolute",
    bottom: 20,
    color: "#999",
    fontSize: 12,
  },
});
