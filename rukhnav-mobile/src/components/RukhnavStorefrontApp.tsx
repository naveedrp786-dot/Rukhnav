import { useCallback, useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";

import * as Print from "expo-print";

const STOREFRONT_URL =
  "https://www.rukhnav.store/store/index.html";

const RUKHNAV_HOSTS = new Set([
  "www.rukhnav.store",
  "rukhnav.store",
]);

function isRukhnavUrl(url: string) {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      RUKHNAV_HOSTS.has(
        parsed.hostname.toLowerCase()
      )
    );
  } catch {
    return false;
  }
}

export default function RukhnavStorefrontApp() {
  const webViewRef =
    useRef<WebView>(null);

  const [canGoBack, setCanGoBack] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [failed, setFailed] =
    useState(false);

  const [reloadKey, setReloadKey] =
    useState(0);

  const handleNavigation =
    useCallback(
      (state: WebViewNavigation) => {
        setCanGoBack(state.canGoBack);
      },
      []
    );

  const handleShouldStart =
    useCallback(
      (request: { url: string }) => {
        const url = request.url;

        if (
          url === "about:blank" ||
          isRukhnavUrl(url)
        ) {
          return true;
        }

        Linking.openURL(url).catch(
          (error) => {
            console.error(
              "Unable to open external URL:",
              error
            );
          }
        );

        return false;
      },
      []
    );

  const handleMessage =
    useCallback(
      async (event: WebViewMessageEvent) => {
        try {
          const message = JSON.parse(
            event.nativeEvent.data
          );

          if (
            message?.type !==
            "RUKHNAV_PRINT_ORDER"
          ) {
            return;
          }

          if (
            typeof message?.html !==
              "string" ||
            !message.html.trim()
          ) {
            console.error(
              "Printable order HTML was not provided."
            );
            return;
          }

          await Print.printAsync({
            html: message.html,
          });
        } catch (error) {
          console.error(
            "Unable to print order:",
            error
          );
        }
      },
      []
    );

  const goHome =
    useCallback(() => {
      setFailed(false);
      setLoading(true);
      setReloadKey((value) => value + 1);
    }, []);

  const retry =
    useCallback(() => {
      setFailed(false);
      setLoading(true);
      setReloadKey((value) => value + 1);
    }, []);

  // Android hardware back:
  // navigate through storefront history before exiting.
  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription =
      BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (canGoBack) {
            webViewRef.current?.goBack();
            return true;
          }

          return false;
        }
      );

    return () => subscription.remove();
  }, [canGoBack]);

  if (failed) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <View style={styles.errorCard}>
          <Text style={styles.brand}>
            RUKHNAV
          </Text>

          <Text style={styles.errorTitle}>
            We couldn't load the store
          </Text>

          <Text style={styles.errorText}>
            Check your internet connection and try again.
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={retry}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>

          <Pressable
            style={styles.homeButton}
            onPress={goHome}
          >
            <Text style={styles.homeText}>
              Reload Store
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{
          uri: STOREFRONT_URL,
        }}
        style={styles.webView}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        onNavigationStateChange={
          handleNavigation
        }
        onShouldStartLoadWithRequest={
          handleShouldStart
        }
        onLoadStart={() => {
          setLoading(true);
          setFailed(false);
        }}
        onLoadEnd={() => {
          setLoading(false);
        }}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        onHttpError={(event) => {
          if (
            event.nativeEvent.statusCode >=
            500
          ) {
            setLoading(false);
            setFailed(true);
          }
        }}
      />

      {loading ? (
        <View
          pointerEvents="none"
          style={styles.loadingOverlay}
        >
          <View style={styles.loadingCard}>
            <Text style={styles.brand}>
              RUKHNAV
            </Text>

            <ActivityIndicator
              size="small"
            />

            <Text style={styles.loadingText}>
              Loading store...
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#173F2B",
    },

    webView: {
      flex: 1,
      backgroundColor: "#FFFFFF",
    },

    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F7F4EC",
    },

    loadingCard: {
      minWidth: 190,
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 24,
      paddingVertical: 24,
    },

    brand: {
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: 4,
      color: "#173F2B",
    },

    loadingText: {
      fontSize: 13,
      color: "#667067",
    },

    errorScreen: {
      flex: 1,
      backgroundColor: "#F7F4EC",
      justifyContent: "center",
      paddingHorizontal: 24,
    },

    errorCard: {
      alignItems: "center",
    },

    errorTitle: {
      marginTop: 22,
      fontSize: 21,
      fontWeight: "700",
      textAlign: "center",
      color: "#1F2A24",
    },

    errorText: {
      marginTop: 10,
      maxWidth: 300,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      color: "#6F776F",
    },

    retryButton: {
      marginTop: 24,
      minWidth: 180,
      alignItems: "center",
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 13,
      backgroundColor: "#173F2B",
    },

    retryText: {
      fontWeight: "700",
      color: "#FFFFFF",
    },

    homeButton: {
      marginTop: 10,
      minWidth: 180,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#173F2B",
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },

    homeText: {
      fontWeight: "700",
      color: "#173F2B",
    },
  });
