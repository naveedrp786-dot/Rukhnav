const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
// ==========================================
// RUKHNAV ERP
// Logged-in Admin Profile
// ==========================================

async function loadAdminProfile() {

    try {

        const token = localStorage.getItem("token");

        if (!token) {

            console.log("No token found.");
            return;

        }

        const response = await fetch(
            RUKHNAV_ORIGIN + "/api/admin/profile",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        console.log("PROFILE RESPONSE:", data);

        if (!response.ok) {

            console.error(data.message);
            return;

        }

        const admin = data.admin;

        console.log("Admin Object:", admin);
console.log("Profile Image:", admin.profile_image);
console.log("Full Name:", admin.first_name, admin.last_name);

        // Full Name
        const name = document.getElementById("adminName");

        if (name) {

            name.innerText =
                `${admin.first_name} ${admin.last_name}`;

        }

        // Role
        const role = document.getElementById("adminRole");

        if (role) {

            role.innerText = admin.role;

        }

        // Profile Image
        const photo = document.getElementById("adminPhoto");

        if (photo) {

            if (admin.profile_image) {

                photo.src =
                    `${RUKHNAV_ORIGIN}/uploads/admins/${admin.profile_image}`;

            } else {

                photo.src =
                    "images/avatar.png";

            }

        }

    }

    catch (error) {

        console.error("Profile Error:", error);

    }

}