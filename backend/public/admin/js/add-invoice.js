const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
const API = RUKHNAV_ORIGIN + "/api";
const token = localStorage.getItem("token");

if (!token) window.location.href = "login.html";

const invoiceForm = document.getElementById("invoiceForm");
const customerIdSelect = document.getElementById("customerId");
const itemRowsContainer = document.getElementById("invoiceItemRows");
const addItemBtn = document.getElementById("addItemBtn");
const paidAmountInput = document.getElementById("paidAmount");
const grandTotalLabel = document.getElementById("grandTotalLabel");
const balanceAmountLabel = document.getElementById("balanceAmountLabel");

let grandTotal = 0;

// 1. Fetch Customers dynamically on page load to fill the select options dropdown
async function populateCustomers() {
    try {
        const response = await fetch(`${API}/customers`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        
        // Handle database array formats flexibility (data.customers or data.data)
        const customers = data.customers || data || [];
        customers.forEach(c => {
            customerIdSelect.innerHTML += `<option value="${c.id}">${c.full_name} (${c.phone || 'No Phone'})</option>`;
        });
    } catch (err) {
        console.error("Failed to load customer list registries:", err);
    }
}

// 2. Insert a fresh input item row template line into our dynamic table grid list
function addNewItemRow() {
    const row = document.createElement("tr");
    row.className = "item-row";
    row.innerHTML = `
        <td><input type="text" class="form-control prod-name" placeholder="Enter product name..." required></td>
        <td><input type="number" class="form-control prod-qty" value="1" min="1" required></td>
        <td><input type="number" class="form-control prod-price" value="0" min="0" required></td>
        <td><input type="number" class="form-control prod-total" value="0" readonly></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row-btn"><i class="bi bi-trash"></i></button></td>
    `;
    itemRowsContainer.appendChild(row);
    bindRowCalculationEvents(row);
    calculateInvoiceTotals();
}

// 3. Keep prices, line sums, and invoice sheets calculations perfectly matched up
function bindRowCalculationEvents(row) {
    const qtyInput = row.querySelector(".prod-qty");
    const priceInput = row.querySelector(".prod-price");
    const totalInput = row.querySelector(".prod-total");
    const removeBtn = row.querySelector(".remove-row-btn");

    const updateLineTotal = () => {
        const total = (parseFloat(qtyInput.value) || 0) * (parseFloat(priceInput.value) || 0);
        totalInput.value = total;
        calculateInvoiceTotals();
    };

    qtyInput.addEventListener("input", updateLineTotal);
    priceInput.addEventListener("input", updateLineTotal);
    removeBtn.addEventListener("click", () => {
        row.remove();
        calculateInvoiceTotals();
    });
}

// 4. Compute overall pricing values dynamically 
function calculateInvoiceTotals() {
    grandTotal = 0;
    document.querySelectorAll(".prod-total").forEach(input => {
        grandTotal += parseFloat(input.value) || 0;
    });

    const paidAmount = parseFloat(paidAmountInput.value) || 0;
    const balanceAmount = grandTotal - paidAmount;

    grandTotalLabel.textContent = `PKR ${grandTotal}`;
    balanceAmountLabel.textContent = `PKR ${balanceAmount}`;
    
    if (balanceAmount <= 0) {
        balanceAmountLabel.className = "text-success font-weight-bold";
    } else {
        balanceAmountLabel.className = "text-danger font-weight-bold";
    }
}

paidAmountInput.addEventListener("input", calculateInvoiceTotals);
addItemBtn.addEventListener("click", addNewItemRow);

// 5. Submit Structured Order Elements block array bundle straight up onto the server API
invoiceForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const items = [];
    document.querySelectorAll(".item-row").forEach(row => {
        items.push({
            product_name: row.querySelector(".prod-name").value.trim(),
            quantity: parseInt(row.querySelector(".prod-qty").value) || 0,
            unit_price: parseFloat(row.querySelector(".prod-price").value) || 0,
            total: parseFloat(row.querySelector(".prod-total").value) || 0
        });
    });

    if (items.length === 0) {
        alert("Please append at least one product line item row block entry first.");
        return;
    }

    const payload = {
        customer_id: parseInt(customerIdSelect.value),
        payment_method: document.getElementById("paymentMethod").value,
        payment_status: document.getElementById("paymentStatus").value,
        grand_total: grandTotal,
        paid_amount: parseFloat(paidAmountInput.value) || 0,
        balance_amount: grandTotal - (parseFloat(paidAmountInput.value) || 0),
        items: items
    };

    try {
        const response = await fetch(`${API}/invoices`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            alert("Invoice created successfully!");
            window.location.href = "invoices.html";
        } else {
            alert(data.message || "Failed to create invoice.");
        }
    } catch (err) {
        console.error(err);
        alert("Server communication error occurred.");
    }
});

// Run Initial Setup on system load
populateCustomers();
addNewItemRow(); // start with one blank item line row automatically
