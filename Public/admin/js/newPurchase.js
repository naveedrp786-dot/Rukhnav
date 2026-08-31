// ============================================
// RUKHNAV ERP
// New Purchase
// ============================================

const API = "/api";

// Admin JWT Token
const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken");

// Global Data
let suppliers = [];
let products = [];

// ============================================
// Page Load
// ============================================

document.addEventListener("DOMContentLoaded", async () => {

    // Authentication
    if (!token) {

        alert("Please login first.");

        window.location.href = "login.html";

        return;

    }

    // Today's Date
    const today =
        new Date()
        .toISOString()
        .split("T")[0];

    document.getElementById("purchaseDate").value = today;

    // Default Expected Date
    document.getElementById("expectedDate").value = today;

    // Load Data
    await loadSuppliers();

    await loadProducts();

    // Event Listeners
    registerEvents();

    // First Product Row
    addRow();

    // Supplier Info
    showSupplier();

 document.getElementById("supplier").focus();   

    // Initial Totals
    calculateTotals();

});

// ============================================
// Register Events
// ============================================

function registerEvents() {

    document
        .getElementById("btnAddRow")
        .addEventListener("click", addRow);

    document
        .getElementById("btnSave")
        .addEventListener("click", savePurchase);

    document
        .getElementById("supplier")
        .addEventListener("change", showSupplier);

    document
        .getElementById("btnNewSupplier")
        .addEventListener("click", openSupplierModal);

    document
        .getElementById("btnCloseSupplierModal")
        .addEventListener("click", closeSupplierModal);

    document
        .getElementById("btnCancelSupplier")
        .addEventListener("click", closeSupplierModal);

    document
        .getElementById("supplierForm")
        .addEventListener("submit", saveSupplier);

    document
        .getElementById("supplierModal")
        .addEventListener("click", event => {
            if (event.target.id === "supplierModal") closeSupplierModal();
        });

    [
        "discount",
        "tax",
        "shipping"
    ].forEach(id => {

        document
            .getElementById(id)
            .addEventListener(
                "input",
                calculateTotals
            );

    });

    document.querySelectorAll("input[type='number']")
.forEach(input => {

    input.addEventListener("input", function () {

        if (Number(this.value) < 0) {

            this.value = 0;

        }

    });

});

document.querySelectorAll("input[type='number']")
.forEach(input => {

    input.addEventListener("wheel", function (e) {

        e.target.blur();

    });

});

}

// ============================================
// Load Suppliers
// ============================================

async function loadSuppliers() {

    try {

        const res = await fetch(

            `${API}/suppliers`,

            {

                headers: {

                    Authorization: `Bearer ${token}`

                }

            }

        );

        const data = await res.json();

        suppliers = data.suppliers || [];

        const select =
            document.getElementById("supplier");

        select.innerHTML = "";

        if (suppliers.length === 0) {

            select.innerHTML = `
                <option value="">
                    No Suppliers Found
                </option>
            `;

            return;

        }

        suppliers.forEach(supplier => {

            select.innerHTML += `

                <option value="${supplier.id}">
                    ${supplier.supplier_name}
                </option>

            `;

        });

    }

    catch (err) {

        console.error(err);

        alert("Unable to load suppliers.");

    }

}


// ============================================
// Add Supplier Modal
// ============================================

function openSupplierModal() {

    const modal = document.getElementById("supplierModal");

    document.getElementById("supplierForm").reset();
    document.getElementById("newSupplierCountry").value = "Pakistan";

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    setTimeout(() => {
        document.getElementById("newSupplierName").focus();
    }, 50);

}

function closeSupplierModal() {

    const modal = document.getElementById("supplierModal");

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

}

async function saveSupplier(event) {

    event.preventDefault();

    const button = document.getElementById("btnSaveSupplier");

    if (button.disabled) return;

    const supplier = {
        supplier_name: document.getElementById("newSupplierName").value.trim(),
        contact_person: document.getElementById("newContactPerson").value.trim(),
        phone: document.getElementById("newSupplierPhone").value.trim(),
        email: document.getElementById("newSupplierEmail").value.trim(),
        city: document.getElementById("newSupplierCity").value.trim(),
        country: document.getElementById("newSupplierCountry").value.trim() || "Pakistan",
        address: document.getElementById("newSupplierAddress").value.trim(),
        status: "Active"
    };

    if (!supplier.supplier_name) {
        return alert("Supplier name is required.");
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {

        const response = await fetch(`${API}/suppliers`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(supplier)
        });

        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Unable to add supplier.");
        }

        await loadSuppliers();

        const supplierSelect = document.getElementById("supplier");
        supplierSelect.value = String(data.supplierId);
        showSupplier();
        closeSupplierModal();

        alert("Supplier added and selected successfully.");

    } catch (error) {

        console.error("Add Supplier Error:", error);
        alert(error.message || "Unable to add supplier.");

    } finally {

        button.disabled = false;
        button.innerHTML = '<i class="fas fa-save"></i> Save Supplier';

    }

}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSupplierModal();
});

// ============================================
// Load Products
// ============================================

async function loadProducts() {

    try {

        const res = await fetch(

            `${API}/products`,

            {

                headers: {

                    Authorization: `Bearer ${token}`

                }

            }

        );

        const data = await res.json();

        products = data.products || [];

    }

    catch (err) {

        console.error(err);

        alert("Unable to load products.");

    }

}

// ============================================
// Supplier Information
// ============================================

function showSupplier() {

    const supplierId = Number(

        document
            .getElementById("supplier")
            .value

    );

    const supplier = suppliers.find(

        s => s.id === supplierId

    );

    if (!supplier) {

        document.getElementById(
            "supplierDetails"
        ).innerHTML = "";

        return;

    }

    document.getElementById(
        "supplierDetails"
    ).innerHTML = `

        <strong>${supplier.supplier_name}</strong><br>

        ${supplier.contact_person || ""}<br>

        ${supplier.phone || ""}<br>

        ${supplier.email || ""}<br>

        ${supplier.address || ""}<br>

        ${supplier.city || ""}

    `;

}

// ============================================
// Add Product Row
// ============================================

function addRow() {

    const tbody =
        document.getElementById("productBody");

    let options = "";

    products.forEach(product => {

        options += `

            <option
                value="${product.id}"
                data-cost="${Number(product.cost_price || 0).toFixed(2)}">

                ${product.product_name}

            </option>

        `;

    });

    tbody.insertAdjacentHTML(

        "beforeend",

        `

        <tr>

            <td>

                <select class="productSelect">

                    ${options}

                </select>

            </td>

            <td>

                <input
                    type="number"
                    class="qty"
                    value="1"
                    min="1">

            </td>

            <td>

                <input
                    type="number"
                    class="cost"
                    value="0.00"
                    step="0.01">

            </td>

            <td>

                <input
                    type="text"
                    class="lineTotal"
                    value="0.00"
                    readonly>

            </td>

            <td>

                <button
                    type="button"
                    class="removeRow btn-danger">

                    <i class="fas fa-trash"></i>

                </button>

            </td>

        </tr>

        `

    );

    bindRowEvents();

    const lastRow =
        tbody.lastElementChild;

    if(lastRow){

        const select =
            lastRow.querySelector(".productSelect");

        if(select.options.length){

            select.dispatchEvent(new Event("change"));
            const qtyInput = lastRow.querySelector(".qty");

if (qtyInput) {
    qtyInput.select();
}

        }

    }

}

// ============================================
// Bind Row Events
// ============================================

function bindRowEvents() {

    document.querySelectorAll(".productSelect").forEach(select => {

        select.onchange = function () {

            const row = this.closest("tr");

            const cost =
                this.options[this.selectedIndex].dataset.cost || 0;

            row.querySelector(".cost").value =
    Number(cost).toFixed(2);

            calculateTotals();

        };

    });

    document.querySelectorAll(".qty").forEach(input => {

        input.oninput = function () {

            if (Number(this.value) < 0) {

                this.value = 0;

            }

            calculateTotals();

        };

    });

    document.querySelectorAll(".cost").forEach(input => {

        input.oninput = function () {

            if (Number(this.value) < 0) {

                this.value = 0;

            }

            calculateTotals();

        };

    });

    document.querySelectorAll(".removeRow").forEach(btn => {

        btn.onclick = function () {

            if (document.querySelectorAll("#productBody tr").length === 1) {

                return alert("At least one product is required.");

            }

            this.closest("tr").remove();

            calculateTotals();

        };

    });

}

// ============================================
// Calculate Totals
// ============================================

function calculateTotals() {

    let subtotal = 0;

    document.querySelectorAll("#productBody tr").forEach(row => {

        const qty = Number(row.querySelector(".qty").value) || 0;

        const cost = Number(row.querySelector(".cost").value) || 0;

        const total = qty * cost;

        row.querySelector(".lineTotal").value = total.toFixed(2);

        subtotal += total;

    });

    const discount =
        Number(document.getElementById("discount").value) || 0;

    const tax =
        Number(document.getElementById("tax").value) || 0;

    const shipping =
        Number(document.getElementById("shipping").value) || 0;

    const grandTotal =
        subtotal - discount + tax + shipping;

    document.getElementById("grandTotal").value =
        grandTotal.toFixed(2);

}

// ======================================
// Save Purchase
// ======================================

async function savePurchase() {

    const btn = document.getElementById("btnSave");

if (btn.disabled) return;

    // ----------------------------------
    // Collect Items
    // ----------------------------------

    const items = [];

    document
        .querySelectorAll("#productBody tr")
        .forEach(row => {

            items.push({

                product_id: Number(
                    row.querySelector(".productSelect").value
                ),

                quantity: Number(
                    row.querySelector(".qty").value
                ),

                unit_cost: Number(
                    row.querySelector(".cost").value
                )

            });

        });

    // ----------------------------------
    // Validation
    // ----------------------------------

    if (!document.getElementById("supplier").value) {

        return alert("Please select a supplier.");

    }

    if (items.length === 0) {

        return alert("Please add at least one product.");

    }

    const ids = items.map(i => i.product_id);

    if (new Set(ids).size !== ids.length) {

        return alert("Duplicate products are not allowed.");

    }

    for (const item of items) {

        if (item.quantity <= 0) {

            return alert("Quantity must be greater than zero.");

        }

        if (item.unit_cost < 0) {

            return alert("Invalid unit cost.");

        }

    }

    // ----------------------------------
    // Request Body
    // ----------------------------------

    const body = {

        supplier_id: Number(
            document.getElementById("supplier").value
        ),

        order_date:
            document.getElementById("purchaseDate").value,

        expected_date:
            document.getElementById("expectedDate").value,

        payment_method:
            document.getElementById("paymentMethod").value,

        discount: Number(
            document.getElementById("discount").value || 0
        ),

        tax: Number(
            document.getElementById("tax").value || 0
        ),

        shipping: Number(
            document.getElementById("shipping").value || 0
        ),

        remarks:
            document.getElementById("remarks").value,

        items

    };

    // ----------------------------------
    // Save Button Loading
    // ----------------------------------

    btn.disabled = true;

    btn.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        Saving...
    `;

    try {

        const res = await fetch(

            `${API}/purchases`,

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json",

                    Authorization: `Bearer ${token}`

                },

                body: JSON.stringify(body)

            }

        );

        const data = await res.json();

        if (!data.success) {

            throw new Error(data.message);

        }

        resetPurchaseForm();

alert("Purchase Order Created Successfully.");

window.location.href = "purchases.html";

    }

    catch (err) {

        console.error(err);

        alert(err.message || "Unable to save purchase.");

    }

    finally {

        btn.disabled = false;

        btn.innerHTML = `
            <i class="fas fa-save"></i>
            Save Purchase
        `;

    }

}

// ======================================
// Reset Purchase Form
// ======================================

function resetPurchaseForm(){
    document.getElementById("supplier").selectedIndex = 0;

showSupplier();

    document.getElementById("discount").value = 0;
    document.getElementById("tax").value = 0;
    document.getElementById("shipping").value = 0;
    document.getElementById("remarks").value = "";

    document.getElementById("productBody").innerHTML = "";

    addRow();

    calculateTotals();

    const today =
    new Date().toISOString().split("T")[0];

document.getElementById("purchaseDate").value = today;

document.getElementById("expectedDate").value = today;

}

// ======================================
// CTRL + S
// ======================================

document.addEventListener("keydown",function(e){

    if(e.ctrlKey && e.key==="s"){

        e.preventDefault();

        savePurchase();

    }

});

document.addEventListener("keydown",function(e){

    if(e.key!=="Enter") return;

    const form=[

        ...document.querySelectorAll(

            "input,select,textarea"

        )

    ];

    const index=form.indexOf(document.activeElement);

    if(index>-1 && index<form.length-1){

        e.preventDefault();

        form[index+1].focus();

    }

});
