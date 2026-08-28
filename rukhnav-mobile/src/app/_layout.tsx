import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  router,
  usePathname,
} from "expo-router";

import * as SplashScreen from "expo-splash-screen";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";

import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  AnimatedSplashOverlay,
} from "@/components/animated-icon";

import {
  WebsiteThemeProvider,
  useWebsiteTheme,
} from "../theme/website-theme";


SplashScreen.preventAutoHideAsync();


function GlobalBottomNav() {
  const theme =
    useWebsiteTheme();

  const insets =
    useSafeAreaInsets();

  const pathname =
    usePathname();

  const styles =
    createNavStyles(
      theme,
      insets.bottom
    );


  const homeActive =
    pathname === "/";

  const shopActive =
    pathname === "/shop" ||
    pathname.startsWith(
      "/product/"
    );

  const cartActive =
    pathname === "/cart";

  const wishlistActive =
    pathname === "/wishlist";

  const accountActive =
    pathname === "/account" ||
    pathname === "/rewards" ||
    pathname === "/edit-profile" ||
    pathname === "/change-password" ||
    pathname === "/register" ||
    pathname === "/verify" ||
    pathname === "/forgot-password";


  return (
    <View style={styles.bottomBar}>

      <Pressable
        style={styles.tab}
        onPress={() => {
          if (!homeActive) {
            router.push("/");
          }
        }}
      >
        <Text
          style={[
            styles.tabIcon,
            homeActive &&
              styles.activeIcon,
          ]}
        >
          ⌂
        </Text>

        <Text
          style={[
            styles.tabText,
            homeActive &&
              styles.activeText,
          ]}
        >
          Home
        </Text>
      </Pressable>


      <Pressable
        style={styles.tab}
        onPress={() => {
          if (
            pathname !== "/shop"
          ) {
            router.push(
              "/shop"
            );
          }
        }}
      >
        <Text
          style={[
            styles.tabIcon,
            shopActive &&
              styles.activeIcon,
          ]}
        >
          ◫
        </Text>

        <Text
          style={[
            styles.tabText,
            shopActive &&
              styles.activeText,
          ]}
        >
          Shop
        </Text>
      </Pressable>


      <Pressable
        style={styles.tab}
        onPress={() => {
          if (!cartActive) {
            router.push(
              "/cart"
            );
          }
        }}
      >
        <View
          style={[
            styles.cartCircle,
            cartActive &&
              styles.cartCircleActive,
          ]}
        >
          <Text
            style={
              styles.cartCircleText
            }
          >
            🛒
          </Text>
        </View>

        <Text
          style={[
            styles.tabText,
            cartActive &&
              styles.activeText,
          ]}
        >
          Cart
        </Text>
      </Pressable>


      <Pressable
        style={styles.tab}
        onPress={() => {
          if (!wishlistActive) {
            router.push(
              "/wishlist"
            );
          }
        }}
      >
        <Text
          style={[
            styles.tabIcon,
            wishlistActive &&
              styles.activeIcon,
          ]}
        >
          ♡
        </Text>

        <Text
          style={[
            styles.tabText,
            wishlistActive &&
              styles.activeText,
          ]}
        >
          Wishlist
        </Text>
      </Pressable>


      <Pressable
        style={styles.tab}
        onPress={() => {
          if (
            pathname !==
            "/account"
          ) {
            router.push(
              "/account"
            );
          }
        }}
      >
        <Text
          style={[
            styles.tabIcon,
            accountActive &&
              styles.activeIcon,
          ]}
        >
          ♙
        </Text>

        <Text
          style={[
            styles.tabText,
            accountActive &&
              styles.activeText,
          ]}
        >
          Account
        </Text>
      </Pressable>

    </View>
  );
}


function AppShell() {
  return (
    <View style={styles.shell}>

      <View style={styles.stackArea}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation:
              "slide_from_right",
          }}
        >
          <Stack.Screen
            name="index"
          />

          <Stack.Screen
            name="shop"
          />

          <Stack.Screen
            name="cart"
          />

          <Stack.Screen
            name="wishlist"
          />

          <Stack.Screen
            name="rewards"
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
      </View>

      <GlobalBottomNav />

    </View>
  );
}


export default function RootLayout() {
  const colorScheme =
    useColorScheme();

  return (
    <SafeAreaProvider>
      <WebsiteThemeProvider>

        <ThemeProvider
          value={
            colorScheme === "dark"
              ? DarkTheme
              : DefaultTheme
          }
        >
          <AnimatedSplashOverlay />

          <AppShell />
        </ThemeProvider>

      </WebsiteThemeProvider>
    </SafeAreaProvider>
  );
}


function createNavStyles(
  theme: ReturnType<
    typeof useWebsiteTheme
  >,
  bottomInset: number
) {
  return StyleSheet.create({
    bottomBar: {
      minHeight:
        64 +
        Math.max(
          bottomInset,
          4
        ),

      paddingTop: 6,

      paddingBottom:
        Math.max(
          bottomInset,
          6
        ),

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-around",

      backgroundColor:
        theme.surface,

      borderTopWidth: 1,

      borderTopColor:
        theme.shade4,
    },

    tab: {
      flex: 1,

      minHeight: 54,

      alignItems: "center",

      justifyContent:
        "center",
    },

    tabIcon: {
      color: theme.muted,

      fontSize: 21,

      height: 27,
    },

    activeIcon: {
      color: theme.primary,
    },

    tabText: {
      color: theme.muted,

      fontSize: 9,

      fontWeight: "600",
    },

    activeText: {
      color: theme.primary,

      fontWeight: "900",
    },

    cartCircle: {
      width: 38,

      height: 38,

      borderRadius: 19,

      marginTop: -14,

      marginBottom: 2,

      alignItems: "center",

      justifyContent:
        "center",

      backgroundColor:
        theme.primary,
    },

    cartCircleActive: {
      borderWidth: 2,

      borderColor:
        theme.secondary,
    },

    cartCircleText: {
      fontSize: 15,
    },
  });
}


const styles =
  StyleSheet.create({
    shell: {
      flex: 1,
    },

    stackArea: {
      flex: 1,
    },
  });
