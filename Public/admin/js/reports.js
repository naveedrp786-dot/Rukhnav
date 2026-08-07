"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
const API=RUKHNAV_ORIGIN + "/api/reports";const token=localStorage.getItem("adminToken")||localStorage.getItem("token")||sessionStorage.getItem("adminToken")||sessionStorage.getItem("token");if(!token)location.href="login.html";const $=id=>document.getElementById(id);let charts={},currentRows=[],currentEndpoint="sales/daily";
const auth=()=>({Authorization:token.startsWith("Bearer ")?token:`Bearer ${token}`});async function api(path){const r=await fetch(`${API}/${path}`,{headers:auth()});let d={};try{d=await r.json()}catch{}if(r.status===401||r.status===403){location.href="login.html";throw Error("Session expired")};if(!r.ok||d.success===false)throw Error(d.message||`Request failed (${r.status})`);return d}
const n=v=>Number.isFinite(Number(v))?Number(v):0,m=v=>new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(n(v)),esc=v=>{const x=document.createElement("div");x.textContent=v==null?"":String(v);return x.innerHTML};function msg(t){$("reportMessage").textContent=t;$("reportMessage").className="message show error"}
function pick(obj,keys){for(const k of keys){if(obj&&obj[k]!=null)return obj[k]}return 0}function deepFind(obj,keyNames){if(!obj||typeof obj!=="object")return 0;for(const [k,v] of Object.entries(obj)){if(keyNames.includes(k))return v;if(v&&typeof v==="object"){const f=deepFind(v,keyNames);if(f!==0)return f}}return 0}
function chart(id,type,labels,data,label){charts[id]?.destroy();charts[id]=new Chart($(id),{type,data:{labels,datasets:[{label,data,borderWidth:2,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type!=="bar"||id==="paymentChart"}},scales:type==="doughnut"?{}:{y:{beginAtZero:true}}}})}
function findArray(data){const candidates=[];const walk=o=>{if(Array.isArray(o))candidates.push(o);else if(o&&typeof o==="object")Object.values(o).forEach(walk)};walk(data);return candidates.sort((a,b)=>b.length-a.length)[0]||[]}
async function loadOverview(){
    const year=$("reportYear").value;
    const fromDate=`${year}-01-01`;
    const toDate=`${year}-12-31`;

    const [dash,fin,rev,pay,growth,cat]=await Promise.allSettled([
        api("dashboard"),
        api("financial"),
        api(`charts/monthly-revenue?year=${year}`),
        api(`charts/payment-methods?fromDate=${fromDate}&toDate=${toDate}`),
        api(`bi/customer-growth?year=${year}`),
        api(`charts/category-sales?fromDate=${fromDate}&toDate=${toDate}`)
    ]);

    const d=dash.value||{},f=fin.value||{};

    $("kpiRevenue").textContent=m(deepFind(d,["total_revenue","totalRevenue"])||deepFind(f,["total_revenue","totalRevenue"]));
    $("kpiSales").textContent=n(deepFind(d,["total_sales","totalSales"]));
    $("kpiInventory").textContent=m(deepFind(d,["inventory_cost_value","inventoryCostValue"]));
    $("kpiCustomers").textContent=n(deepFind(d,["total_customers","totalCustomers"]));
    $("kpiLowStock").textContent=n(deepFind(d,["low_stock_products","lowStockProducts"]));
    $("kpiOutstanding").textContent=m(deepFind(f,["total_purchase_outstanding","totalOutstanding","outstanding"]));

    const rr=rev.status==="fulfilled" ? (rev.value?.chart?.data||[]) : [];
    chart("monthlyRevenueChart","line",
        rr.map(x=>x.shortMonth||x.monthName||""),
        rr.map(x=>n(x.totalRevenue)),
        "Revenue"
    );

    const pp=pay.status==="fulfilled" ? (pay.value?.chart?.data||[]) : [];
    chart("paymentChart","doughnut",
        pp.map(x=>x.paymentMethod||"Not Specified"),
        pp.map(x=>n(x.totalValue)),
        "Sales Value"
    );

    const gg=growth.status==="fulfilled" ? (growth.value?.analytics?.monthlyGrowth?.data||[]) : [];
    chart("customerGrowthChart","line",
        gg.map(x=>x.shortMonth||x.monthName||""),
        gg.map(x=>n(x.newCustomers)),
        "New Customers"
    );

    const cc=cat.status==="fulfilled" ? (cat.value?.chart?.data||[]) : [];
    chart("categoryChart","bar",
        cc.map(x=>x.category||"Uncategorised"),
        cc.map(x=>n(x.netSalesValue)),
        "Net Sales"
    );

    const failures=[dash,fin,rev,pay,growth,cat].filter(x=>x.status==="rejected");
    if(failures.length){
        console.error("Some report widgets failed:",failures.map(x=>x.reason));
        msg(`${failures.length} report widget(s) could not be loaded. Check the server console.`);
    }
}
function flatten(data){const rows=findArray(data);if(rows.length)return rows;const obj=data.report||data.summary||data.dashboard||data.financial||data;return obj&&typeof obj==="object"?[obj]:[]}
function renderTable(rows){currentRows=rows;const box=$("reportTable");$("reportLoading").classList.add("hidden");box.classList.remove("hidden");if(!rows.length){box.innerHTML="<div class='state'>No records found.</div>";return}const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))].slice(0,14);box.innerHTML=`<table><thead><tr>${keys.map(k=>`<th>${esc(k.replaceAll("_"," "))}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>`}
async function loadReport(endpoint){currentEndpoint=endpoint;$("reportLoading").classList.remove("hidden");$("reportTable").classList.add("hidden");try{const q=endpoint.includes("monthly")||endpoint.includes("yearly")?`?year=${$("reportYear").value}`:"";renderTable(flatten(await api(endpoint+q)))}catch(e){msg(e.message);renderTable([])}}
function exportCsv(){if(!currentRows.length)return;const keys=[...new Set(currentRows.flatMap(r=>Object.keys(r)))];const csv=[keys,...currentRows.map(r=>keys.map(k=>r[k]??""))].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv"}));a.download=`rukhnav-${currentEndpoint.replaceAll("/","-")}.csv`;a.click()}
document.addEventListener("DOMContentLoaded",async()=>{const y=new Date().getFullYear();for(let i=y;i>=y-6;i--)$("reportYear").insertAdjacentHTML("beforeend",`<option>${i}</option>`);$("reportTabs").addEventListener("click",e=>{const b=e.target.closest("button[data-report]");if(!b)return;document.querySelectorAll("#reportTabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");loadReport(b.dataset.report)});$("refreshReports").onclick=()=>Promise.all([loadOverview(),loadReport(currentEndpoint)]);$("reportYear").onchange=()=>Promise.all([loadOverview(),loadReport(currentEndpoint)]);$("exportCurrent").onclick=exportCsv;await Promise.all([loadOverview(),loadReport(currentEndpoint)])});