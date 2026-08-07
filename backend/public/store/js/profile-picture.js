"use strict";
window.RukhnavProfilePicture={
 async upload(file,{previewSelector="[data-profile-picture]",messageSelector="[data-profile-message]"}={}){
  if(!file) throw new Error("Choose a profile picture first.");
  const form=new FormData(); form.append("profile_picture",file);
  const response=await fetch(`${API.base}/api/profile/upload-picture`,{method:"POST",headers:API.authHeaders(false),body:form});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.success===false) throw new Error(data.message||"Unable to upload profile picture.");
  document.querySelectorAll(previewSelector).forEach(img=>{img.src=data.imageUrl;});
  const message=document.querySelector(messageSelector); if(message) message.textContent=data.message;
  const session=JSON.parse(localStorage.getItem("customer")||"{}"); session.profile_picture_url=data.imageUrl; localStorage.setItem("customer",JSON.stringify(session));
  return data;
 },
 async remove({previewSelector="[data-profile-picture]"}={}){
  const data=await API.delete("/api/profile/picture");
  document.querySelectorAll(previewSelector).forEach(img=>{img.removeAttribute("src");img.classList.add("is-empty");});
  return data;
 },
 async refresh({previewSelector="[data-profile-picture]"}={}){
  const data=await API.get("/api/profile");
  const url=data.profile?.profile_picture_url;
  if(url) document.querySelectorAll(previewSelector).forEach(img=>{img.src=url;img.classList.remove("is-empty");});
  return data.profile;
 }
};
