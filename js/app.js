// App bootstrap and navigation management
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Handle Tab Navigation
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      // Update active nav-tab styling
      navTabs.forEach(t => {
        t.classList.remove('text-indigo-500', 'font-bold');
        t.classList.add('text-slate-400');
      });
      tab.classList.remove('text-slate-400');
      tab.classList.add('text-indigo-500', 'font-bold');

      // Update tab content visibility
      tabContents.forEach(content => {
        if (content.id === `tab-${targetTab}`) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });
    });
  });

  // Handle Network Toggle
  const networkToggle = document.getElementById('network-toggle');
  const networkLabel = document.getElementById('network-label');
  let currentNetwork = localStorage.getItem('sup_network') || 'TESTNET';

  function updateNetworkUI() {
    if (currentNetwork === 'MAINNET') {
      networkToggle.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm bg-orange-950/40 text-orange-400 border-orange-500/50 glow-mainnet";
      networkToggle.querySelector('span').className = "h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse";
      networkLabel.textContent = 'MAINNET';
    } else {
      networkToggle.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm bg-green-950/40 text-green-400 border-green-500/50 glow-testnet";
      networkToggle.querySelector('span').className = "h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse";
      networkLabel.textContent = 'TESTNET';
    }
  }

  networkToggle.addEventListener('click', () => {
    currentNetwork = currentNetwork === 'TESTNET' ? 'MAINNET' : 'TESTNET';
    localStorage.setItem('sup_network', currentNetwork);
    updateNetworkUI();
    // Dispatch custom event for modules to update
    window.dispatchEvent(new CustomEvent('networkChanged', { detail: currentNetwork }));
  });

  updateNetworkUI();
});
