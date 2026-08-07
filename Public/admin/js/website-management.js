"use strict";

const CMS_API = "/api/admin/website";
const state = {settings:{}, status:"Draft"};

function token(){
    return localStorage.getItem("adminToken") ||
        localStorage.getItem("admin_token") ||
        localStorage.getItem("token") || "";
}

async function request(path, options={}){
    const headers = new Headers(options.headers || {});
    const auth = token();
    if(auth) headers.set("Authorization", auth.startsWith("Bearer ")?auth:`Bearer ${auth}`);
    if(options.body) headers.set("Content-Type","application/json");

    const response = await fetch(CMS_API + path,{...options,headers});
    const data = await response.json().catch(()=>({}));
    if(!response.ok || data.success===false) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
}


async function uploadMedia(
    file,
    mediaType = "Image"
){
    const headers =
        new Headers();

    const auth =
        token();

    if(auth){
        headers.set(
            "Authorization",
            auth.startsWith("Bearer ")
                ? auth
                : `Bearer ${auth}`
        );
    }

    const body =
        new FormData();

    body.append(
        "file",
        file
    );

    body.append(
        "media_type",
        mediaType
    );

    const response =
        await fetch(
            `${CMS_API}/media`,
            {
                method: "POST",
                headers,
                body
            }
        );

    const data =
        await response
            .json()
            .catch(() => ({}));

    if(
        !response.ok ||
        data.success === false
    ){
        throw new Error(
            data.message ||
            `Upload failed (${response.status})`
        );
    }

    return data.media;
}

function getPath(object,path){
    return path.split(".").reduce((value,key)=>value?.[key],object);
}

function setPath(object,path,value){
    const keys=path.split(".");
    let current=object;
    keys.slice(0,-1).forEach(key=>{
        if(!current[key] || typeof current[key]!=="object") current[key]={};
        current=current[key];
    });
    current[keys.at(-1)]=value;
}

function message(text,type=""){
    const el=document.getElementById("cmsMessage");
    el.textContent=text||"";
    el.className=`cms-message ${type}`.trim();
}

function bindFields(){
    document
        .querySelectorAll("[data-path]")
        .forEach(input => {
            const value =
                getPath(
                    state.settings,
                    input.dataset.path
                );

            if(input.type === "checkbox"){
                input.checked =
                    Boolean(value);
            }else if(
                value !== undefined &&
                value !== null
            ){
                input.value = value;
            }

            if(
                input.dataset.cmsBound ===
                "true"
            ){
                return;
            }

            input.dataset.cmsBound =
                "true";

            input.addEventListener(
                "input",
                () => {
                    const next =
                        input.type ===
                        "checkbox"
                            ? input.checked
                            : input.type ===
                              "number"
                                ? Number(
                                    input.value ||
                                    0
                                )
                                : input.value;

                    setPath(
                        state.settings,
                        input.dataset.path,
                        next
                    );

                    updateMediaPreviews();
                    preview();
                }
            );
        });

    bindMediaUploads();
    updateMediaPreviews();
}

function escapeHtml(value=""){
    return String(value)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}


function updatePreviewImage(
    previewId,
    value
){
    const image =
        document.getElementById(
            previewId
        );

    if(!image){
        return;
    }

    const url =
        String(value || "")
            .trim();

    if(url){
        image.src = url;
        image.classList.add("show");
    }else{
        image.removeAttribute("src");
        image.classList.remove("show");
    }
}

function updateMediaPreviews(){
    updatePreviewImage(
        "logoPreview",
        getPath(
            state.settings,
            "branding.logo_url"
        )
    );

    updatePreviewImage(
        "faviconPreview",
        getPath(
            state.settings,
            "branding.favicon_url"
        )
    );

    updatePreviewImage(
        "heroImagePreview",
        getPath(
            state.settings,
            "home.hero_image_url"
        )
    );
}

function bindMediaUploads(){
    document
        .querySelectorAll(
            ".media-file-input"
        )
        .forEach(input => {
            if(
                input.dataset.uploadBound ===
                "true"
            ){
                return;
            }

            input.dataset.uploadBound =
                "true";

            input.addEventListener(
                "change",
                async () => {
                    const file =
                        input.files?.[0];

                    if(!file){
                        return;
                    }

                    try{
                        message(
                            `Uploading ${file.name}...`
                        );

                        const media =
                            await uploadMedia(
                                file,
                                input.dataset
                                    .uploadType ||
                                "Image"
                            );

                        setPath(
                            state.settings,
                            input.dataset
                                .uploadTarget,
                            media.file_url
                        );

                        const target =
                            document
                                .querySelector(
                                    `[data-path="${input.dataset.uploadTarget}"]`
                                );

                        if(target){
                            target.value =
                                media.file_url;
                        }

                        updatePreviewImage(
                            input.dataset.preview,
                            media.file_url
                        );

                        message(
                            "Image uploaded. Save Draft and Publish to make it live.",
                            "success"
                        );

                        preview();
                    }catch(error){
                        message(
                            error.message,
                            "error"
                        );
                    }finally{
                        input.value = "";
                    }
                }
            );
        });
}

function renderCategoryCards(){
    const container =
        document.getElementById(
            "categoryCardEditor"
        );

    if(!container){
        return;
    }

    const home =
        state.settings.home ||=
            {};

    const rows =
        Array.isArray(
            home.category_cards
        )
            ? home.category_cards
            : [];

    container.innerHTML =
        rows
            .map(
                (item, index) => `
                    <div class="repeat-row category-card-row">
                        <input
                            data-category-field="title"
                            data-index="${index}"
                            value="${escapeHtml(item.title || "")}"
                            placeholder="Category title"
                        >

                        <input
                            data-category-field="text"
                            data-index="${index}"
                            value="${escapeHtml(item.text || "")}"
                            placeholder="Category description"
                        >

                        <input
                            data-category-field="url"
                            data-index="${index}"
                            value="${escapeHtml(item.url || "")}"
                            placeholder="products.html?category=..."
                        >

                        <input
                            data-category-field="image_url"
                            data-index="${index}"
                            value="${escapeHtml(item.image_url || "")}"
                            placeholder="Optional image URL"
                        >

                        <input
                            data-category-field="icon"
                            data-index="${index}"
                            value="${escapeHtml(item.icon || "fa-leaf")}"
                            placeholder="Font Awesome icon"
                        >

                        <label>
                            <input
                                type="checkbox"
                                data-category-field="enabled"
                                data-index="${index}"
                                ${item.enabled !== false ? "checked" : ""}
                            >
                            Enabled
                        </label>

                        <button
                            type="button"
                            class="remove-row"
                            data-remove-category="${index}"
                            title="Remove category card"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `
            )
            .join("");

    container
        .querySelectorAll(
            "[data-category-field]"
        )
        .forEach(input => {
            input.addEventListener(
                "input",
                () => {
                    const index =
                        Number(
                            input.dataset.index
                        );

                    const field =
                        input.dataset
                            .categoryField;

                    home.category_cards[index][field] =
                        input.type ===
                        "checkbox"
                            ? input.checked
                            : input.value;

                    preview();
                }
            );
        });

    container
        .querySelectorAll(
            "[data-remove-category]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    home.category_cards.splice(
                        Number(
                            button.dataset
                                .removeCategory
                        ),
                        1
                    );

                    renderCategoryCards();
                    preview();
                }
            );
        });
}

function renderNavigation(){
    const container=document.getElementById("navigationEditor");
    const rows=Array.isArray(state.settings.navigation)?state.settings.navigation:[];
    container.innerHTML=rows.map((item,index)=>`
        <div class="repeat-row">
            <input data-nav-field="label" data-index="${index}" value="${escapeHtml(item.label||"")}" placeholder="Label">
            <input data-nav-field="url" data-index="${index}" value="${escapeHtml(item.url||"")}" placeholder="URL">
            <label><input type="checkbox" data-nav-field="enabled" data-index="${index}" ${item.enabled!==false?"checked":""}> Enabled</label>
            <button type="button" class="remove-row" data-remove-nav="${index}"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join("");

    container.querySelectorAll("[data-nav-field]").forEach(input=>{
        input.addEventListener("input",()=>{
            const index=Number(input.dataset.index);
            const field=input.dataset.navField;
            state.settings.navigation[index][field]=input.type==="checkbox"?input.checked:input.value;
            preview();
        });
    });
    container.querySelectorAll("[data-remove-nav]").forEach(button=>{
        button.addEventListener("click",()=>{
            state.settings.navigation.splice(Number(button.dataset.removeNav),1);
            renderNavigation(); preview();
        });
    });
}

function renderBanners(){
    const container=document.getElementById("bannerEditor");
    const rows=Array.isArray(state.settings.promo_banners)?state.settings.promo_banners:[];
    container.innerHTML=rows.map((item,index)=>`
        <div class="repeat-row banner">
            <input data-banner-field="title" data-index="${index}" value="${escapeHtml(item.title||"")}" placeholder="Title">
            <input data-banner-field="text" data-index="${index}" value="${escapeHtml(item.text||"")}" placeholder="Text">
            <input data-banner-field="image_url" data-index="${index}" value="${escapeHtml(item.image_url||"")}" placeholder="Image URL">
            <input data-banner-field="button_label" data-index="${index}" value="${escapeHtml(item.button_label||"")}" placeholder="Button label">
            <input data-banner-field="button_url" data-index="${index}" value="${escapeHtml(item.button_url||"")}" placeholder="Button URL">
            <label><input type="checkbox" data-banner-field="enabled" data-index="${index}" ${item.enabled!==false?"checked":""}> Enabled</label>
            <button type="button" class="remove-row" data-remove-banner="${index}"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join("");

    container.querySelectorAll("[data-banner-field]").forEach(input=>{
        input.addEventListener("input",()=>{
            const index=Number(input.dataset.index);
            const field=input.dataset.bannerField;
            state.settings.promo_banners[index][field]=input.type==="checkbox"?input.checked:input.value;
            preview();
        });
    });
    container.querySelectorAll("[data-remove-banner]").forEach(button=>{
        button.addEventListener("click",()=>{
            state.settings.promo_banners.splice(Number(button.dataset.removeBanner),1);
            renderBanners(); preview();
        });
    });
}

function preview(){
    const frame=document.getElementById("storePreview");
    if(!frame?.contentWindow) return;
    frame.contentWindow.postMessage({
        type:"RUKHNAV_CMS_PREVIEW",
        settings:state.settings
    },"*");
}

async function load(){
    try{
        const data=await request("/settings");
        state.settings=data.settings||{};
        state.status=data.status||"Draft";
        bindFields();
        renderNavigation();
        renderBanners();
        await loadHistory();
        setTimeout(preview,700);
    }catch(error){
        message(error.message,"error");
    }
}

async function save(){
    try{
        const data=await request("/settings",{
            method:"PUT",
            body:JSON.stringify({settings:state.settings})
        });
        message(data.message,"success");
        await loadHistory();
    }catch(error){message(error.message,"error")}
}

async function publish(){
    try{
        await save();
        const data=await request("/publish",{method:"POST"});
        message(data.message,"success");
        document.getElementById("storePreview").contentWindow.location.reload();
        await loadHistory();
    }catch(error){message(error.message,"error")}
}

async function restore(){
    if(!confirm("Restore the current draft to the last published website?")) return;
    try{
        const data=await request("/restore-published",{method:"POST"});
        message(data.message,"success");
        location.reload();
    }catch(error){message(error.message,"error")}
}

async function loadHistory(){
    try{
        const data=await request("/history");
        document.getElementById("historyList").innerHTML=(data.history||[]).map(row=>`
            <div class="history-item">
                <strong>${escapeHtml(row.action_type)}</strong>
                <span>${escapeHtml(row.created_by_name||"Admin")} · ${new Date(row.created_at).toLocaleString()}</span>
            </div>
        `).join("") || "<p>No publishing history yet.</p>";
    }catch{}
}

document.addEventListener("DOMContentLoaded",()=>{
    document.querySelectorAll("[data-tab]").forEach(button=>{
        button.addEventListener("click",()=>{
            document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));
            document.querySelectorAll("[data-panel]").forEach(x=>x.classList.remove("active"));
            button.classList.add("active");
            document.querySelector(`[data-panel="${button.dataset.tab}"]`)?.classList.add("active");
        });
    });

    
    document
        .getElementById(
            "addCategoryCardButton"
        )
        ?.addEventListener(
            "click",
            () => {
                state.settings.home ||=
                    {};

                state.settings.home
                    .category_cards ||=
                    [];

                state.settings.home
                    .category_cards
                    .push({
                        title:
                            "New Category",
                        text: "",
                        url:
                            "products.html",
                        image_url: "",
                        icon:
                            "fa-leaf",
                        enabled: true
                    });

                renderCategoryCards();
                preview();
            }
        );

    document.getElementById("addNavigationButton").addEventListener("click",()=>{
        state.settings.navigation ||= [];
        state.settings.navigation.push({label:"New Link",url:"#",enabled:true,sort_order:state.settings.navigation.length+1});
        renderNavigation();
    });

    document.getElementById("addBannerButton").addEventListener("click",()=>{
        state.settings.promo_banners ||= [];
        state.settings.promo_banners.push({title:"New Banner",text:"",image_url:"",button_label:"Shop Now",button_url:"products.html",enabled:true,sort_order:state.settings.promo_banners.length+1});
        renderBanners();
    });

    document.getElementById("saveButton").addEventListener("click",save);
    document.getElementById("publishButton").addEventListener("click",publish);
    document.getElementById("restoreButton").addEventListener("click",restore);

    load();
});
