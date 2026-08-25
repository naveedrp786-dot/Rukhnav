import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";

import * as SplashScreen from "expo-splash-screen";

import {
  useColorScheme,
} from "react-native";

import {
  SafeAreaProvider,
} from "react-native-safe-area-context";

import {
  AnimatedSplashOverlay,
} from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme =
    useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={
          colorScheme === "dark"
            ? DarkTheme
            : DefaultTheme
        }
      >
        <AnimatedSplashOverlay />

        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen
            name="index"
          />

          <Stack.Screen
            name="shop"
          />

          <Stack.Screen
            name="account"
          />

          <Stack.Screen
            name="register"
          />

          <Stack.Screen
            name="verify"
          />

          <Stack.Screen
            name="forgot-password"
          />

          <Stack.Screen
            name="change-password"
          />

          <Stack.Screen
            name="edit-profile"
          />

          <Stack.Screen
            name="product/[id]"
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
