"use strict";
let P=null;document.addEventListener("DOMContentLoaded",async()=>{while(!Object.keys(Store.settings).length)await new Promise(r=>setTimeout(r,20));const id=new URLSearchParams(location.search).get("id");if(!id)return Store.toast("Product ID is required.");try{const d=await API.get(API.product(id));P=d.product||d.data||d;render(P)}catch(e){Store.toast(e.message)}});function render(p){const n=p.product_name||p.name||"Product",img=Store.img(p),price=p.selling_price??p.price??0,stock=Number(p.stock_quantity??p.stock??0);document.title=`${n} | RUKHNAV`;const im=document.getElementById("mainImage");im.src=img||"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="#efeadd"/><text x="400" y="420" text-anchor="middle" font-size="72" fill="#173f2b">RUKHNAV</text></svg>');im.alt=n;document.getElementById("detailName").textContent=n;document.getElementById("detailCategory").textContent=p.category||p.category_name||"RUKHNAV";document.getElementById("detailPrice").textContent=Store.money(price);document.getElementById("detailDescription").textContent=p.description||"Selected for quality and everyday care.";document.getElementById("breadcrumb").textContent=`Home / Products / ${n}`;const b=document.getElementById("stockBadge");b.textContent=stock>0?"In stock":"Out of stock";b.classList.toggle("out",stock<=0);document.getElementById("stockText").textContent=stock>0?`${stock} item(s) available`:"Currently unavailable";const q=document.getElementById("qty");q.max=Math.max(1,stock);document.getElementById("addCart").disabled=stock<=0;document.getElementById("detailsLoading").classList.add("hidden");document.getElementById("details").classList.remove("hidden");document.getElementById("minus").onclick=()=>q.value=Math.max(1,Number(q.value)-1);document.getElementById("plus").onclick=()=>q.value=Math.min(Number(q.max),Number(q.value)+1);document.getElementById("addCart").onclick=async()=>{try{await Store.addCart(p.id,Number(q.value));showAddedToCart(n,Number(q.value))}catch(e){Store.toast(e.message||"Unable to add product to cart.","error")}};document.getElementById("addWish").onclick=()=>{Store.toggleWish(p.id);Store.toast("Wishlist updated.")}}

function showAddedToCart(productName, quantity) {
    document
        .getElementById("rukhnavCartActions")
        ?.remove();

    const overlay =
        document.createElement("div");

    overlay.id =
        "rukhnavCartActions";

    overlay.setAttribute(
        "role",
        "dialog"
    );

    overlay.setAttribute(
        "aria-modal",
        "true"
    );

    overlay.setAttribute(
        "aria-label",
        "Product added to cart"
    );

    overlay.innerHTML = `
        <div class="rukhnav-cart-actions-card">
            <button
                type="button"
                class="rukhnav-cart-actions-close"
                aria-label="Close"
            >&times;</button>

            <div class="rukhnav-cart-actions-icon">
                &#10003;
            </div>

            <div class="rukhnav-cart-actions-copy">
                <div class="rukhnav-cart-actions-label">
                    ADDED TO YOUR CART
                </div>

                <h3>Product added successfully</h3>

                <p>
                    <strong></strong>
                    <span class="rukhnav-cart-actions-qty"></span>
                </p>
            </div>

            <div class="rukhnav-cart-actions-buttons">
                <button
                    type="button"
                    class="rukhnav-cart-continue"
                >
                    Continue Shopping
                </button>

                <a
                    href="cart.html"
                    class="rukhnav-cart-view"
                >
                    View Cart
                </a>

                <button
                    type="button"
                    class="rukhnav-cart-checkout"
                >
                    Proceed to Checkout
                </button>
            </div>
        </div>
    `;

    overlay.querySelector(
        ".rukhnav-cart-actions-copy strong"
    ).textContent =
        productName || "Product";

    overlay.querySelector(
        ".rukhnav-cart-actions-qty"
    ).textContent =
        `Quantity: ${quantity || 1}`;

    const style =
        document.createElement("style");

    style.textContent = `
        #rukhnavCartActions {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(8, 28, 19, .48);
            backdrop-filter: blur(3px);
        }

        .rukhnav-cart-actions-card {
            position: relative;
            width: min(560px, 100%);
            padding: 34px;
            border-radius: 20px;
            background: #fff;
            box-shadow:
                0 24px 70px rgba(0, 0, 0, .22);
            text-align: center;
        }

        .rukhnav-cart-actions-close {
            position: absolute;
            top: 14px;
            right: 16px;
            width: 38px;
            height: 38px;
            border: 0;
            border-radius: 50%;
            background: #f4f1e8;
            color: #174d35;
            font-size: 26px;
            line-height: 1;
            cursor: pointer;
        }

        .rukhnav-cart-actions-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 66px;
            height: 66px;
            margin: 0 auto 18px;
            border-radius: 50%;
            background: #e5f5eb;
            color: #16814b;
            font-size: 34px;
            font-weight: 800;
        }

        .rukhnav-cart-actions-label {
            margin-bottom: 8px;
            color: #d59c00;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: .12em;
        }

        .rukhnav-cart-actions-copy h3 {
            margin: 0 0 10px;
            color: #174d35;
            font-size: 28px;
            line-height: 1.15;
        }

        .rukhnav-cart-actions-copy p {
            margin: 0;
            color: #4e5e55;
            line-height: 1.6;
        }

        .rukhnav-cart-actions-copy strong {
            display: block;
            color: #17251d;
            font-size: 16px;
        }

        .rukhnav-cart-actions-qty {
            display: block;
            margin-top: 2px;
            font-size: 13px;
        }

        .rukhnav-cart-actions-buttons {
            display: grid;
            grid-template-columns:
                1fr 1fr;
            gap: 10px;
            margin-top: 26px;
        }

        .rukhnav-cart-actions-buttons a,
        .rukhnav-cart-actions-buttons button {
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px 15px;
            border-radius: 10px;
            font: inherit;
            font-size: 14px;
            font-weight: 750;
            text-decoration: none;
            cursor: pointer;
            box-sizing: border-box;
        }

        .rukhnav-cart-continue {
            border: 1px solid #d9ddd8;
            background: #fff;
            color: #174d35;
        }

        .rukhnav-cart-view {
            border: 1px solid #174d35;
            background: #fff;
            color: #174d35;
        }

        .rukhnav-cart-checkout {
            grid-column: 1 / -1;
            border: 1px solid #174d35;
            background: #174d35;
            color: #fff;
        }

        .rukhnav-cart-actions-buttons
        button:hover,
        .rukhnav-cart-actions-buttons
        a:hover {
            transform: translateY(-1px);
        }

        @media (max-width: 600px) {
            .rukhnav-cart-actions-card {
                padding: 30px 18px 20px;
            }

            .rukhnav-cart-actions-copy h3 {
                font-size: 23px;
            }

            .rukhnav-cart-actions-buttons {
                grid-template-columns: 1fr;
            }

            .rukhnav-cart-checkout {
                grid-column: auto;
            }
        }
    `;

    overlay.appendChild(style);
    document.body.appendChild(overlay);

    const close = () =>
        overlay.remove();

    overlay.querySelector(
        ".rukhnav-cart-actions-close"
    ).onclick =
        close;

    overlay.querySelector(
        ".rukhnav-cart-continue"
    ).onclick =
        close;

    overlay.addEventListener(
        "click",
        event => {
            if (event.target === overlay) {
                close();
            }
        }
    );

    overlay.querySelector(
        ".rukhnav-cart-checkout"
    ).onclick =
        () => {
            /*
             * Signed-in customers use normal checkout.
             * Guests use the guest-cart checkout flow.
             */
            location.href =
                API.isAuthenticated()
                    ? "checkout.html"
                    : "guest-checkout.html?source=cart";
        };
}
