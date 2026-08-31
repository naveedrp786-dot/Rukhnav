"use strict";
const F2="/api/admin/finance";
const tok=()=>localStorage.getItem("adminToken")||localStorage.getItem("admin_token")||localStorage.getItem("token")||"";
async function f2api(path,opt={}){const h=new Headers(opt.headers||{});if(opt.body)h.set("Content-Type","application/json");if(tok())h.set("Authorization",`Bearer ${tok()}`);const r=await fetch(F2+path,{...opt,headers:h});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||`Request failed (${r.status})`);return d}
const fm=v=>`PKR ${Number(v||0).toLocaleString("en-PK",{maximumFractionDigits:2})}`;
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
function msg(id,t,type=""){const e=document.getElementById(id);e.textContent=t||"";e.className=`f2-msg ${type}`}
function openM(id){document.getElementById(id)?.classList.remove("hidden")}
function closeM(id){document.getElementById(id)?.classList.add("hidden")}
