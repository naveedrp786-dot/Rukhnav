document.addEventListener("DOMContentLoaded", () => {
    const trackBtn = document.getElementById("btnGuestTrack") || document.querySelector("button[type='submit']");
    
    if (trackBtn) {
        trackBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const orderNumber = document.getElementById("guestOrderNumber")?.value.trim() || document.getElementById("orderId")?.value.trim();
            const contactInfo = document.getElementById("guestContactInfo")?.value.trim() || document.getElementById("contact")?.value.trim();
            const displayDiv = document.getElementById("guestTrackResult") || document.getElementById("orderStatusResult");

            if (!orderNumber || !contactInfo) {
                alert("Please enter both your Order Number and Mobile/Email.");
                return;
            }

            try {
                const res = await fetch("/api/orders/guest-track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderNumber, contactInfo })
                });
                const data = await res.json();

                if (data.success) {
                    displayDiv.innerHTML = `<div style="color:green; padding:15px; font-weight:bold;">Order Status: ${data.order.status}</div>`;
                } else {
                    displayDiv.innerHTML = `<div style="color:red; padding:15px;">${data.message}</div>`;
                }
            } catch (err) {
                console.error(err);
                alert("Error connecting to the tracking server.");
            }
        });
    }
});
