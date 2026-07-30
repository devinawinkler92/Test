/**
 * Advanced P2FK Transaction Details Inspector Module.
 * Decodes and showcases all aspects of on-chain metadata with customizable toggles.
 */

const inspectorModal = document.getElementById('inspector-modal');
const btnCloseInspector = document.getElementById('btn-close-inspector');
const inspectorBody = document.getElementById('inspector-body');
const btnInspectorAction = document.getElementById('btn-inspector-action');

document.addEventListener('DOMContentLoaded', () => {
  btnCloseInspector.addEventListener('click', () => {
    inspectorModal.classList.add('hidden');
  });

  btnInspectorAction.addEventListener('click', () => {
    inspectorModal.classList.add('hidden');
  });
});

/**
 * Open the inspector modal and render transaction details
 * @param {Object} rawData - P2FK raw JSON object
 * @param {Object} filters - Checked toggles from parent view
 */
export function showFossilInInspector(rawData, filters) {
  if (!rawData) return;

  inspectorBody.innerHTML = '';
  inspectorModal.classList.remove('hidden');

  const container = document.createElement('div');
  container.className = "space-y-4";

  // 1. HEADER SUMMARY CARD
  const summaryCard = document.createElement('div');
  summaryCard.className = "bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2";

  const txid = rawData.txid || rawData.transactionid || 'N/A';
  const blockHeight = rawData.height || rawData.blockHeight || 'Pending confirmation';
  const creator = rawData.creator || rawData.owner || 'Unknown';

  summaryCard.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Transaction Summary</span>
      <span class="text-[10px] bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded border border-indigo-900/40">Height: ${blockHeight}</span>
    </div>
    <div class="text-xs font-mono text-slate-300 break-all">
      <span class="text-slate-500">TXID:</span> ${txid}
    </div>
    <div class="text-xs font-mono text-slate-300 break-all">
      <span class="text-slate-500">Creator/Owner:</span> ${creator}
    </div>
  `;
  container.appendChild(summaryCard);

  // 2. PROFILE DATA SECTION (Enabled if filter checked)
  if (filters.showProfile && (rawData.urn || rawData.name || rawData.bio)) {
    const profileSection = document.createElement('div');
    profileSection.className = "space-y-2";
    profileSection.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-400 tracking-wider">
        <i data-lucide="user" class="h-4 w-4"></i> Profile Metadata
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1 text-xs">
        <div class="font-extrabold text-sm text-slate-100">@${rawData.urn || 'NoURN'}</div>
        <div class="font-bold text-slate-300">${rawData.name || 'Anonymous'}</div>
        <div class="text-slate-400 text-[11px] leading-relaxed italic mt-1">"${rawData.bio || 'No bio on-chain'}"</div>
        ${rawData.pfp ? `<div class="text-[10px] text-slate-500 mt-1 truncate">PFP: <a href="${rawData.pfp}" target="_blank" class="text-indigo-400 hover:underline font-mono">${rawData.pfp}</a></div>` : ''}
      </div>
    `;
    container.appendChild(profileSection);
  }

  // 3. OBJECT / NFT DATA SECTION
  if (filters.showObject && (rawData.objectName || rawData.qty || rawData.royalties)) {
    const objectSection = document.createElement('div');
    objectSection.className = "space-y-2";
    objectSection.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-400 tracking-wider">
        <i data-lucide="package" class="h-4 w-4"></i> Digital Object (NFT)
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1.5 text-xs">
        <div class="flex justify-between">
          <span class="font-extrabold text-slate-200">${rawData.objectName || rawData.name || 'Digital Collectible'}</span>
          <span class="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded font-bold">Qty: ${rawData.qty || 1}</span>
        </div>
        ${rawData.urn ? `<div class="text-[10px] text-slate-400">URN Reference: <span class="font-mono text-indigo-300">${rawData.urn}</span></div>` : ''}
        ${rawData.royalties ? `<div class="text-[10px] text-slate-400">Royalties: <span class="font-mono text-emerald-300">${rawData.royalties}</span></div>` : ''}
      </div>
    `;
    container.appendChild(objectSection);
  }

  // 4. SIGNATURES SECTION
  if (filters.showSignatures && (rawData.sig || rawData.signature || rawData.pubkey)) {
    const sigSection = document.createElement('div');
    sigSection.className = "space-y-2";
    sigSection.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-400 tracking-wider">
        <i data-lucide="shield-check" class="h-4 w-4"></i> Crytographic Signatures
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1 text-xs font-mono break-all">
        <div class="text-[10px] text-slate-500">PUBLIC KEY</div>
        <div class="text-[11px] text-amber-200/90">${rawData.pubkey || 'Determined by address hash'}</div>
        <div class="text-[10px] text-slate-500 mt-2">ECDSA SIGNATURE</div>
        <div class="text-[11px] text-amber-200/90">${rawData.sig || rawData.signature || 'Secp256k1 on-chain assertion'}</div>
      </div>
    `;
    container.appendChild(sigSection);
  }

  // 5. MESSAGE BODY / EXTRA ATTACHMENTS
  if (rawData.message || rawData.text || rawData.body) {
    const messageSection = document.createElement('div');
    messageSection.className = "space-y-2";
    messageSection.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-300 tracking-wider">
        <i data-lucide="message-square" class="h-4 w-4"></i> Decoded Message
      </div>
      <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans">
        ${rawData.message || rawData.text || rawData.body}
      </div>
    `;
    container.appendChild(messageSection);
  }

  // 6. RAW JSON DATA VIEW
  if (filters.showRaw) {
    const rawSection = document.createElement('div');
    rawSection.className = "space-y-2";
    rawSection.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 tracking-wider">
        <i data-lucide="code" class="h-4 w-4"></i> Raw P2FK JSON
      </div>
      <pre class="bg-slate-950 text-[10px] p-3 rounded-xl border border-slate-800 overflow-x-auto max-h-48 text-emerald-400 font-mono">${JSON.stringify(rawData, null, 2)}</pre>
    `;
    container.appendChild(rawSection);
  }

  inspectorBody.appendChild(container);

  // Initialize newly added icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
