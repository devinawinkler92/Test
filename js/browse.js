/**
 * P2FK Online and Offline Browser Module.
 * Parses user input for:
 * - Address lookup (muVr...)
 * - URN Handle lookups (@username)
 * - Keyword search (#Hashtag)
 * - Transaction ID lookups
 *
 * Supports both online query via p2fk.io API & local offline lookup via imported database JSON files.
 */

import { showFossilInInspector } from './inspector.js';

// Local storage indices for fully offline operation
let offlineROOT = JSON.parse(localStorage.getItem('offline_root') || '[]');
let offlineOBJ = JSON.parse(localStorage.getItem('offline_obj') || '{}');
let offlinePRO = JSON.parse(localStorage.getItem('offline_pro') || '{}');
let offlineMSG = JSON.parse(localStorage.getItem('offline_msg') || '[]');

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchStatus = document.getElementById('search-status');
const searchResults = document.getElementById('search-results');
const quickTags = document.querySelectorAll('.quick-tag');

// File uploads
const uploadRoot = document.getElementById('upload-root');
const uploadObj = document.getElementById('upload-obj');
const uploadPro = document.getElementById('upload-pro');
const uploadMsg = document.getElementById('upload-msg');

const statusRoot = document.getElementById('status-root');
const statusObj = document.getElementById('status-obj');
const statusPro = document.getElementById('status-pro');
const statusMsg = document.getElementById('status-msg');

const btnClearOffline = document.getElementById('btn-clear-offline');

// Filter switches
const filterProfile = document.getElementById('filter-profile');
const filterObject = document.getElementById('filter-object');
const filterMessage = document.getElementById('filter-message');
const filterSignatures = document.getElementById('filter-signatures');
const filterRaw = document.getElementById('filter-raw');
const btnResetFilters = document.getElementById('reset-filters');

document.addEventListener('DOMContentLoaded', () => {
  updateOfflineStatuses();

  // Search trigger
  searchButton.addEventListener('click', performSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Quick tags
  quickTags.forEach(tag => {
    tag.addEventListener('click', () => {
      searchInput.value = tag.textContent;
      performSearch();
    });
  });

  // Offline upload triggers
  setupOfflineFileHandler(uploadRoot, 'offline_root', statusRoot, "index loaded successfully");
  setupOfflineFileHandler(uploadObj, 'offline_obj', statusObj, "objects database loaded");
  setupOfflineFileHandler(uploadPro, 'offline_pro', statusPro, "profiles database loaded");
  setupOfflineFileHandler(uploadMsg, 'offline_msg', statusMsg, "message feeds loaded");

  btnClearOffline.addEventListener('click', () => {
    localStorage.removeItem('offline_root');
    localStorage.removeItem('offline_obj');
    localStorage.removeItem('offline_pro');
    localStorage.removeItem('offline_msg');
    offlineROOT = [];
    offlineOBJ = {};
    offlinePRO = {};
    offlineMSG = [];
    updateOfflineStatuses();
    alert("Cached offline database cleared!");
  });

  btnResetFilters.addEventListener('click', () => {
    filterProfile.checked = true;
    filterObject.checked = true;
    filterMessage.checked = true;
    filterSignatures.checked = true;
    filterRaw.checked = true;
    performSearch();
  });
});

function updateOfflineStatuses() {
  statusRoot.textContent = offlineROOT.length > 0 ? `${offlineROOT.length} entries loaded` : "No database index loaded";
  statusObj.textContent = Object.keys(offlineOBJ).length > 0 ? `${Object.keys(offlineOBJ).length} objects loaded` : "No objects database loaded";
  statusPro.textContent = Object.keys(offlinePRO).length > 0 ? `${Object.keys(offlinePRO).length} profiles loaded` : "No profiles database loaded";
  statusMsg.textContent = offlineMSG.length > 0 ? `${offlineMSG.length} message feeds loaded` : "No message feeds loaded";
}

function setupOfflineFileHandler(inputElement, localStorageKey, statusElement, successMsg) {
  inputElement.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        localStorage.setItem(localStorageKey, evt.target.result);

        // Update loaded variables dynamically
        if (localStorageKey === 'offline_root') offlineROOT = parsed;
        if (localStorageKey === 'offline_obj') offlineOBJ = parsed;
        if (localStorageKey === 'offline_pro') offlinePRO = parsed;
        if (localStorageKey === 'offline_msg') offlineMSG = parsed;

        updateOfflineStatuses();
        alert(`Successfully imported ${file.name}!`);
      } catch (err) {
        alert(`Failed parsing JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  });
}

/**
 * Main Search Router
 */
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = '';
  searchStatus.classList.remove('hidden');

  const isTestnet = (localStorage.getItem('sup_network') || 'TESTNET') === 'TESTNET';
  const nodeUrl = isTestnet
    ? (localStorage.getItem('sup_api_testnet') || 'https://p2fk.io')
    : (localStorage.getItem('sup_api_mainnet') || 'https://p2fk.io');

  try {
    // If we have offline files loaded, search offline FIRST (or fallback online)
    if (offlineROOT.length > 0 || Object.keys(offlineOBJ).length > 0 || Object.keys(offlinePRO).length > 0 || offlineMSG.length > 0) {
      const offlineResults = searchOffline(query);
      if (offlineResults.length > 0) {
        renderResults(offlineResults, "Offline Search Results");
        searchStatus.classList.add('hidden');
        return;
      }
    }

    // fallback / online query
    const results = await searchOnline(query, nodeUrl, isTestnet);
    if (results && results.length > 0) {
      renderResults(results, "Online P2FK Results");
    } else {
      renderNoResults();
    }
  } catch (err) {
    console.error("Online search failed, checking offline fallback...", err);
    // Offline Fallback
    const fallbackResults = searchOffline(query);
    if (fallbackResults.length > 0) {
      renderResults(fallbackResults, "Offline Fallback Results");
    } else {
      renderNoResults(`Failed reaching API Node. No offline matching records found in database.`);
    }
  } finally {
    searchStatus.classList.add('hidden');
  }
}

/**
 * Online P2FK Lookups
 */
async function searchOnline(query, nodeUrl, isTestnet) {
  let endpoint = '';
  const cleanQuery = query.replace('@', '').replace('#', '');

  // 1. Transaction ID Search (64 char hex)
  const isTxID = /^[0-9a-fA-F]{64}$/.test(cleanQuery);
  // 2. Address Search (Starts with 'm','n','1','3', etc.)
  const isAddress = /^[13mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanQuery);

  if (isTxID) {
    endpoint = `${nodeUrl}/api/v0/getobjectbytransactionid?tid=${cleanQuery}`;
  } else if (isAddress) {
    endpoint = `${nodeUrl}/api/v0/getobjectsbyaddress?address=${cleanQuery}`;
  } else if (query.startsWith('@')) {
    endpoint = `${nodeUrl}/api/v0/getprofilebyurn?urn=${cleanQuery}`;
  } else if (query.startsWith('#')) {
    endpoint = `${nodeUrl}/api/v0/getobjectsbykeyword?keyword=${cleanQuery}`;
  } else {
    // Default search as profile or keyword
    endpoint = `${nodeUrl}/api/v0/getprofilebyurn?urn=${cleanQuery}`;
  }

  // Let's call the API (if running online)
  const response = await fetch(endpoint, { mode: 'cors' });
  if (!response.ok) return [];

  const rawData = await response.json();
  return normalizeAPIResponse(rawData, query);
}

/**
 * Offline Search Engine - parses local JSON caches
 */
function searchOffline(query) {
  const cleanQuery = query.toLowerCase().replace('@', '').replace('#', '');
  const matches = [];

  // 1. Search in PRO (Profiles)
  for (const [address, profile] of Object.entries(offlinePRO)) {
    if (
      address.toLowerCase() === cleanQuery ||
      (profile.urn && profile.urn.toLowerCase() === cleanQuery) ||
      (profile.name && profile.name.toLowerCase().includes(cleanQuery))
    ) {
      matches.push({
        type: 'PROFILE',
        title: profile.name || `@${profile.urn}`,
        subtitle: `Address: ${address}`,
        badge: 'Profile',
        address: address,
        rawData: { address, ...profile }
      });
    }
  }

  // 2. Search in OBJ (Objects)
  for (const [id, obj] of Object.entries(offlineOBJ)) {
    if (
      id.toLowerCase() === cleanQuery ||
      (obj.name && obj.name.toLowerCase().includes(cleanQuery)) ||
      (obj.urn && obj.urn.toLowerCase() === cleanQuery)
    ) {
      matches.push({
        type: 'OBJECT',
        title: obj.name || 'Digital Object',
        subtitle: `URN: ${obj.urn || 'N/A'}`,
        badge: 'Object',
        id: id,
        rawData: { id, ...obj }
      });
    }
  }

  // 3. Search in ROOT indices / Message logs
  offlineROOT.forEach((entry, idx) => {
    const serialized = JSON.stringify(entry).toLowerCase();
    if (serialized.includes(cleanQuery)) {
      matches.push({
        type: 'TRANSACTION',
        title: `Fossil Entry #${idx + 1}`,
        subtitle: `Transaction: ${entry.txid || 'N/A'}`,
        badge: 'Fossil Block',
        rawData: entry
      });
    }
  });

  return matches;
}

/**
 * Clean up different formats into unified list
 */
function normalizeAPIResponse(data, query) {
  if (!data) return [];
  const results = [];

  // If it's a list
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      results.push({
        type: item.urn ? 'OBJECT' : 'TRANSACTION',
        title: item.name || `P2FK Entry #${index + 1}`,
        subtitle: item.txid || item.address || query,
        badge: item.urn ? 'Object' : 'Fossil',
        rawData: item
      });
    });
  } else {
    // Single object/profile response
    results.push({
      type: data.urn ? 'PROFILE' : 'FOSSIL',
      title: data.name || data.urn || 'On-chain Data',
      subtitle: data.address || query,
      badge: data.urn ? 'Profile' : 'Fossil',
      rawData: data
    });
  }

  return results;
}

/**
 * Renderers
 */
function renderResults(results, sourceTitle) {
  const heading = document.createElement('div');
  heading.className = "text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 pl-1";
  heading.textContent = sourceTitle;
  searchResults.appendChild(heading);

  results.forEach(res => {
    // Apply client-side visibility filters
    if (res.type === 'PROFILE' && !filterProfile.checked) return;
    if (res.type === 'OBJECT' && !filterObject.checked) return;
    if (res.type === 'TRANSACTION' && !filterMessage.checked) return;

    const card = document.createElement('div');
    card.className = "bg-slate-800 border border-slate-700/60 rounded-xl p-4 hover:border-indigo-500 transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/5 relative overflow-hidden";

    // Icon badge based on type
    let icon = 'file-text';
    let iconColor = 'text-slate-400';
    if (res.type === 'PROFILE') {
      icon = 'user';
      iconColor = 'text-indigo-400';
    } else if (res.type === 'OBJECT') {
      icon = 'package';
      iconColor = 'text-emerald-400';
    }

    card.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="p-2 bg-slate-900 rounded-lg ${iconColor}">
          <i data-lucide="${icon}" class="h-5 w-5"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-bold text-sm text-slate-100 truncate">${res.title}</h3>
            <span class="text-[10px] bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 text-slate-400 font-bold tracking-wide">${res.badge}</span>
          </div>
          <p class="text-xs text-slate-500 truncate font-mono mt-0.5">${res.subtitle}</p>
        </div>
      </div>
    `;

    // Click handler to launch advanced transaction detail inspector!
    card.addEventListener('click', () => {
      showFossilInInspector(res.rawData, {
        showProfile: filterProfile.checked,
        showObject: filterObject.checked,
        showSignatures: filterSignatures.checked,
        showRaw: filterRaw.checked
      });
    });

    searchResults.appendChild(card);
  });

  // Re-run lucide icons for newly appended cards
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderNoResults(msg) {
  searchResults.innerHTML = `
    <div class="bg-slate-800/40 rounded-2xl border border-slate-800 p-8 text-center space-y-2">
      <i data-lucide="help-circle" class="h-10 w-10 text-slate-600 mx-auto animate-pulse"></i>
      <p class="text-sm font-semibold text-slate-400">No fossils discovered</p>
      <p class="text-xs text-slate-500 leading-relaxed">${msg || 'We could not find any on-chain matching metadata. Connect to an active node or load local offline ROOT databases.'}</p>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}
