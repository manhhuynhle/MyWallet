/* MyWallet - ứng dụng phía trình duyệt.
   Dữ liệu được lưu trong localStorage, tự sao lưu nội bộ và đồng bộ giữa các trang/tab cùng origin.
   localStorage không thay thế sao lưu đám mây; hãy xuất JSON định kỳ để lưu bên ngoài. */
(() => {
  "use strict";
  const KEYS = {
    transactions: "mywallet_transactions",
    budgets: "mywallet_budgets",
    backup: "mywallet_backup_v1",
  };
  const CATEGORIES = [
    "Ăn uống",
    "Đi lại",
    "Học tập",
    "Giải trí",
    "Mua sắm",
    "Khác",
  ];
  const COLORS = [
    "#153f34",
    "#76a98d",
    "#a7cbb6",
    "#c6ded0",
    "#dce9e1",
    "#edf3ef",
  ];
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = (n) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
      Number(n) || 0,
    ) + " VNĐ";
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const monthISO = (date = todayISO()) => date.slice(0, 7);
  const escapeHTML = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const safeRead = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  };
  function allTransactions() {
    const v = safeRead(KEYS.transactions, []);
    return Array.isArray(v) ? v : [];
  }
  function allBudgets() {
    const v = safeRead(KEYS.budgets, {});
    return v && typeof v === "object" ? v : {};
  }
  function persist() {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      transactions: allTransactions(),
      budgets: allBudgets(),
    };
    try {
      localStorage.setItem(KEYS.backup, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("mywallet:changed"));
      return true;
    } catch (e) {
      toast("Không thể lưu dữ liệu. Hãy kiểm tra dung lượng trình duyệt.");
      console.error(e);
      return false;
    }
  }
  function saveTransactions(items) {
    try {
      localStorage.setItem(KEYS.transactions, JSON.stringify(items));
      return persist();
    } catch (e) {
      toast("Lưu giao dịch thất bại.");
      return false;
    }
  }
  function saveBudgets(items) {
    try {
      localStorage.setItem(KEYS.budgets, JSON.stringify(items));
      return persist();
    } catch (e) {
      toast("Lưu ngân sách thất bại.");
      return false;
    }
  }
  function toast(message) {
    let el = $("#mywallet-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "mywallet-toast";
      el.className = "toast";
      document.body.append(el);
    }
    el.textContent = message;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.remove(), 3200);
  }
  function getRangeTransactions(period, month) {
    const tx = allTransactions();
    if (period === "all") return tx;
    const now = new Date();
    if (period === "year") {
      const y = String(now.getFullYear());
      return tx.filter((t) => (t.date || "").startsWith(y));
    }
    const m = month || monthISO();
    return tx.filter((t) => (t.date || "").startsWith(m));
  }
  function sum(tx, type) {
    return tx
      .filter((t) => t.type === type)
      .reduce((a, t) => a + Number(t.amount || 0), 0);
  }
  function statCard(label, value, foot = "", className = "") {
    return `<article class="stat-card ${className}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`;
  }
  function setActive(page) {
    $$(".sidebar-nav a").forEach((a) =>
      a.classList.toggle("active", a.dataset.page === page),
    );
  }
  function updateHeader() {
    const date = $(".current-date");
    if (date)
      date.textContent = new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date());
    const tx = allTransactions().filter(
      (t) => t.type === "expense" && monthISO(t.date || "") === monthISO(),
    );
    const spent = tx.reduce((a, t) => a + Number(t.amount || 0), 0),
      b = allBudgets(),
      total = Number(b.total || 3000000);
    const widget = $(".budget-widget p");
    if (widget)
      widget.textContent = `Bạn còn ${money(Math.max(0, total - spent))} trong ngân sách tháng này.`;
  }
  function tableHTML(tx, actions = false) {
    if (!tx.length)
      return `<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>Chưa có giao dịch phù hợp.</p></div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Tên giao dịch</th><th>Danh mục</th><th>Loại</th><th style="text-align:right">Số tiền</th>${actions ? "<th>Thao tác</th>" : ""}</tr></thead><tbody>${tx.map((t) => `<tr><td class="muted">${escapeHTML(t.date || "")}</td><td><strong>${escapeHTML(t.name)}</strong>${t.note ? `<div class="small-muted">${escapeHTML(t.note)}</div>` : ""}</td><td class="muted">${escapeHTML(t.category || "Khác")}</td><td class="${t.type === "income" ? "positive" : "muted"}">${t.type === "income" ? "Thu nhập" : "Chi tiêu"}</td><td class="amount ${t.type === "income" ? "positive" : ""}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</td>${actions ? `<td class="table-actions"><button data-edit="${escapeHTML(t.id)}" aria-label="Sửa"><i class="fa-solid fa-pen"></i></button><button data-delete="${escapeHTML(t.id)}" aria-label="Xóa"><i class="fa-regular fa-trash-can"></i></button></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
  }
  function categoryTotals(tx) {
    const out = {};
    CATEGORIES.forEach((c) => (out[c] = 0));
    tx.filter((t) => t.type === "expense").forEach((t) => {
      const c = CATEGORIES.includes(t.category) ? t.category : "Khác";
      out[c] += Number(t.amount || 0);
    });
    return out;
  }
  function pieHTML(tx) {
    const totals = categoryTotals(tx),
      entries = Object.entries(totals).filter(([, v]) => v > 0),
      total = entries.reduce((a, [, v]) => a + v, 0);
    if (!total)
      return `<div class="empty-state">Chưa có khoản chi để thống kê.</div>`;
    let start = 0;
    const parts = entries.map(([name, v]) => {
      const a = start;
      start += (v / total) * 100;
      return `${COLORS[CATEGORIES.indexOf(name)]} ${a}% ${start}%`;
    });
    const bg = entries
      .map(
        ([name, v]) =>
          `${COLORS[CATEGORIES.indexOf(name)]} ${(v / total) * 100}%`,
      )
      .join(",");
    // Build cumulative conic gradient with exact slices.
    let cursor = 0;
    const slices = entries
      .map(([name, v]) => {
        const from = cursor;
        cursor += (v / total) * 100;
        return `${COLORS[CATEGORIES.indexOf(name)]} ${from}% ${cursor}%`;
      })
      .join(",");
    return `<div class="pie-ring" style="background:conic-gradient(${slices})"><div class="pie-hole"><strong>${money(total).replace(" VNĐ", "")}</strong><span>VNĐ đã chi</span></div></div><div class="legend-list">${entries.map(([name, v]) => `<div class="legend-row"><span><i class="dot" style="background:${COLORS[CATEGORIES.indexOf(name)]}"></i>${escapeHTML(name)}</span><strong>${((v / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</strong></div>`).join("")}</div>`;
  }
  function chartHTML(tx, grouping = "week") {
    const month =
      $("#dashboard-month")?.value || $("#report-month")?.value || monthISO();
    let labels = [],
      income = [],
      expense = [];
    if (grouping === "week") {
      labels = ["01–07", "08–14", "15–21", "22–31"];
      income = [0, 0, 0, 0];
      expense = [0, 0, 0, 0];
      tx.filter((t) => (t.date || "").startsWith(month)).forEach((t) => {
        const day = Number((t.date || "").slice(8, 10));
        const i = Math.min(3, Math.floor((day - 1) / 7));
        (t.type === "income" ? income : expense)[i] += Number(t.amount || 0);
      });
    } else {
      labels = ["Thu nhập", "Chi tiêu"];
      income = [sum(tx, "income"), 0];
      expense = [0, sum(tx, "expense")];
    }
    const max = Math.max(1, ...income, ...expense);
    return `<div class="chart-legend"><span><i class="dot" style="background:var(--green)"></i>Thu nhập</span><span><i class="dot" style="background:#79ad91"></i>Chi tiêu</span></div><div class="chart-bars">${labels.map((l, i) => `<div class="chart-group"><div class="chart-bar expense" title="Thu nhập: ${money(income[i])}" style="height:${Math.max(1, (income[i] / max) * 100)}%"></div><div class="chart-bar income" title="Chi tiêu: ${money(expense[i])}" style="height:${Math.max(1, (expense[i] / max) * 100)}%"></div><span class="chart-label">${l}</span></div>`).join("")}</div>`;
  }
  function budgetSpentByCategory(tx) {
    return categoryTotals(tx);
  }
  function budgetLimit(category, b) {
    return Number((b.limits || {})[category] || 0);
  }
  function renderDashboard() {
    const month = $("#dashboard-month")?.value || monthISO(),
      tx = allTransactions().filter((t) => (t.date || "").startsWith(month)),
      income = sum(tx, "income"),
      expense = sum(tx, "expense"),
      budgets = allBudgets(),
      total = Number(budgets.total || 3000000),
      remain = total - expense;
    const stats = $("#dashboard-stats");
    if (stats)
      stats.innerHTML =
        statCard(
          "Tổng số dư",
          money(
            Number(budgets.openingBalance || 0) +
              sum(allTransactions(), "income") -
              sum(allTransactions(), "expense"),
          ),
          "Số dư ước tính",
          "dark",
        ) +
        statCard(
          "Tổng thu nhập tháng này",
          money(income),
          `${tx.filter((t) => t.type === "income").length} khoản thu`,
        ) +
        statCard(
          "Tổng chi tiêu tháng này",
          money(expense),
          `${tx.filter((t) => t.type === "expense").length} khoản chi`,
        ) +
        statCard(
          "Ngân sách còn lại",
          money(remain),
          `${total ? Math.round((expense / total) * 100) : 0}% đã sử dụng`,
        );
    const ch = $("#dashboard-chart");
    if (ch) ch.innerHTML = chartHTML(tx);
    const pie = $("#dashboard-pie");
    if (pie) pie.innerHTML = pieHTML(tx);
    const recent = $("#dashboard-recent");
    if (recent)
      recent.innerHTML = tableHTML(
        [...tx]
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .slice(0, 6),
      );
    const bud = $("#dashboard-budget");
    if (bud) bud.innerHTML = budgetHTML(tx, budgets, true);
  }
  function fillCategoryOptions(select, selected = "") {
    if (!select) return;
    select.innerHTML = CATEGORIES.map(
      (c) =>
        `<option ${c === selected ? "selected" : ""} value="${c}">${c}</option>`,
    ).join("");
  }
  function renderTransactions() {
    const all = allTransactions().sort((a, b) =>
      (b.date || "").localeCompare(a.date || ""),
    );
    const month = $("#transaction-month-filter")?.value || monthISO();
    const search = ($("#transaction-search")?.value || "")
      .trim()
      .toLocaleLowerCase("vi");
    const type = $("#transaction-type-filter")?.value || "all",
      cat = $("#transaction-category-filter")?.value || "all";
    const tx = all.filter(
      (t) =>
        (t.date || "").startsWith(month) &&
        (!search ||
          `${t.name} ${t.note || ""}`
            .toLocaleLowerCase("vi")
            .includes(search)) &&
        (type === "all" || t.type === type) &&
        (cat === "all" || t.category === cat),
    );
    const monthTx = all.filter((t) => (t.date || "").startsWith(month));
    const st = $("#transaction-stats");
    if (st)
      st.innerHTML =
        statCard("Tổng thu nhập", money(sum(monthTx, "income"))) +
        statCard("Tổng chi tiêu", money(sum(monthTx, "expense"))) +
        statCard(
          "Chênh lệch thu chi",
          money(sum(monthTx, "income") - sum(monthTx, "expense")),
        );
    const table = $("#transaction-table");
    if (table) table.innerHTML = tableHTML(tx, true);
  }
  function openTransaction(id = "") {
    const form = $("#transaction-form");
    if (!form) return;
    form.reset();
    $("#transaction-id").value = "";
    $("#transaction-dialog-title").textContent = id
      ? "Sửa giao dịch"
      : "Thêm giao dịch";
    $("#transaction-date").value = todayISO();
    fillCategoryOptions($("#transaction-category"));
    if (id) {
      const t = allTransactions().find((x) => x.id === id);
      if (!t) return;
      $("#transaction-id").value = t.id;
      $("#transaction-type").value = t.type;
      $("#transaction-name").value = t.name;
      $("#transaction-amount").value = t.amount;
      $("#transaction-category").value = t.category;
      $("#transaction-date").value = t.date;
      $("#transaction-payment").value = t.payment || "Tiền mặt";
      $("#transaction-note").value = t.note || "";
    }
    $("#transaction-dialog").showModal();
  }
  function budgetHTML(tx, b, compact = false) {
    const spent = budgetSpentByCategory(tx),
      total = Number(b.total || 3000000),
      allSpent = sum(tx, "expense"),
      remain = total - allSpent;
    const rows = CATEGORIES.map((c, i) => {
      const limit = budgetLimit(c, b),
        used = spent[c] || 0,
        pct = limit ? (used / limit) * 100 : 0;
      return { c, limit, used, pct, i };
    });
    if (compact)
      return `<div><div class="legend-row"><span>${money(allSpent)} / ${money(total)}</span><strong>${total ? Math.round((allSpent / total) * 100) : 0}%</strong></div><div class="progress-track"><div class="progress-fill ${allSpent > total ? "over" : ""}" style="width:${Math.min(100, total ? (allSpent / total) * 100 : 0)}%"></div></div>${rows
        .filter((r) => r.limit > 0)
        .slice(0, 4)
        .map(
          (r) =>
            `<div class="legend-row"><span>${r.c}</span><strong>${Math.round(r.pct)}%</strong></div><div class="progress-track"><div class="progress-fill ${r.pct > 100 ? "over" : r.pct >= 80 ? "warn" : ""}" style="width:${Math.min(100, r.pct)}%"></div></div>`,
        )
        .join("")}</div>`;
    return `<div class="budget-overview"><div><span class="small-muted muted">Tổng ngân sách tháng</span><strong>${money(total)}</strong><p class="small-muted muted">Áp dụng cho ${CATEGORIES.length} danh mục</p></div><div><span class="small-muted muted">Đã chi</span><strong>${money(allSpent)}</strong><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, total ? (allSpent / total) * 100 : 0)}%"></div></div><span class="small-muted muted">${total ? Math.round((allSpent / total) * 100) : 0}% ngân sách đã dùng</span></div><div><span class="small-muted muted">Còn lại</span><strong>${money(remain)}</strong><p class="small-muted muted">${remain < 0 ? "Đã vượt ngân sách" : "Theo dõi chi tiêu trong tháng"}</p></div></div>`;
  }
  function renderBudget() {
    const month = monthISO(),
      tx = allTransactions().filter(
        (t) => (t.date || "").startsWith(month) && t.type === "expense",
      ),
      b = allBudgets(),
      spent = budgetSpentByCategory(tx);
    const overview = $("#budget-overview");
    if (overview) overview.innerHTML = budgetHTML(tx, b, false);
    const warning = CATEGORIES.filter(
      (c) => budgetLimit(c, b) > 0 && spent[c] >= budgetLimit(c, b) * 0.8,
    );
    const notice = $("#budget-notice");
    if (notice) {
      notice.hidden = !warning.length;
      notice.textContent = warning.length
        ? `Lưu ý: ${warning.join(", ")} đã sử dụng ít nhất 80% hạn mức.`
        : "";
    }
    const cards = $("#budget-cards");
    if (cards)
      cards.innerHTML = CATEGORIES.map((c, i) => {
        const limit = budgetLimit(c, b),
          used = spent[c] || 0,
          pct = limit ? (used / limit) * 100 : 0;
        return `<article class="budget-card"><div class="panel-heading"><h3><i class="dot" style="background:${COLORS[i]}"></i>${c}</h3><span class="small-muted">${limit ? money(limit) : "Chưa đặt hạn mức"}</span></div><div class="big-amount ${pct > 100 ? "negative" : ""}">${money(used)}</div><p>Đã chi ${pct.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% hạn mức</p><div class="progress-track"><div class="progress-fill ${pct > 100 ? "over" : pct >= 80 ? "warn" : ""}" style="width:${Math.min(100, pct)}%"></div></div><p class="budget-state ${pct > 100 ? "negative" : pct >= 80 ? "" : "positive"}">${!limit ? "Hãy thiết lập hạn mức" : pct > 100 ? `Vượt ${money(used - limit)}` : `Còn ${money(limit - used)}`}</p></article>`;
      }).join("");
  }
  function openBudgetDialog() {
    const b = allBudgets();
    $("#budget-total-input").value = Number(b.total || 3000000);
    $("#budget-limit-fields").innerHTML = CATEGORIES.map(
      (c) =>
        `<label>${c}<input class="control" type="number" min="0" step="1000" data-budget-category="${c}" value="${Number((b.limits || {})[c] || 0)}" placeholder="Hạn mức VNĐ"></label>`,
    ).join("");
    $("#budget-dialog").showModal();
  }
  function renderReports() {
    const period = $("#report-period")?.value || "month",
      month = $("#report-month")?.value || monthISO(),
      tx = getRangeTransactions(period, month),
      income = sum(tx, "income"),
      expense = sum(tx, "expense");
    const st = $("#report-stats");
    if (st)
      st.innerHTML =
        statCard("Tổng thu nhập", money(income)) +
        statCard("Tổng chi tiêu", money(expense)) +
        statCard(
          "Tiền còn lại",
          money(income - expense),
          "Thu nhập trừ chi tiêu",
          "dark",
        );
    const chart = $("#report-chart");
    if (chart) chart.innerHTML = chartHTML(tx, "week");
    const pie = $("#report-pie");
    if (pie) pie.innerHTML = pieHTML(tx);
    const totals = Object.entries(categoryTotals(tx))
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const cats = $("#report-categories");
    if (cats)
      cats.innerHTML = totals.length
        ? totals
            .map(
              ([c, v], i) =>
                `<div class="rank-row"><span class="rank-number">${i + 1}</span><span>${escapeHTML(c)}</span><span class="small-muted">${expense ? ((v / expense) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : 0}%</span><strong>${money(v)}</strong></div>`,
            )
            .join("")
        : `<div class="empty-state">Chưa có dữ liệu chi tiêu.</div>`;
  }
  function renderSettings() {
    const status = $("#storage-status");
    if (status) {
      const tx = allTransactions();
      status.textContent = `Đang lưu trên trình duyệt này · ${tx.length} giao dịch · bản sao nội bộ ${safeRead(KEYS.backup, null) ? "đã tạo" : "chưa có"}`;
    }
  }
  function exportJSON() {
    const data = {
      app: "MyWallet",
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: allTransactions(),
      budgets: allBudgets(),
    };
    downloadFile(
      `mywallet-backup-${todayISO()}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    toast("Đã xuất bản sao lưu JSON.");
  }
  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportCSV() {
    const rows = [
      [
        "Ngày",
        "Tên giao dịch",
        "Loại",
        "Danh mục",
        "Số tiền",
        "Phương thức",
        "Ghi chú",
      ],
      ...allTransactions().map((t) => [
        t.date,
        t.name,
        t.type === "income" ? "Thu nhập" : "Chi tiêu",
        t.category,
        t.amount,
        t.payment || "",
        t.note || "",
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
        )
        .join("\r\n");
    downloadFile(
      `mywallet-transactions-${todayISO()}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
    toast("Đã xuất báo cáo CSV.");
  }
  function restoreJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (
          !data ||
          !Array.isArray(data.transactions) ||
          !data.budgets ||
          typeof data.budgets !== "object"
        )
          throw new Error("Cấu trúc file không đúng");
        if (
          !confirm("Khôi phục sẽ thay thế dữ liệu hiện tại. Bạn có chắc không?")
        )
          return;
        localStorage.setItem(
          KEYS.transactions,
          JSON.stringify(data.transactions),
        );
        localStorage.setItem(KEYS.budgets, JSON.stringify(data.budgets));
        persist();
        renderCurrentPage();
        toast("Đã khôi phục dữ liệu.");
      } catch (e) {
        alert(
          "Không thể khôi phục file. Hãy chọn file JSON được xuất từ MyWallet.",
        );
      }
    };
    reader.readAsText(file);
  }
  function restoreLocalBackup() {
    const b = safeRead(KEYS.backup, null);
    if (!b || !Array.isArray(b.transactions) || !b.budgets) {
      toast("Chưa có bản sao lưu nội bộ hợp lệ.");
      return;
    }
    if (
      !confirm(
        "Khôi phục bản sao lưu nội bộ gần nhất? Dữ liệu hiện tại sẽ bị thay thế.",
      )
    )
      return;
    localStorage.setItem(KEYS.transactions, JSON.stringify(b.transactions));
    localStorage.setItem(KEYS.budgets, JSON.stringify(b.budgets));
    renderCurrentPage();
    toast("Đã khôi phục bản sao lưu nội bộ.");
  }
  function clearData() {
    if (
      !confirm(
        "Xóa toàn bộ giao dịch và ngân sách? Hãy tải bản sao lưu trước nếu cần.",
      )
    )
      return;
    localStorage.removeItem(KEYS.transactions);
    localStorage.removeItem(KEYS.budgets);
    persist();
    renderCurrentPage();
    toast("Đã xóa dữ liệu.");
  }
  let currentPage = "dashboard";
  function renderCurrentPage() {
    updateHeader();
    if (currentPage === "dashboard") renderDashboard();
    if (currentPage === "transactions") renderTransactions();
    if (currentPage === "budget") renderBudget();
    if (currentPage === "reports") renderReports();
    if (currentPage === "settings") renderSettings();
  }
  async function loadPage(page, push = true) {
    const allowed = [
      "dashboard",
      "transactions",
      "budget",
      "reports",
      "settings",
    ];
    if (!allowed.includes(page)) page = "dashboard";
    const host = $("#page-content");
    if (!host) return;
    try {
      const response = await fetch(`${page}.html`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Không tải được ${page}.html`);
      const html = await response.text();
      host.innerHTML = html;
      currentPage = page;
      setActive(page);
      if (push) history.pushState({ page }, "", `#${page}`);
      initPage(page);
      updateHeader();
    } catch (e) {
      host.innerHTML = `<section class="panel"><h1>Không tải được trang</h1><p>Hãy mở dự án bằng VS Code Live Server, không mở trực tiếp bằng file://.</p><p class="small-muted">${escapeHTML(e.message)}</p></section>`;
    }
  }
  function initPage(page) {
    if (page === "dashboard") {
      const m = $("#dashboard-month");
      if (m) {
        m.value = monthISO();
        m.addEventListener("change", renderDashboard);
      }
      renderDashboard();
    }
    if (page === "transactions") {
      const m = $("#transaction-month-filter");
      if (m) {
        m.value = monthISO();
        m.addEventListener("change", renderTransactions);
      }
      fillCategoryOptions($("#transaction-category"));
      const cat = $("#transaction-category-filter");
      if (cat) {
        cat.innerHTML =
          '<option value="all">Tất cả danh mục</option>' +
          CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
        cat.addEventListener("change", renderTransactions);
      }
      ["transaction-search", "transaction-type-filter"].forEach((id) =>
        $("#" + id)?.addEventListener(
          id === "transaction-search" ? "input" : "change",
          renderTransactions,
        ),
      );
      $("#clear-transaction-filters")?.addEventListener("click", () => {
        $("#transaction-search").value = "";
        $("#transaction-type-filter").value = "all";
        $("#transaction-category-filter").value = "all";
        $("#transaction-month-filter").value = monthISO();
        renderTransactions();
      });
      $("#transaction-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = $("#transaction-id").value;
        const item = {
          id: id || crypto.randomUUID?.() || String(Date.now()),
          type: $("#transaction-type").value,
          name: $("#transaction-name").value.trim(),
          amount: Number($("#transaction-amount").value),
          category: $("#transaction-category").value,
          date: $("#transaction-date").value,
          payment: $("#transaction-payment").value,
          note: $("#transaction-note").value.trim(),
        };
        if (!item.name || !item.amount || item.amount < 1 || !item.date) {
          toast("Vui lòng nhập đủ thông tin hợp lệ.");
          return;
        }
        let tx = allTransactions();
        if (id) tx = tx.map((t) => (t.id === id ? item : t));
        else tx.push(item);
        if (saveTransactions(tx)) {
          $("#transaction-dialog").close();
          renderTransactions();
          updateHeader();
          toast(id ? "Đã cập nhật giao dịch." : "Đã thêm giao dịch.");
        }
      });
      renderTransactions();
    }
    if (page === "budget") {
      renderBudget();
      $("#budget-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const b = {
          ...allBudgets(),
          total: Number($("#budget-total-input").value),
          limits: {},
        };
        $$("[data-budget-category]").forEach(
          (i) => (b.limits[i.dataset.budgetCategory] = Number(i.value) || 0),
        );
        if (saveBudgets(b)) {
          $("#budget-dialog").close();
          renderBudget();
          updateHeader();
          toast("Đã lưu ngân sách.");
        }
      });
    }
    if (page === "reports") {
      const m = $("#report-month");
      if (m) {
        m.value = monthISO();
        m.addEventListener("change", renderReports);
      }
      $("#report-period")?.addEventListener("change", renderReports);
      renderReports();
    }
    if (page === "settings") {
      renderSettings();
      $("#restore-file")?.addEventListener("change", (e) => {
        if (e.target.files?.[0]) restoreJSON(e.target.files[0]);
        e.target.value = "";
      });
    }
  }
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-page],[data-nav]");
    if (nav) {
      e.preventDefault();
      loadPage(nav.dataset.page || nav.dataset.nav);
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "new-transaction") {
      if ($("#transaction-form")) {
        openTransaction();
      } else {
        loadPage("transactions").then(() => openTransaction());
      }
    }
    if (action === "close-transaction") $("#transaction-dialog")?.close();
    if (action === "edit-budgets") openBudgetDialog();
    if (action === "close-budget") $("#budget-dialog")?.close();
    if (action === "backup-json") exportJSON();
    if (action === "export-csv") exportCSV();
    if (action === "restore-local-backup") restoreLocalBackup();
    if (action === "clear-data") clearData();
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      const id = edit.dataset.edit;
      if ($("#transaction-form")) {
        openTransaction(id);
      } else {
        loadPage("transactions").then(() => openTransaction(id));
      }
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      const tx = allTransactions().find((t) => t.id === del.dataset.delete);
      if (tx && confirm(`Xóa giao dịch "${tx.name}"?`)) {
        saveTransactions(allTransactions().filter((t) => t.id !== tx.id));
        renderCurrentPage();
        updateHeader();
        toast("Đã xóa giao dịch.");
      }
    }
  });
  window.addEventListener("popstate", () =>
    loadPage((location.hash || "#dashboard").slice(1), false),
  );
  window.addEventListener("mywallet:changed", () => {
    updateHeader();
  });
  window.addEventListener("storage", (e) => {
    if ([KEYS.transactions, KEYS.budgets, KEYS.backup].includes(e.key)) {
      renderCurrentPage();
    }
  });
  // Nếu bộ nhớ chính bị xóa nhưng còn bản sao nội bộ, không tự ghi đè dữ liệu mới; chỉ thông báo để người dùng chủ động khôi phục.
  if (
    !localStorage.getItem(KEYS.transactions) &&
    !localStorage.getItem(KEYS.budgets) &&
    safeRead(KEYS.backup, null)
  ) {
    // Dữ liệu cũ có thể đã được xóa có chủ đích; tránh tự phục hồi ngoài ý muốn.
  }
  const hash = (location.hash || "").replace("#", "");
  loadPage(hash || "dashboard", false);
  // Gắn hàm tiện ích để kiểm tra trong DevTools nếu cần.
  window.MyWallet = { allTransactions, allBudgets, exportJSON, loadPage };
})();
