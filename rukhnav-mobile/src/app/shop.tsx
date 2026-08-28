import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
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
  useMemo,
  useState,
} from "react";

import {
  getProducts,
} from "../api/products";

import {
  productImageUrl,
} from "../config/images";

import type {
  Product,
} from "../types/product";

import {
  useWebsiteTheme,
} from "../theme/website-theme";

function money(
  value: string | number
) {
  return `Rs. ${Number(value || 0)
    .toLocaleString("en-PK")}`;
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

  const image =
    productImageUrl(product.image);

  const selling =
    Number(product.selling_price || 0);

  const discount =
    Number(product.discount_price || 0);

  const price =
    discount > 0 &&
    discount < selling
      ? discount
      : selling;

  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/product/[id]",
          params: {
            id: String(product.id),
          },
        })
      }
    >
      <View style={styles.imageBox}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              RUKHNAV
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.category}>
          {product.category || "RUKHNAV"}
        </Text>

        <Text
          style={styles.name}
          numberOfLines={2}
        >
          {product.product_name}
        </Text>

        <View style={styles.ratingRow}>
          <Text style={styles.star}>
            ★
          </Text>

          <Text style={styles.ratingText}>
            {Number(product.averageRating || 0)
              ? Number(
                  product.averageRating
                ).toFixed(1)
              : "New"}
          </Text>

          {product.totalReviews > 0 ? (
            <Text style={styles.reviewText}>
              ({product.totalReviews})
            </Text>
          ) : null}
        </View>

        <Text style={styles.price}>
          {money(price)}
        </Text>

        <Text
          style={[
            styles.stock,
            product.stock_quantity <= 0 &&
              styles.out,
          ]}
        >
          {product.stock_quantity > 0
            ? "In Stock"
            : "Out of Stock"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ShopScreen() {
  const theme =
    useWebsiteTheme();

  const styles =
    createStyles(theme);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState("All");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const load =
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
      await load();
      setLoading(false);
    })();
  }, [load]);

  const categories =
    useMemo(() => {
      const values =
        products
          .map(item => item.category)
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          );

      return [
        "All",
        ...Array.from(
          new Set(values)
        ),
      ];
    }, [products]);

  const filtered =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return products.filter(product => {
        const matchesCategory =
          category === "All" ||
          product.category === category;

        const matchesSearch =
          !query ||
          product.product_name
            .toLowerCase()
            .includes(query) ||
          String(
            product.category || ""
          )
            .toLowerCase()
            .includes(query);

        return (
          matchesCategory &&
          matchesSearch
        );
      });
    }, [
      products,
      category,
      search,
    ]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loading}
      >
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading RUKHNAV...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>
            RUKHNAV
          </Text>

          <Text style={styles.tagline}>
            Discover your collection
          </Text>
        </View>

        <Pressable
          style={styles.account}
          onPress={() =>
            router.push("/account")
          }
        >
          <Text style={styles.accountText}>
            ♙
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item =>
          String(item.id)
        }
        numColumns={2}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
          />
        )}
        columnWrapperStyle={
          styles.row
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
            <Text style={styles.title}>
              Shop
            </Text>

            <Text style={styles.subtitle}>
              Beauty, skincare and hair care
              from RUKHNAV.
            </Text>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search products..."
              placeholderTextColor="#8a918c"
              style={styles.search}
            />

            <FlatList
              data={categories}
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              keyExtractor={item => item}
              contentContainerStyle={
                styles.categoryList
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    setCategory(item)
                  }
                  style={[
                    styles.categoryChip,
                    category === item &&
                      styles.categoryChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === item &&
                        styles.categoryChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />

            <View
              style={styles.resultRow}
            >
              <Text
                style={styles.resultTitle}
              >
                Products
              </Text>

              <Text
                style={styles.resultCount}
              >
                {filtered.length} found
              </Text>
            </View>

            {error ? (
              <Text style={styles.error}>
                {error}
              </Text>
            ) : null}
          </>
        }
      />

      
    </SafeAreaView>
  );
}

function createStyles(
  theme: ReturnType<
    typeof useWebsiteTheme
  >
) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: theme.background,
    },

    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      gap: 15,
    },

    loadingText: {
      color: theme.primary,
    },

    header: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    logo: {
      color: theme.secondary,
      fontSize: 27,
      fontWeight: "800",
      letterSpacing: 5,
    },

    tagline: {
      color: theme.surface,
      fontSize: 11,
      marginTop: 4,
    },

    account: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: theme.secondary,
      alignItems: "center",
      justifyContent: "center",
    },

    accountText: {
      color: theme.surface,
      fontSize: 22,
    },

    content: {
      paddingBottom: 115,
    },

    title: {
      marginTop: 24,
      marginHorizontal: 18,
      color: theme.primary,
      fontSize: 32,
      fontWeight: "800",
    },

    subtitle: {
      marginHorizontal: 18,
      marginTop: 5,
      color: "#68736c",
      fontSize: 14,
    },

    search: {
      marginHorizontal: 18,
      marginTop: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.shade4,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: theme.primary,
    },

    categoryList: {
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: 8,
    },

    categoryChip: {
      borderWidth: 1,
      borderColor: theme.shade4,
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 22,
      backgroundColor: theme.surface,
    },

    categoryChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },

    categoryChipText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "700",
    },

    categoryChipTextActive: {
      color: theme.surface,
    },

    resultRow: {
      marginHorizontal: 18,
      marginBottom: 12,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    resultTitle: {
      color: theme.primary,
      fontSize: 22,
      fontWeight: "800",
    },

    resultCount: {
      color: theme.muted,
      fontSize: 12,
    },

    row: {
      paddingHorizontal: 12,
      gap: 10,
    },

    card: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 18,
      overflow: "hidden",
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.shade4,
    },

    imageBox: {
      width: "100%",
      aspectRatio: 1,
      backgroundColor: theme.shade4,
    },

    image: {
      width: "100%",
      height: "100%",
    },

    placeholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    placeholderText: {
      color: theme.primary,
      fontWeight: "800",
      letterSpacing: 2,
    },

    cardBody: {
      padding: 12,
    },

    category: {
      color: theme.secondary,
      fontSize: 9,
      fontWeight: "800",
      textTransform: "uppercase",
    },

    name: {
      color: theme.primary,
      fontSize: 15,
      lineHeight: 20,
      minHeight: 40,
      marginTop: 4,
      fontWeight: "700",
    },

    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },

    star: {
      color: theme.secondary,
    },

    ratingText: {
      color: theme.text,
      fontSize: 11,
      marginLeft: 4,
    },

    reviewText: {
      color: theme.muted,
      fontSize: 10,
      marginLeft: 3,
    },

    price: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: "800",
      marginTop: 7,
    },

    stock: {
      color: "#37734f",
      fontSize: 10,
      fontWeight: "700",
      marginTop: 4,
    },

    out: {
      color: "#a44141",
    },

    error: {
      marginHorizontal: 18,
      marginBottom: 10,
      color: "#a44141",
    },

    bottomBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: 78,
      paddingBottom: 8,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.shade4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-around",
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

    cartText: {
      fontSize: 17,
    },
    });
}
