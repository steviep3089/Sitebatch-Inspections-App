// screens/SplashScreen.js
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from "react-native";
import { supabase } from "../supabase";
import * as Linking from 'expo-linking';

export default function SplashScreen({ navigation }) {
  // Animated value for spin
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Infinite spin loop
    const spinLoop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    spinLoop.start();

    // Check for password recovery
    const checkSession = async () => {
      // First check if URL contains recovery token
      const url = await Linking.getInitialURL();
      console.log('Splash screen initial URL:', url);
      
      if (
        url?.includes('access_token') ||
        url?.includes('type=recovery') ||
        url?.includes('type=invite') ||
        url?.includes('type=signup') ||
        url?.includes('from=invite') ||
        url?.includes('from=signup')
      ) {
        console.log('Recovery URL detected, extracting tokens...');
        
        // Extract tokens from URL hash/query
        const urlParts = url.split('#')[1] || url.split('?')[1] || '';
        const params = new URLSearchParams(urlParts);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        console.log('Tokens found:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken });
        
        if (accessToken && refreshToken) {
          // Manually set the session with the tokens from URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Error setting session:', error);
          } else {
            console.log('Session set successfully, navigating to reset');
            navigation.replace("ResetPassword");
            return;
          }
        } else {
          console.log('No tokens in URL, token may be expired');
        }
      }

      // Check session for recovery mode
      const { data: { session } } = await supabase.auth.getSession();
      const { data: userData } = await supabase.auth.getUser();
      
      if (session && session.user) {
        const currentUser = userData?.user || session.user;
        console.log('Session found:', currentUser.email);
        const needsReset =
          currentUser.recovery_sent_at ||
          (currentUser.invited_at && currentUser.user_metadata?.password_set !== true);
        if (needsReset) {
          console.log('Recovery/invite session detected');
          navigation.replace("ResetPassword");
          return;
        }
      }
      
      // Normal flow
      setTimeout(() => {
        navigation.replace("Login");
      }, 2000);
    };

    checkSession();

    return () => {
      spinLoop.stop();
    };
  }, [navigation, spinValue]);

  // Turn 0→1 into 0deg→360deg
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../assets/sitebatch-logo.png")}
        style={[styles.logo, { transform: [{ rotate: spin }] }]}
        resizeMode="contain"
      />
      <Text style={styles.brand}>Sitebatch Technologies</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 20,
  },
  brand: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
