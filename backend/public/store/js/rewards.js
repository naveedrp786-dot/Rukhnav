"use strict";

const RewardsPage = {
    loyalty: null,

    async init() {
        await this.waitForStore();

        if (!API.isAuthenticated()) {
            this.showAuth();
            return;
        }

        await this.loadRewards();
    },

    waitForStore() {
        return new Promise(resolve => {
            if (
                Store.settings &&
                Object.keys(Store.settings).length
            ) {
                resolve();
                return;
            }

            document.addEventListener(
                "rukhnav:store-ready",
                resolve,
                { once: true }
            );
        });
    },

    hideStates() {
        [
            "rewardsLoading",
            "rewardsAuthState",
            "rewardsContent"
        ].forEach(id => {
            document
                .getElementById(id)
                ?.classList.add("hidden");
        });
    },

    showAuth() {
        this.hideStates();

        document
            .getElementById("rewardsAuthState")
            .classList.remove("hidden");
    },

    async loadRewards() {
        this.hideStates();

        document
            .getElementById("rewardsLoading")
            .classList.remove("hidden");

        try {
            const data =
                await API.get(
                    "/api/customer-loyalty/me"
                );

            this.loyalty =
                data.loyalty || {};

            this.render();

            this.hideStates();

            document
                .getElementById("rewardsContent")
                .classList.remove("hidden");
        } catch (error) {
            if (
                error.status === 401 ||
                error.status === 403
            ) {
                API.clearCustomerSession?.();
                this.showAuth();
                return;
            }

            Store.toast(
                error.message,
                "error"
            );

            this.showAuth();
        }
    },

    render() {
        const loyalty =
            this.loyalty;

        const level =
            String(
                loyalty.membershipLevel ||
                "Bronze"
            );

        const levelKey =
            level.toLowerCase();

        const benefits =
            loyalty.benefits || {};

        const nextCategory =
            loyalty.nextCategory;

        const firstName =
            String(
                loyalty.fullName ||
                "Customer"
            )
                .trim()
                .split(/\s+/)[0];

        document
            .getElementById("rewardsGreeting")
            .textContent =
            `${firstName}'s rewards`;

        document
            .getElementById("membershipLevel")
            .textContent =
            level;

        document
            .getElementById("membershipEmblemText")
            .textContent =
            level;

        document
            .getElementById("availablePoints")
            .textContent =
            this.number(
                loyalty.availablePoints
            );

        document
            .getElementById("lifetimePoints")
            .textContent =
            this.number(
                loyalty.lifetimePoints
            );

        document
            .getElementById("totalOrders")
            .textContent =
            this.number(
                loyalty.totalOrders
            );

        document
            .getElementById("totalSpent")
            .textContent =
            Store.money(
                loyalty.totalSpent
            );

        document
            .getElementById("pointsMultiplier")
            .textContent =
            `${Number(
                benefits.pointsMultiplier ||
                1
            ).toFixed(2)}×`;

        document
            .getElementById("discountPercentage")
            .textContent =
            `${Number(
                benefits.discountPercentage ||
                0
            )}%`;

        document
            .getElementById("birthdayBonus")
            .textContent =
            this.number(
                benefits.birthdayBonusPoints
            );

        document
            .getElementById("referralBonus")
            .textContent =
            this.number(
                benefits.referralBonusPoints
            );

        const hero =
            document.getElementById(
                "membershipHero"
            );

        hero.className =
            `membership-hero membership-${levelKey}`;

        document
            .getElementById("membershipMessage")
            .textContent =
            this.membershipMessage(
                levelKey
            );

        this.renderProgress(
            loyalty
        );

        this.renderBenefits(
            benefits
        );

        this.renderEventsAccess(
            loyalty
        );

        if (!nextCategory) {
            document
                .getElementById("progressCard")
                .classList.add("hidden");
        }
    },

    renderProgress(loyalty) {
        const next =
            loyalty.nextCategory;

        if (!next) {
            return;
        }

        const current =
            Number(
                loyalty.lifetimePoints ||
                0
            );

        const target =
            Number(
                next.requiredLifetimePoints ||
                0
            );

        const previousThreshold =
            this.previousThreshold(
                loyalty.membershipLevel
            );

        const range =
            Math.max(
                1,
                target -
                previousThreshold
            );

        const progress =
            Math.max(
                0,
                Math.min(
                    100,
                    (
                        (
                            current -
                            previousThreshold
                        ) /
                        range
                    ) *
                    100
                )
            );

        document
            .getElementById("progressHeading")
            .textContent =
            `Progress to ${next.name}`;

        document
            .getElementById("pointsNeededLabel")
            .textContent =
            `${this.number(
                next.pointsNeeded
            )} points needed`;

        document
            .getElementById("membershipProgressBar")
            .style.width =
            `${progress}%`;

        document
            .getElementById("currentPointsLabel")
            .textContent =
            `${this.number(current)} lifetime points`;

        document
            .getElementById("targetPointsLabel")
            .textContent =
            `Target: ${this.number(target)}`;
    },

    renderBenefits(benefits) {
        const items = [
            {
                icon: "fa-bolt",
                title: "Points multiplier",
                text: `${Number(
                    benefits.pointsMultiplier ||
                    1
                ).toFixed(2)}× points on eligible purchases`,
                enabled: true
            },
            {
                icon: "fa-percent",
                title: "Member discount",
                text: `${Number(
                    benefits.discountPercentage ||
                    0
                )}% membership discount`,
                enabled:
                    Number(
                        benefits.discountPercentage ||
                        0
                    ) > 0
            },
            {
                icon: "fa-cake-candles",
                title: "Birthday bonus",
                text: `${this.number(
                    benefits.birthdayBonusPoints
                )} birthday bonus points`,
                enabled:
                    Number(
                        benefits.birthdayBonusPoints ||
                        0
                    ) > 0
            },
            {
                icon: "fa-user-group",
                title: "Referral bonus",
                text: `${this.number(
                    benefits.referralBonusPoints
                )} referral bonus points`,
                enabled:
                    Number(
                        benefits.referralBonusPoints ||
                        0
                    ) > 0
            },
            {
                icon: "fa-calendar-check",
                title: "Events & reminders",
                text: "Birthday, anniversary and special-event reminders",
                enabled:
                    Boolean(
                        benefits.eventMenuEnabled
                    )
            },
            {
                icon: "fa-envelope",
                title: "Email reminders",
                text: "Receive event reminders by email",
                enabled:
                    Boolean(
                        benefits.emailRemindersEnabled
                    )
            },
            {
                icon: "fa-brands fa-whatsapp",
                title: "WhatsApp reminders",
                text: "Receive event reminders through WhatsApp",
                enabled:
                    Boolean(
                        benefits.whatsappRemindersEnabled
                    )
            },
            {
                icon: "fa-comment-sms",
                title: "SMS reminders",
                text: "Receive event reminders by SMS",
                enabled:
                    Boolean(
                        benefits.smsRemindersEnabled
                    )
            },
            {
                icon: "fa-headset",
                title: "Priority support",
                text: "Faster assistance from customer support",
                enabled:
                    Boolean(
                        benefits.prioritySupportEnabled
                    )
            },
            {
                icon: "fa-truck-fast",
                title: "Free delivery",
                text: "Free delivery on qualifying orders",
                enabled:
                    Boolean(
                        benefits.freeDeliveryEnabled
                    )
            }
        ];

        document
            .getElementById("benefitsGrid")
            .innerHTML =
            items
                .map(item => `
                    <article class="benefit-item ${item.enabled ? "enabled" : ""}">
                        <i class="fa-solid ${item.icon}"></i>

                        <div>
                            <strong>${Components.e(item.title)}</strong>
                            <span>${Components.e(item.text)}</span>
                        </div>

                        <span class="benefit-state">
                            ${item.enabled ? "Active" : "Locked"}
                        </span>
                    </article>
                `)
                .join("");
    },

    renderEventsAccess(loyalty) {
        const benefits =
            loyalty.benefits || {};

        const unlocked =
            Boolean(
                benefits.eventMenuEnabled
            );

        const card =
            document.getElementById(
                "eventsAccessCard"
            );

        const icon =
            document.getElementById(
                "eventsAccessIcon"
            );

        const title =
            document.getElementById(
                "eventsAccessTitle"
            );

        const text =
            document.getElementById(
                "eventsAccessText"
            );

        const button =
            document.getElementById(
                "eventsAccessButton"
            );

        card.classList.toggle(
            "locked",
            !unlocked
        );

        card.classList.toggle(
            "unlocked",
            unlocked
        );

        if (unlocked) {
            icon.className =
                "fa-solid fa-calendar-heart";

            title.textContent =
                "Events & Reminders unlocked";

            text.textContent =
                "Create birthdays, anniversaries and special occasions with email, WhatsApp or SMS reminders.";

            button.href =
                "events.html";

            button.textContent =
                "Open Events & Reminders";

            button.className =
                "btn light";
        } else {
            icon.className =
                "fa-solid fa-lock";

            const pointsNeeded =
                this.pointsToGold(
                    loyalty
                );

            title.textContent =
                "Events & Reminders locked";

            text.textContent =
                pointsNeeded > 0
                    ? `Reach Gold membership to unlock this premium feature. You need ${this.number(pointsNeeded)} more lifetime points.`
                    : "Reach Gold membership to unlock birthdays, anniversaries and special-occasion reminders.";

            button.href =
                "#progressCard";

            button.textContent =
                "View progress";

            button.className =
                "btn secondary";
        }
    },

    pointsToGold(loyalty) {
        const current =
            Number(
                loyalty.lifetimePoints ||
                0
            );

        return Math.max(
            0,
            5000 - current
        );
    },

    previousThreshold(level) {
        const map = {
            bronze: 0,
            silver: 1000,
            gold: 5000,
            platinum: 15000
        };

        return map[
            String(level || "bronze")
                .toLowerCase()
        ] || 0;
    },

    membershipMessage(level) {
        const messages = {
            bronze:
                "Start earning points with every eligible purchase and work toward Silver membership.",
            silver:
                "Enjoy improved rewards while progressing toward Gold and premium event access.",
            gold:
                "You have unlocked premium rewards, priority benefits and Events & Reminders.",
            platinum:
                "You have reached the highest RUKHNAV membership with maximum benefits."
        };

        return (
            messages[level] ||
            messages.bronze
        );
    },

    number(value) {
        return new Intl.NumberFormat(
            "en-PK"
        ).format(
            Number(value) || 0
        );
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => RewardsPage.init()
);
