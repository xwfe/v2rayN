const api = window.v2raynApi;
const state = {
  config: null,
  profiles: [],
  meta: { hasDatabase: false, dbPath: '', total: 0 },
  dataRoot: ''
};

const selectors = {
  dataDir: document.getElementById('data-dir'),
  defaultServer: document.getElementById('default-server'),
  profileCount: document.getElementById('profile-count'),
  dbPath: document.getElementById('db-path'),
  tbody: document.getElementById('profiles-body'),
  emptyState: document.getElementById('empty-state'),
  toast: document.getElementById('toast'),
  refreshBtn: document.getElementById('refresh'),
  selectDirBtn: document.getElementById('select-dir')
};

async function bootstrap() {
  selectors.refreshBtn.addEventListener('click', () => refreshData(true));
  selectors.selectDirBtn.addEventListener('click', handlePickDirectory);
  await refreshData(false);
}

async function handlePickDirectory() {
  try {
    const result = await api.selectDataRoot();
    if (result?.canceled) {
      return;
    }
    await refreshData(false);
    showToast('Data directory updated', 'success');
  } catch (error) {
    showToast(`Unable to switch directory: ${error.message}`, 'error');
  }
}

async function refreshData(showFeedback) {
  try {
    if (showFeedback) {
      showToast('Refreshing…', 'info', 800);
    }
    const [config, profilesResult, dataRootResult] = await Promise.all([
      api.getConfig(),
      api.listProfiles(),
      api.getDataRoot()
    ]);

    state.config = config;
    state.profiles = profilesResult?.profiles ?? [];
    state.meta = profilesResult?.meta ?? state.meta;
    state.dataRoot = dataRootResult?.root ?? '';

    render();
    if (showFeedback) {
      showToast('Latest data loaded', 'success');
    }
  } catch (error) {
    console.error(error);
    showToast(`Failed to load data: ${error.message}`, 'error');
  }
}

function render() {
  selectors.dataDir.textContent = state.dataRoot || 'Not configured';
  selectors.profileCount.textContent = state.meta.total ?? state.profiles.length;
  const dbText = state.meta.hasDatabase
    ? state.meta.dbPath
    : state.meta.error
      ? `Database error: ${state.meta.error}`
      : 'Database not found';
  selectors.dbPath.textContent = dbText;

  const defaultProfile = state.profiles.find((profile) => profile.isDefault);
  selectors.defaultServer.textContent = defaultProfile
    ? `${defaultProfile.Remarks} (${formatEndpoint(defaultProfile)})`
    : 'Not set';

  renderTable();
}

function renderTable() {
  selectors.tbody.innerHTML = '';

  if (!state.profiles.length) {
    selectors.emptyState.classList.remove('hidden');
    return;
  }

  selectors.emptyState.classList.add('hidden');

  state.profiles.forEach((profile) => {
    const tr = document.createElement('tr');
    if (profile.isDefault) {
      tr.classList.add('default-row');
    }

    tr.innerHTML = `
      <td>
        <div>${escapeHtml(profile.Remarks || '(unnamed)')}</div>
        <small>${escapeHtml(profile.IndexId)}</small>
      </td>
      <td>${escapeHtml(profile.ConfigTypeName)}</td>
      <td>${escapeHtml(profile.CoreTypeName)}</td>
      <td>${escapeHtml(formatEndpoint(profile))}</td>
      <td>${escapeHtml(profile.SubRemarks || 'Local')}</td>
      <td>${escapeHtml(profile.Network || 'tcp')}</td>
      <td>${escapeHtml(profile.StreamSecurityLabel || profile.Security || 'none')}</td>
      <td class="actions">
        <button ${profile.isDefault ? 'disabled' : ''} data-index="${profile.IndexId}">
          ${profile.isDefault ? 'Selected' : 'Set default'}
        </button>
      </td>
    `;

    const button = tr.querySelector('button');
    button?.addEventListener('click', () => handleSetDefault(profile));
    selectors.tbody.appendChild(tr);
  });
}

async function handleSetDefault(profile) {
  if (!profile?.IndexId) {
    return;
  }
  try {
    await api.setDefaultServer(profile.IndexId);
    await refreshData(false);
    showToast(`Default server set to ${profile.Remarks}`, 'success');
  } catch (error) {
    showToast(`Unable to set default: ${error.message}`, 'error');
  }
}

function formatEndpoint(profile) {
  if (!profile?.Address) {
    return '–';
  }
  if (!profile.Port) {
    return profile.Address;
  }
  const needsBrackets = profile.Address.includes(':') && !profile.Address.startsWith('[');
  const host = needsBrackets ? `[${profile.Address}]` : profile.Address;
  return `${host}:${profile.Port}`;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let toastTimeout;
function showToast(message, variant = 'info', duration = 2200) {
  if (!selectors.toast) {
    return;
  }
  selectors.toast.textContent = message;
  selectors.toast.style.background = getToastBackground(variant);
  selectors.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    selectors.toast.classList.remove('show');
  }, duration);
}

function getToastBackground(variant) {
  switch (variant) {
    case 'error':
      return 'rgba(239, 68, 68, 0.95)';
    case 'success':
      return 'rgba(16, 185, 129, 0.95)';
    default:
      return 'rgba(79, 70, 229, 0.95)';
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
