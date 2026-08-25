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
import { productImageUrl } from "../config/images";
import type { Product } from "../types/product";

function money(value: string | number) {
  const amount = Number(value || 0);

  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

function ProductCard({
  product,
}: {
  product: Product;
}) {
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

export default function HomeScreen() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

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

  useEffect(() => {
    (async () => {
      await loadProducts();
      setLoading(false);
    })();
  }, [loadProducts]);

  async function refresh() {
    setRefreshing(true);
    await loadProducts();
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
    <SafeAreaView style={styles.page}>
      <StatusBar
        barStyle="light-content"
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>
            RUKHNAV
          </Text>

          <Text style={styles.tagline}>
            Natural Beauty • Thoughtfully Made
          </Text>
        </View>

        <Pressable
          style={styles.accountButton}
          onPress={() =>
            router.push("/account")
          }
        >
          <Text style={styles.accountIcon}>
            ♙
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
        numColumns={2}
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
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>
                RUKHNAV COLLECTION
              </Text>

              <Text style={styles.heroTitle}>
                Beauty inspired by nature.
              </Text>

              <Text style={styles.heroText}>
                Discover herbal beauty,
                skincare and hair care
                selected for everyday
                confidence.
              </Text>

              <Pressable
                style={styles.shopButton}
                onPress={() => router.push("/shop")}
              >
                <Text
                  style={
                    styles.shopButtonText
                  }
                >
                  SHOP COLLECTION
                </Text>
              </Pressable>
            </View>

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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              Products coming soon
            </Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <Pressable style={styles.tab}>
          <Text style={styles.tabIcon}>
            ⌂
          </Text>
          <Text style={styles.activeTab}>
            Home
          </Text>
        </Pressable>

        <Pressable
          style={styles.tab}
          onPress={() =>
            router.push("/shop")
          }
        >
          <Text style={styles.tabIcon}>
            ◫
          </Text>
          <Text style={styles.tabText}>
            Shop
          </Text>
        </Pressable>

        <Pressable style={styles.tab}>
          <View style={styles.cartCircle}>
            <Text
              style={
                styles.cartCircleText
              }
            >
              🛒
            </Text>
          </View>
          <Text style={styles.tabText}>
            Cart
          </Text>
        </Pressable>

        <Pressable style={styles.tab}>
          <Text style={styles.tabIcon}>
            ♡
          </Text>
          <Text style={styles.tabText}>
            Wishlist
          </Text>
        </Pressable>

        <Pressable
          style={styles.tab}
          onPress={() =>
            router.push("/account")
          }
        >
          <Text style={styles.tabIcon}>
            ♙
          </Text>
          <Text style={styles.tabText}>
            Account
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8f5ed",
  },

  loadingPage: {
    flex: 1,
    backgroundColor: "#173f2b",
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
    backgroundColor: "#173f2b",
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

  accountButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#d9b95b",
    alignItems: "center",
    justifyContent: "center",
  },

  accountIcon: {
    color: "#ffffff",
    fontSize: 22,
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
    color: "#173f2b",
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "800",
    marginTop: 10,
    maxWidth: 300,
  },

  heroText: {
    color: "#526058",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 310,
  },

  shopButton: {
    marginTop: 20,
    backgroundColor: "#173f2b",
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
    color: "#a18031",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  sectionTitle: {
    color: "#173f2b",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 3,
  },

  productTotal: {
    color: "#758078",
    fontSize: 12,
  },

  productRow: {
    paddingHorizontal: 12,
    gap: 10,
  },

  productCard: {
    flex: 1,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ebe6d9",
  },

  imageBox: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#f1eee5",
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
    color: "#173f2b",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },

  featuredBadge: {
    position: "absolute",
    top: 9,
    left: 9,
    backgroundColor: "#173f2b",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },

  featuredText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "800",
  },

  productContent: {
    padding: 12,
  },

  category: {
    color: "#a18031",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  productName: {
    color: "#1b3024",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
    minHeight: 40,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  stars: {
    color: "#b28a2e",
    fontSize: 13,
  },

  rating: {
    color: "#536159",
    fontSize: 11,
    marginLeft: 4,
  },

  reviewCount: {
    color: "#909790",
    fontSize: 10,
    marginLeft: 3,
  },

  price: {
    color: "#173f2b",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 7,
  },

  stock: {
    color: "#36744d",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
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
    color: "#173f2b",
    fontWeight: "800",
    marginTop: 8,
  },

  empty: {
    padding: 40,
    alignItems: "center",
  },

  emptyTitle: {
    color: "#173f2b",
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
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e9e4d7",
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
    color: "#173f2b",
    fontSize: 21,
    height: 27,
  },

  activeTab: {
    color: "#173f2b",
    fontSize: 10,
    fontWeight: "800",
  },

  tabText: {
    color: "#7b837d",
    fontSize: 10,
  },

  cartCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#173f2b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -19,
    marginBottom: 4,
  },

  cartCircleText: {
    fontSize: 17,
  },
});
