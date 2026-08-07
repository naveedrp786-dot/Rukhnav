"use strict";
window.RukhnavReviews={
 async load(productId,container){
  const target=typeof container==="string"?document.querySelector(container):container; if(!target)return;
  const data=await API.get(`/api/reviews/product/${encodeURIComponent(productId)}`);
  target.innerHTML=`<div class="rv-summary"><strong>${Number(data.averageRating).toFixed(1)}</strong><span>${"★".repeat(Math.round(data.averageRating))}${"☆".repeat(5-Math.round(data.averageRating))}</span><small>${data.totalReviews} reviews</small></div>`+data.reviews.map(r=>`<article class="rv-card"><header>${r.profile_picture_url?`<img src="${Components.e(r.profile_picture_url)}" alt="">`:""}<div><strong>${Components.e(r.full_name)}</strong><span>${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</span>${r.verified_purchase?"<small>Verified Purchase</small>":""}</div></header><p>${Components.e(r.comment||"")}</p><div class="rv-images">${r.images.map(i=>`<button type="button" data-review-image="${Components.e(i.url)}"><img src="${Components.e(i.url)}" alt="${Components.e(i.image_alt||"Review image")}"></button>`).join("")}</div>${r.admin_reply?`<aside><strong>RUKHNAV reply</strong><p>${Components.e(r.admin_reply)}</p></aside>`:""}<button type="button" data-helpful="${r.id}">Helpful (${r.helpful_count||0})</button></article>`).join("");
  target.querySelectorAll("[data-helpful]").forEach(b=>b.onclick=async()=>{const d=await API.post(`/api/reviews/${b.dataset.helpful}/helpful`,{});b.textContent=`Helpful (${d.helpfulCount})`;});
  target.querySelectorAll("[data-review-image]").forEach(b=>b.onclick=()=>window.open(b.dataset.reviewImage,"_blank","noopener"));
 },
 async submit(form,productId){
  const body=new FormData(form); body.set("product_id",productId);
  const response=await fetch(`${API.base}/api/reviews`,{method:"POST",headers:API.authHeaders(false),body});
  const data=await response.json().catch(()=>({})); if(!response.ok||data.success===false)throw new Error(data.message||"Unable to submit review."); return data;
 }
};
