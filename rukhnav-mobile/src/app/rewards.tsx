import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  router,
} from "expo-router";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getMyLoyaltySummary,
  type LoyaltySummary,
} from "../api/loyalty";

import {
  useWebsiteTheme,
} from "../theme/website-theme";


function number(value: number) {
  return Number(value || 0)
    .toLocaleString();
}


function money(value: number) {
  return `Rs ${Number(value || 0)
    .toLocaleString()}`;
}


export default function RewardsScreen() {
  const theme =
    useWebsiteTheme();

  const styles =
    createStyles(theme);

  const [loyalty, setLoyalty] =
    useState<LoyaltySummary | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");


  const load = useCallback(
    async () => {
      try {
        setError("");

        const result =
          await getMyLoyaltySummary();

        setLoyalty(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load rewards."
        );
      }
    },
    []
  );


  useEffect(() => {
    load().finally(() =>
      setLoading(false)
    );
  }, [load]);


  async function refresh() {
    setRefreshing(true);

    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }


  if (loading) {
    return (
      <SafeAreaView
        style={styles.page}
      >
        <View
          style={styles.loading}
        >
          <ActivityIndicator
            size="large"
            color={theme.primary}
          />

          <Text
            style={styles.loadingText}
          >
            Loading your rewards
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  if (!loyalty) {
    return (
      <SafeAreaView
        style={styles.page}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.back}
            onPress={() =>
              router.back()
            }
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Loyalty & Rewards
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>
            Rewards unavailable
          </Text>

          <Text style={styles.errorText}>
            {error ||
              "We could not load your loyalty account."}
          </Text>

          <Pressable
            style={styles.retry}
            onPress={load}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }


  const benefits =
    loyalty.benefits;

  const next =
    loyalty.nextCategory;

  const currentMinimum =
    next
      ? Math.max(
          0,
          next.requiredLifetimePoints -
            next.pointsNeeded
        )
      : loyalty.lifetimePoints;

  const progress =
    next
      ? Math.max(
          0,
          Math.min(
            1,
            (
              loyalty.lifetimePoints -
              currentMinimum
            ) /
              Math.max(
                1,
                next.requiredLifetimePoints -
                currentMinimum
              )
          )
        )
      : 1;


  const benefitRows = [
    {
      label: "Points multiplier",
      value:
        `${benefits.pointsMultiplier}× points`,
      enabled: true,
    },
    {
      label: "Member discount",
      value:
        `${benefits.discountPercentage}%`,
      enabled:
        benefits.discountPercentage > 0,
    },
    {
      label: "Birthday bonus",
      value:
        `${number(
          benefits.birthdayBonusPoints
        )} points`,
      enabled:
        benefits.birthdayBonusPoints > 0,
    },
    {
      label: "Referral bonus",
      value:
        `${number(
          benefits.referralBonusPoints
        )} points`,
      enabled:
        benefits.referralBonusPoints > 0,
    },
    {
      label: "Events & reminders",
      value:
        benefits.eventMenuEnabled
          ? "Unlocked"
          : "Locked",
      enabled:
        benefits.eventMenuEnabled,
    },
    {
      label: "Priority support",
      value:
        benefits.prioritySupportEnabled
          ? "Included"
          : "Not included",
      enabled:
        benefits.prioritySupportEnabled,
    },
    {
      label: "Free delivery benefit",
      value:
        benefits.freeDeliveryEnabled
          ? "Included"
          : "Not included",
      enabled:
        benefits.freeDeliveryEnabled,
    },
  ];


  return (
    <SafeAreaView
      style={styles.page}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() =>
            router.back()
          }
        >
          <Text style={styles.backText}>
            ‹
          </Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          Loyalty & Rewards
        </Text>

        <View style={styles.headerSpace} />
      </View>


      <ScrollView
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.memberCard}>
          <Text style={styles.memberLabel}>
            RUKHNAV MEMBER
          </Text>

          <Text style={styles.memberLevel}>
            {loyalty.membershipLevel}
          </Text>

          <Text style={styles.memberName}>
            {loyalty.fullName}
          </Text>


          <View style={styles.pointsRow}>
            <View style={styles.pointsBox}>
              <Text style={styles.pointsNumber}>
                {number(
                  loyalty.availablePoints
                )}
              </Text>

              <Text style={styles.pointsLabel}>
                Available Points
              </Text>
            </View>

            <View style={styles.pointsDivider} />

            <View style={styles.pointsBox}>
              <Text style={styles.pointsNumber}>
                {number(
                  loyalty.lifetimePoints
                )}
              </Text>

              <Text style={styles.pointsLabel}>
                Lifetime Points
              </Text>
            </View>
          </View>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Membership Progress
          </Text>

          {next ? (
            <>
              <View
                style={
                  styles.progressHeading
                }
              >
                <Text
                  style={
                    styles.progressCurrent
                  }
                >
                  {loyalty.membershipLevel}
                </Text>

                <Text
                  style={styles.progressNext}
                >
                  {next.name}
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        `${progress * 100}%`,
                    },
                  ]}
                />
              </View>

              <Text style={styles.progressText}>
                {number(next.pointsNeeded)}
                {" points to "}
                {next.name}
              </Text>

              <Text style={styles.progressSmall}>
                {number(
                  next.requiredLifetimePoints
                )}
                {" lifetime points required"}
              </Text>
            </>
          ) : (
            <View style={styles.highestBox}>
              <Text style={styles.highestTitle}>
                Highest membership level
              </Text>

              <Text style={styles.highestText}>
                You have reached the highest
                active RUKHNAV membership tier.
              </Text>
            </View>
          )}
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Your Benefits
          </Text>

          {benefitRows.map(item => (
            <View
              key={item.label}
              style={styles.benefitRow}
            >
              <View
                style={[
                  styles.benefitStatus,
                  item.enabled &&
                    styles.benefitStatusActive,
                ]}
              >
                <Text
                  style={[
                    styles.benefitStatusText,
                    item.enabled &&
                      styles.benefitStatusTextActive,
                  ]}
                >
                  {item.enabled ? "✓" : "—"}
                </Text>
              </View>

              <View style={styles.benefitCopy}>
                <Text style={styles.benefitName}>
                  {item.label}
                </Text>

                <Text style={styles.benefitValue}>
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Reminder Access
          </Text>

          <View style={styles.channelRow}>
            <View style={styles.channel}>
              <Text style={styles.channelIcon}>
                ✉
              </Text>
              <Text style={styles.channelName}>
                Email
              </Text>
              <Text style={styles.channelValue}>
                {benefits.emailRemindersEnabled
                  ? "Available"
                  : "Not included"}
              </Text>
            </View>

            <View style={styles.channel}>
              <Text style={styles.channelIcon}>
                ◉
              </Text>
              <Text style={styles.channelName}>
                WhatsApp
              </Text>
              <Text style={styles.channelValue}>
                {benefits.whatsappRemindersEnabled
                  ? "Available"
                  : "Not included"}
              </Text>
            </View>

            <View style={styles.channel}>
              <Text style={styles.channelIcon}>
                ▣
              </Text>
              <Text style={styles.channelName}>
                SMS
              </Text>
              <Text style={styles.channelValue}>
                {benefits.smsRemindersEnabled
                  ? "Available"
                  : "Not included"}
              </Text>
            </View>
          </View>
        </View>


        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {loyalty.totalOrders}
            </Text>

            <Text style={styles.statLabel}>
              Orders
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {money(loyalty.totalSpent)}
            </Text>

            <Text style={styles.statLabel}>
              Total Spent
            </Text>
          </View>
        </View>


        {error ? (
          <Text style={styles.refreshError}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}


function createStyles(
  theme: ReturnType<typeof useWebsiteTheme>
) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        theme.background,
    },

    header: {
      minHeight: 58,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor:
        theme.surface,
      borderBottomWidth: 1,
      borderBottomColor:
        theme.shade4,
    },

    back: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.shade4,
    },

    backText: {
      color: theme.primary,
      fontSize: 30,
      lineHeight: 31,
      fontWeight: "500",
    },

    headerTitle: {
      color: theme.primary,
      fontSize: 18,
      fontWeight: "800",
    },

    headerSpace: {
      width: 38,
    },

    content: {
      padding: 14,
      paddingBottom: 40,
    },

    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },

    loadingText: {
      color: theme.muted,
      fontSize: 13,
    },

    memberCard: {
      paddingHorizontal: 18,
      paddingVertical: 15,
      borderRadius: 18,
      backgroundColor:
        theme.primary,
      overflow: "hidden",
    },

    memberLabel: {
      color: theme.secondary,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.5,
    },

    memberLevel: {
      color: theme.surface,
      fontSize: 25,
      fontWeight: "900",
      marginTop: 3,
    },

    memberName: {
      color: theme.surface,
      opacity: 0.78,
      fontSize: 11,
      marginTop: 1,
    },

    pointsRow: {
      marginTop: 13,
      flexDirection: "row",
      alignItems: "center",
    },

    pointsBox: {
      flex: 1,
    },

    pointsDivider: {
      width: 1,
      height: 34,
      marginHorizontal: 12,
      backgroundColor:
        theme.secondary,
      opacity: 0.45,
    },

    pointsNumber: {
      color: theme.secondary,
      fontSize: 20,
      fontWeight: "900",
    },

    pointsLabel: {
      color: theme.surface,
      opacity: 0.72,
      fontSize: 9,
      marginTop: 1,
    },

    section: {
      marginTop: 14,
      padding: 17,
      borderRadius: 18,
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    sectionTitle: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "900",
      marginBottom: 15,
    },

    progressHeading: {
      flexDirection: "row",
      justifyContent: "space-between",
    },

    progressCurrent: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "800",
    },

    progressNext: {
      color: theme.secondary,
      fontSize: 12,
      fontWeight: "800",
    },

    progressTrack: {
      height: 9,
      borderRadius: 20,
      backgroundColor:
        theme.shade4,
      overflow: "hidden",
      marginTop: 10,
    },

    progressFill: {
      height: "100%",
      borderRadius: 20,
      backgroundColor:
        theme.secondary,
    },

    progressText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 10,
    },

    progressSmall: {
      color: theme.muted,
      fontSize: 10,
      marginTop: 3,
    },

    highestBox: {
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        theme.shade4,
    },

    highestTitle: {
      color: theme.primary,
      fontWeight: "800",
      fontSize: 13,
    },

    highestText: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 4,
    },

    benefitRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 9,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        theme.shade4,
    },

    benefitStatus: {
      width: 29,
      height: 29,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.shade4,
    },

    benefitStatusActive: {
      backgroundColor:
        theme.primary,
    },

    benefitStatusText: {
      color: theme.muted,
      fontWeight: "900",
    },

    benefitStatusTextActive: {
      color: theme.surface,
    },

    benefitCopy: {
      flex: 1,
      marginLeft: 11,
    },

    benefitName: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "700",
    },

    benefitValue: {
      color: theme.muted,
      fontSize: 10,
      marginTop: 2,
    },

    channelRow: {
      flexDirection: "row",
      gap: 8,
    },

    channel: {
      flex: 1,
      padding: 11,
      borderRadius: 13,
      backgroundColor:
        theme.shade4,
      alignItems: "center",
    },

    channelIcon: {
      color: theme.primary,
      fontSize: 18,
      fontWeight: "900",
    },

    channelName: {
      color: theme.text,
      fontSize: 10,
      fontWeight: "800",
      marginTop: 5,
    },

    channelValue: {
      color: theme.muted,
      fontSize: 8,
      textAlign: "center",
      marginTop: 2,
    },

    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },

    statCard: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    statNumber: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: "900",
    },

    statLabel: {
      color: theme.muted,
      fontSize: 10,
      marginTop: 4,
    },

    refreshError: {
      color: "#b42318",
      fontSize: 11,
      textAlign: "center",
      marginTop: 14,
    },

    errorState: {
      flex: 1,
      padding: 30,
      alignItems: "center",
      justifyContent: "center",
    },

    errorTitle: {
      color: theme.primary,
      fontSize: 20,
      fontWeight: "900",
    },

    errorText: {
      color: theme.muted,
      textAlign: "center",
      lineHeight: 19,
      marginTop: 8,
    },

    retry: {
      marginTop: 18,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor:
        theme.primary,
    },

    retryText: {
      color: theme.surface,
      fontWeight: "800",
    },
  });
}
