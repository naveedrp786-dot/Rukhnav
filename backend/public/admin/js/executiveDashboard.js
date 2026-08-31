const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
const API_BASE=RUKHNAV_ORIGIN;
let charts={};

document.addEventListener("DOMContentLoaded",()=>{
    document.getElementById("refreshDashboardBtn")?.addEventListener("click",loadDashboard);
    loadDashboard();
});

const token=()=>localStorage.getItem("token")||localStorage.getItem("adminToken")||localStorage.getItem("admin_token")||"";
const money=v=>new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:2}).format(Number(v||0));
const date=v=>v?new Date(v).toLocaleDateString("en-PK"):"-";
const empty=(c,m)=>`<tr><td colspan="${c}">${m}</td></tr>`;

function badge(value){
    const s=String(value||"Unknown");
    let c="status-gray";
    if(["Paid","Delivered","Completed","Received","Active","Posted"].includes(s)) c="status-green";
    else if(["Confirmed","Processing","Shipped","Approved","Ordered"].includes(s)) c="status-blue";
    else if(["Pending","Partial","Unpaid","Draft","Partially Received"].includes(s)) c="status-orange";
    else if(["Cancelled","Rejected","Failed","Inactive"].includes(s)) c="status-red";
    return `<span class="status-badge ${c}">${s}</span>`;
}

async function loadDashboard(){
    const b=document.getElementById("refreshDashboardBtn");
    try{
        if(b){b.disabled=true;b.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Loading';}
        const r=await fetch(`${API_BASE}/api/admin/executive-dashboard`,{headers:{Authorization:`Bearer ${token()}`}});
        const data=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(data.message||`Request failed (${r.status})`);
        const d=data.dashboard||{};
        renderKpis(d.kpis||{});
        renderCharts(d);
        renderLowStock(d.low_stock_products||[]);
        renderOrders(d.recent_orders||[]);
        renderPOs(d.recent_purchase_orders||[]);
        renderCustomers(d.recent_customers||[]);
        renderSuppliers(d.recent_suppliers||[]);
    }catch(e){
        const m=document.getElementById("dashboardMessage");
        m.textContent=e.message;m.className="dashboard-message show error";
    }finally{
        if(b){b.disabled=false;b.innerHTML='<i class="fa-solid fa-rotate"></i> Refresh';}
    }
}

function renderKpis(k){
    const cards=[
        ["Total Sales",money(k.total_sales),"fa-chart-line"],
        ["This Month Sales",money(k.month_sales),"fa-calendar-check"],
        ["Total Purchases",money(k.total_purchases),"fa-cart-flatbed"],
        ["This Month Purchases",money(k.month_purchases),"fa-calendar-days"],
        ["Customers",k.total_customers,"fa-users"],
        ["Active Customers",k.active_customers,"fa-user-check"],
        ["Suppliers",k.total_suppliers,"fa-truck-field"],
        ["Active Suppliers",k.active_suppliers,"fa-building-circle-check"],
        ["Products",k.total_products,"fa-box"],
        ["Inventory Units",k.inventory_units,"fa-boxes-stacked"],
        ["Inventory Value",money(k.inventory_value),"fa-warehouse"],
        ["Low Stock",k.low_stock_products,"fa-triangle-exclamation"],
        ["Out of Stock",k.out_of_stock_products,"fa-box-open"],
        ["Open Customer Orders",k.open_customer_orders,"fa-cart-shopping"],
        ["Open Purchase Orders",k.open_purchase_orders,"fa-file-circle-plus"],
        ["Receivables",money(k.outstanding_receivables),"fa-hand-holding-dollar"],
        ["Payables",money(k.outstanding_payables),"fa-file-invoice-dollar"],
        ["Customer Returns",k.customer_returns,"fa-arrow-rotate-left"],
        ["Purchase Returns",k.purchase_returns,"fa-rotate-left"]
    ];
    document.getElementById("kpiGrid").innerHTML=cards.map(([l,v,i])=>`<article class="executive-kpi-card"><div class="kpi-top"><div><div class="kpi-label">${l}</div><div class="kpi-value">${v??0}</div></div><div class="kpi-icon"><i class="fa-solid ${i}"></i></div></div></article>`).join("");
}

function renderCharts(d){
    Object.values(charts).forEach(c=>c?.destroy());
    const s=d.monthly_sales||[], p=d.monthly_purchases||[];
    charts.sales=new Chart(document.getElementById("monthlySalesChart"),{type:"line",data:{labels:s.map(x=>x.month_label),datasets:[{label:"Sales",data:s.map(x=>Number(x.total||0)),borderColor:"#0b6e4f",backgroundColor:"rgba(11,110,79,.16)",fill:true,tension:.32}]},options:{responsive:true,maintainAspectRatio:false}});
    charts.purchases=new Chart(document.getElementById("monthlyPurchasesChart"),{type:"bar",data:{labels:p.map(x=>x.month_label),datasets:[{label:"Purchases",data:p.map(x=>Number(x.total||0)),backgroundColor:"rgba(212,168,77,.82)",borderColor:"#d4a84d",borderWidth:1,borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false}});
    const o=d.order_statuses||[], po=d.purchase_order_statuses||[];
    charts.orders=new Chart(document.getElementById("orderStatusChart"),{type:"doughnut",data:{labels:o.map(x=>x.status),datasets:[{data:o.map(x=>Number(x.total||0))}]},options:{responsive:true,maintainAspectRatio:false}});
    charts.po=new Chart(document.getElementById("purchaseOrderStatusChart"),{type:"doughnut",data:{labels:po.map(x=>x.status),datasets:[{data:po.map(x=>Number(x.total||0))}]},options:{responsive:true,maintainAspectRatio:false}});
}

function renderLowStock(rows){
    document.getElementById("lowStockBody").innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${x.product_name||"-"}</strong></td><td>${x.stock||0}</td><td>${badge(x.status)}</td></tr>`).join(""):empty(3,"No low-stock products.");
}
function renderOrders(rows){
    document.getElementById("recentOrdersBody").innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${x.order_number||x.id}</strong></td><td>${x.full_name||"-"}</td><td>${x.city||"-"}</td><td>${money(x.grand_total)}</td><td>${badge(x.payment_status)}</td><td>${badge(x.order_status)}</td><td>${date(x.created_at)}</td></tr>`).join(""):empty(7,"No customer orders.");
}
function renderPOs(rows){
    document.getElementById("recentPurchaseOrdersBody").innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${x.po_number||"-"}</strong></td><td>${x.supplier_name||"-"}</td><td>${date(x.order_date)}</td><td>${money(x.grand_total)}</td><td>${badge(x.payment_status)}</td><td>${badge(x.status)}</td></tr>`).join(""):empty(6,"No purchase orders.");
}
function renderCustomers(rows){
    document.getElementById("recentCustomersBody").innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${x.full_name||"-"}</strong><br><small>${x.email||""}</small></td><td>${x.phone||"-"}</td><td>${badge(x.status)}</td></tr>`).join(""):empty(3,"No customers.");
}
function renderSuppliers(rows){
    document.getElementById("recentSuppliersBody").innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${x.supplier_name||"-"}</strong></td><td>${x.contact_person||"-"}</td><td>${x.phone||"-"}</td><td>${badge(x.status)}</td></tr>`).join(""):empty(4,"No suppliers.");
}
