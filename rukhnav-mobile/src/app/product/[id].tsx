import {
  ActivityIndicator,
  Image,
  Pressable,
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
  useLocalSearchParams,
} from "expo-router";

import {
  useEffect,
  useState,
} from "react";

import {
  getProductById,
} from "../../api/products";

import {
  productImageUrl,
} from "../../config/images";

import type {
  Product,
} from "../../types/product";

function money(
  value: string | number
) {
  return `Rs. ${Number(value || 0)
    .toLocaleString("en-PK")}`;
}

export default function ProductScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const [product, setProduct] =
    useState<Product | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    (async () => {
      try {
        setError("");

        const row =
          await getProductById(id);

        setProduct(row);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load product."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.centerText}>
          Loading product...
        </Text>
      </SafeAreaView>
    );
  }

  if (!product || error) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <Text style={styles.error}>
          {error ||
            "Product not found."}
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={styles.backButtonText}
          >
            Go Back
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const image =
    productImageUrl(product.image);

  const selling =
    Number(product.selling_price || 0);

  const discount =
    Number(product.discount_price || 0);

  const hasDiscount =
    discount > 0 &&
    discount < selling;

  const price =
    hasDiscount
      ? discount
      : selling;

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.iconButton}
          onPress={() =>
            router.back()
          }
        >
          <Text style={styles.icon}>
            ‹
          </Text>
        </Pressable>

        <Text style={styles.topTitle}>
          Product
        </Text>

        <Pressable
          style={styles.iconButton}
        >
          <Text style={styles.heart}>
            ♡
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.imageBox}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View
              style={styles.placeholder}
            >
              <Text
                style={
                  styles.placeholderText
                }
              >
                RUKHNAV
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.category}>
          {product.category ||
            "RUKHNAV"}
        </Text>

        <Text style={styles.name}>
          {product.product_name}
        </Text>

        <View style={styles.ratingRow}>
          <Text style={styles.star}>
            ★
          </Text>

          <Text style={styles.rating}>
            {Number(
              product.averageRating || 0
            )
              ? Number(
                  product.averageRating
                ).toFixed(1)
              : "New"}
          </Text>

          <Text style={styles.reviews}>
            {product.totalReviews > 0
              ? `(${product.totalReviews} reviews)`
              : "No reviews yet"}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {money(price)}
          </Text>

          {hasDiscount ? (
            <Text style={styles.oldPrice}>
              {money(selling)}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.stockBox,
            product.stock_quantity <= 0 &&
              styles.stockBoxOut,
          ]}
        >
          <Text
            style={[
              styles.stockText,
              product.stock_quantity <=
                0 &&
                styles.stockTextOut,
            ]}
          >
            {product.stock_quantity > 0
              ? `In Stock • ${product.stock_quantity} available`
              : "Out of Stock"}
          </Text>
        </View>

        {product.description ? (
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              Description
            </Text>

            <Text
              style={styles.sectionText}
            >
              {product.description}
            </Text>
          </View>
        ) : null}

        {product.ingredients ? (
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              Ingredients
            </Text>

            <Text
              style={styles.sectionText}
            >
              {product.ingredients}
            </Text>
          </View>
        ) : null}

        {product.directions ? (
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              Directions
            </Text>

            <Text
              style={styles.sectionText}
            >
              {product.directions}
            </Text>
          </View>
        ) : null}

        {product.warnings ? (
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
            >
              Warnings
            </Text>

            <Text
              style={styles.sectionText}
            >
              {product.warnings}
            </Text>
          </View>
        ) : null}

        {product.sku ? (
          <Text style={styles.sku}>
            SKU: {product.sku}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            disabled={
              product.stock_quantity <= 0
            }
            style={[
              styles.cartButton,
              product.stock_quantity <=
                0 &&
                styles.disabled,
            ]}
          >
            <Text
              style={
                styles.cartButtonText
              }
            >
              Add to Cart
            </Text>
          </Pressable>

          <Pressable
            disabled={
              product.stock_quantity <= 0
            }
            style={[
              styles.buyButton,
              product.stock_quantity <=
                0 &&
                styles.disabled,
            ]}
          >
            <Text
              style={styles.buyButtonText}
            >
              Buy Now
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: "#f8f5ed",
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: "#f8f5ed",
      gap: 15,
    },

    centerText: {
      color: "#173f2b",
    },

    error: {
      color: "#a44141",
      textAlign: "center",
    },

    backButton: {
      backgroundColor: "#173f2b",
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 22,
    },

    backButtonText: {
      color: "#ffffff",
      fontWeight: "700",
    },

    topBar: {
      height: 60,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      backgroundColor: "#173f2b",
    },

    topTitle: {
      color: "#d9b95b",
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 2,
    },

    iconButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },

    icon: {
      color: "#ffffff",
      fontSize: 35,
      lineHeight: 36,
    },

    heart: {
      color: "#ffffff",
      fontSize: 27,
    },

    content: {
      paddingBottom: 40,
    },

    imageBox: {
      margin: 16,
      height: 360,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#e8e1d3",
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
      color: "#173f2b",
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 3,
    },

    category: {
      marginHorizontal: 20,
      marginTop: 6,
      color: "#a18031",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },

    name: {
      marginHorizontal: 20,
      marginTop: 6,
      color: "#173f2b",
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "800",
    },

    ratingRow: {
      marginHorizontal: 20,
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
    },

    star: {
      color: "#b58d30",
      fontSize: 17,
    },

    rating: {
      color: "#445148",
      marginLeft: 5,
      fontWeight: "700",
    },

    reviews: {
      color: "#858d87",
      marginLeft: 6,
      fontSize: 12,
    },

    priceRow: {
      marginHorizontal: 20,
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    price: {
      color: "#173f2b",
      fontSize: 27,
      fontWeight: "800",
    },

    oldPrice: {
      color: "#929892",
      fontSize: 16,
      textDecorationLine:
        "line-through",
    },

    stockBox: {
      marginHorizontal: 20,
      marginTop: 12,
      backgroundColor: "#e4f1e7",
      borderRadius: 12,
      padding: 11,
    },

    stockBoxOut: {
      backgroundColor: "#f8e6e3",
    },

    stockText: {
      color: "#2e6b45",
      fontSize: 12,
      fontWeight: "700",
    },

    stockTextOut: {
      color: "#a44141",
    },

    section: {
      marginHorizontal: 20,
      marginTop: 25,
    },

    sectionTitle: {
      color: "#173f2b",
      fontSize: 18,
      fontWeight: "800",
    },

    sectionText: {
      color: "#58635c",
      fontSize: 14,
      lineHeight: 22,
      marginTop: 7,
    },

    sku: {
      marginHorizontal: 20,
      marginTop: 25,
      color: "#8a918c",
      fontSize: 11,
    },

    actionRow: {
      marginHorizontal: 20,
      marginTop: 28,
      flexDirection: "row",
      gap: 10,
    },

    cartButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#173f2b",
      borderRadius: 28,
      paddingVertical: 15,
      alignItems: "center",
    },

    cartButtonText: {
      color: "#173f2b",
      fontWeight: "800",
    },

    buyButton: {
      flex: 1,
      backgroundColor: "#173f2b",
      borderRadius: 28,
      paddingVertical: 15,
      alignItems: "center",
    },

    buyButtonText: {
      color: "#ffffff",
      fontWeight: "800",
    },

    disabled: {
      opacity: 0.4,
    },
  });
