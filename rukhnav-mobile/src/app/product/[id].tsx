import {
  ActivityIndicator,
  Dimensions,
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
  Alert,
} from "react-native";

import {
  getProductById,
} from "../../api/products";

import {
  addToCart,
} from "../../api/cart";

import {
  getToken,
} from "../../auth/session";

import {
  addGuestCartItem,
} from "../../cart/guestCart";

import {
  getProductMedia,
} from "../../api/product-media";

import {
  getProductReviews,
} from "../../api/reviews";

import {
  getProducts,
} from "../../api/products";

import type {
  ProductReview,
} from "../../api/reviews";

import {
  ApiError,
} from "../../api/client";

import {
  productImageUrl,
} from "../../config/images";

import {
  useWebsiteTheme,
} from "../../theme/website-theme";

import type {
  Product,
} from "../../types/product";

const SCREEN_WIDTH =
  Dimensions.get("window").width;

function money(
  value: string | number
) {
  return `Rs. ${Number(value || 0)
    .toLocaleString("en-PK")}`;
}

export default function ProductScreen() {
  const theme =
    useWebsiteTheme();

  const styles =
    createStyles(theme);

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

  const [
    galleryImages,
    setGalleryImages,
  ] = useState<string[]>([]);

  const [
    activeImageIndex,
    setActiveImageIndex,
  ] = useState(0);

  const [
    addingToCart,
    setAddingToCart,
  ] = useState(false);

  const [
    quantity,
    setQuantity,
  ] = useState(1);

  const [
    reviews,
    setReviews,
  ] = useState<ProductReview[]>([]);

  const [
    reviewsLoading,
    setReviewsLoading,
  ] = useState(false);

  const [
    relatedProducts,
    setRelatedProducts,
  ] = useState<Product[]>([]);

  const [
    cartToast,
    setCartToast,
  ] = useState<{
    visible: boolean;
    message: string;
  }>({
    visible: false,
    message: "",
  });

  useEffect(() => {
    (async () => {
      try {
        setError("");

        const row =
          await getProductById(id);

        setProduct(row);

        const fallback =
          productImageUrl(row.image);

        try {
          const media =
            await getProductMedia(id);

          const urls =
            media
              .map(item =>
                productImageUrl(
                  item.image_url
                )
              )
              .filter(
                (
                  value
                ): value is string =>
                  Boolean(value)
              );

          const unique =
            Array.from(
              new Set(
                fallback
                  ? [fallback, ...urls]
                  : urls
              )
            );

          setGalleryImages(unique);
        } catch (galleryError) {
          console.warn(
            "Unable to load product gallery:",
            galleryError
          );

          setGalleryImages(
            fallback
              ? [fallback]
              : []
          );
        }

        setActiveImageIndex(0);
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

  async function handleAddToCart() {
    if (
      !product ||
      addingToCart
    ) {
      return;
    }

    setAddingToCart(true);

    try {
      const token =
        await getToken();

      if (token) {
        const result =
          await addToCart({
            product_id:
              Number(product.id),
            quantity,
          });

        setCartToast({
          visible: true,
          message:
            result.message ||
            "Product added to your cart.",
        });
      } else {
        await addGuestCartItem(
          Number(product.id),
          quantity
        );

        setCartToast({
          visible: true,
          message:
            "Product added to your cart.",
        });
      }
    } catch (err) {
      if (
        err instanceof ApiError
      ) {
        Alert.alert(
          "Unable to Add",
          err.message
        );

        return;
      }

      Alert.alert(
        "Unable to Add",
        err instanceof Error
          ? err.message
          : "Unable to add this product to your cart."
      );
    } finally {
      setAddingToCart(false);
    }
  }

  useEffect(() => {
    if (!id) {
      return;
    }

    let mounted = true;

    (async () => {
      setReviewsLoading(true);

      try {
        const reviewResponse =
          await getProductReviews(id);

        if (mounted) {
          setReviews(
            Array.isArray(reviewResponse.reviews)
              ? reviewResponse.reviews
              : []
          );
        }
      } catch (reviewError) {
        console.warn(
          "Unable to load product reviews:",
          reviewError
        );

        if (mounted) {
          setReviews([]);
        }
      } finally {
        if (mounted) {
          setReviewsLoading(false);
        }
      }

      try {
        const productResponse =
          await getProducts();

        const rows =
          Array.isArray(productResponse)
            ? productResponse
            : Array.isArray(
                (productResponse as any)?.products
              )
              ? (productResponse as any).products
              : [];

        if (mounted) {
          const currentId =
            Number(id);

          const otherProducts =
            rows
              .filter(
                (item: Product) =>
                  Number(item.id) !== currentId
              )
              .sort(
                (
                  a: Product,
                  b: Product
                ) => {
                  const aSame =
                    a.category ===
                    product?.category
                      ? 1
                      : 0;

                  const bSame =
                    b.category ===
                    product?.category
                      ? 1
                      : 0;

                  return bSame - aSame;
                }
              )
              .slice(0, 8);

          setRelatedProducts(
            otherProducts
          );
        }
      } catch (productError) {
        console.warn(
          "Unable to load related products:",
          productError
        );

        if (mounted) {
          setRelatedProducts([]);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    id,
    product?.category,
  ]);


  async function handleBuyNow() {
    if (
      !product ||
      product.stock_quantity <= 0 ||
      addingToCart
    ) {
      return;
    }

    setAddingToCart(true);

    try {
      const token =
        await getToken();

      if (token) {
        await addToCart({
          product_id:
            Number(product.id),
          quantity,
        });
      } else {
        await addGuestCartItem(
          Number(product.id),
          quantity
        );
      }

      router.push("/cart");
    } catch (err) {
      Alert.alert(
        "Unable to Continue",
        err instanceof Error
          ? err.message
          : "Unable to continue with this product."
      );
    } finally {
      setAddingToCart(false);
    }
  }

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

  const fallbackImage =
    productImageUrl(product.image);

  const displayImages =
    galleryImages.length
      ? galleryImages
      : fallbackImage
        ? [fallbackImage]
        : [];

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
        <View style={styles.purchaseArea}>
          <View style={styles.purchaseGallery}>
            <View style={styles.galleryArea}>
          {displayImages.length ? (
            <>
              <View style={styles.imageBox}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={
                    false
                  }
                  onMomentumScrollEnd={event => {
                    const width =
                      event.nativeEvent
                        .layoutMeasurement
                        .width;

                    if (!width) {
                      return;
                    }

                    const nextIndex =
                      Math.round(
                        event.nativeEvent
                          .contentOffset.x /
                          width
                      );

                    setActiveImageIndex(
                      Math.max(
                        0,
                        Math.min(
                          nextIndex,
                          displayImages.length -
                            1
                        )
                      )
                    );
                  }}
                >
                  {displayImages.map(
                    (uri, index) => (
                      <View
                        key={`${uri}-${index}`}
                        style={
                          styles.slide
                        }
                      >
                        <Image
                          source={{ uri }}
                          style={
                            styles.image
                          }
                          resizeMode="contain"
                        />
                      </View>
                    )
                  )}
                </ScrollView>

                {displayImages.length > 1 ? (
                  <View
                    style={
                      styles.imageCounter
                    }
                  >
                    <Text
                      style={
                        styles.imageCounterText
                      }
                    >
                      {activeImageIndex + 1}
                      {" / "}
                      {displayImages.length}
                    </Text>
                  </View>
                ) : null}
              </View>

              {displayImages.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  contentContainerStyle={
                    styles.thumbnailRow
                  }
                >
                  {displayImages.map(
                    (uri, index) => (
                      <Pressable
                        key={`thumb-${uri}-${index}`}
                        onPress={() =>
                          setActiveImageIndex(
                            index
                          )
                        }
                        style={[
                          styles.thumbnailBox,
                          index ===
                            activeImageIndex &&
                            styles.thumbnailBoxActive,
                        ]}
                      >
                        <Image
                          source={{ uri }}
                          style={
                            styles.thumbnailImage
                          }
                          resizeMode="cover"
                        />
                      </Pressable>
                    )
                  )}
                </ScrollView>
              ) : null}
            </>
          ) : (
            <View
              style={[
                styles.imageBox,
                styles.placeholder,
              ]}
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


          </View>


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

        <View style={styles.purchaseControls}>
          <View style={styles.purchaseOptionsRow}>
            <View style={styles.quantitySection}>
              <Text style={styles.quantityLabel}>
                Quantity
              </Text>

              <View style={styles.quantityControl}>
                <Pressable
                  style={styles.quantityButton}
                  onPress={() =>
                    setQuantity(current =>
                      Math.max(
                        1,
                        current - 1
                      )
                    )
                  }
                >
                  <Text
                    style={
                      styles.quantityButtonText
                    }
                  >
                    −
                  </Text>
                </Pressable>

                <Text style={styles.quantityValue}>
                  {quantity}
                </Text>

                <Pressable
                  style={styles.quantityButton}
                  onPress={() =>
                    setQuantity(current =>
                      Math.min(
                        Number(
                          product.stock_quantity ||
                            1
                        ),
                        current + 1
                      )
                    )
                  }
                >
                  <Text
                    style={
                      styles.quantityButtonText
                    }
                  >
                    +
                  </Text>
                </Pressable>
              </View>
            </View>

            {Array.isArray(
              (product as any).available_sizes
            ) &&
            (product as any)
              .available_sizes.length ? (
              <View style={styles.sizeSection}>
                <Text style={styles.sizeLabel}>
                  Size
                </Text>

                <View style={styles.sizeRow}>
                  {(product as any)
                    .available_sizes
                    .map(
                      (
                        size: string
                      ) => (
                        <View
                          key={size}
                          style={
                            styles.sizeChip
                          }
                        >
                          <Text
                            style={
                              styles.sizeChipText
                            }
                          >
                            {size}
                          </Text>
                        </View>
                      )
                    )}
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => {
                void handleAddToCart();
              }}
              disabled={
                product.stock_quantity <= 0 ||
                addingToCart
              }
              style={[
                styles.cartButton,
                (
                  product.stock_quantity <= 0 ||
                  addingToCart
                ) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.cartButtonText}>
                {addingToCart
                  ? "Adding..."
                  : "Add to Cart"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void handleBuyNow();
              }}
              disabled={
                product.stock_quantity <= 0 ||
                addingToCart
              }
              style={[
                styles.buyButton,
                (
                  product.stock_quantity <= 0 ||
                  addingToCart
                ) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.buyButtonText}>
                Buy Now
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>
            Description
          </Text>

          <Text
            style={[
              styles.sectionText,
              !product.description &&
                styles.descriptionPlaceholder,
            ]}
          >
            {product.description ||
              "Product description will be updated soon."}
          </Text>
        </View>

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

        <View style={styles.reviewsSection}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>
              Customer Reviews
            </Text>

            {product.totalReviews > 0 ? (
              <Text style={styles.reviewTotal}>
                {product.totalReviews}
                {" reviews"}
              </Text>
            ) : null}
          </View>

          {reviewsLoading ? (
            <View style={styles.reviewLoading}>
              <ActivityIndicator
                size="small"
                color={theme.primary}
              />

              <Text style={styles.reviewLoadingText}>
                Loading customer reviews...
              </Text>
            </View>
          ) : reviews.length ? (
            reviews.map((review, index) => {
              const rating =
                Number(
                  (review as any).rating || 0
                );

              const customerName =
                (review as any).customer_name ||
                (review as any).full_name ||
                (review as any).customerName ||
                "RUKHNAV Customer";

              const title =
                (review as any).review_title ||
                (review as any).title ||
                "";

              const comment =
                (review as any).review_text ||
                (review as any).comment ||
                (review as any).review ||
                "";

              const verified =
                Boolean(
                  (review as any)
                    .verified_purchase ||
                  (review as any)
                    .is_verified_purchase
                );

              const images =
                Array.isArray(
                  (review as any).images
                )
                  ? (review as any).images
                  : Array.isArray(
                      (review as any)
                        .review_images
                    )
                    ? (review as any)
                        .review_images
                    : [];

              const adminReply =
                (review as any).admin_reply ||
                (review as any).reply ||
                "";

              return (
                <View
                  key={
                    String(
                      (review as any).id ||
                      index
                    )
                  }
                  style={styles.reviewCard}
                >
                  <View
                    style={
                      styles.reviewHeader
                    }
                  >
                    <View
                      style={
                        styles.reviewAvatar
                      }
                    >
                      <Text
                        style={
                          styles.reviewAvatarText
                        }
                      >
                        {String(
                          customerName
                        )
                          .trim()
                          .charAt(0)
                          .toUpperCase() ||
                          "R"}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.reviewHeaderCopy
                      }
                    >
                      <View
                        style={
                          styles.reviewNameRow
                        }
                      >
                        <Text
                          style={
                            styles.reviewName
                          }
                        >
                          {customerName}
                        </Text>

                        {verified ? (
                          <View
                            style={
                              styles.verifiedBadge
                            }
                          >
                            <Text
                              style={
                                styles.verifiedText
                              }
                            >
                              ✓ Verified
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text
                        style={
                          styles.reviewStars
                        }
                      >
                        {"★".repeat(
                          Math.max(
                            0,
                            Math.min(
                              5,
                              Math.round(
                                rating
                              )
                            )
                          )
                        )}
                        {"☆".repeat(
                          Math.max(
                            0,
                            5 -
                              Math.max(
                                0,
                                Math.min(
                                  5,
                                  Math.round(
                                    rating
                                  )
                                )
                              )
                          )
                        )}
                      </Text>
                    </View>
                  </View>

                  {title ? (
                    <Text
                      style={
                        styles.reviewTitle
                      }
                    >
                      {title}
                    </Text>
                  ) : null}

                  {comment ? (
                    <Text
                      style={
                        styles.reviewComment
                      }
                    >
                      {comment}
                    </Text>
                  ) : null}

                  {images.length ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={
                        false
                      }
                      contentContainerStyle={
                        styles.reviewImages
                      }
                    >
                      {images.map(
                        (
                          image: any,
                          imageIndex: number
                        ) => {
                          const raw =
                            typeof image ===
                            "string"
                              ? image
                              : image.image_url ||
                                image.image ||
                                image.url;

                          const uri =
                            productImageUrl(
                              raw
                            );

                          if (!uri) {
                            return null;
                          }

                          return (
                            <Image
                              key={`${raw}-${imageIndex}`}
                              source={{
                                uri,
                              }}
                              style={
                                styles.reviewImage
                              }
                              resizeMode="cover"
                            />
                          );
                        }
                      )}
                    </ScrollView>
                  ) : null}

                  {adminReply ? (
                    <View
                      style={
                        styles.adminReply
                      }
                    >
                      <Text
                        style={
                          styles.adminReplyTitle
                        }
                      >
                        RUKHNAV
                      </Text>

                      <Text
                        style={
                          styles.adminReplyText
                        }
                      >
                        {adminReply}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.noReviews}>
              <Text
                style={styles.noReviewsTitle}
              >
                No customer reviews yet
              </Text>

              <Text
                style={styles.noReviewsText}
              >
                Be the first customer to share
                your experience with this
                product.
              </Text>
            </View>
          )}
        </View>


        {relatedProducts.length ? (
          <View
            style={
              styles.relatedSection
            }
          >
            <View
              style={
                styles.sectionHeadingRow
              }
            >
              <Text
                style={styles.sectionTitle}
              >
                You May Also Like
              </Text>

              <Pressable
                onPress={() =>
                  router.push("/shop")
                }
              >
                <Text
                  style={
                    styles.viewAllText
                  }
                >
                  View All
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.relatedRow
              }
            >
              {relatedProducts.map(
                item => {
                  const image =
                    productImageUrl(
                      item.image
                    );

                  const normalPrice =
                    Number(
                      item.selling_price ||
                      0
                    );

                  const salePrice =
                    Number(
                      item.discount_price ||
                      0
                    );

                  const finalPrice =
                    salePrice > 0 &&
                    salePrice <
                      normalPrice
                      ? salePrice
                      : normalPrice;

                  return (
                    <Pressable
                      key={String(
                        item.id
                      )}
                      style={
                        styles.relatedCard
                      }
                      onPress={() =>
                        router.push(
                          `/product/${item.id}`
                        )
                      }
                    >
                      <View
                        style={
                          styles.relatedImageBox
                        }
                      >
                        {image ? (
                          <Image
                            source={{
                              uri: image,
                            }}
                            style={
                              styles.relatedImage
                            }
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={
                              styles.relatedPlaceholder
                            }
                          >
                            <Text
                              style={
                                styles.relatedPlaceholderText
                              }
                            >
                              RUKHNAV
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text
                        style={
                          styles.relatedCategory
                        }
                        numberOfLines={1}
                      >
                        {item.category ||
                          "RUKHNAV"}
                      </Text>

                      <Text
                        style={
                          styles.relatedName
                        }
                        numberOfLines={2}
                      >
                        {item.product_name}
                      </Text>

                      <View
                        style={
                          styles.relatedRating
                        }
                      >
                        <Text
                          style={
                            styles.relatedStar
                          }
                        >
                          ★
                        </Text>

                        <Text
                          style={
                            styles.relatedRatingText
                          }
                        >
                          {Number(
                            item.averageRating ||
                            0
                          )
                            ? Number(
                                item.averageRating
                              ).toFixed(1)
                            : "New"}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.relatedPrice
                        }
                      >
                        {money(
                          finalPrice
                        )}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </ScrollView>
          </View>
        ) : null}



      </ScrollView>

      {cartToast.visible ? (
        <View
          pointerEvents="box-none"
          style={styles.toastLayer}
        >
          <View style={styles.cartToast}>
            <View style={styles.toastTopRow}>
              <View style={styles.toastIcon}>
                <Text style={styles.toastIconText}>
                  ✓
                </Text>
              </View>

              <View style={styles.toastContent}>
                <Text style={styles.toastTitle}>
                  Added to Cart
                </Text>

                <Text
                  style={styles.toastMessage}
                  numberOfLines={2}
                >
                  {cartToast.message}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setCartToast({
                    visible: false,
                    message: "",
                  });
                }}
                hitSlop={10}
              >
                <Text style={styles.toastClose}>
                  ×
                </Text>
              </Pressable>
            </View>

            <View style={styles.toastActions}>
              <Pressable
                style={styles.toastSecondaryButton}
                onPress={() => {
                  setCartToast({
                    visible: false,
                    message: "",
                  });

                  router.back();
                }}
              >
                <Text
                  style={
                    styles.toastSecondaryText
                  }
                >
                  Continue Shopping
                </Text>
              </Pressable>

              <Pressable
                style={styles.toastPrimaryButton}
                onPress={() => {
                  setCartToast({
                    visible: false,
                    message: "",
                  });

                  router.push("/cart");
                }}
              >
                <Text
                  style={
                    styles.toastPrimaryText
                  }
                >
                  Go to Cart
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
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

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: theme.background,
      gap: 15,
    },

    centerText: {
      color: theme.primary,
    },

    error: {
      color: "#a44141",
      textAlign: "center",
    },

    backButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 22,
    },

    backButtonText: {
      color: theme.surface,
      fontWeight: "700",
    },

    topBar: {
      height: 60,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      backgroundColor: theme.primary,
    },

    topTitle: {
      color: theme.secondary,
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
      color: theme.surface,
      fontSize: 35,
      lineHeight: 36,
    },

    heart: {
      color: theme.surface,
      fontSize: 27,
    },

    content: {
      paddingBottom: 40,
    },

    purchaseArea: {
      paddingTop: 16,
      paddingHorizontal: 12,
    },

    purchaseGallery: {
      width: "100%",
    },

    purchaseControls: {
      marginHorizontal: 20,
      marginTop: 18,
    },

    purchaseOptionsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
    },

    quantitySection: {
      flex: 1,
    },

    quantityLabel: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "800",
    },

    quantityControl: {
      marginTop: 8,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 24,
      backgroundColor: theme.shade4,
      overflow: "hidden",
    },

    quantityButton: {
      width: 52,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },

    quantityButtonText: {
      color: theme.primary,
      fontSize: 23,
      fontWeight: "800",
    },

    quantityValue: {
      color: theme.primary,
      fontSize: 15,
      fontWeight: "900",
    },

    sizeSection: {
      flex: 1,
    },

    sizeLabel: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "800",
    },

    sizeRow: {
      marginTop: 8,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },

    sizeChip: {
      minWidth: 42,
      minHeight: 42,
      paddingHorizontal: 10,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.shade4,
      borderWidth: 1,
      borderColor: theme.shade4,
    },

    sizeChipText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: "800",
    },

    descriptionSection: {
      marginHorizontal: 20,
      marginTop: 28,
    },

    descriptionPlaceholder: {
      color: theme.muted,
      fontStyle: "italic",
    },


    galleryArea: {
      marginTop: 0,
    },

    imageBox: {
      marginHorizontal: 0,
      height: 265,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.shade4,
    },

    slide: {
      width: SCREEN_WIDTH - 24,
      height: 263,
      alignItems: "center",
      justifyContent: "center",
    },

    image: {
      width: "100%",
      height: "100%",
    },

    imageCounter: {
      position: "absolute",
      right: 13,
      bottom: 13,
      minWidth: 48,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.primary,
      alignItems: "center",
    },

    imageCounterText: {
      color: theme.surface,
      fontSize: 10,
      fontWeight: "800",
    },

    thumbnailRow: {
      paddingHorizontal: 0,
      paddingTop: 8,
      paddingBottom: 2,
      gap: 9,
    },

    thumbnailBox: {
      width: 58,
      height: 58,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.shade4,
    },

    thumbnailBoxActive: {
      borderWidth: 2,
      borderColor: theme.secondary,
    },

    thumbnailImage: {
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
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 3,
    },

    category: {
      marginHorizontal: 20,
      marginTop: 6,
      color: theme.secondary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },

    name: {
      marginHorizontal: 20,
      marginTop: 6,
      color: theme.primary,
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
      color: theme.secondary,
      fontSize: 17,
    },

    rating: {
      color: theme.text,
      marginLeft: 5,
      fontWeight: "700",
    },

    reviews: {
      color: theme.muted,
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
      color: theme.primary,
      fontSize: 27,
      fontWeight: "800",
    },

    oldPrice: {
      color: theme.muted,
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
      color: theme.primary,
      fontSize: 18,
      fontWeight: "800",
    },

    sectionText: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 7,
    },

    sku: {
      marginHorizontal: 20,
      marginTop: 25,
      color: theme.muted,
      fontSize: 11,
    },

    reviewsSection: {
      marginHorizontal: 20,
      marginTop: 28,
    },

    sectionHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginBottom: 13,
    },

    reviewTotal: {
      color: theme.muted,
      fontSize: 11,
      fontWeight: "600",
    },

    reviewLoading: {
      minHeight: 80,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },

    reviewLoadingText: {
      color: theme.muted,
      fontSize: 11,
    },

    reviewCard: {
      paddingVertical: 15,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        theme.shade4,
    },

    reviewHeader: {
      flexDirection: "row",
      alignItems: "center",
    },

    reviewAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    reviewAvatarText: {
      color: theme.secondary,
      fontSize: 15,
      fontWeight: "900",
    },

    reviewHeaderCopy: {
      flex: 1,
      marginLeft: 10,
    },

    reviewNameRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 7,
    },

    reviewName: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "800",
    },

    verifiedBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 10,
      backgroundColor:
        theme.shade4,
    },

    verifiedText: {
      color: theme.primary,
      fontSize: 8,
      fontWeight: "800",
    },

    reviewStars: {
      color: theme.secondary,
      fontSize: 13,
      marginTop: 2,
      letterSpacing: 1,
    },

    reviewTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 11,
    },

    reviewComment: {
      color: theme.text,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 5,
    },

    reviewImages: {
      paddingTop: 11,
      gap: 8,
    },

    reviewImage: {
      width: 82,
      height: 82,
      borderRadius: 12,
      backgroundColor:
        theme.shade4,
    },

    adminReply: {
      marginTop: 12,
      padding: 11,
      borderRadius: 12,
      backgroundColor:
        theme.shade4,
    },

    adminReplyTitle: {
      color: theme.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },

    adminReplyText: {
      color: theme.text,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 4,
    },

    noReviews: {
      padding: 16,
      borderRadius: 14,
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    noReviewsTitle: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "800",
    },

    noReviewsText: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 4,
    },

    relatedSection: {
      marginTop: 28,
    },

    relatedRow: {
      paddingHorizontal: 20,
      gap: 10,
      paddingBottom: 2,
    },

    viewAllText: {
      color: theme.secondary,
      fontSize: 11,
      fontWeight: "800",
      marginRight: 20,
    },

    relatedCard: {
      width: 132,
      padding: 8,
      borderRadius: 15,
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    relatedImageBox: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 11,
      overflow: "hidden",
      backgroundColor:
        theme.shade4,
    },

    relatedImage: {
      width: "100%",
      height: "100%",
    },

    relatedPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    relatedPlaceholderText: {
      color: theme.primary,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    relatedCategory: {
      color: theme.secondary,
      fontSize: 8,
      fontWeight: "800",
      marginTop: 8,
      textTransform:
        "uppercase",
    },

    relatedName: {
      minHeight: 31,
      color: theme.text,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
      marginTop: 3,
    },

    relatedRating: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 5,
    },

    relatedStar: {
      color: theme.secondary,
      fontSize: 11,
    },

    relatedRatingText: {
      color: theme.muted,
      fontSize: 9,
      marginLeft: 3,
    },

    relatedPrice: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "900",
      marginTop: 5,
    },


    actionRow: {
      marginTop: 16,
      flexDirection: "row",
      gap: 10,
    },

    cartButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 28,
      paddingVertical: 15,
      alignItems: "center",
    },

    cartButtonText: {
      color: theme.primary,
      fontWeight: "800",
    },

    buyButton: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 28,
      paddingVertical: 15,
      alignItems: "center",
    },

    toastLayer: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      backgroundColor: "rgba(0,0,0,0.18)",
    },

    cartToast: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.secondary,
      borderRadius: 18,
      paddingHorizontal: 18,
      paddingVertical: 18,
      shadowColor: "#000000",
      shadowOpacity: 0.16,
      shadowRadius: 16,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation: 10,
    },

    toastTopRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    toastActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },

    toastSecondaryButton: {
      flex: 1,
      minHeight: 42,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },

    toastSecondaryText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: "800",
    },

    toastPrimaryButton: {
      flex: 1,
      minHeight: 42,
      backgroundColor: theme.primary,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },

    toastPrimaryText: {
      color: theme.surface,
      fontSize: 11,
      fontWeight: "800",
    },

    toastIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },

    toastIconText: {
      color: theme.surface,
      fontSize: 18,
      fontWeight: "800",
    },

    toastContent: {
      flex: 1,
    },

    toastTitle: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: "800",
    },

    toastMessage: {
      marginTop: 6,
      color: theme.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      textAlign: "center",
    },

    toastClose: {
      marginLeft: 10,
      color: theme.accent,
      fontSize: 22,
      lineHeight: 24,
      fontWeight: "700",
    },

    buyButtonText: {
      color: theme.surface,
      fontWeight: "800",
    },

    disabled: {
      opacity: 0.4,
    },
    });
}
