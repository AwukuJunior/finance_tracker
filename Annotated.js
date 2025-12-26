// ===============================
// Personal Finance Dashboard Logic
// ===============================

// Currency formatter for Ghana Cedi (GHS)
// This ensures all amounts are displayed consistently with currency symbol and 2 decimals.
const fmt = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 2 });

// Collect references to important DOM elements for easy access
const els = {
  balance: document.getElementById('balance'),
  totalIncome: document.getElementById('totalIncome'),
  totalExpenses: document.getElementById('totalExpenses'),
  balanceSub: document.getElementById('balanceSub'),
  txnForm: document.getElementById('txnForm'),
  desc: document.getElementById('desc'),
  amount: document.getElementById('amount'),
  type: document.getElementById('type'),
  category: document.getElementById('category'),
  date: document.getElementById('date'),
  tableBody: document.getElementById('txnTableBody'),
  tableFooter: document.getElementById('tableFooter'),
  search: document.getElementById('search'),
  filterCategory: document.getElementById('filterCategory'),
  filterType: document.getElementById('filterType'),
  fromDate: document.getElementById('fromDate'),
  toDate: document.getElementById('toDate'),
  deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
  selectAll: document.getElementById('selectAll'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  themeToggle: document.getElementById('themeToggle'),
  budgetsList: document.getElementById('budgetsList'),
  budgetsDialog: document.getElementById('budgetsDialog'),
  budgetsEditor: document.getElementById('budgetsEditor'),
  saveBudgetsBtn: document.getElementById('saveBudgetsBtn'),
  editBudgetsBtn: document.getElementById('editBudgetsBtn'),
  categoryChart: document.getElementById('categoryChart'),
  monthlyChart: document.getElementById('monthlyChart'),
};

// Application state: holds transactions, budgets, and theme preference
let state = {
  transactions: load('transactions', []),          // Load saved transactions or start empty
  budgets: load('budgets', defaultBudgets()),      // Load budgets or use defaults
  theme: load('theme', 'dark'),                    // Load theme preference
};

// Default budgets for categories (can be edited later via modal)
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

// Helper functions to save/load from LocalStorage
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

// ===============================
// Theme Handling
// ===============================

// Apply theme (dark or light) by toggling CSS class on <body>
function setTheme(mode) {
  state.theme = mode;
  document.body.classList.toggle('light', mode === 'light');
  save('theme', mode);
  els.themeToggle.textContent = mode === 'light' ? 'Light Mode' : 'Dark Mode';
}
setTheme(state.theme); // Initialize theme on load

// ===============================
// Charts Initialization
// ===============================

// Doughnut chart for category distribution
let categoryChart = new Chart(els.categoryChart, {
  type: 'doughnut',
  data: { labels: [], datasets: [{ data: [], backgroundColor: palette() }] },
  options: { plugins: { legend: { position: 'bottom' } } }
});

// Line chart for monthly net balance
let monthlyChart = new Chart(els.monthlyChart, {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'Net', data: [], borderColor: '#22c55e', tension: .3 }] },
  options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => fmt.format(v) } } } }
});

// Color palette for charts
function palette() {
  return ['#22c55e','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#84cc16','#e11d48'];
}

// ===============================
// Transaction Handling
// ===============================

// Add transaction form submission
els.txnForm.addEventListener('submit', (e) => {
  e.preventDefault(); // Prevent page reload
  const txn = {
    id: crypto.randomUUID(),       // Unique ID
    desc: els.desc.value.trim(),   // Description
    amount: Number(els.amount.value), // Amount
    type: els.type.value,          // "income" or "expense"
    category: els.category.value,  // Category
    date: els.date.value,          // Date string
  };
  if (!txn.desc || !txn.amount || !txn.date) return; // Validation
  state.transactions.push(txn); // Add to state
  save('transactions', state.transactions); // Persist
  els.txnForm.reset(); // Clear form
  refresh(); // Update UI
});

// ===============================
// Table Handling
// ===============================

// Select all checkbox
els.selectAll.addEventListener('change', (e) => {
  const checked = e.target.checked;
  document.querySelectorAll('.row-select').forEach(cb => cb.checked = checked);
});

// Delete selected transactions
els.deleteSelectedBtn.addEventListener('click', () => {
  const selectedIds = Array.from(document.querySelectorAll('.row-select'))
    .filter(cb => cb.checked)
    .map(cb => cb.dataset.id);
  if (!selectedIds.length) return;
  state.transactions = state.transactions.filter(t => !selectedIds.includes(t.id));
  save('transactions', state.transactions);
  refresh();
});

// ===============================
// Filters
// ===============================

// Apply filters whenever inputs change
['input','change'].forEach(evt => {
  els.search.addEventListener(evt, refresh);
  els.filterCategory.addEventListener(evt, refresh);
  els.filterType.addEventListener(evt, refresh);
  els.fromDate.addEventListener(evt, refresh);
  els.toDate.addEventListener(evt, refresh);
});

// Clear filters button
document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  els.search.value = '';
  els.filterCategory.value = '';
  els.filterType.value = '';
  els.fromDate.value = '';
  els.toDate.value = '';
  refresh();
});

// ===============================
// Export / Import
// ===============================

// Export data to JSON file
els.exportBtn.addEventListener('click', () => {
  const data = {
    transactions: state.transactions,
    budgets: state.budgets,
    exportedAt: new Date().toISOString(),
  };
  downloadJSON('finance-export.json', data);
});

// Import data from JSON or CSV
els.importInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith('.csv')) {
      const txns = parseCSV(text);
      state.transactions = mergeTransactions(state.transactions, txns);
      save('transactions', state.transactions);
    } else {
      const obj = JSON.parse(text);
      if (Array.isArray(obj.transactions)) state.transactions = obj.transactions;
      if (obj.budgets && typeof obj.budgets === 'object') state.budgets = obj.budgets;
      save('transactions', state.transactions);
      save('budgets', state.budgets);
    }
    refresh();
  } catch {
    alert('Import failed. Ensure the file is valid JSON or CSV.');
  } finally {
    e.target.value = '';
  }
});

// ===============================
// Theme Toggle
// ===============================
els.themeToggle.addEventListener('click', () => {
  setTheme(state.theme === 'light' ? 'dark' : 'light');
});

// ===============================
// Budgets
// ===============================

// Open budgets editor modal
els.editBudgetsBtn.addEventListener('click', () => openBudgetsEditor());

// Save budgets from modal
els.saveBudgetsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const inputs = els.budgetsEditor.querySelectorAll('input[data-category]');
  inputs.forEach(inp => {
    state.budgets[inp.dataset.category] = Number(inp.value || 0);
  });
  save('budgets', state.budgets);
  els.budgetsDialog.close();
  refresh();
});

// ===============================
// Core Refresh Function
// ===============================

// Refresh UI: summary, table, budgets, charts
function refresh() {
  const filtered = applyFilters(state.transactions);
  renderSummary(filtered);
  renderTable(filtered);
  renderBudgets(filtered);
  renderCategoryChart(filtered);
  renderMonthlyChart(filtered);
}

// ===============================
// Filtering Logic
// ===============================

function applyFilters(txns) {
  const q = els.search.value
