"use strict";

const BASE_URL =
    process.env.TEST_BASE_URL ||
    "https://rukhnav-production.up.railway.app";

const PRODUCT_ID =
    Number(
        process.env.TEST_PRODUCT_ID ||
        20
    );

const IDENTIFIER =
    process.env.TEST_CUSTOMER_IDENTIFIER;

const PASSWORD =
    process.env.TEST_CUSTOMER_PASSWORD;

if (!IDENTIFIER || !PASSWORD) {
    console.error(
        "❌ Set TEST_CUSTOMER_IDENTIFIER and TEST_CUSTOMER_PASSWORD first."
    );
    process.exit(1);
}

async function request(
    path,
    {
        method = "GET",
        token = null,
        body = undefined
    } = {}
) {

    const headers = {
        Accept:
            "application/json"
    };

    if (body !== undefined) {
        headers["Content-Type"] =
            "application/json";
    }

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    const response =
        await fetch(
            `${BASE_URL}${path}`,
            {
                method,
                headers,
                body:
                    body === undefined
                        ? undefined
                        : JSON.stringify(
                            body
                        )
            }
        );

    let data;

    try {
        data =
            await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            `${method} ${path} failed with HTTP ${response.status}`
        );
    }

    return data;
}

function extractToken(data) {

    return (
        data.token ||
        data.customerToken ||
        data.customer_token ||
        data.accessToken ||
        data.access_token ||
        data.data?.token ||
        data.data?.accessToken ||
        null
    );
}

function extractProduct(data) {

    return (
        data.product ||
        data.data?.product ||
        data.data ||
        data
    );
}

function extractProfile(data) {

    return (
        data.customer ||
        data.profile ||
        data.data?.customer ||
        data.data?.profile ||
        data.data ||
        data
    );
}

function extractOrder(data) {

    return (
        data.order ||
        data.data?.order ||
        data.data ||
        data
    );
}

(async () => {

    console.log(
        "======================================"
    );
    console.log(
        "RUKHNAV LIVE INVENTORY TEST"
    );
    console.log(
        "======================================"
    );

    // --------------------------------------------------
    // 1. Read product before test
    // --------------------------------------------------

    const beforeResponse =
        await request(
            `/api/products/${PRODUCT_ID}`
        );

    const beforeProduct =
        extractProduct(
            beforeResponse
        );

    const beforeStock =
        Number(
            beforeProduct.stock_quantity ??
            beforeProduct.stock ??
            0
        );

    console.log(
        `Product: ${beforeProduct.product_name || beforeProduct.name}`
    );

    console.log(
        `Stock before: ${beforeStock}`
    );

    if (beforeStock < 1) {
        throw new Error(
            "Test product is out of stock."
        );
    }

    // --------------------------------------------------
    // 2. Customer login
    // --------------------------------------------------

    const loginResponse =
        await request(
            "/api/customers/login",
            {
                method:
                    "POST",

                body: {
                    identifier:
                        IDENTIFIER,

                    email:
                        IDENTIFIER,

                    password:
                        PASSWORD
                }
            }
        );

    const token =
        extractToken(
            loginResponse
        );

    if (!token) {
        throw new Error(
            "Login succeeded but no customer token was returned."
        );
    }

    console.log(
        "✅ Customer login successful"
    );

    // --------------------------------------------------
    // 3. Load customer profile
    // --------------------------------------------------

    const profileResponse =
        await request(
            "/api/customers/profile",
            {
                token
            }
        );

    const profile =
        extractProfile(
            profileResponse
        );

    // --------------------------------------------------
    // 4. Clear this product from existing cart if present
    // --------------------------------------------------

    const currentCartResponse =
        await request(
            "/api/cart",
            {
                token
            }
        );

    const currentCart =
        currentCartResponse.cart ||
        currentCartResponse.data?.cart ||
        [];

    for (
        const item
        of currentCart
    ) {

        if (
            Number(
                item.product_id
            ) === PRODUCT_ID
        ) {

            await request(
                `/api/cart/${item.cart_id}`,
                {
                    method:
                        "DELETE",

                    token
                }
            );
        }
    }

    // --------------------------------------------------
    // 5. Add exactly one product
    // --------------------------------------------------

    await request(
        "/api/cart",
        {
            method:
                "POST",

            token,

            body: {
                product_id:
                    PRODUCT_ID,

                quantity:
                    1
            }
        }
    );

    console.log(
        "✅ Added 1 unit to authenticated cart"
    );

    // --------------------------------------------------
    // 6. Place test COD order
    // --------------------------------------------------

    const orderResponse =
        await request(
            "/api/orders",
            {
                method:
                    "POST",

                token,

                body: {
                    full_name:
                        profile.full_name ||
                        "Inventory Test Customer",

                    phone:
                        profile.phone ||
                        "+923000000000",

                    email:
                        profile.email ||
                        IDENTIFIER,

                    shipping_address:
                        profile.address ||
                        profile.shipping_address ||
                        "Inventory Integration Test Address",

                    city:
                        profile.city ||
                        "Arifwala",

                    postal_code:
                        profile.postal_code ||
                        "57450",

                    order_notes:
                        "AUTOMATED INVENTORY INTEGRATION TEST",

                    payment_method:
                        "cash_on_delivery"
                }
            }
        );

    const order =
        extractOrder(
            orderResponse
        );

    const orderId =
        Number(
            order.id ||
            order.order_id ||
            orderResponse.orderId ||
            orderResponse.order_id
        );

    const orderNumber =
        order.order_number ||
        orderResponse.orderNumber ||
        orderResponse.order_number ||
        null;

    if (!orderId) {
        console.log(
            orderResponse
        );

        throw new Error(
            "Order was created but order ID could not be determined."
        );
    }

    console.log(
        `✅ Test order created: ${orderNumber || orderId}`
    );

    // --------------------------------------------------
    // 7. Verify public stock decreased
    // --------------------------------------------------

    const afterOrderResponse =
        await request(
            `/api/products/${PRODUCT_ID}`
        );

    const afterOrderProduct =
        extractProduct(
            afterOrderResponse
        );

    const afterOrderStock =
        Number(
            afterOrderProduct.stock_quantity ??
            afterOrderProduct.stock ??
            0
        );

    console.log(
        `Stock after order: ${afterOrderStock}`
    );

    if (
        afterOrderStock !==
        beforeStock - 1
    ) {

        throw new Error(
            `Stock deduction failed. Expected ${beforeStock - 1}, found ${afterOrderStock}.`
        );
    }

    console.log(
        "✅ Product stock decreased by exactly 1"
    );

    // --------------------------------------------------
    // 8. Cancel same test order
    // --------------------------------------------------

    await request(
        `/api/orders/${orderId}/cancel`,
        {
            method:
                "PUT",

            token,

            body: {
                reason:
                    "Automated inventory integration test cleanup",

                cancellation_reason:
                    "Automated inventory integration test cleanup"
            }
        }
    );

    console.log(
        "✅ Test order cancelled"
    );

    // --------------------------------------------------
    // 9. Verify stock restored
    // --------------------------------------------------

    const finalResponse =
        await request(
            `/api/products/${PRODUCT_ID}`
        );

    const finalProduct =
        extractProduct(
            finalResponse
        );

    const finalStock =
        Number(
            finalProduct.stock_quantity ??
            finalProduct.stock ??
            0
        );

    console.log(
        `Final stock: ${finalStock}`
    );

    if (
        finalStock !==
        beforeStock
    ) {

        throw new Error(
            `Stock restoration failed. Expected ${beforeStock}, found ${finalStock}.`
        );
    }

    console.log();
    console.log(
        "======================================"
    );
    console.log(
        "✅ LIVE INVENTORY TEST PASSED"
    );
    console.log(
        "======================================"
    );

    console.log(
        `Order: ${orderNumber || orderId}`
    );

    console.log(
        `Before: ${beforeStock}`
    );

    console.log(
        `After order: ${afterOrderStock}`
    );

    console.log(
        `After cancellation: ${finalStock}`
    );

})().catch(error => {

    console.error();
    console.error(
        "======================================"
    );
    console.error(
        "❌ LIVE INVENTORY TEST FAILED"
    );
    console.error(
        "======================================"
    );

    console.error(
        error.message
    );

    process.exit(1);
});
