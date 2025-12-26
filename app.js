// Currency formatter (Ghana Cedi)
const fmt = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 2,
});

const els = {
  balance: document.getElementById("balance"),
  totalIncome: document.getElementById("totalIncome"),
  totalExpenses: document.getElementById("totalExpenses"),
  balanceSub: document.getElementById("balanceSub"),
  txnForm: document.getElementById("txnForm"),
  desc: document.getElementById("desc"),
  amount: document.getElementById("amount"),
  type: document.getElementById("type"),
  category: document.getElementById("category"),
  date: document.getElementById("date"),
  tableBody: document.getElementById("txnTableBody"),
  tableFooter: document.getElementById("tableFooter"),
  search: document.getElementById("search"),
  filterCategory: document.getElementById("filterCategory"),
  filterType: document.getElementById("filterType"),
  fromDate: document.getElementById("fromDate"),
  toDate: document.getElementById("toDate"),
  deleteSelectedBtn: document.getElementById("deleteSelectedBtn"),
  selectAll: document.getElementById("selectAll"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  themeToggle: document.getElementById("themeToggle"),
  budgetsList: document.getElementById("budgetsList"),
  budgetsDialog: document.getElementById("budgetsDialog"),
  budgetsEditor: document.getElementById("budgetsEditor"),
  saveBudgetsBtn: document.getElementById("saveBudgetsBtn"),
  editBudgetsBtn: document.getElementById("editBudgetsBtn"),
  categoryChart: document.getElementById("categoryChart"),
  monthlyChart: document.getElementById("monthlyChart"),
};

let state = {
  transactions: load("transactions", []),
  budgets: load("budgets", defaultBudgets()),
  theme: load("theme", "dark"),
};

function defaultBudgets() {
  return {
    Food: 800,
    Transport: 500,
    Rent: 1500,
    Utilities: 600,
    Savings: 1000,
    Business: 0,
    Salary: 0,
    Misc: 300,
  };
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function setTheme(mode) {
  state.theme = mode;
  document.body.classList.toggle("light", mode === "light");
  save("theme", mode);
  els.themeToggle.textContent = mode === "light" ? "Light Mode" : "Dark Mode";
}

// Initialize theme
setTheme(state.theme);

// Charts
let categoryChart = new Chart(els.categoryChart, {
  type: "doughnut",
  data: { labels: [], datasets: [{ data: [], backgroundColor: palette() }] },
  options: { plugins: { legend: { position: "bottom" } } },
});
let monthlyChart = new Chart(els.monthlyChart, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Net", data: [], borderColor: "#22c55e", tension: 0.3 },
    ],
  },
  options: {
    plugins: { legend: { display: false } },
    scales: { y: { ticks: { callback: (v) => fmt.format(v) } } },
  },
});

function palette() {
  return [
    "#22c55e",
    "#0ea5e9",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#14b8a6",
    "#84cc16",
    "#e11d48",
  ];
}

// Add transaction
els.txnForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const txn = {
    id: crypto.randomUUID(),
    desc: els.desc.value.trim(),
    amount: Number(els.amount.value),
    type: els.type.value,
    category: els.category.value,
    date: els.date.value,
  };
  if (!txn.desc || !txn.amount || !txn.date) return;
  state.transactions.push(txn);
  save("transactions", state.transactions);
  els.txnForm.reset();
  refresh();
});

// Select all
els.selectAll.addEventListener("change", (e) => {
  const checked = e.target.checked;
  document
    .querySelectorAll(".row-select")
    .forEach((cb) => (cb.checked = checked));
});

// Delete selected
els.deleteSelectedBtn.addEventListener("click", () => {
  const selectedIds = Array.from(document.querySelectorAll(".row-select"))
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.id);
  if (!selectedIds.length) return;
  state.transactions = state.transactions.filter(
    (t) => !selectedIds.includes(t.id)
  );
  save("transactions", state.transactions);
  refresh();
});

// Filters
["input", "change"].forEach((evt) => {
  els.search.addEventListener(evt, refresh);
  els.filterCategory.addEventListener(evt, refresh);
  els.filterType.addEventListener(evt, refresh);
  els.fromDate.addEventListener(evt, refresh);
  els.toDate.addEventListener(evt, refresh);
});
document.getElementById("clearFiltersBtn").addEventListener("click", () => {
  els.search.value = "";
  els.filterCategory.value = "";
  els.filterType.value = "";
  els.fromDate.value = "";
  els.toDate.value = "";
  refresh();
});

// Export
els.exportBtn.addEventListener("click", () => {
  const data = {
    transactions: state.transactions,
    budgets: state.budgets,
    exportedAt: new Date().toISOString(),
  };
  downloadJSON("finance-export.json", data);
});

// Import
els.importInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith(".csv")) {
      const txns = parseCSV(text);
      state.transactions = mergeTransactions(state.transactions, txns);
      save("transactions", state.transactions);
    } else {
      const obj = JSON.parse(text);
      if (Array.isArray(obj.transactions))
        state.transactions = obj.transactions;
      if (obj.budgets && typeof obj.budgets === "object")
        state.budgets = obj.budgets;
      save("transactions", state.transactions);
      save("budgets", state.budgets);
    }
    refresh();
  } catch {
    alert("Import failed. Ensure the file is valid JSON or CSV.");
  } finally {
    e.target.value = "";
  }
});

// Theme toggle
els.themeToggle.addEventListener("click", () => {
  setTheme(state.theme === "light" ? "dark" : "light");
});

// Budgets UI
els.editBudgetsBtn.addEventListener("click", () => openBudgetsEditor());
els.saveBudgetsBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const inputs = els.budgetsEditor.querySelectorAll("input[data-category]");
  inputs.forEach((inp) => {
    state.budgets[inp.dataset.category] = Number(inp.value || 0);
  });
  save("budgets", state.budgets);
  els.budgetsDialog.close();
  refresh();
});

// Core refresh
function refresh() {
  const filtered = applyFilters(state.transactions);
  renderSummary(filtered);
  renderTable(filtered);
  renderBudgets(filtered);
  renderCategoryChart(filtered);
  renderMonthlyChart(filtered);
}

// Filtering logic
function applyFilters(txns) {
  const q = els.search.value.trim().toLowerCase();
  const cat = els.filterCategory.value;
  const typ = els.filterType.value;
  const from = els.fromDate.value ? new Date(els.fromDate.value) : null;
  const to = els.toDate.value ? new Date(els.toDate.value) : null;

  return txns.filter((t) => {
    const tDate = new Date(t.date);
    if (q && !t.desc.toLowerCase().includes(q)) return false;
    if (cat && t.category !== cat) return false;
    if (typ && t.type !== typ) return false;
    if (from && tDate < from) return false;
    if (to && tDate > to) return false;
    return true;
  });
}

// Summary
function renderSummary(txns) {
  const income = txns
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + t.amount, 0);
  const expenses = txns
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  const balance = income - expenses;
  els.totalIncome.textContent = fmt.format(income);
  els.totalExpenses.textContent = fmt.format(expenses);
  els.balance.textContent = fmt.format(balance);
  els.balanceSub.textContent =
    balance >= 0 ? "You are net positive" : "You are net negative";
}

// Table
function renderTable(txns) {
  els.tableBody.innerHTML = "";
  if (!txns.length) {
    els.tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted)">No transactions found</td></tr>`;
  } else {
    txns
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((t) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input type="checkbox" class="row-select" data-id="${
            t.id
          }" /></td>
          <td>${escapeHTML(t.desc)}</td>
          <td>${t.category}</td>
          <td>${t.type}</td>
          <td>${fmt.format(t.amount)}</td>
          <td>${t.date}</td>
          <td>
            <button class="small" data-action="edit" data-id="${
              t.id
            }">Edit</button>
            <button class="small danger" data-action="delete" data-id="${
              t.id
            }">Delete</button>
          </td>
        `;
        els.tableBody.appendChild(tr);
      });
  }

  // Footer summary
  const count = txns.length;
  const total = txns.reduce(
    (a, t) => a + (t.type === "income" ? t.amount : -t.amount),
    0
  );
  els.tableFooter.textContent = `${count} transaction(s) • Net: ${fmt.format(
    total
  )}`;

  // Row actions
  els.tableBody
    .querySelectorAll('button[data-action="delete"]')
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        state.transactions = state.transactions.filter((t) => t.id !== id);
        save("transactions", state.transactions);
        refresh();
      });
    });
  els.tableBody
    .querySelectorAll('button[data-action="edit"]')
    .forEach((btn) => {
      btn.addEventListener("click", () => openEditDialog(btn.dataset.id));
    });
}

// Budgets render
function renderBudgets(txns) {
  const spendByCat = aggregateByCategory(
    txns.filter((t) => t.type === "expense")
  );
  els.budgetsList.innerHTML = "";
  Object.entries(state.budgets).forEach(([cat, limit]) => {
    const used = spendByCat[cat] || 0;
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const item = document.createElement("div");
    item.className = "budget-item";
    item.innerHTML = `
      <div class="budget-head">
        <strong>${cat}</strong>
        <span>${fmt.format(used)} / ${fmt.format(limit || 0)}</span>
      </div>
      <div class="progress"><span style="width:${pct}%; background:${
      pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "var(--primary)"
    }"></span></div>
    `;
    els.budgetsList.appendChild(item);
  });
}

// Charts render
function renderCategoryChart(txns) {
  const spendByCat = aggregateByCategory(
    txns.filter((t) => t.type === "expense")
  );
  const labels = Object.keys(spendByCat);
  const data = labels.map((k) => spendByCat[k]);
  categoryChart.data.labels = labels;
  categoryChart.data.datasets[0].data = data;
  categoryChart.update();
}

function renderMonthlyChart(txns) {
  const months = groupByMonthNet(txns);
  const labels = Object.keys(months).sort();
  const data = labels.map((k) => months[k]);
  monthlyChart.data.labels = labels;
  monthlyChart.data.datasets[0].data = data;
  monthlyChart.update();
}

// Helpers
function aggregateByCategory(txns) {
  return txns.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
}
function groupByMonthNet(txns) {
  const map = {};
  txns.forEach((t) => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    map[key] = (map[key] || 0) + (t.type === "income" ? t.amount : -t.amount);
  });
  return map;
}
function escapeHTML(s) {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}
function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function parseCSV(text) {
  // Simple CSV: desc,amount,type,category,date
  const lines = text.trim().split(/\r?\n/);
  const txns = [];
  for (let i = 1; i < lines.length; i++) {
    // skip header
    const parts = lines[i].split(",").map((s) => s.trim());
    if (parts.length < 5) continue;
    const [desc, amount, type, category, date] = parts;
    txns.push({
      id: crypto.randomUUID(),
      desc,
      amount: Number(amount),
      type,
      category,
      date,
    });
  }
  return txns;
}
function mergeTransactions(existing, incoming) {
  // naive merge: append all
  return existing.concat(incoming);
}

// Edit dialog (built inline for simplicity)
function openEditDialog(id) {
  const txn = state.transactions.find((t) => t.id === id);
  if (!txn) return;
  const dlg = document.createElement("dialog");
  dlg.innerHTML = `
    <form method="dialog" class="dialog-card">
      <h3>Edit transaction</h3>
      <div class="form-grid">
        <div><label>Description</label><input id="edDesc" type="text" value="${escapeHTML(
          txn.desc
        )}" /></div>
        <div><label>Amount</label><input id="edAmount" type="number" step="0.01" value="${
          txn.amount
        }" /></div>
        <div><label>Type</label>
          <select id="edType"><option value="income">Income</option><option value="expense">Expense</option></select>
        </div>
        <div><label>Category</label>
          <select id="edCat">
            ${Object.keys(defaultBudgets())
              .map((c) => `<option value="${c}">${c}</option>`)
              .join("")}
          </select>
        </div>
        <div><label>Date</label><input id="edDate" type="date" value="${
          txn.date
        }" /></div>
      </div>
      <menu class="dialog-actions">
        <button value="cancel">Cancel</button>
        <button id="saveEditBtn" value="default" class="primary">Save</button>
      </menu>
    </form>
  `;
  document.body.appendChild(dlg);
  dlg.showModal();
  dlg.querySelector("#edType").value = txn.type;
  dlg.querySelector("#edCat").value = txn.category;

  dlg.querySelector("#saveEditBtn").addEventListener("click", (e) => {
    e.preventDefault();
    txn.desc = dlg.querySelector("#edDesc").value.trim();
    txn.amount = Number(dlg.querySelector("#edAmount").value);
    txn.type = dlg.querySelector("#edType").value;
    txn.category = dlg.querySelector("#edCat").value;
    txn.date = dlg.querySelector("#edDate").value;
    save("transactions", state.transactions);
    dlg.close();
    dlg.remove();
    refresh();
  });
  dlg.addEventListener("close", () => dlg.remove());
}

// Budgets editor
function openBudgetsEditor() {
  els.budgetsEditor.innerHTML = "";
  Object.entries(state.budgets).forEach(([cat, limit]) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <label>${cat}</label>
      <input type="number" step="0.01" value="${limit}" data-category="${cat}" />
    `;
    els.budgetsEditor.appendChild(wrap);
  });
  els.budgetsDialog.showModal();
}

// Seed demo data if empty
if (!state.transactions.length) {
  state.transactions = [
    {
      id: crypto.randomUUID(),
      desc: "Salary",
      amount: 4500,
      type: "income",
      category: "Salary",
      date: iso(-25),
    },
    {
      id: crypto.randomUUID(),
      desc: "Transport (UCC–Adenta)",
      amount: 120,
      type: "expense",
      category: "Transport",
      date: iso(-20),
    },
    {
      id: crypto.randomUUID(),
      desc: "Food",
      amount: 230,
      type: "expense",
      category: "Food",
      date: iso(-19),
    },
    {
      id: crypto.randomUUID(),
      desc: "Side business profit",
      amount: 800,
      type: "income",
      category: "Business",
      date: iso(-15),
    },
    {
      id: crypto.randomUUID(),
      desc: "Internet bill",
      amount: 150,
      type: "expense",
      category: "Utilities",
      date: iso(-12),
    },
    {
      id: crypto.randomUUID(),
      desc: "Rent",
      amount: 1200,
      type: "expense",
      category: "Rent",
      date: iso(-10),
    },
    {
      id: crypto.randomUUID(),
      desc: "Savings deposit",
      amount: 500,
      type: "expense",
      category: "Savings",
      date: iso(-8),
    },
    {
      id: crypto.randomUUID(),
      desc: "Food",
      amount: 160,
      type: "expense",
      category: "Food",
      date: iso(-5),
    },
  ];
  save("transactions", state.transactions);
}
function iso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Initial render
refresh();
