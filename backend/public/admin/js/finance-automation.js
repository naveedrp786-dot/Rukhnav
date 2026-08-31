"use strict";

const booleanSettings = new Set([
    "AUTO_POST_CUSTOMER_PAYMENTS",
    "AUTO_POST_CUSTOMER_REFUNDS",
    "AUTO_POST_SUPPLIER_PAYMENTS",
    "AUTO_POST_FINANCE_TRANSACTIONS"
]);

async function loadAutomation() {
    try {
        const data = await f2Api("/automation/dashboard");

        document.getElementById("autoEvents").textContent =
            String(data.sourceSummary.automatedEvents);
        document.getElementById("autoPosted").textContent =
            String(data.journalSummary.postedJournals);
        document.getElementById("autoPostedValue").textContent =
            `${f2Money(data.journalSummary.postedValue)} posted value`;
        document.getElementById("autoCoupons").textContent =
            String(data.couponSummary.activeCoupons);
        document.getElementById("autoCouponUses").textContent =
            `${data.couponSummary.redeemedCount} redemption(s)`;
        document.getElementById("autoDiscountImpact").textContent =
            f2Money(data.couponSummary.discountImpact);

        renderSettings(data.settings || []);
        renderRecent(data.recent || []);
    } catch (error) {
        f2Message("automationMessage", error.message, "error");
    }
}

function renderSettings(settings) {
    const container = document.getElementById("automationSettings");

    container.innerHTML = settings.map(setting => {
        const isBoolean = booleanSettings.has(setting.setting_key);
        return `
            <article class="automation-setting-card">
                <div>
                    <strong>${f2Escape(setting.setting_key.replaceAll("_"," "))}</strong>
                    <p>${f2Escape(setting.description || "")}</p>
                </div>
                ${
                    isBoolean
                        ? `
                            <label class="automation-switch">
                                <input
                                    type="checkbox"
                                    data-setting-key="${f2Escape(setting.setting_key)}"
                                    ${String(setting.setting_value).toLowerCase() === "true" ? "checked" : ""}
                                >
                                <span></span>
                            </label>
                        `
                        : `<code>${f2Escape(setting.setting_value)}</code>`
                }
            </article>
        `;
    }).join("");

    container.querySelectorAll("[data-setting-key]").forEach(input => {
        input.addEventListener("change", async event => {
            const key = event.currentTarget.dataset.settingKey;
            try {
                await f2Api(
                    `/automation/settings/${encodeURIComponent(key)}`,
                    {
                        method:"PATCH",
                        body:JSON.stringify({
                            setting_value:event.currentTarget.checked ? "true" : "false"
                        })
                    }
                );
                f2Message("automationMessage","Automation setting updated.","success");
            } catch (error) {
                event.currentTarget.checked = !event.currentTarget.checked;
                f2Message("automationMessage",error.message,"error");
            }
        });
    });
}

function renderRecent(rows) {
    const body = document.getElementById("automationRecent");

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="6">No automated journals found.</td></tr>`;
        return;
    }

    body.innerHTML = rows.map(row => `
        <tr>
            <td>${f2Escape(row.journal_date)}</td>
            <td>${f2Escape(row.source_type)} #${f2Escape(row.source_id)}</td>
            <td>${f2Escape(row.event_key)}</td>
            <td><strong>${f2Escape(row.journal_number)}</strong></td>
            <td>${f2Escape(row.narration)}</td>
            <td class="f2-money debit">${f2Money(row.total_debit)}</td>
        </tr>
    `).join("");
}

async function reconcile() {
    if (!confirm(
        "Create any missing journals from historical payments and finance transactions? Existing source events will not be duplicated."
    )) return;

    const button = document.getElementById("reconcileButton");
    f2Loading(button,true,"Reconciling");

    try {
        const data = await f2Api(
            "/automation/reconcile",
            {method:"POST"}
        );

        const s = data.summary;
        f2Message(
            "automationMessage",
            `Reconciliation complete: ${s.customerPayments} customer payments, ${s.customerRefunds} refunds, ${s.supplierPayments} supplier payments and ${s.financeTransactions} finance transactions posted. ${s.skipped} already linked. ${s.failed.length} failed.`,
            s.failed.length ? "error" : "success"
        );

        await loadAutomation();
    } catch (error) {
        f2Message("automationMessage",error.message,"error");
    } finally {
        f2Loading(button,false);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("reconcileButton").addEventListener("click",reconcile);
    loadAutomation();
},{once:true});
