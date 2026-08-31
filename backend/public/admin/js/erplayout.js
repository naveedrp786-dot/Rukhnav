"use strict";

window.RukhnavLayout = {
  init() {
    this.injectSidebar();
    this.bindCommonEvents();
    this.setActiveNav();
  },

  injectSidebar() {
    const host = document.getElementById("erpSidebarHost");
    if (!host) return;

    host.innerHTML = `
      <aside class="erp-sidebar" id="erpSidebar">
        <div class="brand">
          <div class="brand-logo">R</div>
          <div>
            <h2>RUKHNAV</h2>
            <p>ERP SYSTEM</p>
          </div>
        </div>

        <div class="sidebar-scroll">
          <a class="nav-link" data-page="dashboard" href="dashboard.html"><span class="nav-icon">⌂</span><span>Dashboard</span></a>

          <div class="nav-section">Products</div>
          <a class="nav-link" data-page="products" href="products.html"><span class="nav-icon">▦</span><span>All Products</span></a>
          <a class="nav-link" data-page="add-product" href="addProduct.html"><span class="nav-icon">＋</span><span>Add Product</span></a>
          <a class="nav-link" data-page="categories" href="categories.html"><span class="nav-icon">◫</span><span>Categories</span></a>
          <a class="nav-link" data-page="inactive-products" href="inactiveProducts.html"><span class="nav-icon">⊘</span><span>Inactive Products</span><span class="nav-badge" id="inactiveNavCount">0</span></a>

          <div class="nav-section">Inventory</div>
          <a class="nav-link" data-page="purchases" href="purchases.html"><span class="nav-icon">⇩</span><span>Purchases</span></a>
          <a class="nav-link" data-page="purchase-returns" href="purchaseReturns.html"><span class="nav-icon">↩</span><span>Purchase Returns</span></a>
          <a class="nav-link" data-page="stock-adjustments" href="stockAdjustments.html"><span class="nav-icon">±</span><span>Stock Adjustments</span></a>
          <a class="nav-link" data-page="stock-transfers" href="stockTransfers.html"><span class="nav-icon">⇄</span><span>Stock Transfers</span></a>

          <div class="nav-section">Business</div>
          <a class="nav-link" data-page="sales" href="sales.html"><span class="nav-icon">🛒</span><span>Sales</span></a>
          <a class="nav-link" data-page="customers" href="customers.html"><span class="nav-icon">♙</span><span>Customers</span></a>
          <a class="nav-link" data-page="suppliers" href="suppliers.html"><span class="nav-icon">▣</span><span>Suppliers</span></a>
          <a class="nav-link" data-page="reports" href="reports.html"><span class="nav-icon">▥</span><span>Reports</span></a>

          <div class="nav-section">System</div>
          <a class="nav-link" data-page="settings" href="settings.html"><span class="nav-icon">⚙</span><span>Settings</span></a>
          <a class="nav-link" href="#" id="logoutLink"><span class="nav-icon">⇥</span><span>Logout</span></a>
        </div>

        <div class="sidebar-user">
          <div class="user-avatar">A</div>
          <div><strong>Admin</strong><span>Super Admin</span></div>
        </div>
      </aside>
    `;
  },

  setActiveNav() {
    const page = document.body.dataset.page;
    if (!page) return;
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.toggle("active", link.dataset.page === page);
    });
  },

  bindCommonEvents() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("#mobileSidebarToggle")) {
        document.getElementById("erpSidebar")?.classList.toggle("open");
      }

      if (event.target.closest("#logoutLink")) {
        event.preventDefault();
        localStorage.removeItem("adminToken");
        localStorage.removeItem("token");
        sessionStorage.removeItem("adminToken");
        sessionStorage.removeItem("token");
        window.location.href = "login.html";
      }
    });
  },

  setInactiveCount(count) {
    const badge = document.getElementById("inactiveNavCount");
    if (badge) badge.textContent = String(count ?? 0);
  },

  toast(message, type = "success") {
    let stack = document.getElementById("toastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toastStack";
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<strong>${type === "success" ? "✓" : "!"}</strong><div>${this.escapeHtml(message)}</div>`;
    stack.appendChild(toast);

    setTimeout(() => toast.remove(), 4500);
  },

  escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }
};

document.addEventListener("DOMContentLoaded", () => window.RukhnavLayout.init());
