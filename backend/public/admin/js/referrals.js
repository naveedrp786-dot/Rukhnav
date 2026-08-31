"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const ReferralsAdmin = {
    base: RUKHNAV_ORIGIN,
    page: 1,
    limit: 20,
    totalPages: 1,
    currentRows: [],

    token() {
        return localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
    },

    async request(path) {
        const token = this.token();
        const response = await fetch(this.base + path, {
            headers: {
                Accept: "application/json",
                Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`
            }
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
            throw new Error(data.message || "Admin login is required.");
        }
        if (!response.ok || data.success === false) {
            throw new Error(data.message || `Request failed (${response.status}).`);
        }
        return data;
    },

    async init() {
        this.bind();
        await Promise.all([this.loadSummary(), this.loadReferrals()]);
    },

    bind() {
        document.getElementById("refreshReferrals")?.addEventListener("click", () => this.refresh());
        document.getElementById("applyReferralFilters")?.addEventListener("click", () => { this.page = 1; this.loadReferrals(); });
        document.getElementById("referralSearch")?.addEventListener("keydown", event => {
            if (event.key === "Enter") { this.page = 1; this.loadReferrals(); }
        });
        document.getElementById("referralLimit")?.addEventListener("change", event => {
            this.limit = Number(event.target.value) || 20;
            this.page = 1;
            this.loadReferrals();
        });
        document.getElementById("referralPrev")?.addEventListener("click", () => {
            if (this.page > 1) { this.page -= 1; this.loadReferrals(); }
        });
        document.getElementById("referralNext")?.addEventListener("click", () => {
            if (this.page < this.totalPages) { this.page += 1; this.loadReferrals(); }
        });
        document.getElementById("referralsBody")?.addEventListener("click", event => {
            const button = event.target.closest("[data-referral-id]");
            if (button) this.openDetails(button.dataset.referralId);
        });
        document.getElementById("closeReferralModal")?.addEventListener("click", () => this.closeModal());
        document.getElementById("referralModal")?.addEventListener("click", event => {
            if (event.target.id === "referralModal") this.closeModal();
        });
        document.getElementById("exportReferrals")?.addEventListener("click", () => this.exportCsv());
    },

    async refresh() {
        this.page = 1;
        await Promise.all([this.loadSummary(), this.loadReferrals()]);
        this.message("Referral data refreshed.", "success");
    },

    async loadSummary() {
        try {
            const data = await this.request("/api/admin/referrals/summary");
            const s = data.summary || {};
            this.text("kpiTotal", s.totalReferrals || 0);
            this.text("kpiRegistered", s.registeredReferrals || 0);
            this.text("kpiQualified", s.qualifiedReferrals || 0);
            this.text("kpiRewarded", s.rewardedReferrals || 0);
            this.text("kpiPoints", new Intl.NumberFormat("en-PK").format(s.totalPointsAwarded || 0));
        } catch (error) {
            this.message(error.message, "error");
        }
    },

    async loadReferrals() {
        const body = document.getElementById("referralsBody");
        if (body) body.innerHTML = '<tr><td colspan="9" class="empty-cell">Loading referrals...</td></tr>';

        const search = document.getElementById("referralSearch")?.value.trim() || "";
        const status = document.getElementById("referralStatus")?.value || "";
        const qs = new URLSearchParams({ page: String(this.page), limit: String(this.limit) });
        if (search) qs.set("search", search);
        if (status) qs.set("status", status);

        try {
            const data = await this.request(`/api/admin/referrals?${qs}`);
            this.currentRows = data.referrals || [];
            this.totalPages = Number(data.pagination?.totalPages || 1);
            this.renderRows(this.currentRows);
            this.renderPagination(data.pagination || {});
        } catch (error) {
            if (body) body.innerHTML = `<tr><td colspan="9" class="empty-cell">${this.escape(error.message)}</td></tr>`;
            this.message(error.message, "error");
        }
    },

    renderRows(rows) {
        const body = document.getElementById("referralsBody");
        if (!body) return;
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="9" class="empty-cell">No referrals match these filters.</td></tr>';
            return;
        }

        body.innerHTML = rows.map(r => `
            <tr>
                <td><strong>#${this.escape(r.id)}</strong></td>
                <td><span class="code-pill">${this.escape(r.referral_code_used || "—")}</span></td>
                <td class="person-cell"><strong>${this.escape(r.referrer_name || "—")}</strong><span>${this.escape(r.referrer_membership || "Bronze")} • ${this.escape(r.referrer_email || r.referrer_phone || "")}</span></td>
                <td class="person-cell"><strong>${this.escape(r.referred_name || "—")}</strong><span>${this.escape(r.referred_email || r.referred_phone || "")}</span></td>
                <td class="person-cell">${r.first_paid_sale_id ? `<strong>${this.escape(r.first_paid_sale_number || `#${r.first_paid_sale_id}`)}</strong><span>${this.money(r.first_paid_sale_total)}</span>` : '<strong>Not yet</strong><span>Waiting for completed paid sale</span>'}</td>
                <td><span class="status-pill ${this.escape(String(r.status || "registered").toLowerCase())}">${this.escape(r.status || "Registered")}</span></td>
                <td><strong>${this.escape(r.referrer_reward_points || 0)}</strong></td>
                <td>${this.date(r.created_at)}</td>
                <td><button class="view-referral" type="button" data-referral-id="${this.escape(r.id)}" title="View referral"><i class="fa-regular fa-eye"></i></button></td>
            </tr>
        `).join("");
    },

    renderPagination(p) {
        const total = Number(p.total || 0);
        const start = total ? ((this.page - 1) * this.limit) + 1 : 0;
        const end = Math.min(this.page * this.limit, total);
        this.text("referralPageInfo", `Showing ${start} to ${end} of ${total} referrals`);
        const prev = document.getElementById("referralPrev");
        const next = document.getElementById("referralNext");
        if (prev) prev.disabled = this.page <= 1;
        if (next) next.disabled = this.page >= this.totalPages;
    },

    async openDetails(id) {
        try {
            const data = await this.request(`/api/admin/referrals/${encodeURIComponent(id)}`);
            const r = data.referral || {};
            this.text("referralModalTitle", `Referral #${r.id || id}`);
            const body = document.getElementById("referralModalBody");
            body.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-card"><span>Referral Code Used</span><strong>${this.escape(r.referral_code_used || "—")}</strong><small>Status: ${this.escape(r.status || "Registered")}</small></div>
                    <div class="detail-card"><span>Reward</span><strong>${this.escape(r.referrer_reward_points || 0)} points</strong><small>Rewarded: ${this.date(r.rewarded_at)}</small></div>
                    <div class="detail-card"><span>Referrer</span><strong>${this.escape(r.referrer_name || "—")}</strong><small>${this.escape(r.referrer_email || r.referrer_phone || "")} • ${this.escape(r.referrer_membership || "Bronze")}</small></div>
                    <div class="detail-card"><span>Referred Customer</span><strong>${this.escape(r.referred_name || "—")}</strong><small>${this.escape(r.referred_email || r.referred_phone || "")} • ${this.escape(r.referred_account_status || "")}</small></div>
                    <div class="detail-card full"><span>First Completed + Paid Sale</span><strong>${r.first_paid_sale_id ? this.escape(r.first_paid_sale_number || `#${r.first_paid_sale_id}`) : "No qualifying sale yet"}</strong><small>${r.first_paid_sale_id ? `${this.money(r.first_paid_sale_total)} • ${this.date(r.first_paid_sale_date)}` : "Referral reward remains pending until the referred customer's first qualifying sale."}</small></div>
                </div>
                <div class="modal-rule"><strong>Reward rule:</strong> the referrer receives the loyalty-category referral bonus only after the referred customer's first sale is both <b>Completed</b> and <b>Paid</b>. The backend reward service remains the source of truth.</div>
            `;
            document.getElementById("referralModal")?.classList.remove("hidden");
        } catch (error) {
            this.message(error.message, "error");
        }
    },

    closeModal() {
        document.getElementById("referralModal")?.classList.add("hidden");
    },

    exportCsv() {
        if (!this.currentRows.length) {
            this.message("There are no loaded referral rows to export.", "error");
            return;
        }
        const headers = ["ID","Referral Code","Referrer","Referrer Contact","Referred Customer","Referred Contact","Status","Points","First Paid Sale","Registered At"];
        const rows = this.currentRows.map(r => [r.id,r.referral_code_used,r.referrer_name,r.referrer_email || r.referrer_phone,r.referred_name,r.referred_email || r.referred_phone,r.status,r.referrer_reward_points,r.first_paid_sale_number || "",r.created_at || ""]);
        const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `rukhnav-referrals-${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    },

    money(value) {
        return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(Number(value || 0));
    },

    date(value) {
        if (!value) return "—";
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    },

    text(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },

    message(text, type) {
        const el = document.getElementById("referralMessage");
        if (!el) return;
        el.textContent = text;
        el.className = `referral-message show ${type || "success"}`;
        clearTimeout(this.messageTimer);
        this.messageTimer = setTimeout(() => { el.className = "referral-message"; }, 3500);
    },

    escape(value) {
        return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
    }
};

document.addEventListener("DOMContentLoaded", () => ReferralsAdmin.init());
