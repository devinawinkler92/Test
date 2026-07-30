/**
 * Etch / Minting Module for P2FK.
 * Creates compliant JSON structures for:
 * - Public/Private Messages
 * - Profile Registration
 * - Digital Object (NFT) minting
 * Shows raw generated payload and handles signing/broadcasting online or offline.
 */

const btnEtchMsg = document.getElementById('btn-etch-msg');
const btnEtchProfile = document.getElementById('btn-etch-profile');
const btnEtchObject = document.getElementById('btn-etch-object');

const formMessage = document.getElementById('form-message');
const formProfile = document.getElementById('form-profile');
const formObject = document.getElementById('form-object');

const etchForm = document.getElementById('etch-form');
const btnGenerateP2FK = document.getElementById('btn-generate-p2fk');
const p2fkPayloadBox = document.getElementById('p2fk-payload-box');
const p2fkPayloadJson = document.getElementById('p2fk-payload-json');
const btnClosePayload = document.getElementById('btn-close-payload');

let activeType = 'MESSAGE'; // MESSAGE, PROFILE, OBJECT

document.addEventListener('DOMContentLoaded', () => {
  // Navigation tabs for form
  btnEtchMsg.addEventListener('click', () => switchFormType('MESSAGE'));
  btnEtchProfile.addEventListener('click', () => switchFormType('PROFILE'));
  btnEtchObject.addEventListener('click', () => switchFormType('OBJECT'));

  btnGenerateP2FK.addEventListener('click', () => {
    const payload = constructPayload();
    p2fkPayloadJson.textContent = JSON.stringify(payload, null, 2);
    p2fkPayloadBox.classList.remove('hidden');
  });

  btnClosePayload.addEventListener('click', () => {
    p2fkPayloadBox.classList.add('hidden');
  });

  etchForm.addEventListener('submit', handleEtchSubmit);
});

function switchFormType(type) {
  activeType = type;
  p2fkPayloadBox.classList.add('hidden');

  // Toggle active styling
  [btnEtchMsg, btnEtchProfile, btnEtchObject].forEach(btn => {
    btn.className = "flex-1 py-2 text-center rounded-lg text-slate-400 hover:text-slate-200 transition-all";
  });

  if (type === 'MESSAGE') {
    btnEtchMsg.className = "flex-1 py-2 text-center rounded-lg bg-indigo-600 text-white transition-all";
    formMessage.classList.remove('hidden');
    formProfile.classList.add('hidden');
    formObject.classList.add('hidden');
  } else if (type === 'PROFILE') {
    btnEtchProfile.className = "flex-1 py-2 text-center rounded-lg bg-indigo-600 text-white transition-all";
    formMessage.classList.add('hidden');
    formProfile.classList.remove('hidden');
    formObject.classList.add('hidden');
  } else if (type === 'OBJECT') {
    btnEtchObject.className = "flex-1 py-2 text-center rounded-lg bg-indigo-600 text-white transition-all";
    formMessage.classList.add('hidden');
    formProfile.classList.add('hidden');
    formObject.classList.remove('hidden');
  }
}

/**
 * Build the P2FK standard compliant JSON object structure
 */
function constructPayload() {
  const activeWif = sessionStorage.getItem('active_wif');
  const activeAddress = sessionStorage.getItem('active_address') || 'Offline Session (Unsigned)';

  const payload = {
    protocol: 'P2FK',
    version: '1.0',
    timestamp: Date.now(),
    signer: activeAddress
  };

  if (activeType === 'MESSAGE') {
    payload.type = 'MSG';
    payload.recipient = document.getElementById('msg-recipient').value.trim() || 'PUBLIC';
    payload.keywords = document.getElementById('msg-keywords').value.trim().split(' ').filter(k => k.length > 0);
    payload.message = document.getElementById('msg-body').value.trim();
  } else if (activeType === 'PROFILE') {
    payload.type = 'PRO';
    payload.urn = document.getElementById('pro-urn').value.trim();
    payload.name = document.getElementById('pro-name').value.trim();
    payload.pfp = document.getElementById('pro-pfp').value.trim();
    payload.bio = document.getElementById('pro-bio').value.trim();
  } else if (activeType === 'OBJECT') {
    payload.type = 'OBJ';
    payload.objectName = document.getElementById('obj-name').value.trim();
    payload.urn = document.getElementById('obj-urn').value.trim();
    payload.qty = parseInt(document.getElementById('obj-qty').value) || 1;
    payload.royalties = document.getElementById('obj-royalties').value.trim();
  }

  // If wallet is unlocked, sign the payload using browser cryptographic keys
  if (activeWif) {
    // Generate simple standard HMAC/ECDSA mock assertions for browser demo
    payload.sig = CryptoJS.HmacSHA256(JSON.stringify(payload), activeWif).toString();
  }

  return payload;
}

/**
 * Handle broadcast submission
 */
async function handleEtchSubmit(e) {
  e.preventDefault();

  const payload = constructPayload();
  const isTestnet = (localStorage.getItem('sup_network') || 'TESTNET') === 'TESTNET';
  const nodeUrl = isTestnet
    ? (localStorage.getItem('sup_api_testnet') || 'https://p2fk.io')
    : (localStorage.getItem('sup_api_mainnet') || 'https://p2fk.io');

  try {
    alert(`Signing and preparing transaction payloads...\n\nBroadcasting to API Node: ${nodeUrl}\n\nTransaction ID (Simulated): \n${CryptoJS.SHA256(JSON.stringify(payload)).toString()}`);

    // In live network environment, the client pushes raw hex payload or registers metadata via p2fk.io endpoint
    const endpoint = `${nodeUrl}/ipfs`; // endpoint accepting ingress payloads

    // Convert payload to file blob
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', blob, 'p2fk_etch.json');

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      mode: 'cors'
    });

    if (response.ok) {
      const data = await response.json();
      alert(`Success! P2FK fossil uploaded and pinned to IPFS.\n\nCID: ${data.cid || data.Hash}`);
    } else {
      throw new Error("Relay node refused payload stream.");
    }
  } catch (err) {
    console.warn("Broadcasting offline or node unreachable. Presenting raw transmission hex:", err);
    // Offline Broadcast options
    const payloadStr = JSON.stringify(payload);
    const hex = toHex(payloadStr);

    const instruct = `Relay Node Unreachable (Broadcasting offline).\n\nPlease write this hex payload directly into your offline Hard-drive Bitcoin core node terminal:\n\nbitcoin-cli -testnet signrawtransactionwithwallet "${hex}"`;
    prompt(instruct, hex);
  }
}

function toHex(str) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += str.charCodeAt(i).toString(16);
  }
  return result;
}
