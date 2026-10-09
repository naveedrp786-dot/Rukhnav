"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const api = "/api/blog/admin/articles";

  let editingId = null;
  let currentStatus = "draft";
  let busy = false;

  function getToken() {
    const keys = [
      "adminToken", "admin_token", "token", "authToken"
    ];

    for (const storage of [localStorage, sessionStorage]) {
      for (const key of keys) {
        const value = storage.getItem(key);
        if (value) return value;
      }
    }

    return "";
  }

  async function request(url, options = {}) {
    const token = getToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message ||
        `HTTP ${response.status}`);
    }

    return data;
  }

  function message(text) {
    $("message").textContent = text;
  }

  function clearForm() {
    editingId = null;
    currentStatus = "draft";
    $("articleForm").reset();
    $("saveBtn").textContent = "Save Draft";
    message("");
  }

  function setBusy(value) {
    busy = value;
    $("saveBtn").disabled = value;
  }

  function htmlToPlainText(html) {
    const container = document.createElement("div");
    container.innerHTML = html || "";
    return container.textContent || "";
  }

  async function editArticle(id) {
    try {
      const data = await request(`${api}/${id}`);
      const article = data.article;

      if (article.status !== "draft") {
        message("Only draft articles can be edited.");
        return;
      }

      editingId = article.id;
      currentStatus = article.status;

      $("title").value = article.title || "";
      $("slug").value = article.slug || "";
      $("excerpt").value = article.excerpt || "";
      $("content").value =
        htmlToPlainText(article.content_html);

      $("saveBtn").textContent = "Update Draft";
      message("Editing draft #" + article.id);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      message(err.message);
    }
  }

  async function loadArticles() {
    const list = $("articleList");
    list.textContent = "Loading...";

    try {
      const data = await request(api);
      list.replaceChildren();

      if (!data.articles.length) {
        list.textContent = "No articles yet.";
        return;
      }

      for (const article of data.articles) {
        const item = document.createElement("div");
        item.className = "article";

        const title = document.createElement("strong");
        title.textContent = article.title;

        const details = document.createElement("small");
        details.textContent =
          `${article.status} | ${article.slug}`;

        item.append(title, details);

        if (article.status === "draft") {
          const edit = document.createElement("button");
          edit.type = "button";
          edit.textContent = "Edit";
          edit.className = "secondary";
          edit.addEventListener("click", () => {
            editArticle(article.id);
          });
          item.appendChild(edit);

          const publish = document.createElement("button");
          publish.type = "button";
          publish.textContent = "Publish";

          publish.addEventListener("click", async () => {
            if (!confirm(`Publish "${article.title}"?`)) return;

            publish.disabled = true;

            try {
              await request(`${api}/${article.id}/publish`, {
                method: "POST"
              });
              message("Article published successfully.");
              await loadArticles();
            } catch (err) {
              message(err.message);
              publish.disabled = false;
            }
          });

          item.appendChild(publish);
        }

        list.appendChild(item);
      }
    } catch (err) {
      list.textContent = `Unable to load articles: ${err.message}`;
    }
  }

  $("title").addEventListener("input", () => {
    if (editingId) return;

    $("slug").value = $("title").value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 240)
      .replace(/-$/, "");
  });

  $("articleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);

    const payload = {
      title: $("title").value.trim(),
      slug: $("slug").value.trim(),
      excerpt: $("excerpt").value,
      content_text: $("content").value
    };

    try {
      await request(
        editingId ? `${api}/${editingId}` : api,
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );

      message("Draft saved successfully.");
      await loadArticles();
    } catch (err) {
      message(err.message);
    } finally {
      setBusy(false);
    }
  });

  $("clearBtn").addEventListener("click", clearForm);
  $("refreshBtn").addEventListener("click", loadArticles);

  loadArticles();
})();
