const STORAGE_KEY = 'expensePlannerData';
const thresholds = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const elements = {
  categoryForm: document.getElementById('category-form'),
  categoryName: document.getElementById('category-name'),
  categoryLimit: document.getElementById('category-limit'),
  expenseForm: document.getElementById('expense-form'),
  expenseCategory: document.getElementById('expense-category'),
  expenseAmount: document.getElementById('expense-amount'),
  expenseDate: document.getElementById('expense-date'),
  categoryList: document.getElementById('category-list'),
  notificationList: document.getElementById('notification-list'),
  metricSummary: document.getElementById('metric-summary'),
  clearAll: document.getElementById('clear-all'),
};

const state = {
  categories: [],
  expenses: [],
  notifications: [],
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    state.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    state.expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
    state.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
  } catch (error) {
    console.error('Failed to load saved state:', error);
  }
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getCategory(categoryId) {
  return state.categories.find((category) => category.id === categoryId);
}

function getCategorySpent(categoryId, monthKey) {
  return state.expenses
    .filter((expense) => {
      return expense.categoryId === categoryId && getMonthKey(new Date(expense.date)) === monthKey;
    })
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
}

function addNotification(message) {
  const notification = {
    id: Date.now().toString(),
    message,
    date: new Date().toISOString(),
  };
  state.notifications.unshift(notification);
  if (state.notifications.length > 20) {
    state.notifications.pop();
  }
  saveState();
  renderNotifications();
}

function notifyThresholds(category, monthKey, newSpent) {
  const limit = Number(category.limit);
  if (!limit || limit <= 0) {
    return;
  }

  const percent = Math.min(100, Math.floor((newSpent / limit) * 100));
  const thresholdsByMonth = category.thresholdsByMonth || {};
  const previousLevel = Number(thresholdsByMonth[monthKey] || 0);

  thresholds
    .filter((level) => level <= percent && level > previousLevel)
    .forEach((level) => {
      const message = `Category “${category.name}” reached ${level}% of its ${formatCurrency(limit)} limit.`;
      addNotification(message);
      window.alert(message);
      thresholdsByMonth[monthKey] = level;
    });

  if (percent < previousLevel) {
    thresholdsByMonth[monthKey] = percent;
  }

  category.thresholdsByMonth = thresholdsByMonth;
}

function renderCategoryOptions() {
  const hasCategories = state.categories.length > 0;
  elements.expenseCategory.innerHTML = hasCategories
    ? state.categories
        .map((category) => `<option value="${category.id}">${category.name}</option>`)
        .join('')
    : '<option value="">Add a category first</option>';
  elements.expenseCategory.disabled = !hasCategories;
}

function renderCategoryList() {
  const monthKey = getMonthKey(new Date());
  if (state.categories.length === 0) {
    elements.categoryList.innerHTML = '<p class="empty">No categories created yet.</p>';
    return;
  }

  elements.categoryList.innerHTML = state.categories
    .map((category) => {
      const spent = getCategorySpent(category.id, monthKey);
      const limit = Number(category.limit);
      const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      return `
        <div class="category-card">
          <header>
            <div>
              <strong>${category.name}</strong>
              <div class="muted">Limit: ${formatCurrency(limit)}</div>
            </div>
            <div>${percent}%</div>
          </header>
          <div class="progress"><span style="width: ${percent}%"></span></div>
          <div class="metric-row">
            <div>Spent this month: <strong>${formatCurrency(spent)}</strong></div>
            <div>Remaining: <strong>${formatCurrency(Math.max(0, limit - spent))}</strong></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderNotifications() {
  if (state.notifications.length === 0) {
    elements.notificationList.innerHTML = '<p class="empty">No notifications yet.</p>';
    return;
  }

  elements.notificationList.innerHTML = state.notifications
    .map((notification) => {
      return `
      <div class="notification-card">
        <div>${notification.message}</div>
        <div class="muted">${formatDate(notification.date)}</div>
      </div>
    `;
    })
    .join('');
}

function renderMetrics() {
  const today = new Date();
  const thisMonthKey = getMonthKey(today);
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthKey = getMonthKey(lastMonthDate);

  const thisMonthTotal = state.expenses
    .filter((expense) => getMonthKey(new Date(expense.date)) === thisMonthKey)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  const lastMonthTotal = state.expenses
    .filter((expense) => getMonthKey(new Date(expense.date)) === lastMonthKey)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  const difference = thisMonthTotal - lastMonthTotal;
  const compareText = lastMonthTotal === 0
    ? 'No spending recorded last month.'
    : `${difference >= 0 ? 'Up' : 'Down'} ${formatCurrency(Math.abs(difference))} compared to last month.`;

  const spendComparison = lastMonthTotal === 0 ? 'No prior month comparison available.' : compareText;

  const categoryBreakdown = state.categories
    .map((category) => {
      const thisMonthCategory = getCategorySpent(category.id, thisMonthKey);
      const lastMonthCategory = getCategorySpent(category.id, lastMonthKey);
      return `
        <div class="metric-card">
          <header>
            <strong>${category.name}</strong>
            <span>${formatCurrency(thisMonthCategory)}</span>
          </header>
          <div>Last month: ${formatCurrency(lastMonthCategory)}</div>
          <div>${lastMonthCategory === 0 ? 'No last month data' : `Change: ${formatCurrency(thisMonthCategory - lastMonthCategory)}`}</div>
        </div>
      `;
    })
    .join('');

  elements.metricSummary.innerHTML = `
    <div class="metric-card">
      <header>
        <strong>This month total</strong>
        <span>${formatCurrency(thisMonthTotal)}</span>
      </header>
      <div>Last month total: ${formatCurrency(lastMonthTotal)}</div>
      <div>${spendComparison}</div>
    </div>
    <div class="metric-card">
      <strong>Category comparison</strong>
      ${categoryBreakdown || '<div class="muted">Create categories and add expenses for category metrics.</div>'}
    </div>
  `;
}

function render() {
  renderCategoryOptions();
  renderCategoryList();
  renderNotifications();
  renderMetrics();
}

function resetForms() {
  elements.categoryForm.reset();
  elements.expenseForm.reset();
  elements.expenseDate.valueAsDate = new Date();
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const name = elements.categoryName.value.trim();
  const limit = Number(elements.categoryLimit.value);
  if (!name || limit <= 0) {
    return;
  }

  state.categories.push({
    id: Date.now().toString(),
    name,
    limit,
    thresholdsByMonth: {},
  });

  saveState();
  render();
  resetForms();
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  const categoryId = elements.expenseCategory.value;
  const amount = Number(elements.expenseAmount.value);
  const date = elements.expenseDate.value;
  if (!categoryId || amount <= 0 || !date) {
    return;
  }

  const category = getCategory(categoryId);
  if (!category) {
    return;
  }

  const monthKey = getMonthKey(new Date(date));
  const spentInMonth = getCategorySpent(categoryId, monthKey) + amount;

  state.expenses.push({
    id: Date.now().toString(),
    categoryId,
    amount,
    date,
  });

  notifyThresholds(category, monthKey, spentInMonth);
  saveState();
  render();
  resetForms();
}

function handleReset() {
  if (!window.confirm('Clear all categories, expenses, and notifications?')) {
    return;
  }
  state.categories = [];
  state.expenses = [];
  state.notifications = [];
  saveState();
  render();
}

function initialize() {
  loadState();
  elements.expenseDate.valueAsDate = new Date();
  elements.categoryForm.addEventListener('submit', handleCategorySubmit);
  elements.expenseForm.addEventListener('submit', handleExpenseSubmit);
  elements.clearAll.addEventListener('click', handleReset);
  render();
}

initialize();
