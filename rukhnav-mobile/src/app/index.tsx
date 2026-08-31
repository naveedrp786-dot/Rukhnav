import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { router } from "expo-router";

import { getProducts } from "../api/products";
import {
  getCustomerProfile,
} from "../api/profile";
import {
  getToken,
} from "../auth/session";
import { productImageUrl } from "../config/images";
import type { Product } from "../types/product";

import {
  colors,
} from "../theme/rukhnav";

import {
  useWebsiteTheme,
} from "../theme/website-theme";

function money(value: string | number) {
  const amount = Number(value || 0);

  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

function ProductCard({
  product,
}: {
  product: Product;
}) {
  const theme =
    useWebsiteTheme();

  const styles =
    createStyles(theme);

  const image = productImageUrl(product.image);

  const sellingPrice =
    Number(product.selling_price || 0);

  const discountPrice =
    Number(product.discount_price || 0);

  const finalPrice =
    discountPrice > 0 &&
    discountPrice < sellingPrice
      ? discountPrice
      : sellingPrice;

  const rating =
    Number(product.averageRating || 0);

  return (
    <Pressable
      style={styles.productCard}
      onPress={() =>
        router.push(`/product/${product.id}`)
      }
    >
      <View style={styles.imageBox}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderBrand}>
              RUKHNAV
            </Text>
          </View>
        )}

        {product.is_featured ? (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>
              FEATURED
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.productContent}>
        <Text
          style={styles.category}
          numberOfLines={1}
        >
          {product.category || "RUKHNAV"}
        </Text>

        <Text
          style={styles.productName}
          numberOfLines={2}
        >
          {product.product_name}
        </Text>

        <View style={styles.ratingRow}>
          <Text style={styles.stars}>
            ★
          </Text>

          <Text style={styles.rating}>
            {rating
              ? rating.toFixed(1)
              : "New"}
          </Text>

          {product.totalReviews > 0 ? (
            <Text style={styles.reviewCount}>
              ({product.totalReviews})
            </Text>
          ) : null}
        </View>

        <Text style={styles.price}>
          {money(finalPrice)}
        </Text>

        <Text
          style={[
            styles.stock,
            Number(product.stock_quantity) <= 0 &&
              styles.outOfStock,
          ]}
        >
          {Number(product.stock_quantity) > 0
            ? "In Stock"
            : "Out of Stock"}
        </Text>
      </View>
    </Pressable>
  );
}


function StoreBenefits() {
  const theme =
    useWebsiteTheme();

  const styles =
    createStyles(theme);

  return (
    <View style={[
        styles.storeBenefits,
        {
          backgroundColor:
            theme.primary,
        },
      ]}>
      <Text style={styles.benefitsTitle}>
        RUKHNAV Benefits
      </Text>

      <View style={styles.benefitCard}>
        <Text style={styles.benefitIcon}>
          🚚
        </Text>

        <View style={styles.benefitCopy}>
          <Text style={styles.benefitName}>
            Free Delivery
          </Text>

          <Text style={styles.benefitText}>
            Qualifying orders over Rs. 3,000
          </Text>
        </View>
      </View>

      <View style={styles.benefitCard}>
        <Text style={styles.benefitIcon}>
          🎟
        </Text>

        <View style={styles.benefitCopy}>
          <Text style={styles.benefitName}>
            Coupons & Offers
          </Text>

          <Text style={styles.benefitText}>
            Use active RUKHNAV coupons at checkout
          </Text>
        </View>
      </View>

      <View style={styles.benefitCard}>
        <Text style={styles.benefitIcon}>
          👑
        </Text>

        <View style={styles.benefitCopy}>
          <Text style={styles.benefitName}>
            Gold Membership
          </Text>

          <Text style={styles.benefitPoints}>
            5,000+ lifetime points
          </Text>

          <Text style={styles.benefitText}>
            5% discount • Events & Reminders unlocked
          </Text>
        </View>
      </View>

      <View style={styles.benefitCard}>
        <Text style={styles.benefitIcon}>
          💎
        </Text>

        <View style={styles.benefitCopy}>
          <Text style={styles.benefitName}>
            Platinum Membership
          </Text>

          <Text style={styles.benefitPoints}>
            15,000+ lifetime points
          </Text>

          <Text style={styles.benefitText}>
            10% discount • Events • Priority support • Free delivery benefit
          </Text>
        </View>
      </View>

      <Pressable
        style={[
          styles.rewardsButton,
          {
            backgroundColor:
              theme.secondary,
          },
        ]}
        onPress={() =>
          router.push("/rewards")
        }
      >
        <Text style={styles.rewardsButtonText}>
          View My Rewards
        </Text>

        <Text style={styles.rewardsArrow}>
          ›
        </Text>
      </Pressable>
    </View>
  );
}


export default function HomeScreen() {
  const theme =
    useWebsiteTheme();

  const styles =
    createStyles(theme);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    profilePictureUrl,
    setProfilePictureUrl,
  ] = useState<string | null>(
    null
  );

  const loadProducts =
    useCallback(async () => {
      try {
        setError("");

        const rows =
          await getProducts();

        setProducts(rows);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load products."
        );
      }
    }, []);

  const loadAccountPhoto =
    useCallback(async () => {
      try {
        const token =
          await getToken();

        if (!token) {
          setProfilePictureUrl(null);
          return;
        }

        const result =
          await getCustomerProfile();

        setProfilePictureUrl(
          result.profile
            ?.profile_picture_url ||
            null
        );
      } catch {
        setProfilePictureUrl(null);
      }
    }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([
        loadProducts(),
        loadAccountPhoto(),
      ]);

      setLoading(false);
    })();
  }, [
    loadProducts,
    loadAccountPhoto,
  ]);

  async function refresh() {
    setRefreshing(true);

    await Promise.all([
      loadProducts(),
      loadAccountPhoto(),
    ]);

    setRefreshing(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <StatusBar
          barStyle="light-content"
        />

        <Text style={styles.loadingLogo}>
          RUKHNAV
        </Text>

        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Preparing your store...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.page,
        {
          backgroundColor:
            theme.background,
        },
      ]}
    >
      <StatusBar
        barStyle="light-content"
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor:
              theme.primary,
          },
        ]}
      >
        <View>
          <Text
            style={[
              styles.logo,
              {
                color:
                  theme.secondary,
              },
            ]}
          >
            RUKHNAV
          </Text>

          <Text
            style={[
              styles.tagline,
              {
                color:
                  theme.surface,
              },
            ]}
          >
            Natural Beauty • Thoughtfully Made
          </Text>
        </View>

        <Pressable
          style={styles.accountArea}
          onPress={() =>
            router.push("/account")
          }
        >
          <View
            style={[
            styles.accountButton,
            {
              borderColor:
                theme.secondary,
            },
          ]}
          >
            {profilePictureUrl ? (
              <Image
                source={{
                  uri:
                    profilePictureUrl,
                }}
                style={
                  styles.accountImage
                }
                resizeMode="cover"
              />
            ) : (
              <Text
                style={
                  styles.accountIcon
                }
              >
                ♙
              </Text>
            )}
          </View>

          <Text
            style={
              styles.accountLabel
            }
          >
            Account
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={item =>
          String(item.id)
        }
        renderItem={({ item }) => (
          <ProductCard product={item} />
        )}
        numColumns={3}
        columnWrapperStyle={
          styles.productRow
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
        ListHeaderComponent={
          <>
            <View
              style={
                styles.sectionHeading
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  OUR PRODUCTS
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Shop RUKHNAV
                </Text>
              </View>

              <Text
                style={
                  styles.productTotal
                }
              >
                {products.length} products
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text
                  style={
                    styles.errorTitle
                  }
                >
                  Unable to refresh store
                </Text>

                <Text
                  style={
                    styles.errorText
                  }
                >
                  {error}
                </Text>

                <Pressable
                  onPress={refresh}
                >
                  <Text
                    style={
                      styles.retryText
                    }
                  >
                    Try again
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
        ListFooterComponent={
          <StoreBenefits />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              Products coming soon
            </Text>
          </View>
        }
      />

      
    </SafeAreaView>
  );
}

function createStyles(
  theme: ReturnType<typeof useWebsiteTheme>
) {
  return StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: theme.background,
  },

  loadingPage: {
    flex: 1,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },

  loadingLogo: {
    color: "#d9b95b",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 7,
  },

  loadingText: {
    color: "#ffffff",
    fontSize: 14,
  },

  header: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logo: {
    color: "#d9b95b",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 5,
  },

  tagline: {
    color: "#f2ead3",
    marginTop: 4,
    fontSize: 10,
    letterSpacing: 0.7,
  },

  accountArea: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 58,
  },

  accountButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: "#d9b95b",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: theme.primary,
  },

  accountImage: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
  },

  accountIcon: {
    color: "#ffffff",
    fontSize: 22,
  },

  accountLabel: {
    marginTop: 4,
    color: "#f2ead3",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  content: {
    paddingBottom: 110,
  },

  hero: {
    margin: 16,
    padding: 25,
    minHeight: 230,
    borderRadius: 24,
    backgroundColor: "#e8dfc8",
    justifyContent: "center",
  },

  heroEyebrow: {
    color: "#987629",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },

  heroTitle: {
    color: theme.primary,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "800",
    marginTop: 10,
    maxWidth: 300,
  },

  heroText: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 310,
  },

  shopButton: {
    marginTop: 20,
    backgroundColor: theme.primary,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 30,
    alignSelf: "flex-start",
  },

  shopButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  sectionHeading: {
    paddingHorizontal: 18,
    marginTop: 10,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  sectionEyebrow: {
    color: theme.secondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  sectionTitle: {
    color: theme.primary,
    fontSize: 25,
    fontWeight: "800",
    marginTop: 3,
  },

  productTotal: {
    color: theme.muted,
    fontSize: 12,
  },

  productRow: {
    paddingHorizontal: 8,
    gap: 6,
  },

  productCard: {
    flex: 1,
    marginBottom: 8,
    backgroundColor: theme.surface,
    borderRadius: 13,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.shade4,
  },

  imageBox: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: theme.shade4,
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  placeholderBrand: {
    color: theme.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  featuredBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: theme.primary,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 7,
  },

  featuredText: {
    color: "#ffffff",
    fontSize: 6,
    fontWeight: "800",
  },

  productContent: {
    padding: 7,
  },

  category: {
    color: theme.secondary,
    fontSize: 7,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },

  productName: {
    color: theme.primary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    marginTop: 3,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  stars: {
    color: theme.secondary,
    fontSize: 9,
  },

  rating: {
    color: theme.text,
    marginLeft: 3,
    fontSize: 8,
  },

  reviewCount: {
    color: theme.muted,
    marginLeft: 2,
    fontSize: 7,
  },

  price: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },

  stock: {
    color: "#2e6b45",
    fontSize: 8,
    fontWeight: "700",
    marginTop: 3,
  },

  outOfStock: {
    color: "#a14343",
  },

  errorBox: {
    marginHorizontal: 16,
    marginBottom: 15,
    backgroundColor: "#fff0ed",
    borderRadius: 14,
    padding: 14,
  },

  errorTitle: {
    color: "#8d2d2d",
    fontWeight: "800",
  },

  errorText: {
    color: "#754949",
    marginTop: 4,
  },

  retryText: {
    color: theme.primary,
    fontWeight: "800",
    marginTop: 8,
  },

  empty: {
    padding: 40,
    alignItems: "center",
  },

  emptyTitle: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: "700",
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    paddingBottom: 8,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.shade4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  tabIcon: {
    color: theme.primary,
    fontSize: 21,
    height: 27,
  },

  activeTab: {
    color: theme.primary,
    fontSize: 10,
    fontWeight: "800",
  },

  tabText: {
    color: theme.muted,
    fontSize: 10,
  },

  cartCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -19,
    marginBottom: 4,
  },

  cartCircleText: {
    fontSize: 17,
  },

  storeBenefits: {
    marginHorizontal: 12,
    marginTop: 18,
    marginBottom: 22,
    padding: 16,

    borderRadius: 18,

    backgroundColor:
      colors.primary,
  },

  benefitsTitle: {
    marginBottom: 12,

    color: colors.white,

    fontSize: 18,
    fontWeight: "800",
  },

  benefitCard: {
    minHeight: 68,

    paddingVertical: 11,

    flexDirection: "row",
    alignItems: "center",

    borderBottomWidth: 1,
    borderBottomColor:
      "rgba(255,255,255,0.12)",
  },

  benefitIcon: {
    width: 42,

    fontSize: 22,

    textAlign: "center",
  },

  benefitCopy: {
    flex: 1,

    paddingLeft: 8,
  },

  benefitName: {
    color: colors.white,

    fontSize: 13,
    fontWeight: "800",
  },

  benefitPoints: {
    marginTop: 2,

    color: colors.secondary,

    fontSize: 11,
    fontWeight: "800",
  },

  benefitText: {
    marginTop: 3,

    color: theme.surface,

    fontSize: 10,
    lineHeight: 15,
  },

  rewardsButton: {
    marginTop: 15,

    minHeight: 46,

    paddingHorizontal: 16,

    borderRadius: 23,

    backgroundColor:
      colors.secondary,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  rewardsButtonText: {
    color: colors.primary,

    fontSize: 12,
    fontWeight: "900",
  },

  rewardsArrow: {
    color: colors.primary,

    fontSize: 22,
    lineHeight: 22,
  },

  });
}
