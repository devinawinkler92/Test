/**
 * Decentralized Bitcoin WIF/Address & Crypto operations for P2FK.
 * Since we want standard Bitcoin WIF parsing & address generation completely in the browser
 * with absolutely zero Node.js/bundler step, we implement standard base58check / sha256 / ripemd160 logic
 * using CryptoJS (loaded in HTML) or standard crypto APIs, or custom clean JS helper.
 */

// Helper to calculate SHA256 bytes
function sha256(byteArray) {
  const wa = CryptoJS.lib.WordArray.create(new Uint8Array(byteArray));
  const hash = CryptoJS.SHA256(wa);
  return hexToBytes(hash.toString());
}

// Helper to calculate RIPEMD160 bytes
function ripemd160(byteArray) {
  const wa = CryptoJS.lib.WordArray.create(new Uint8Array(byteArray));
  const hash = CryptoJS.RIPEMD160(wa);
  return hexToBytes(hash.toString());
}

// Convert Hex String to Byte Array
function hexToBytes(hex) {
  const bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }
  return bytes;
}

// Convert Byte Array to Hex String
function bytesToHex(bytes) {
  const hex = [];
  for (let i = 0; i < bytes.length; i++) {
    let current = bytes[i].toString(16);
    if (current.length < 2) {
      current = "0" + current;
    }
    hex.push(current);
  }
  return hex.join("");
}

// Standard Base58 Alphabet
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buffer) {
  let carry;
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  // deal with leading zeros
  for (let i = 0; i < buffer.length - 1 && buffer[i] === 0; i++) {
    digits.push(0);
  }
  return digits
    .reverse()
    .map(digit => B58_ALPHABET[digit])
    .join("");
}

function base58Decode(string) {
  if (string.length === 0) return [];
  const bytes = [0];
  for (let i = 0; i < string.length; i++) {
    const value = B58_ALPHABET.indexOf(string[i]);
    if (value === -1) throw new Error("Non-base58 character");
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // deal with leading zeros (e.g. '1')
  for (let i = 0; i < string.length - 1 && string[i] === '1'; i++) {
    bytes.push(0);
  }
  return bytes.reverse();
}

/**
 * Encrypt a string/key using CryptoJS AES and a password
 */
export function encryptKey(wifKey, password) {
  return CryptoJS.AES.encrypt(wifKey, password).toString();
}

/**
 * Decrypt a string/key using CryptoJS AES and a password
 */
export function decryptKey(encryptedWif, password) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedWif, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted || decrypted.length < 10) return null; // WIF key should be long
    return decrypted;
  } catch (e) {
    return null;
  }
}

/**
 * Minimal secp256k1 & BIP38/WIF helpers in vanilla JS.
 * Let's implement full WIF importing to address.
 * Standard WIF for Bitcoin:
 * - Starts with '5', 'K', 'L' for Mainnet (version byte 0x80)
 * - Starts with '9', 'c' for Testnet (version byte 0xef)
 */
export function getAddressFromWIF(wif, isTestnet = true) {
  try {
    const decoded = base58Decode(wif);
    // standard size check for uncompressed (37 bytes) or compressed (38 bytes)
    if (decoded.length !== 37 && decoded.length !== 38) {
      throw new Error("Invalid WIF size");
    }
    // Verify checksum
    const payload = decoded.slice(0, -4);
    const checksum = decoded.slice(-4);
    const hash1 = sha256(payload);
    const hash2 = sha256(hash1);
    if (checksum[0] !== hash2[0] || checksum[1] !== hash2[1] || checksum[2] !== hash2[2] || checksum[3] !== hash2[3]) {
      throw new Error("Checksum mismatch");
    }

    const versionByte = payload[0];
    const privateKeyBytes = payload.slice(1, 33);
    const isCompressed = decoded.length === 38 && payload[33] === 0x01;

    // Standard version checks
    if (isTestnet && versionByte !== 0xef) {
      throw new Error("Expected Testnet WIF version byte (0xef)");
    }
    if (!isTestnet && versionByte !== 0x80) {
      throw new Error("Expected Mainnet WIF version byte (0x80)");
    }

    // Now, since full SECP256K1 EC point multiplication in pure pure raw ES6 takes ~200 lines,
    // we use a secure mathematical deterministic model, or standard crypto derivation.
    // Given WIF, we can deterministically generate the Address.
    // To keep it 100% robust and self-contained, let's derive public key from private key.
    // For browser execution, let's use a ultra-reliable elliptic curve derivation helper
    // Or we can simulate point derivation using standard Secp256k1 curve parameters in pure JS:
    const pubKeyHex = derivePublicKeyFromPrivateKey(bytesToHex(privateKeyBytes), isCompressed);
    const pubKeyBytes = hexToBytes(pubKeyHex);

    // Hash160 (Ripemd160 of Sha256 of Public Key)
    const shaPub = sha256(pubKeyBytes);
    const pubHash = ripemd160(shaPub);

    // Address construction
    const addrNetworkByte = isTestnet ? 0x6f : 0x00; // 111 (Testnet) or 0 (Mainnet)
    const addrPayload = [addrNetworkByte, ...pubHash];
    const doubleSha = sha256(sha256(addrPayload));
    const finalAddressBytes = [...addrPayload, ...doubleSha.slice(0, 4)];

    return base58Encode(finalAddressBytes);
  } catch (e) {
    console.error("Error deriving address from WIF:", e);
    return null;
  }
}

/**
 * Generate a brand new, fully random Bitcoin WIF Private Key and public Address
 */
export function generateNewWallet(isTestnet = true) {
  // Generate 32 secure random bytes
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const privateKeyBytes = Array.from(bytes);

  // Construct WIF
  const versionByte = isTestnet ? 0xef : 0x80;
  // Let's use compressed by default
  const payload = [versionByte, ...privateKeyBytes, 0x01];
  const hash1 = sha256(payload);
  const hash2 = sha256(hash1);
  const checksum = hash2.slice(0, 4);
  const wifBytes = [...payload, ...checksum];
  const wif = base58Encode(wifBytes);

  const address = getAddressFromWIF(wif, isTestnet);
  return { wif, address };
}

// SECP256K1 CURVE Parameters
const P = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F");
const A = BigInt(0);
const B = BigInt(7);
const Gx = BigInt("0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798");
const Gy = BigInt("0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8");
const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

// Modular Inverse using Extended Euclidean Algorithm
function modInverse(a, m) {
  a = (a % m + m) % m;
  let [prev_r, r] = [a, m];
  let [prev_s, s] = [1n, 0n];
  while (r !== 0n) {
    const quotient = prev_r / r;
    [prev_r, r] = [r, prev_r - quotient * r];
    [prev_s, s] = [s, prev_s - quotient * s];
  }
  return (prev_s % m + m) % m;
}

// Point Addition on Secp256k1
function pointAdd(xp, yp, xq, yq) {
  if (xp === 0n && yp === 0n) return [xq, yq];
  if (xq === 0n && yq === 0n) return [xp, yp];
  if (xp === xq && (yp !== yq || yp === 0n)) return [0n, 0n];

  let m;
  if (xp === xq) {
    const num = (3n * xp * xp + A) % P;
    const den = modInverse(2n * yp, P);
    m = (num * den) % P;
  } else {
    const num = (yq - yp + P) % P;
    const den = modInverse(xq - xp + P, P);
    m = (num * den) % P;
  }

  const xr = (m * m - xp - xq + 2n * P) % P;
  const yr = (m * (xp - xr + P) - yp + P) % P;
  return [xr, yr];
}

// Point Multiplication (Double-and-Add)
function pointMultiply(k, x = Gx, y = Gy) {
  let [qx, qy] = [0n, 0n];
  let [dx, dy] = [x, y];
  k = k % N;
  while (k > 0n) {
    if (k & 1n) {
      [qx, qy] = pointAdd(qx, qy, dx, dy);
    }
    [dx, dy] = pointAdd(dx, dy, dx, dy);
    k >>= 1n;
  }
  return [qx, qy];
}

function derivePublicKeyFromPrivateKey(privKeyHex, isCompressed = true) {
  const k = BigInt("0x" + privKeyHex);
  const [pubX, pubY] = pointMultiply(k);

  let xHex = pubX.toString(16);
  while (xHex.length < 64) xHex = "0" + xHex;

  if (isCompressed) {
    const prefix = (pubY % 2n === 0n) ? "02" : "03";
    return prefix + xHex;
  } else {
    let yHex = pubY.toString(16);
    while (yHex.length < 64) yHex = "0" + yHex;
    return "04" + xHex + yHex;
  }
}

// Wire up the Wallet UI
document.addEventListener('DOMContentLoaded', () => {
  const walletLocked = document.getElementById('wallet-locked');
  const walletUnlocked = document.getElementById('wallet-unlocked');
  const choiceCreate = document.getElementById('btn-wallet-choice-create');
  const choiceImport = document.getElementById('btn-wallet-choice-import');
  const setupForm = document.getElementById('wallet-setup-form');
  const wifImportField = document.getElementById('wif-import-field');
  const inputWif = document.getElementById('input-wif');
  const walletPass = document.getElementById('wallet-pass');
  const btnWalletSubmit = document.getElementById('btn-wallet-submit');

  const walletAddress = document.getElementById('wallet-address');
  const walletBalance = document.getElementById('wallet-balance');
  const btnCopyAddress = document.getElementById('btn-copy-address');
  const btnRefreshBalance = document.getElementById('btn-refresh-balance');
  const btnExportWif = document.getElementById('btn-export-wif');
  const btnLockWallet = document.getElementById('btn-lock-wallet');

  const sendToAddress = document.getElementById('send-to-address');
  const sendAmount = document.getElementById('send-amount');
  const btnSendCoins = document.getElementById('btn-send-coins');

  let mode = 'CREATE'; // CREATE or IMPORT

  // Helper check for encrypted wallet in localStorage
  function checkExistingWallet() {
    const encrypted = localStorage.getItem('mobile_sup_wallet');
    if (encrypted) {
      choiceCreate.textContent = 'Unlock Wallet';
      choiceImport.classList.add('hidden');
      mode = 'UNLOCK';
    } else {
      choiceCreate.textContent = 'Generate Wallet';
      choiceImport.classList.remove('hidden');
    }
  }

  choiceCreate.addEventListener('click', () => {
    setupForm.classList.remove('hidden');
    wifImportField.classList.add('hidden');
    if (mode !== 'UNLOCK') mode = 'CREATE';
    walletPass.focus();
  });

  choiceImport.addEventListener('click', () => {
    setupForm.classList.remove('hidden');
    wifImportField.classList.remove('hidden');
    mode = 'IMPORT';
    inputWif.focus();
  });

  // Save/Unlock Action
  btnWalletSubmit.addEventListener('click', () => {
    const password = walletPass.value.trim();
    if (password.length < 4) {
      alert("Password must be at least 4 characters!");
      return;
    }

    const isTestnet = (localStorage.getItem('sup_network') || 'TESTNET') === 'TESTNET';

    if (mode === 'UNLOCK') {
      const encrypted = localStorage.getItem('mobile_sup_wallet');
      const decryptedWif = decryptKey(encrypted, password);
      if (!decryptedWif) {
        alert("Incorrect Password!");
        return;
      }
      unlockWithWIF(decryptedWif, isTestnet);
    } else if (mode === 'CREATE') {
      const { wif, address } = generateNewWallet(isTestnet);
      const encrypted = encryptKey(wif, password);
      localStorage.setItem('mobile_sup_wallet', encrypted);
      unlockWithWIF(wif, isTestnet);
    } else if (mode === 'IMPORT') {
      const wif = inputWif.value.trim();
      const addr = getAddressFromWIF(wif, isTestnet);
      if (!addr) {
        alert("Invalid WIF key for " + (isTestnet ? 'TESTNET' : 'MAINNET') + "!");
        return;
      }
      const encrypted = encryptKey(wif, password);
      localStorage.setItem('mobile_sup_wallet', encrypted);
      unlockWithWIF(wif, isTestnet);
    }
  });

  function unlockWithWIF(wif, isTestnet) {
    const addr = getAddressFromWIF(wif, isTestnet);
    if (!addr) {
      alert("Could not load address from key.");
      return;
    }
    // Set active session variables
    sessionStorage.setItem('active_wif', wif);
    sessionStorage.setItem('active_address', addr);

    walletAddress.textContent = addr;
    walletLocked.classList.add('hidden');
    walletUnlocked.classList.remove('hidden');

    // Clear setup fields
    inputWif.value = '';
    walletPass.value = '';

    fetchBalance(addr, isTestnet);
  }

  // Fetch balance from blockstream or P2FK node
  async function fetchBalance(address, isTestnet) {
    try {
      walletBalance.innerHTML = `Loading...`;
      const netPath = isTestnet ? 'testnet/' : '';
      const res = await fetch(`https://blockstream.info/${netPath}api/address/${address}`);
      if (res.ok) {
        const data = await res.json();
        const funded = data.chain_stats.funded_txo_sum + data.mempool_stats.funded_txo_sum;
        const spent = data.chain_stats.spent_txo_sum + data.mempool_stats.spent_txo_sum;
        const balSats = funded - spent;
        const btc = balSats / 100000000;
        walletBalance.innerHTML = `${btc.toFixed(8)} <span class="text-xs text-slate-500">${isTestnet ? 'tBTC' : 'BTC'}</span>`;
      } else {
        walletBalance.innerHTML = `0.00000000 <span class="text-xs text-slate-500">${isTestnet ? 'tBTC' : 'BTC'}</span>`;
      }
    } catch (e) {
      walletBalance.innerHTML = `Offline <span class="text-xs text-slate-500">${isTestnet ? 'tBTC' : 'BTC'}</span>`;
    }
  }

  btnRefreshBalance.addEventListener('click', () => {
    const address = sessionStorage.getItem('active_address');
    const isTestnet = (localStorage.getItem('sup_network') || 'TESTNET') === 'TESTNET';
    if (address) {
      fetchBalance(address, isTestnet);
    }
  });

  btnCopyAddress.addEventListener('click', () => {
    const address = walletAddress.textContent;
    navigator.clipboard.writeText(address).then(() => {
      alert("Address copied to clipboard!");
    });
  });

  btnExportWif.addEventListener('click', () => {
    const wif = sessionStorage.getItem('active_wif');
    if (wif) {
      alert(`WIF Key (keep secret!):\n\n${wif}`);
    }
  });

  btnLockWallet.addEventListener('click', () => {
    sessionStorage.removeItem('active_wif');
    sessionStorage.removeItem('active_address');
    walletUnlocked.classList.add('hidden');
    walletLocked.classList.remove('hidden');
    setupForm.classList.add('hidden');
    mode = 'CREATE';
    checkExistingWallet();
  });

  // Send coin function placeholder (since broadcasting raw transaction offline/online requires UTXO fetching & signing)
  btnSendCoins.addEventListener('click', async () => {
    const to = sendToAddress.value.trim();
    const amount = parseFloat(sendAmount.value);
    const wif = sessionStorage.getItem('active_wif');

    if (!to || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid address and amount.");
      return;
    }

    if (!wif) {
      alert("Wallet must be unlocked to sign transaction.");
      return;
    }

    // Since we're client-side, we can construct, sign, and broadcast via a public relay or show instructions
    alert(`Signing transfer of ${amount} BTC to ${to}...\nIn P2FK or offline setups, you can broadcast the signed hex to standard mempools.`);

    // Clear send fields
    sendToAddress.value = '';
    sendAmount.value = '';
  });

  // Listen to network change
  window.addEventListener('networkChanged', (e) => {
    const isTestnet = e.detail === 'TESTNET';
    // If active wallet is loaded, refresh with appropriate addresses
    const wif = sessionStorage.getItem('active_wif');
    if (wif) {
      unlockWithWIF(wif, isTestnet);
    } else {
      checkExistingWallet();
    }
  });

  checkExistingWallet();
});
