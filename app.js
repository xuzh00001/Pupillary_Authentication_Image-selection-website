const manifest = window.IMAGE_MANIFEST;

if (!manifest || !Array.isArray(manifest.categories) || manifest.categories.length === 0) {
  document.body.innerHTML = '<main style="padding: 24px; font-family: sans-serif;">Unable to load the image manifest. Please make sure assets/manifest.js exists and is valid.</main>';
  throw new Error('Manifest not found or invalid.');
}

const STORAGE_KEY = 'image-selector-web-state-v1';

const elements = {
  screens: {
    start: document.getElementById('start-screen'),
    experiment: document.getElementById('experiment-screen'),
    summary: document.getElementById('summary-screen')
  },
  totalCategories: document.getElementById('total-categories'),
  imagesPerCategory: document.getElementById('images-per-category'),
  participantId: document.getElementById('participant-id'),
  startButton: document.getElementById('start-button'),
  restartButton: document.getElementById('restart-button'),
  categoryProgress: document.getElementById('category-progress'),
  categoryStep: document.getElementById('category-step'),
  categoryTitle: document.getElementById('category-title'),
  imageStep: document.getElementById('image-step'),
  colorImage: document.getElementById('color-image'),
  imageLabel: document.getElementById('image-label'),
  imageId: document.getElementById('image-id'),
  prevButton: document.getElementById('prev-button'),
  nextButton: document.getElementById('next-button'),
  selectButton: document.getElementById('select-button'),
  clearSelectionButton: document.getElementById('clear-selection-button'),
  confirmCategoryButton: document.getElementById('confirm-category-button'),
  thumbnailStrip: document.getElementById('thumbnail-strip'),
  selectionPreview: document.getElementById('selection-preview'),
  summaryGrid: document.getElementById('summary-grid'),
  summaryCategoryJump: document.getElementById('summary-category-jump'),
  summaryMeta: document.getElementById('summary-meta'),
  downloadButton: document.getElementById('download-button')
};

const state = loadState();

init();

function init() {
  const firstCategory = manifest.categories[0];
  elements.totalCategories.textContent = String(manifest.categories.length);
  elements.imagesPerCategory.textContent = String(firstCategory.items.length);
  elements.participantId.value = state.participantId;

  bindEvents();
  render();
}

function bindEvents() {
  elements.startButton.addEventListener('click', startTask);
  elements.restartButton.addEventListener('click', restartTask);
  elements.prevButton.addEventListener('click', () => moveItem(-1));
  elements.nextButton.addEventListener('click', () => moveItem(1));
  elements.selectButton.addEventListener('click', selectCurrentItem);
  elements.clearSelectionButton.addEventListener('click', clearCurrentCategorySelection);
  elements.confirmCategoryButton.addEventListener('click', confirmCategory);
  elements.downloadButton.addEventListener('click', downloadResults);
  elements.participantId.addEventListener('input', () => {
    state.participantId = elements.participantId.value.trim();
    persistState();
  });

  document.addEventListener('keydown', (event) => {
    if (state.stage !== 'experiment') {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveItem(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveItem(1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectCurrentItem();
    }
  });
}

function startTask() {
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString();
  }

  state.participantId = elements.participantId.value.trim();
  state.stage = 'experiment';
  state.returnToSummaryAfterConfirm = false;
  persistState();
  render();
}

function restartTask() {
  const confirmed = window.confirm('This will clear all current selections and restart the task. Do you want to continue?');
  if (!confirmed) {
    return;
  }

  const freshState = createInitialState();
  Object.assign(state, freshState);
  elements.participantId.value = '';
  persistState();
  render();
}

function moveItem(delta) {
  const category = getCurrentCategory();
  const nextIndex = clamp(state.itemIndex + delta, 0, category.items.length - 1);
  if (nextIndex === state.itemIndex) {
    return;
  }

  state.itemIndex = nextIndex;
  persistState();
  renderExperiment();
}

function selectCurrentItem() {
  const category = getCurrentCategory();
  const item = category.items[state.itemIndex];

  state.selections[category.id] = {
    categoryId: category.id,
    categoryName: category.name,
    itemId: item.id,
    label: item.label,
    color: item.color,
    gray: item.gray,
    chosenAt: new Date().toISOString()
  };

  persistState();
  renderExperiment();
}

function clearCurrentCategorySelection() {
  const category = getCurrentCategory();
  delete state.selections[category.id];
  persistState();
  renderExperiment();
}

function jumpToCategory(categoryIndex) {
  const category = manifest.categories[categoryIndex];
  const selection = state.selections[category.id];

  state.returnToSummaryAfterConfirm = state.stage === 'summary';
  state.stage = 'experiment';
  state.categoryIndex = categoryIndex;
  state.itemIndex = selection ? findItemIndexById(category, selection.itemId) : 0;
  persistState();
  render();
}

function confirmCategory() {
  const category = getCurrentCategory();
  if (!state.selections[category.id]) {
    window.alert('Please select one image in the current category first.');
    return;
  }

  if (state.returnToSummaryAfterConfirm) {
    state.stage = 'summary';
    state.completedAt = new Date().toISOString();
    state.returnToSummaryAfterConfirm = false;
    persistState();
    render();
    return;
  }

  if (state.categoryIndex < manifest.categories.length - 1) {
    state.categoryIndex += 1;
    state.itemIndex = 0;
    persistState();
    render();
    return;
  }

  state.stage = 'summary';
  state.completedAt = new Date().toISOString();
  persistState();
  render();
}

function render() {
  toggleScreen(state.stage);
  elements.restartButton.classList.toggle('hidden', state.stage === 'start');

  if (state.stage === 'start') {
    return;
  }

  if (state.stage === 'experiment') {
    renderExperiment();
    return;
  }

  renderSummary();
}

function renderExperiment() {
  const category = getCurrentCategory();
  const item = category.items[state.itemIndex];
  const selection = state.selections[category.id];

  elements.categoryStep.textContent = `Category ${state.categoryIndex + 1} / ${manifest.categories.length}`;
  elements.categoryTitle.textContent = category.name;
  elements.imageStep.textContent = `Image ${state.itemIndex + 1} / ${category.items.length}`;
  elements.colorImage.src = item.color;
  elements.colorImage.alt = `${category.name} - ${item.label}`;
  elements.imageLabel.textContent = item.label;
  elements.imageId.textContent = `ID ${item.id}`;
  elements.prevButton.disabled = state.itemIndex === 0;
  elements.nextButton.disabled = state.itemIndex === category.items.length - 1;
  elements.confirmCategoryButton.disabled = !selection;

  if (selection && selection.itemId === item.id) {
    elements.selectButton.textContent = 'Current Image Selected';
    elements.selectButton.disabled = true;
  } else {
    elements.selectButton.textContent = 'Select Current Image';
    elements.selectButton.disabled = false;
  }

  elements.clearSelectionButton.disabled = !selection;
  elements.confirmCategoryButton.textContent =
    state.categoryIndex === manifest.categories.length - 1
      ? 'Finish All Categories and Open Memory Phase'
      : 'Confirm Category and Continue';

  renderCategoryProgress();
  renderSelectionPreview();
  renderThumbnails(category, selection);
}

function renderCategoryProgress() {
  elements.categoryProgress.innerHTML = '';

  manifest.categories.forEach((category, index) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'category-pill';

    if (index === state.categoryIndex) {
      pill.classList.add('current');
    }

    if (state.selections[category.id]) {
      pill.classList.add('done');
    }

    const label = document.createElement('span');
    label.textContent = category.name;

    const status = document.createElement('span');
    status.className = 'category-pill-status';
    status.textContent = state.selections[category.id] ? 'Selected' : index === state.categoryIndex ? 'In Progress' : 'Not Started';

    pill.append(label, status);
    pill.addEventListener('click', () => jumpToCategory(index));
    elements.categoryProgress.appendChild(pill);
  });
}

function renderSelectionPreview() {
  const category = getCurrentCategory();
  const selection = state.selections[category.id];

  if (!selection) {
    elements.selectionPreview.className = 'selection-preview empty';
    elements.selectionPreview.innerHTML = '<p>No image selected yet</p>';
    return;
  }

  elements.selectionPreview.className = 'selection-preview';
  elements.selectionPreview.innerHTML = `
    <div class="selection-preview-content">
      <img src="${selection.color}" alt="${selection.label}">
      <div>
        <div class="selection-preview-name">${selection.label}</div>
        <div class="image-meta">ID ${selection.itemId}</div>
      </div>
    </div>
  `;
}

function renderThumbnails(category, selection) {
  elements.thumbnailStrip.innerHTML = '';

  category.items.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb-button';

    if (index === state.itemIndex) {
      button.classList.add('current');
    }

    if (selection && selection.itemId === item.id) {
      button.classList.add('selected');
    }

    button.innerHTML = `
      <img src="${item.color}" alt="${item.label}">
      <span>${item.label}</span>
      <span class="thumb-button-index">ID ${item.id}</span>
    `;
    button.addEventListener('click', () => {
      state.itemIndex = index;
      persistState();
      renderExperiment();
    });

    elements.thumbnailStrip.appendChild(button);
  });
}

function renderSummary() {
  elements.summaryGrid.innerHTML = '';
  elements.summaryCategoryJump.innerHTML = '';
  const orderedSelections = manifest.categories.map((category) => state.selections[category.id]).filter(Boolean);

  elements.summaryMeta.textContent = state.participantId
    ? `Participant ID: ${state.participantId}`
    : 'No participant ID entered';

  manifest.categories.forEach((category, index) => {
    const selection = state.selections[category.id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-pill summary-pill';
    button.innerHTML = `
      <span>${category.name}</span>
      <span class="category-pill-status">${selection ? 'Edit Selection' : 'Open Category'}</span>
    `;
    button.addEventListener('click', () => jumpToCategory(index));
    elements.summaryCategoryJump.appendChild(button);
  });

  orderedSelections.forEach((selection, index) => {
    const card = document.createElement('article');
    card.className = 'summary-card';
    card.innerHTML = `
      <p class="eyebrow">Image ${index + 1}</p>
      <img src="${selection.gray}" alt="${selection.categoryName} grayscale image ${selection.itemId}">
      <div>
        <h3>${selection.categoryName}</h3>
        <p>Selected color image: ${selection.label}</p>
        <p>Grayscale ID: ${selection.itemId}</p>
      </div>
    `;
    elements.summaryGrid.appendChild(card);
  });
}

function downloadResults() {
  const headerRow = ['participant_id', 'completed_at', ...manifest.categories.map((category) => category.id)];
  const dataRow = [
    state.participantId || '',
    state.completedAt || new Date().toISOString(),
    ...manifest.categories.map((category) => {
      const selection = state.selections[category.id];
      return selection ? `${selection.label} (ID ${selection.itemId})` : '';
    })
  ];
  const rows = [headerRow, dataRow];

  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `${state.participantId || 'participant'}-image-selection.csv`;
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function getCurrentCategory() {
  return manifest.categories[state.categoryIndex];
}

function toggleScreen(stage) {
  elements.screens.start.classList.toggle('active', stage === 'start');
  elements.screens.experiment.classList.toggle('active', stage === 'experiment');
  elements.screens.summary.classList.toggle('active', stage === 'summary');
}

function createInitialState() {
  return {
    stage: 'start',
    participantId: '',
    categoryIndex: 0,
    itemIndex: 0,
    selections: {},
    startedAt: null,
    completedAt: null,
    returnToSummaryAfterConfirm: false
  };
}

function loadState() {
  const fallback = createInitialState();

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }

    const categoryIds = new Set(manifest.categories.map((category) => category.id));
    const safeSelections = {};
    Object.entries(parsed.selections || {}).forEach(([categoryId, selection]) => {
      if (categoryIds.has(categoryId)) {
        const category = manifest.categories.find((item) => item.id === categoryId);
        const manifestItem = category?.items.find((item) => item.id === selection.itemId);

        if (category && manifestItem) {
          safeSelections[categoryId] = {
            ...selection,
            categoryId: category.id,
            categoryName: category.name,
            itemId: manifestItem.id,
            label: manifestItem.label,
            color: manifestItem.color,
            gray: manifestItem.gray
          };
        }
      }
    });

    return {
      stage: ['start', 'experiment', 'summary'].includes(parsed.stage) ? parsed.stage : 'start',
      participantId: typeof parsed.participantId === 'string' ? parsed.participantId : '',
      categoryIndex: Number.isInteger(parsed.categoryIndex) ? clamp(parsed.categoryIndex, 0, manifest.categories.length - 1) : 0,
      itemIndex: Number.isInteger(parsed.itemIndex) ? clamp(parsed.itemIndex, 0, manifest.categories[0].items.length - 1) : 0,
      selections: safeSelections,
      startedAt: parsed.startedAt || null,
      completedAt: parsed.completedAt || null,
      returnToSummaryAfterConfirm: Boolean(parsed.returnToSummaryAfterConfirm)
    };
  } catch (error) {
    console.warn('Failed to load saved state.', error);
    return fallback;
  }
}

function persistState() {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function findItemIndexById(category, itemId) {
  const itemIndex = category.items.findIndex((item) => item.id === itemId);
  return itemIndex >= 0 ? itemIndex : 0;
}

function escapeCsvCell(value) {
  const stringValue = String(value ?? '');
  return `"${stringValue.replace(/"/g, '""')}"`;
}

