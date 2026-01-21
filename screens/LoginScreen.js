import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    loadRememberedLogin();
    checkForRecovery();
  }, []);

  async function checkForRecovery() {
    // Check if there's a recovery session immediately
    const { data: { session } } = await supabase.auth.getSession();
    const { data: userData } = await supabase.auth.getUser();
    
    if (session?.user) {
      const currentUser = userData?.user || session.user;
      console.log('Session found on login:', session);
      console.log('User meta:', currentUser);
      
      // Check if this is a recovery token by looking at session metadata
      // Recovery sessions have different properties
      const isRecovery =
        currentUser.aud === 'authenticated' &&
        (currentUser.recovery_sent_at ||
          (currentUser.invited_at && currentUser.user_metadata?.password_set !== true));
      
      if (isRecovery) {
        console.log('Recovery session detected - navigating to reset');
        navigation.replace('ResetPassword');
        return;
      }
      
    }
    
    // Subscribe to future auth changes
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth event on login screen:', event);
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event - navigating');
        navigation.replace('ResetPassword');
        return;
      }

      if (
        event === 'SIGNED_IN' &&
        newSession?.user?.invited_at
      ) {
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user?.user_metadata?.password_set !== true) {
            console.log('Invite sign-in detected - navigating');
            navigation.replace('ResetPassword');
          }
        });
      }
    });
    
    return () => {
      data?.subscription?.unsubscribe();
    };
  }

  async function loadRememberedLogin() {
    const savedEmail = await AsyncStorage.getItem("savedEmail");
    const savedPassword = await AsyncStorage.getItem("savedPassword");

    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRemember(true);
    }
  }

  async function rememberLogin() {
    if (remember) {
      await AsyncStorage.setItem("savedEmail", email);
      await AsyncStorage.setItem("savedPassword", password);
    } else {
      await AsyncStorage.removeItem("savedEmail");
      await AsyncStorage.removeItem("savedPassword");
    }
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      await rememberLogin();
      navigation.replace("Home");
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      alert("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "inspectionsapp://",
    });

    if (error) {
      alert(error.message);
    } else {
      Alert.alert(
        "Email Sent",
        "Password reset email sent. Check your email and click the link. The app will now close.",
        [
          {
            text: "OK",
            onPress: () => {
              // Close the app so it starts fresh when email link is clicked
              if (Platform.OS === 'android') {
                BackHandler.exitApp();
              }
            }
          }
        ]
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Logo */}
        <Animated.View style={{ opacity: logoOpacity, alignItems: "center" }}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Text style={styles.title}>Login</Text>

        {/* Email */}
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
        />

        {/* Password */}
        <View style={styles.passwordRow}>
          <TextInput
            placeholder="Password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            style={[styles.input, styles.passwordInput]}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.passwordToggle}
          >
            <Text style={styles.passwordToggleText}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Remember Me */}
        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRemember(!remember)}
        >
          <View style={[styles.checkbox, remember && styles.checkboxChecked]} />
          <Text style={styles.rememberText}>Remember me</Text>
        </TouchableOpacity>

        {/* Forgot Password */}
        <TouchableOpacity onPress={forgotPassword}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign In */}
        <TouchableOpacity style={styles.button} onPress={signIn}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        {/* Contact admin message */}
        <Text style={styles.contactText}>
          Need an account? Contact your administrator.
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------
// Styles
// ---------------------
const styles = StyleSheet.create({
  container: {
    padding: 25,
    paddingTop: 60,
  },

  logo: {
    width: 180,
    height: 180,
    marginBottom: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 25,
  },

  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#555",
    marginRight: 10,
    borderRadius: 4,
  },

  checkboxChecked: {
    backgroundColor: "#007aff",
    borderColor: "#007aff",
  },

  rememberText: {
    fontSize: 16,
  },

  forgotText: {
    marginTop: 5,
    marginBottom: 20,
    color: "#007aff",
    textAlign: "right",
    fontSize: 16,
  },

  button: {
    backgroundColor: "#007aff",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },

  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },

  contactText: {
    marginTop: 20,
    color: "#666",
    textAlign: "center",
    fontSize: 14,
  },
});
