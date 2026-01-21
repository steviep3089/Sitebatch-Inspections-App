import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { supabase } from "../supabase";

export default function ResetPasswordScreen({ navigation }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    // Splash screen already waited, just verify session exists
    const { data: { session } } = await supabase.auth.getSession();
    console.log('ResetPassword session check:', session);
    
    if (session?.user) {
      console.log('Session ready for password update');
      setSessionReady(true);
    } else {
      Alert.alert(
        "Session Expired",
        "The password reset link has expired. Please request a new one.",
        [{ text: "OK", onPress: () => navigation.replace("Login") }]
      );
    }
    setLoading(false);
  }

  async function handleResetPassword() {
    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please fill in both password fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true, invited: false },
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "Password updated successfully", [
        {
          text: "OK",
          onPress: () => navigation.replace("Login"),
        },
      ]);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 20 }}>Loading...</Text>
      </View>
    );
  }

  if (!sessionReady) {
    return null;
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Reset Password</Text>

        <View style={styles.passwordRow}>
          <TextInput
            placeholder="New Password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            style={[styles.input, styles.passwordInput]}
          />
          <TouchableWithoutFeedback onPress={() => setShowPassword((prev) => !prev)}>
            <View style={styles.passwordToggle}>
              <Text style={styles.passwordToggleText}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </View>
          </TouchableWithoutFeedback>
        </View>

        <View style={styles.passwordRow}>
          <TextInput
            placeholder="Confirm Password"
            secureTextEntry={!showConfirm}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={[styles.input, styles.passwordInput]}
          />
          <TouchableWithoutFeedback onPress={() => setShowConfirm((prev) => !prev)}>
            <View style={styles.passwordToggle}>
              <Text style={styles.passwordToggleText}>
                {showConfirm ? "Hide" : "Show"}
              </Text>
            </View>
          </TouchableWithoutFeedback>
        </View>

        <Button title="Reset Password" onPress={handleResetPassword} />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 26,
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    marginBottom: 10,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  passwordToggle: {
    marginLeft: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  passwordToggleText: {
    color: "#007aff",
    fontSize: 14,
  },
});
