const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
const API_BASE_URL = RUKHNAV_ORIGIN;

document.addEventListener("DOMContentLoaded", () => {
    loadHomepageCms();
});

async function loadHomepageCms() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/website/pages/home`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to load homepage CMS content."
            );
        }

        const sections = Array.isArray(data.sections)
            ? data.sections
            : [];

        const brandStorySection = sections.find(section => {
            return section.section_key === "brand_story";
        });

        renderHomeBrandStory(brandStorySection);

    } catch (error) {
        console.error("Homepage CMS error:", error);
    }
}

function renderHomeBrandStory(section) {
    if (!section) {
        return;
    }

    const sectionElement =
        document.getElementById("homeBrandStorySection");

    const imageElement =
        document.getElementById("homeBrandStoryImage");

    const eyebrowElement =
        document.getElementById("homeBrandStoryEyebrow");

    const titleElement =
        document.getElementById("homeBrandStoryTitle");

    const contentElement =
        document.getElementById("homeBrandStoryContent");

    const valuesElement =
        document.getElementById("homeBrandStoryValues");

    const buttonElement =
        document.getElementById("homeBrandStoryButton");

    if (sectionElement) {
        sectionElement.style.display =
            String(section.status).toLowerCase() === "inactive"
                ? "none"
                : "";
    }

    if (imageElement && section.image) {
        imageElement.src = resolveCmsImage(section.image);
    }

    if (imageElement) {
        imageElement.alt =
            section.image_alt ||
            section.title ||
            "RUKHNAV herbal beauty and care";
    }

    if (eyebrowElement && section.eyebrow) {
        eyebrowElement.textContent = section.eyebrow;
    }

    if (titleElement && section.title) {
        titleElement.textContent = section.title;
    }

    if (contentElement) {
        const storyContent =
            section.content ||
            section.description ||
            section.subtitle;

        if (storyContent) {
            contentElement.textContent = storyContent;
        }
    }

    if (buttonElement) {
        if (section.button_text) {
            buttonElement.textContent = section.button_text;
        }

        if (section.button_url) {
            buttonElement.href = section.button_url;
        }
    }

    const items = Array.isArray(section.items)
        ? section.items
              .filter(item => {
                  return String(item.status).toLowerCase() !== "inactive";
              })
              .sort((a, b) => {
                  return Number(a.sort_order || 0)
                      - Number(b.sort_order || 0);
              })
        : [];

    if (valuesElement && items.length > 0) {
        valuesElement.innerHTML = "";

        items.forEach((item, index) => {
            const valueItem = document.createElement("div");

            const number = document.createElement("strong");
            number.textContent =
                String(index + 1).padStart(2, "0");

            const label = document.createElement("span");
            label.textContent =
                item.title ||
                item.description ||
                `Brand value ${index + 1}`;

            valueItem.appendChild(number);
            valueItem.appendChild(label);

            valuesElement.appendChild(valueItem);
        });
    }
}

function resolveCmsImage(imagePath) {
    if (!imagePath) {
        return "";
    }

    if (
        imagePath.startsWith("http://") ||
        imagePath.startsWith("https://") ||
        imagePath.startsWith("data:") ||
        imagePath.startsWith("blob:")
    ) {
        return imagePath;
    }

    if (imagePath.startsWith("/")) {
        return `${API_BASE_URL}${imagePath}`;
    }

    if (imagePath.startsWith("uploads/")) {
        return `${API_BASE_URL}/${imagePath}`;
    }

    return imagePath;
}