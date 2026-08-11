"use strict";

const ReviewAdmin = {
    page: 1,
    limit: 20,
    totalPages: 1,
    activeReviewId: null,
    moderationEnabled: false,

    token() {
        return localStorage.getItem("token") || localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
    },

    async request(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.token()}`,
                ...(options.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
        return data;
    },

    async init() {
        this.bind();
        await Promise.all([this.loadSummary(), this.loadReviews()]);
    },

    bind() {
        document.getElementById("refreshReviews")?.addEventListener("click", () => this.refresh());
        document.getElementById("applyReviewFilters")?.addEventListener("click", () => { this.page = 1; this.loadReviews(); });
        document.getElementById("reviewSearch")?.addEventListener("keydown", event => {
            if (event.key === "Enter") { this.page = 1; this.loadReviews(); }
        });
        document.getElementById("prevReviewPage")?.addEventListener("click", () => {
            if (this.page > 1) { this.page--; this.loadReviews(); }
        });
        document.getElementById("nextReviewPage")?.addEventListener("click", () => {
            if (this.page < this.totalPages) { this.page++; this.loadReviews(); }
        });
        document.getElementById("closeReviewModal")?.addEventListener("click", () => this.closeModal());
        document.getElementById("reviewModal")?.addEventListener("click", event => {
            if (event.target.id === "reviewModal") this.closeModal();
        });
        document.querySelectorAll("[data-review-status]").forEach(button => {
            button.addEventListener("click", () => this.updateStatus(button.dataset.reviewStatus));
        });
    },

    async refresh() {
        await Promise.all([this.loadSummary(), this.loadReviews()]);
    },

    async loadSummary() {
        try {
            const data = await this.request("/api/admin/reviews/summary");
            const s = data.summary || {};
            this.text("totalReviews", s.totalReviews || 0);
            this.text("averageRating", Number(s.averageRating || 0).toFixed(1));
            this.text("fiveStarReviews", s.fiveStarReviews || 0);
            this.text("pendingReviews", s.pendingReviews || 0);
            this.text("approvedReviews", s.approvedReviews || 0);
            this.moderationEnabled = Boolean(s.moderationEnabled);
            const statusFilter = document.getElementById("statusFilter");
            if (statusFilter) statusFilter.disabled = !this.moderationEnabled;
        } catch (error) {
            this.message(error.message, "error");
        }
    },

    async loadReviews() {
        const body = document.getElementById("reviewsBody");
        if (body) body.innerHTML = '<tr><td colspan="8">Loading reviews…</td></tr>';

        try {
            const query = new URLSearchParams({ page: String(this.page), limit: String(this.limit) });
            const search = document.getElementById("reviewSearch")?.value.trim();
            const rating = document.getElementById("ratingFilter")?.value;
            const status = document.getElementById("statusFilter")?.value;
            if (search) query.set("search", search);
            if (rating) query.set("rating", rating);
            if (status && this.moderationEnabled) query.set("status", status);

            const data = await this.request(`/api/admin/reviews?${query.toString()}`);
            const reviews = Array.isArray(data.reviews) ? data.reviews : [];
            const p = data.pagination || {};
            this.totalPages = Number(p.totalPages || 1);
            this.page = Number(p.page || this.page);
            this.moderationEnabled = Boolean(data.capabilities?.moderationEnabled);

            this.text("reviewCountLabel", `${Number(p.total || reviews.length)} review${Number(p.total || reviews.length) === 1 ? "" : "s"}`);
            this.text("reviewPageLabel", `Page ${this.page} of ${this.totalPages}`);
            document.getElementById("prevReviewPage").disabled = this.page <= 1;
            document.getElementById("nextReviewPage").disabled = this.page >= this.totalPages;

            if (!reviews.length) {
                body.innerHTML = '<tr><td colspan="8">No reviews match these filters.</td></tr>';
                return;
            }

            body.innerHTML = reviews.map(review => this.row(review)).join("");
            body.querySelectorAll("[data-view-review]").forEach(button => {
                button.addEventListener("click", () => this.openReview(button.dataset.viewReview));
            });
        } catch (error) {
            if (body) body.innerHTML = `<tr><td colspan="8">${this.e(error.message)}</td></tr>`;
            this.message(error.message, "error");
        }
    },

    row(review) {
        const status = String(review.status || "Approved");
        return `<tr>
            <td>#${this.e(review.id)}</td>
            <td><strong>${this.e(review.customer_name || "Customer")}</strong><br><small>${this.e(review.customer_email || review.customer_phone || "")}</small></td>
            <td>${this.e(review.product_name || `Product #${review.product_id}`)}</td>
            <td><span class="review-stars">${this.stars(review.rating)}</span></td>
            <td><div class="review-comment" title="${this.e(review.comment || "")}">${this.e(review.comment || "—")}</div></td>
            <td><span class="status-pill ${status.toLowerCase()}">${this.e(status)}</span></td>
            <td>${this.date(review.created_at)}</td>
            <td><button class="view-review" type="button" data-view-review="${this.e(review.id)}" title="View"><i class="fa-regular fa-eye"></i></button></td>
        </tr>`;
    },

    async openReview(id) {
        try {
            const data = await this.request(`/api/admin/reviews/${encodeURIComponent(id)}`);
            const r = data.review || {};
            this.activeReviewId = r.id;
            this.moderationEnabled = Boolean(data.capabilities?.moderationEnabled);
            this.text("modalReviewTitle", `${r.product_name || "Product"} — ${this.stars(r.rating)}`);
            document.getElementById("modalReviewContent").innerHTML = `
                <div class="review-detail-grid">
                    <div><span>Customer</span><strong>${this.e(r.customer_name || "Customer")}</strong></div>
                    <div><span>Contact</span><strong>${this.e(r.customer_email || r.customer_phone || "—")}</strong></div>
                    <div><span>Product</span><strong>${this.e(r.product_name || "—")}</strong></div>
                    <div><span>Status</span><strong>${this.e(r.status || "Approved")}</strong></div>
                    <div><span>Rating</span><strong class="review-stars">${this.stars(r.rating)}</strong></div>
                    <div><span>Date</span><strong>${this.date(r.created_at)}</strong></div>
                    <div>
                        <span>Verified Purchase</span>
                        <strong>${Number(r.verified_purchase) === 1 ? "Yes ✓" : "No"}</strong>
                    </div>
                    <div>
                        <span>Helpful Votes</span>
                        <strong>${Number(r.helpful_count || 0)}</strong>
                    </div>
                    <div>
                        <span>Featured</span>
                        <strong>${Number(r.featured) === 1 ? "Yes ★" : "No"}</strong>
                    </div>
                    <div>
                        <span>Approved By</span>
                        <strong>${this.e(r.approved_by_name || "—")}</strong>
                    </div>
                    <div>
                        <span>Approved At</span>
                        <strong>${r.approved_at ? this.dateTime(r.approved_at) : "—"}</strong>
                    </div>
                </div>

                <div class="review-detail-comment">
                    ${this.e(r.comment || "No written comment.")}
                </div>

                <div class="review-admin-tools">
                    <label class="review-admin-label" for="adminReviewReply">
                        Admin Reply
                    </label>

                    <textarea
                        id="adminReviewReply"
                        class="review-admin-reply"
                        rows="4"
                        maxlength="5000"
                        placeholder="Write a professional reply to this customer..."
                    >${this.e(r.admin_reply || "")}</textarea>

                    <div class="review-admin-tool-actions">
                        <button
                            id="saveReviewReply"
                            type="button"
                            class="review-btn review-btn-dark">
                            Save Reply
                        </button>

                        <button
                            id="removeReviewReply"
                            type="button"
                            class="review-btn"
                            ${r.admin_reply ? "" : "disabled"}>
                            Remove Reply
                        </button>

                        <button
                            id="toggleFeaturedReview"
                            type="button"
                            class="review-btn review-btn-gold">
                            ${Number(r.featured) === 1
                                ? "Remove Featured"
                                : "Feature Review"}
                        </button>
                    </div>
                </div>`;

            document
                .getElementById("saveReviewReply")
                ?.addEventListener(
                    "click",
                    () => this.saveReply()
                );

            document
                .getElementById("removeReviewReply")
                ?.addEventListener(
                    "click",
                    () => this.removeReply()
                );

            document
                .getElementById("toggleFeaturedReview")
                ?.addEventListener(
                    "click",
                    () => this.toggleFeatured(
                        Number(r.featured) !== 1
                    )
                );
            document.getElementById("moderationActions")?.classList.toggle("hidden", !this.moderationEnabled);
            const modal = document.getElementById("reviewModal");
            modal?.classList.remove("hidden");
            modal?.setAttribute("aria-hidden", "false");
        } catch (error) {
            this.message(error.message, "error");
        }
    },

    closeModal() {
        const modal = document.getElementById("reviewModal");

        // Move keyboard focus outside the modal before hiding it.
        // This prevents Chrome's aria-hidden accessibility warning.
        if (modal && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }

        modal?.classList.add("hidden");
        modal?.setAttribute("aria-hidden", "true");

        this.activeReviewId = null;
    },

    async updateStatus(status) {
        if (!this.activeReviewId) return;
        try {
            await this.request(`/api/admin/reviews/${this.activeReviewId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status })
            });
            this.message(`Review marked ${status}.`, "info");
            this.closeModal();
            await this.refresh();
        } catch (error) {
            this.message(error.message, "error");
        }
    },

    async saveReply() {
        if (!this.activeReviewId) return;

        const textarea =
            document.getElementById("adminReviewReply");

        const replyText =
            String(textarea?.value || "").trim();

        if (!replyText) {
            this.message(
                "Write a reply before saving.",
                "error"
            );
            textarea?.focus();
            return;
        }

        try {
            await this.request(
                `/api/admin/reviews/${this.activeReviewId}/reply`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        reply_text: replyText
                    })
                }
            );

            this.message(
                "Admin reply saved successfully.",
                "info"
            );

            await this.openReview(
                this.activeReviewId
            );

        } catch (error) {
            this.message(
                error.message,
                "error"
            );
        }
    },

    async removeReply() {
        if (!this.activeReviewId) return;

        try {
            await this.request(
                `/api/admin/reviews/${this.activeReviewId}/reply`,
                {
                    method: "DELETE"
                }
            );

            this.message(
                "Admin reply removed.",
                "info"
            );

            await this.openReview(
                this.activeReviewId
            );

        } catch (error) {
            this.message(
                error.message,
                "error"
            );
        }
    },

    async toggleFeatured(featured) {
        if (!this.activeReviewId) return;

        try {
            await this.request(
                `/api/admin/reviews/${this.activeReviewId}/featured`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        featured
                    })
                }
            );

            this.message(
                featured
                    ? "Review marked as featured."
                    : "Review removed from featured reviews.",
                "info"
            );

            await this.openReview(
                this.activeReviewId
            );

            await this.refresh();

        } catch (error) {
            this.message(
                error.message,
                "error"
            );
        }
    },

    stars(value) {
        const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
        return "★".repeat(n) + "☆".repeat(5 - n);
    },

    date(value) {
        return value
            ? new Date(value).toLocaleDateString(
                "en-GB",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            )
            : "—";
    },

    dateTime(value) {
        return value
            ? new Date(value).toLocaleString(
                "en-GB",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )
            : "—";
    },

    text(id, value) {
        const node = document.getElementById(id);
        if (node) node.textContent = value;
    },

    message(text, type = "info") {
        const node = document.getElementById("reviewMessage");
        if (!node) return;
        node.textContent = text;
        node.className = `review-message show ${type}`;
        window.setTimeout(() => { node.className = "review-message"; }, 4500);
    },

    e(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
};

document.addEventListener("DOMContentLoaded", () => ReviewAdmin.init());
