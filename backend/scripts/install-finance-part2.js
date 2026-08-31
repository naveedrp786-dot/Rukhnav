"use strict";
const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"../..");
const file=path.join(root,"public/admin/components/sidebar.html");
const backup=`${file}.before-finance-part2`;
if (!fs.existsSync(backup)) fs.copyFileSync(file,backup);
let text=fs.readFileSync(file,"utf8");
if (!text.includes("/admin/finance-accounts.html")) {
    const marker='<a href="/admin/finance.html">';
    const index=text.indexOf(marker);
    if (index<0) throw new Error("Finance Part 1 sidebar link not found.");
    const liEnd=text.indexOf("</li>",index);
    const links=`
                    <li><a href="/admin/finance-accounts.html"><i class="fa-solid fa-sitemap"></i><span>Chart of Accounts</span></a></li>
                    <li><a href="/admin/finance-journals.html"><i class="fa-solid fa-book"></i><span>Journal Entries</span></a></li>
                    <li><a href="/admin/finance-ledger.html"><i class="fa-solid fa-book-open"></i><span>General Ledger</span></a></li>`;
    text=text.slice(0,liEnd+5)+links+text.slice(liEnd+5);
    fs.writeFileSync(file,text);
}
console.log("Finance Part 2 sidebar installed.");
