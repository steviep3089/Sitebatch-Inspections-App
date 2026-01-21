// App.js
import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from 'expo-linking';
import { supabase } from "./supabase";

import SplashScreen from "./screens/SplashScreen";
import LoginScreen from "./screens/LoginScreen";
import SignUpScreen from "./screens/SignUpScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import HomeScreen from "./screens/HomeScreen";
import ChecklistsScreen from "./screens/ChecklistsScreen";
import ChecklistDetailScreen from "./screens/ChecklistDetailScreen";
import NewDefectScreen from "./screens/NewDefectScreen";
import DefectListScreen from "./screens/DefectListScreen";
import DefectDetailsScreen from "./screens/DefectDetailsScreen";

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['inspectionsapp://'],
  config: {
    screens: {
      Login: 'login',
      ResetPassword: 'reset',
    },
  },
};

export default function App() {
  const navigationRef = useRef();

  useEffect(() => {
    const isInviteOrSignup = (url) =>
      url?.includes("type=invite") ||
      url?.includes("type=signup") ||
      url?.includes("from=invite") ||
      url?.includes("from=signup");

    // Check if app was opened with a recovery link
    const checkInitialURL = async () => {
      const url = await Linking.getInitialURL();
      console.log('Initial URL:', url);
      
      if (
        url?.includes('type=recovery') ||
        url?.includes('reset') ||
        isInviteOrSignup(url)
      ) {
        console.log('Recovery URL detected on app launch');
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          if (navigationRef.current?.isReady()) {
            navigationRef.current.navigate('ResetPassword');
          }
        }, 500);
      }
    };
    
    checkInitialURL();

    // Listen for deep link auth events
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery detected - navigating to reset');
        // Navigate to reset password screen with delay for navigation readiness
        setTimeout(() => {
          if (navigationRef.current?.isReady()) {
            navigationRef.current.navigate('ResetPassword');
          }
        }, 100);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user?.invited_at) {
        supabase.auth.getUser().then(({ data }) => {
          const needsReset =
            data?.user?.user_metadata?.password_set !== true &&
            data?.user?.invited_at;
          if (!needsReset) {
            return;
          }
          console.log('Invite sign-in detected - navigating to reset');
          setTimeout(() => {
            if (navigationRef.current?.isReady()) {
              navigationRef.current.navigate('ResetPassword');
            }
          }, 100);
        });
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <NavigationContainer 
      ref={navigationRef} 
      linking={linking}
      onReady={() => console.log('Navigation ready')}
    >
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerTitleAlign: "center" }}
      >
        {/* SPLASH */}
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />

        {/* AUTH */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "Login" }}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ title: "Sign Up" }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ title: "Reset Password" }}
        />

        {/* HOME */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Inspections App" }}
        />

        <Stack.Screen
          name="Checklists"
          component={ChecklistsScreen}
          options={{ title: "Current Checklists" }}
        />
        <Stack.Screen
          name="ChecklistDetail"
          component={ChecklistDetailScreen}
          options={{ title: "Checklist" }}
        />

        {/* DEFECT FLOWS */}
        <Stack.Screen
          name="NewDefect"
          component={NewDefectScreen}
          options={{ title: "New Defect" }}
        />

        {/* 🔹 THIS NAME MUST MATCH YOUR navigation.navigate TARGET 🔹 */}
        <Stack.Screen
          name="DefectList"
          component={DefectListScreen}
          options={{ title: "All Defects" }}
        />

        <Stack.Screen
          name="DefectDetails"
          component={DefectDetailsScreen}
          options={{ title: "Defect Details" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
