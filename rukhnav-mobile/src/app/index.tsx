import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { router } from "expo-router";

import { getProducts } from "../api/products";
import { getCategories } from "../api/categories";
import {
  getCustomerProfile,
} from "../api/profile";
import {
  getToken,
} from "../auth/session";
import { productImageUrl } from "../config/images";
import type { Product } from "../types/product";
import type { Category } from "../types/category";

import {
  useWebsiteTheme,
} from "../theme/website-theme";

const SCREEN_WIDTH =
  Dimensions.get("window").width;

const SLIDER_HORIZONTAL_MARGIN = 14;

const SLIDER_WIDTH =
  SCREEN_WIDTH -
  SLIDER_HORIZONTAL_MARGIN * 2;

const SLIDER_GAP = 10;

const SLIDER_SNAP =
  SLIDER_WIDTH + SLIDER_GAP;

function darkenHex(
  colour: string,
  amount = 0.58
) {
  const value =
    /^#[0-9a-fA-F]{6}$/.test(colour)
      ? colour
      : "#173f2b";

  const red =
    parseInt(value.slice(1, 3), 16);

  const green =
    parseInt(value.slice(3, 5), 16);

  const blue =
    parseInt(value.slice(5, 7), 16);

  const factor =
    Math.max(
      0,
      Math.min(1, amount)
    );

  const channel = (number: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(number * factor)
      )
    )
      .toString(16)
      .padStart(2, "0");

  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function money(value: string | number) {
  const amount = Number(value || 0);

  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

function finalProductPrice(product: Product) {
  const selling =
    Number(product.selling_price || 0);

  const discount =
    Number(product.discount_price || 0);

  return discount > 0 &&
    discount < selling
    ? discount
    : selling;
}

function discountPercent(product: Product) {
  const selling =
    Number(product.selling_price || 0);

  const discount =
    Number(product.discount_price || 0);

  if (
    selling <= 0 ||
    discount <= 0 ||
    discount >= selling
  ) {
    return 0;
  }

  return Math.round(
    ((selling - discount) / selling) * 100
  );
}

const CATEGORY_ICON_SYMBOLS:
  Record<string, string> = {
    leaf: "❧",
    droplet: "💧",
    sparkles: "✦",
    flower: "✿",
    heart: "♥",
    sun: "☀",
    bottle: "♢",
    seedling: "♧",
    spa: "✾",
    hair: "✧",
    gift: "🎁",
    star: "★",
    beauty: "✦",
    cleanser: "◇",
    shopping: "◆",
    shirt: "♜",
  };

function categoryIconSymbol(
  iconKey?: string | null
) {
  return (
    CATEGORY_ICON_SYMBOLS[
      String(iconKey || "")
        .trim()
        .toLowerCase()
    ] ||
    CATEGORY_ICON_SYMBOLS.sparkles
  );
}

function safeCategoryColour(
  colour?: string | null
) {
  const value =
    String(colour || "").trim();

  return /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#D4A72C";
}

function SectionHeader({
  eyebrow,
  title,
  action = "See All",
  onPress,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        {eyebrow ? (
          <Text style={styles.sectionEyebrow}>
            {eyebrow}
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>
          {title}
        </Text>
      </View>

      {onPress ? (
        <Pressable
          style={styles.seeAllButton}
          onPress={onPress}
        >
          <Text style={styles.seeAllText}>
            {action}
          </Text>

          <Text style={styles.seeAllArrow}>
            ›
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CompactProductCard({
  product,
}: {
  product: Product;
}) {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  const image =
    productImageUrl(product.image);

  const finalPrice =
    finalProductPrice(product);

  const saving =
    discountPercent(product);

  const rating =
    Number(product.averageRating || 0);

  return (
    <Pressable
      style={styles.compactProductCard}
      onPress={() =>
        router.push(`/product/${product.id}`)
      }
    >
      <View style={styles.compactImageBox}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.compactProductImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderBrand}>
              RUKHNAV
            </Text>
          </View>
        )}

        {saving > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>
              -{saving}%
            </Text>
          </View>
        ) : product.is_featured ? (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>
              FEATURED
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.compactProductContent}>
        <Text
          style={styles.compactCategory}
          numberOfLines={1}
        >
          {product.category || "RUKHNAV"}
        </Text>

        <Text
          style={styles.compactProductName}
          numberOfLines={2}
        >
          {product.product_name}
        </Text>

        <View style={styles.compactRatingRow}>
          <Text style={styles.star}>
            ★
          </Text>

          <Text style={styles.compactRatingText}>
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

        <Text style={styles.compactPrice}>
          {money(finalPrice)}
        </Text>

        {saving > 0 ? (
          <Text style={styles.oldPrice}>
            {money(product.selling_price)}
          </Text>
        ) : null}

        <Text
          style={[
            styles.compactStock,
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

function ProductGridCard({
  product,
}: {
  product: Product;
}) {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  const image =
    productImageUrl(product.image);

  const finalPrice =
    finalProductPrice(product);

  const rating =
    Number(product.averageRating || 0);

  const saving =
    discountPercent(product);

  return (
    <Pressable
      style={styles.gridProductCard}
      onPress={() =>
        router.push(`/product/${product.id}`)
      }
    >
      <View style={styles.gridImageBox}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.gridProductImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderBrand}>
              RUKHNAV
            </Text>
          </View>
        )}

        {saving > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>
              -{saving}%
            </Text>
          </View>
        ) : product.is_featured ? (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>
              FEATURED
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.gridProductContent}>
        <Text
          style={styles.gridCategory}
          numberOfLines={1}
        >
          {product.category || "RUKHNAV"}
        </Text>

        <Text
          style={styles.gridProductName}
          numberOfLines={2}
        >
          {product.product_name}
        </Text>

        <View style={styles.gridRatingRow}>
          <Text style={styles.star}>
            ★
          </Text>

          <Text style={styles.gridRating}>
            {rating
              ? rating.toFixed(1)
              : "New"}
          </Text>

          {product.totalReviews > 0 ? (
            <Text style={styles.gridReviewCount}>
              ({product.totalReviews})
            </Text>
          ) : null}
        </View>

        <Text style={styles.gridPrice}>
          {money(finalPrice)}
        </Text>

        <Text
          style={[
            styles.gridStock,
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

function ProductSlider({
  products,
}: {
  products: Product[];
}) {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  const sliderRef =
    useRef<FlatList<Product>>(null);

  const [activeIndex, setActiveIndex] =
    useState(0);

  useEffect(() => {
    if (products.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setActiveIndex(current => {
        const next =
          (current + 1) %
          products.length;

        sliderRef.current?.scrollToIndex({
          index: next,
          animated: true,
        });

        return next;
      });
    }, 4200);

    return () => {
      clearInterval(timer);
    };
  }, [products.length]);

  if (!products.length) {
    return null;
  }

  function handleMomentumEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    const next =
      Math.round(
        event.nativeEvent.contentOffset.x /
          SLIDER_SNAP
      );

    setActiveIndex(
      Math.max(
        0,
        Math.min(next, products.length - 1)
      )
    );
  }

  return (
    <View style={styles.sliderSection}>
      <FlatList
        ref={sliderRef}
        horizontal
        pagingEnabled
        data={products}
        keyExtractor={item =>
          `slider-${item.id}`
        }
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal:
            SLIDER_HORIZONTAL_MARGIN,
        }}
        snapToInterval={SLIDER_SNAP}
        decelerationRate="fast"
        onMomentumScrollEnd={
          handleMomentumEnd
        }
        getItemLayout={(_, index) => ({
          length: SLIDER_SNAP,
          offset: SLIDER_SNAP * index,
          index,
        })}
        renderItem={({ item }) => {
          const image =
            productImageUrl(item.image);

          const finalPrice =
            finalProductPrice(item);

          const saving =
            discountPercent(item);

          return (
            <Pressable
              style={styles.sliderCard}
              onPress={() =>
                router.push(
                  `/product/${item.id}`
                )
              }
            >
              <View style={styles.sliderCopy}>
                <Text
                  style={styles.sliderEyebrow}
                >
                  {saving > 0
                    ? `${saving}% OFF`
                    : "RUKHNAV FEATURED"}
                </Text>

                <Text
                  style={styles.sliderTitle}
                  numberOfLines={2}
                >
                  {item.product_name}
                </Text>

                <Text
                  style={styles.sliderCategory}
                  numberOfLines={1}
                >
                  {item.category ||
                    "Premium Care"}
                </Text>

                <View style={styles.sliderPriceRow}>
                  <Text
                    style={styles.sliderPrice}
                  >
                    {money(finalPrice)}
                  </Text>

                  {saving > 0 ? (
                    <Text
                      style={
                        styles.sliderOldPrice
                      }
                    >
                      {money(
                        item.selling_price
                      )}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={styles.sliderShopButton}
                >
                  <Text
                    style={
                      styles.sliderShopText
                    }
                  >
                    SHOP NOW
                  </Text>

                  <Text
                    style={
                      styles.sliderShopArrow
                    }
                  >
                    ›
                  </Text>
                </View>
              </View>

              <View style={styles.sliderImageArea}>
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={styles.sliderImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={
                      styles.sliderPlaceholder
                    }
                  >
                    <Text
                      style={
                        styles.sliderPlaceholderText
                      }
                    >
                      RUKHNAV
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {products.length > 1 ? (
        <View style={styles.sliderDots}>
          {products.map((product, index) => (
            <View
              key={`dot-${product.id}`}
              style={[
                styles.sliderDot,
                index === activeIndex &&
                  styles.sliderDotActive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ServiceStrip() {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  const services = [
    {
      icon: "🚚",
      title: "Free Delivery",
      text: "Rs. 3,000+",
    },
    {
      icon: "↻",
      title: "Easy Returns",
      text: "Simple support",
    },
    {
      icon: "✓",
      title: "Secure",
      text: "Safe checkout",
    },
    {
      icon: "♛",
      title: "Rewards",
      text: "Earn points",
    },
  ];

  return (
    <View style={styles.serviceStrip}>
      {services.map(
        (service, index) => (
          <View
            key={service.title}
            style={styles.serviceEntry}
          >
            {index > 0 ? (
              <View
                style={styles.serviceDivider}
              />
            ) : null}

            <Pressable
              style={styles.serviceItem}
              onPress={
                service.title === "Rewards"
                  ? () =>
                      router.push(
                        "/rewards"
                      )
                  : undefined
              }
            >
              <Text
                style={styles.serviceIcon}
              >
                {service.icon}
              </Text>

              <Text
                style={styles.serviceTitle}
                numberOfLines={2}
              >
                {service.title}
              </Text>

              <Text
                style={styles.serviceText}
                numberOfLines={2}
              >
                {service.text}
              </Text>
            </Pressable>
          </View>
        )
      )}
    </View>
  );
}

function CommercePromos() {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.promoRow}>
      <Pressable
        style={[
          styles.promoCard,
          styles.promoCardWarm,
        ]}
        onPress={() =>
          router.push("/shop")
        }
      >
        <View style={styles.promoIconBox}>
          <Text style={styles.promoIcon}>
            %
          </Text>
        </View>

        <View style={styles.promoCopy}>
          <Text style={styles.promoTitle}>
            RUKHNAV Offers
          </Text>

          <Text
            style={styles.promoText}
            numberOfLines={2}
          >
            Discover active savings and selected deals
          </Text>
        </View>

        <Text style={styles.promoArrow}>
          ›
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.promoCard,
          styles.promoCardCool,
        ]}
        onPress={() =>
          router.push("/shop")
        }
      >
        <View style={styles.promoIconBox}>
          <Text style={styles.promoIcon}>
            🎁
          </Text>
        </View>

        <View style={styles.promoCopy}>
          <Text style={styles.promoTitle}>
            New Arrivals
          </Text>

          <Text
            style={styles.promoText}
            numberOfLines={2}
          >
            Explore the latest products from RUKHNAV
          </Text>
        </View>

        <Text style={styles.promoArrow}>
          ›
        </Text>
      </Pressable>
    </View>
  );
}

function CategoriesForYou({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (name: string) => void;
}) {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  if (!categories.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader
        eyebrow="EXPLORE MORE"
        title="Categories for You"
        onPress={() =>
          router.push("/shop")
        }
      />

      <FlatList
        horizontal
        data={categories.slice(0, 8)}
        keyExtractor={item =>
          `category-feature-${item.id}`
        }
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.categoryFeatureList
        }
        renderItem={({ item }) => {
          const iconColour =
            safeCategoryColour(
              item.icon_color
            );

          return (
            <Pressable
              style={
                styles.categoryFeatureCard
              }
              onPress={() =>
                onSelect(
                  item.category_name
                )
              }
            >
              <View
                style={[
                  styles.categoryFeatureVisual,
                  {
                    backgroundColor:
                      `${iconColour}14`,
                    borderColor:
                      `${iconColour}35`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryFeatureIcon,
                    {
                      color:
                        iconColour,
                    },
                  ]}
                >
                  {categoryIconSymbol(
                    item.icon_key
                  )}
                </Text>

                <View
                  style={[
                    styles.categoryFeatureOrb,
                    {
                      backgroundColor:
                        `${iconColour}18`,
                    },
                  ]}
                />
              </View>

              <Text
                style={
                  styles.categoryFeatureName
                }
                numberOfLines={1}
              >
                {item.category_name}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}


function StoreBenefits() {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.storeBenefits}>
      <View style={styles.membershipTopRow}>
        <View style={styles.membershipBadge}>
          <Text style={styles.membershipBadgeIcon}>
            ★
          </Text>
        </View>

        <View style={styles.membershipCopy}>
          <Text style={styles.benefitsEyebrow}>
            RUKHNAV REWARDS
          </Text>

          <Text style={styles.benefitsTitle}>
            More value with every order
          </Text>

          <Text style={styles.membershipDescription}>
            Earn points and unlock exclusive member benefits.
          </Text>
        </View>
      </View>

      <View style={styles.membershipStats}>
        <View style={styles.membershipStat}>
          <Text style={styles.membershipStatValue}>
            Gold
          </Text>

          <Text style={styles.membershipStatLabel}>
            5% discount
          </Text>
        </View>

        <View style={styles.membershipStatDivider} />

        <View style={styles.membershipStat}>
          <Text style={styles.membershipStatValue}>
            Platinum
          </Text>

          <Text style={styles.membershipStatLabel}>
            10% discount
          </Text>
        </View>

        <View style={styles.membershipStatDivider} />

        <View style={styles.membershipStat}>
          <Text style={styles.membershipStatValue}>
            Rewards
          </Text>

          <Text style={styles.membershipStatLabel}>
            Earn points
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.rewardsButton}
        onPress={() =>
          router.push("/rewards")
        }
      >
        <Text style={styles.rewardsButtonText}>
          VIEW MY REWARDS
        </Text>

        <Text style={styles.rewardsArrow}>
          ›
        </Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useWebsiteTheme();
  const styles = createStyles(theme);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    profilePictureUrl,
    setProfilePictureUrl,
  ] = useState<string | null>(null);

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

  const loadCategories =
    useCallback(async () => {
      try {
        const rows =
          await getCategories();

        if (rows.length) {
          setCategories(rows);
          return;
        }
      } catch {
        // Product-derived fallback keeps shopping usable.
      }

      setCategories([]);
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
        loadCategories(),
        loadAccountPhoto(),
      ]);

      setLoading(false);
    })();
  }, [
    loadProducts,
    loadCategories,
    loadAccountPhoto,
  ]);

  async function refresh() {
    setRefreshing(true);

    await Promise.all([
      loadProducts(),
      loadCategories(),
      loadAccountPhoto(),
    ]);

    setRefreshing(false);
  }

  const fallbackCategoryNames =
    useMemo(
      () =>
        Array.from(
          new Set(
            products
              .map(product =>
                String(
                  product.category || ""
                ).trim()
              )
              .filter(Boolean)
          )
        ),
      [products]
    );

  const displayCategories:
    Category[] =
    useMemo(
      () =>
        categories.length
          ? categories
          : fallbackCategoryNames.map(
              (categoryName, index) => ({
                id: -(index + 1),
                category_name:
                  categoryName,
                description: null,
                image: null,
                icon_key: "sparkles",
                icon_color: "#D4A72C",
                status: "active",
              })
            ),
      [
        categories,
        fallbackCategoryNames,
      ]
    );

  const featuredProducts =
    useMemo(() => {
      const featured =
        products.filter(
          product =>
            Boolean(product.is_featured) &&
            Number(
              product.stock_quantity
            ) > 0
        );

      const source =
        featured.length
          ? featured
          : products.filter(
              product =>
                Number(
                  product.stock_quantity
                ) > 0
            );

      return source.slice(0, 6);
    }, [products]);

  const popularProducts =
    useMemo(
      () =>
        [...products]
          .sort((a, b) => {
            const ratingDifference =
              Number(
                b.averageRating || 0
              ) -
              Number(
                a.averageRating || 0
              );

            if (ratingDifference) {
              return ratingDifference;
            }

            return (
              Number(
                b.totalReviews || 0
              ) -
              Number(
                a.totalReviews || 0
              )
            );
          })
          .slice(0, 8),
      [products]
    );

  const newArrivals =
    useMemo(
      () =>
        [...products]
          .sort(
            (a, b) =>
              Number(b.id) -
              Number(a.id)
          )
          .slice(0, 8),
      [products]
    );

  const filteredProducts =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      return products.filter(product => {
        const categoryMatch =
          selectedCategory === "All" ||
          String(
            product.category || ""
          )
            .trim()
            .toLowerCase() ===
            selectedCategory
              .trim()
              .toLowerCase();

        if (!categoryMatch) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          product.product_name,
          product.category,
          product.brand,
          product.description,
          product.sku,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    }, [
      products,
      selectedCategory,
      searchQuery,
    ]);

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingPage}
      >
        <StatusBar
          barStyle="light-content"
        />

        <Text style={styles.loadingLogo}>
          RUKHNAV
        </Text>

        <ActivityIndicator
          size="large"
          color={theme.secondary}
        />

        <Text style={styles.loadingText}>
          Preparing your store...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.page}
      edges={["top"]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.primary}
      />

      <View style={styles.header}>
        <View style={styles.topHeaderRow}>
          <Pressable
            style={styles.brandArea}
            onPress={() =>
              router.push("/")
            }
          >
            <Text style={styles.logo}>
              RUKHNAV
            </Text>

            <Text style={styles.tagline}>
              NATURAL BEAUTY
            </Text>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerIconButton}
              onPress={() =>
                router.push("/account")
              }
            >
              <Text
                style={
                  styles.headerActionIcon
                }
              >
                ♢
              </Text>

              <View
                style={
                  styles.notificationDot
                }
              />
            </Pressable>

            <Pressable
              style={styles.headerIconButton}
              onPress={() =>
                router.push("/cart")
              }
            >
              <Text
                style={
                  styles.headerActionIcon
                }
              >
                🛒
              </Text>
            </Pressable>

            <Pressable
              style={styles.accountArea}
              onPress={() =>
                router.push("/account")
              }
            >
              <View
                style={
                  styles.accountButton
                }
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
            </Pressable>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>
            ⌕
          </Text>

          <TextInput
            value={searchQuery}
            onChangeText={value => {
              setSearchQuery(value);
            }}
            placeholder="Search RUKHNAV products"
            placeholderTextColor={
              theme.muted
            }
            style={styles.searchInput}
            returnKeyType="search"
          />

          {searchQuery ? (
            <Pressable
              style={styles.clearSearch}
              onPress={() =>
                setSearchQuery("")
              }
            >
              <Text
                style={
                  styles.clearSearchText
                }
              >
                ×
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.deliveryRow}>
          <Text style={styles.deliveryIcon}>
            ⌖
          </Text>

          <View style={styles.deliveryCopy}>
            <Text
              style={styles.deliveryLabel}
            >
              Delivering across Pakistan
            </Text>

            <Text
              style={styles.deliverySubtext}
            >
              Quality care, delivered to your door
            </Text>
          </View>

          <Text style={styles.deliveryArrow}>
            ›
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.primary}
          />
        }
      >
        {searchQuery.trim() ? (
          <View
            style={
              styles.liveSearchSection
            }
          >
            <View
              style={
                styles.liveSearchHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.liveSearchEyebrow
                  }
                >
                  SEARCH RESULTS
                </Text>

                <Text
                  style={
                    styles.liveSearchTitle
                  }
                >
                  Results for “
                  {searchQuery.trim()}”
                </Text>
              </View>

              <Text
                style={
                  styles.liveSearchCount
                }
              >
                {filteredProducts.length}{" "}
                {filteredProducts.length ===
                1
                  ? "item"
                  : "items"}
              </Text>
            </View>

            {filteredProducts.length ? (
              <View
                style={
                  styles.productGrid
                }
              >
                {filteredProducts.map(
                  product => (
                    <View
                      key={`live-${product.id}`}
                      style={
                        styles.productGridCell
                      }
                    >
                      <ProductGridCard
                        product={product}
                      />
                    </View>
                  )
                )}
              </View>
            ) : (
              <View
                style={styles.empty}
              >
                <Text
                  style={
                    styles.emptyIcon
                  }
                >
                  ◇
                </Text>

                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  No products found
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Try another product name,
                  category or search term.
                </Text>

                <Pressable
                  style={
                    styles.emptyResetButton
                  }
                  onPress={() =>
                    setSearchQuery("")
                  }
                >
                  <Text
                    style={
                      styles.emptyResetText
                    }
                  >
                    CLEAR SEARCH
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <View style={styles.errorCopy}>
              <Text
                style={styles.errorTitle}
              >
                Store update unavailable
              </Text>

              <Text
                style={styles.errorText}
              >
                {error}
              </Text>
            </View>

            <Pressable
              style={styles.retryButton}
              onPress={refresh}
            >
              <Text
                style={styles.retryText}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}

        <ProductSlider
          products={featuredProducts}
        />

        <ServiceStrip />

        <View style={styles.section}>
          <SectionHeader
            eyebrow="DISCOVER"
            title="Shop by Category"
            onPress={() =>
              router.push("/shop")
            }
          />

          <FlatList
            horizontal
            data={[
              {
                id: 0,
                category_name: "All",
                description: null,
                image: null,
                icon_key: "sparkles",
                icon_color:
                  theme.secondary,
                status: "active",
              } as Category,
              ...displayCategories,
            ]}
            keyExtractor={item =>
              `category-${item.id}-${item.category_name}`
            }
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.categoryList
            }
            renderItem={({ item }) => {
              const active =
                selectedCategory ===
                item.category_name;

              const iconColour =
                safeCategoryColour(
                  item.icon_color
                );

              return (
                <Pressable
                  onPress={() =>
                    setSelectedCategory(
                      item.category_name
                    )
                  }
                  style={
                    styles.categoryItem
                  }
                >
                  <View
                    style={[
                      styles.categoryCircle,
                      {
                        borderColor:
                          active
                            ? theme.primary
                            : iconColour,
                        backgroundColor:
                          active
                            ? theme.primary
                            : `${iconColour}12`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryIcon,
                        {
                          color: active
                            ? theme.surface
                            : iconColour,
                        },
                      ]}
                    >
                      {categoryIconSymbol(
                        item.icon_key
                      )}
                    </Text>
                  </View>

                  <Text
                    numberOfLines={2}
                    style={[
                      styles.categoryName,
                      active &&
                        styles.categoryNameActive,
                    ]}
                  >
                    {item.category_name}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <CommercePromos />

        {popularProducts.length ? (
          <View style={styles.section}>
            <SectionHeader
              eyebrow="CUSTOMER FAVOURITES"
              title="Popular Products"
              onPress={() =>
                router.push("/shop")
              }
            />

            <FlatList
              horizontal
              data={popularProducts}
              keyExtractor={item =>
                `popular-${item.id}`
              }
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.horizontalProducts
              }
              renderItem={({ item }) => (
                <CompactProductCard
                  product={item}
                />
              )}
            />
          </View>
        ) : null}

        {newArrivals.length ? (
          <View style={styles.section}>
            <SectionHeader
              eyebrow="FRESH FROM RUKHNAV"
              title="New Arrivals"
              onPress={() =>
                router.push("/shop")
              }
            />

            <FlatList
              horizontal
              data={newArrivals}
              keyExtractor={item =>
                `new-${item.id}`
              }
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.horizontalProducts
              }
              renderItem={({ item }) => (
                <CompactProductCard
                  product={item}
                />
              )}
            />
          </View>
        ) : null}

        <CategoriesForYou
          categories={displayCategories}
          onSelect={name => {
            setSelectedCategory(name);
            setSearchQuery("");
          }}
        />

        {!searchQuery.trim() ? (
        <View
          style={styles.catalogueSection}
        >
          <SectionHeader
            eyebrow={
              selectedCategory === "All"
                ? "SELECTED FOR YOU"
                : selectedCategory.toUpperCase()
            }
            title={
              searchQuery
                ? "Search Results"
                : selectedCategory ===
                    "All"
                  ? "Recommended for You"
                  : selectedCategory
            }
            action={`${filteredProducts.length} items`}
          />

          {searchQuery ? (
            <View
              style={
                styles.searchResultNotice
              }
            >
              <Text
                style={
                  styles.searchResultText
                }
              >
                Results for “{searchQuery}”
              </Text>

              <Pressable
                onPress={() =>
                  setSearchQuery("")
                }
              >
                <Text
                  style={
                    styles.searchResultClear
                  }
                >
                  Clear
                </Text>
              </Pressable>
            </View>
          ) : null}

          {filteredProducts.length ? (
            <View style={styles.productGrid}>
              {filteredProducts.map(
                product => (
                  <View
                    key={`grid-${product.id}`}
                    style={
                      styles.productGridCell
                    }
                  >
                    <ProductGridCard
                      product={product}
                    />
                  </View>
                )
              )}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>
                ◇
              </Text>

              <Text
                style={styles.emptyTitle}
              >
                No products found
              </Text>

              <Text
                style={styles.emptyText}
              >
                Try another category or search term.
              </Text>

              <Pressable
                style={
                  styles.emptyResetButton
                }
                onPress={() => {
                  setSearchQuery("");
                  setSelectedCategory(
                    "All"
                  );
                }}
              >
                <Text
                  style={
                    styles.emptyResetText
                  }
                >
                  SHOW ALL PRODUCTS
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        ) : null}

        <StoreBenefits />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(
  theme: ReturnType<typeof useWebsiteTheme>
) {
  const commerceHeader =
    darkenHex(theme.primary, 0.28);

  const commerceHeaderDeep =
    darkenHex(theme.primary, 0.18);

  return StyleSheet.create({
    liveSearchSection: {
      paddingTop: 18,
      paddingBottom: 8,
    },

    liveSearchHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 14,
    },

    liveSearchEyebrow: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginBottom: 4,
    },

    liveSearchTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "800",
      flexShrink: 1,
    },

    liveSearchCount: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: "700",
      paddingBottom: 2,
    },

    page: {
      flex: 1,
      backgroundColor:
        theme.surface,
    },

    scroll: {
      flex: 1,
    },

    content: {
      paddingBottom: 28,
    },

    loadingPage: {
      flex: 1,
      backgroundColor:
        theme.primary,
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
    },

    loadingLogo: {
      color: theme.secondary,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: 7,
    },

    loadingText: {
      color: theme.surface,
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0.5,
    },

    header: {
      backgroundColor:
        commerceHeader,
      paddingHorizontal: 14,
      paddingTop: 7,
      paddingBottom: 10,
    },

    topHeaderRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    brandArea: {
      flex: 1,
      justifyContent: "center",
    },

    logo: {
      color: theme.secondary,
      fontSize: 22,
      lineHeight: 25,
      fontWeight: "900",
      letterSpacing: 4.2,
    },

    tagline: {
      marginTop: 1,
      color: theme.surface,
      opacity: 0.76,
      fontSize: 7,
      fontWeight: "800",
      letterSpacing: 1.7,
    },

    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    headerIconButton: {
      position: "relative",
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.14)",
      backgroundColor:
        "rgba(255,255,255,0.07)",
    },

    headerActionIcon: {
      color: theme.surface,
      fontSize: 17,
    },

    notificationDot: {
      position: "absolute",
      top: 7,
      right: 7,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        theme.secondary,
    },

    accountArea: {
      marginLeft: 1,
    },

    accountButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      overflow: "hidden",
      borderWidth: 1.5,
      borderColor:
        theme.secondary,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        commerceHeaderDeep,
    },

    accountImage: {
      width: "100%",
      height: "100%",
    },

    accountIcon: {
      color: theme.surface,
      fontSize: 19,
    },

    searchBar: {
      minHeight: 45,
      marginTop: 9,
      paddingHorizontal: 12,
      borderRadius: 11,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        theme.surface,
    },

    searchIcon: {
      width: 25,
      color: theme.primary,
      fontSize: 22,
      lineHeight: 24,
    },

    searchInput: {
      flex: 1,
      minHeight: 44,
      paddingVertical: 0,
      color: theme.text,
      fontSize: 13,
      fontWeight: "500",
    },

    clearSearch: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },

    clearSearchText: {
      color: theme.muted,
      fontSize: 23,
      lineHeight: 24,
    },

    deliveryRow: {
      minHeight: 39,
      paddingTop: 9,
      flexDirection: "row",
      alignItems: "center",
    },

    deliveryIcon: {
      width: 28,
      color: theme.secondary,
      fontSize: 17,
    },

    deliveryCopy: {
      flex: 1,
    },

    deliveryLabel: {
      color: theme.surface,
      fontSize: 10,
      fontWeight: "800",
    },

    deliverySubtext: {
      marginTop: 1,
      color: theme.surface,
      opacity: 0.65,
      fontSize: 8,
    },

    deliveryArrow: {
      color: theme.secondary,
      fontSize: 22,
      lineHeight: 24,
    },

    errorBox: {
      marginHorizontal: 14,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fff0ed",
    },

    errorCopy: {
      flex: 1,
    },

    errorTitle: {
      color: "#8d2d2d",
      fontSize: 12,
      fontWeight: "900",
    },

    errorText: {
      marginTop: 2,
      color: "#754949",
      fontSize: 9,
    },

    retryButton: {
      marginLeft: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor:
        theme.primary,
    },

    retryText: {
      color: theme.surface,
      fontSize: 9,
      fontWeight: "900",
    },

    sliderSection: {
      marginTop: 12,
      marginBottom: 2,
    },

    sliderCard: {
      width: SLIDER_WIDTH,
      minHeight: 190,
      marginRight:
        SLIDER_GAP,
      borderRadius: 20,
      overflow: "hidden",
      flexDirection: "row",
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },

    sliderCopy: {
      width: "54%",
      paddingLeft: 18,
      paddingTop: 20,
      paddingBottom: 18,
      justifyContent: "center",
      zIndex: 2,
    },

    sliderEyebrow: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      overflow: "hidden",
      color: theme.surface,
      backgroundColor:
        theme.primary,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.9,
    },

    sliderTitle: {
      marginTop: 11,
      color: theme.heading,
      fontSize: 21,
      lineHeight: 25,
      fontWeight: "900",
    },

    sliderCategory: {
      marginTop: 5,
      color: theme.muted,
      fontSize: 10,
      fontWeight: "600",
    },

    sliderPriceRow: {
      marginTop: 9,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },

    sliderPrice: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "900",
    },

    sliderOldPrice: {
      color: theme.muted,
      fontSize: 9,
      textDecorationLine:
        "line-through",
    },

    sliderShopButton: {
      alignSelf: "flex-start",
      minHeight: 31,
      marginTop: 12,
      paddingHorizontal: 12,
      borderRadius: 17,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        theme.secondary,
    },

    sliderShopText: {
      color: theme.primary,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.7,
    },

    sliderShopArrow: {
      marginLeft: 5,
      color: theme.primary,
      fontSize: 17,
      lineHeight: 18,
    },

    sliderImageArea: {
      width: "46%",
      alignItems: "center",
      justifyContent: "center",
      padding: 9,
    },

    sliderImage: {
      width: "100%",
      height: 160,
    },

    sliderPlaceholder: {
      width: 125,
      height: 160,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.surface,
    },

    sliderPlaceholderText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 2,
    },

    sliderDots: {
      minHeight: 25,
      paddingTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },

    sliderDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        theme.shade3,
    },

    sliderDotActive: {
      width: 18,
      backgroundColor:
        theme.primary,
    },

    serviceStrip: {
      marginHorizontal: 14,
      marginTop: 8,
      minHeight: 76,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
      overflow: "hidden",
    },

    serviceEntry: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },

    serviceItem: {
      flex: 1,
      minHeight: 74,
      paddingHorizontal: 4,
      paddingVertical: 9,
      alignItems: "center",
      justifyContent: "center",
    },

    serviceIcon: {
      color: theme.primary,
      fontSize: 18,
      lineHeight: 22,
      marginBottom: 3,
    },

    serviceTitle: {
      color: theme.heading,
      fontSize: 8,
      lineHeight: 10,
      fontWeight: "900",
      textAlign: "center",
    },

    serviceText: {
      marginTop: 3,
      color: theme.muted,
      fontSize: 6.5,
      lineHeight: 9,
      textAlign: "center",
    },

    serviceDivider: {
      width: 1,
      height: 40,
      backgroundColor:
        theme.shade4,
    },

    promoRow: {
      marginTop: 22,
      paddingHorizontal: 14,
      flexDirection: "row",
      gap: 9,
    },

    promoCard: {
      flex: 1,
      minHeight: 92,
      paddingHorizontal: 11,
      paddingVertical: 12,
      borderRadius: 15,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    promoCardWarm: {
      backgroundColor:
        theme.surface,
      borderLeftWidth: 3,
      borderLeftColor:
        theme.secondary,
    },

    promoCardCool: {
      backgroundColor:
        theme.surface,
      borderLeftWidth: 3,
      borderLeftColor:
        theme.primary,
    },

    promoIconBox: {
      width: 34,
      height: 34,
      borderRadius: 17,
      marginRight: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.surface,
    },

    promoIcon: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "900",
    },

    promoCopy: {
      flex: 1,
    },

    promoTitle: {
      color: theme.heading,
      fontSize: 10,
      fontWeight: "900",
    },

    promoText: {
      marginTop: 3,
      color: theme.text,
      fontSize: 7.5,
      lineHeight: 10,
    },

    promoArrow: {
      marginLeft: 3,
      color: theme.primary,
      fontSize: 19,
      fontWeight: "800",
    },

    categoryFeatureList: {
      paddingHorizontal: 14,
      gap: 10,
    },

    categoryFeatureCard: {
      width: 132,
    },

    categoryFeatureVisual: {
      height: 105,
      borderRadius: 15,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      position: "relative",
    },

    categoryFeatureIcon: {
      fontSize: 42,
      lineHeight: 48,
      fontWeight: "800",
      zIndex: 2,
    },

    categoryFeatureOrb: {
      position: "absolute",
      width: 92,
      height: 92,
      borderRadius: 46,
      right: -28,
      bottom: -32,
    },

    categoryFeatureName: {
      marginTop: 7,
      color: theme.heading,
      fontSize: 10,
      fontWeight: "800",
      textAlign: "center",
    },

    section: {
      marginTop: 21,
    },

    catalogueSection: {
      marginTop: 26,
    },

    sectionHeader: {
      minHeight: 47,
      paddingHorizontal: 14,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent:
        "space-between",
    },

    sectionHeaderCopy: {
      flex: 1,
      paddingRight: 10,
    },

    sectionEyebrow: {
      color: theme.secondary,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.2,
    },

    sectionTitle: {
      marginTop: 3,
      color: theme.heading,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },

    seeAllButton: {
      minHeight: 28,
      paddingLeft: 8,
      flexDirection: "row",
      alignItems: "center",
    },

    seeAllText: {
      color: theme.primary,
      fontSize: 9,
      fontWeight: "900",
    },

    seeAllArrow: {
      marginLeft: 4,
      color: theme.secondary,
      fontSize: 19,
      lineHeight: 20,
    },

    categoryList: {
      paddingHorizontal: 10,
      gap: 3,
    },

    categoryItem: {
      width: 74,
      alignItems: "center",
    },

    categoryCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1.4,
      alignItems: "center",
      justifyContent: "center",
    },

    categoryIcon: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "700",
      textAlign: "center",
    },

    categoryName: {
      width: 70,
      minHeight: 27,
      marginTop: 6,
      color: theme.text,
      fontSize: 8,
      lineHeight: 11,
      fontWeight: "700",
      textAlign: "center",
    },

    categoryNameActive: {
      color: theme.primary,
      fontWeight: "900",
    },

    horizontalProducts: {
      paddingHorizontal: 14,
      gap: 10,
    },

    compactProductCard: {
      width: 150,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    compactImageBox: {
      width: "100%",
      height: 142,
      position: "relative",
      backgroundColor:
        theme.shade4,
    },

    compactProductImage: {
      width: "100%",
      height: "100%",
    },

    compactProductContent: {
      minHeight: 118,
      padding: 9,
    },

    compactCategory: {
      color: theme.secondary,
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },

    compactProductName: {
      minHeight: 31,
      marginTop: 4,
      color: theme.heading,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "800",
    },

    compactRatingRow: {
      minHeight: 16,
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
    },

    star: {
      color: theme.secondary,
      fontSize: 10,
    },

    compactRatingText: {
      marginLeft: 3,
      color: theme.text,
      fontSize: 8,
      fontWeight: "700",
    },

    reviewCount: {
      marginLeft: 2,
      color: theme.muted,
      fontSize: 7,
    },

    compactPrice: {
      marginTop: 4,
      color: theme.primary,
      fontSize: 13,
      fontWeight: "900",
    },

    oldPrice: {
      marginTop: 1,
      color: theme.muted,
      fontSize: 8,
      textDecorationLine:
        "line-through",
    },

    compactStock: {
      marginTop: 4,
      color: "#2e6b45",
      fontSize: 7,
      fontWeight: "800",
    },

    discountBadge: {
      position: "absolute",
      top: 6,
      left: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor:
        theme.secondary,
    },

    discountBadgeText: {
      color: theme.primary,
      fontSize: 7,
      fontWeight: "900",
    },

    featuredBadge: {
      position: "absolute",
      top: 6,
      left: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor:
        theme.primary,
    },

    featuredText: {
      color: theme.surface,
      fontSize: 6,
      fontWeight: "900",
    },

    searchResultNotice: {
      marginHorizontal: 14,
      marginBottom: 12,
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      backgroundColor:
        theme.accent,
    },

    searchResultText: {
      flex: 1,
      paddingRight: 10,
      color: theme.text,
      fontSize: 10,
      fontWeight: "700",
    },

    searchResultClear: {
      color: theme.primary,
      fontSize: 9,
      fontWeight: "900",
    },

    productGrid: {
      paddingHorizontal: 8,
      flexDirection: "row",
      flexWrap: "wrap",
    },

    productGridCell: {
      width: "50%",
      paddingHorizontal: 5,
      paddingBottom: 10,
    },

    gridProductCard: {
      flex: 1,
      overflow: "hidden",
      borderRadius: 12,
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    gridImageBox: {
      width: "100%",
      aspectRatio: 1,
      position: "relative",
      backgroundColor:
        theme.shade4,
    },

    gridProductImage: {
      width: "100%",
      height: "100%",
    },

    gridProductContent: {
      minHeight: 124,
      padding: 10,
    },

    gridCategory: {
      color: theme.secondary,
      fontSize: 6.5,
      fontWeight: "800",
      textTransform: "uppercase",
    },

    gridProductName: {
      minHeight: 34,
      marginTop: 4,
      color: theme.heading,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "800",
    },

    gridRatingRow: {
      minHeight: 15,
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
    },

    gridRating: {
      marginLeft: 2,
      color: theme.text,
      fontSize: 7,
      fontWeight: "700",
    },

    gridReviewCount: {
      marginLeft: 2,
      color: theme.muted,
      fontSize: 6.5,
    },

    gridPrice: {
      marginTop: 5,
      color: theme.primary,
      fontSize: 14,
      fontWeight: "900",
    },

    gridStock: {
      marginTop: 3,
      color: "#2e6b45",
      fontSize: 7,
      fontWeight: "800",
    },

    outOfStock: {
      color: "#a14343",
    },

    placeholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    placeholderBrand: {
      color: theme.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },

    empty: {
      marginHorizontal: 14,
      paddingHorizontal: 20,
      paddingVertical: 35,
      borderRadius: 16,
      alignItems: "center",
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    emptyIcon: {
      color: theme.secondary,
      fontSize: 35,
    },

    emptyTitle: {
      marginTop: 7,
      color: theme.heading,
      fontSize: 17,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 5,
      color: theme.muted,
      fontSize: 10,
      textAlign: "center",
    },

    emptyResetButton: {
      marginTop: 15,
      minHeight: 38,
      paddingHorizontal: 16,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.primary,
    },

    emptyResetText: {
      color: theme.surface,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.7,
    },

    storeBenefits: {
      marginHorizontal: 14,
      marginTop: 24,
      marginBottom: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        commerceHeader,
      borderWidth: 1,
      borderColor:
        commerceHeaderDeep,
    },

    membershipTopRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    membershipBadge: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.secondary,
    },

    membershipBadgeIcon: {
      color:
        commerceHeader,
      fontSize: 20,
      fontWeight: "900",
    },

    membershipCopy: {
      flex: 1,
      paddingLeft: 12,
    },

    benefitsEyebrow: {
      color:
        theme.secondary,
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 1.1,
    },

    benefitsTitle: {
      marginTop: 3,
      color: "#ffffff",
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
    },

    membershipDescription: {
      marginTop: 4,
      color:
        "rgba(255,255,255,0.70)",
      fontSize: 8,
      lineHeight: 12,
    },

    membershipStats: {
      marginTop: 14,
      minHeight: 56,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    membershipStat: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    membershipStatValue: {
      color: "#ffffff",
      fontSize: 10,
      fontWeight: "900",
    },

    membershipStatLabel: {
      marginTop: 3,
      color:
        "rgba(255,255,255,0.62)",
      fontSize: 7,
    },

    membershipStatDivider: {
      width: 1,
      height: 28,
      backgroundColor:
        "rgba(255,255,255,0.12)",
    },

    rewardsButton: {
      minHeight: 40,
      marginTop: 13,
      paddingHorizontal: 16,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.secondary,
    },

    rewardsButtonText: {
      color:
        commerceHeader,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    rewardsArrow: {
      marginLeft: 6,
      color:
        commerceHeader,
      fontSize: 18,
      lineHeight: 19,
    },
  });
}
