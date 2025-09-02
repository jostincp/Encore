// Encore Application JavaScript - Final Fixed Version

// Application Data
const appData = {
  songs: [
    {"id": 1, "title": "Blinding Lights", "artist": "The Weeknd", "duration": "3:20", "genre": "Pop", "cost": 50, "popularity": 95},
    {"id": 2, "title": "Shape of You", "artist": "Ed Sheeran", "duration": "3:53", "genre": "Pop", "cost": 40, "popularity": 90},
    {"id": 3, "title": "Despacito", "artist": "Luis Fonsi ft. Daddy Yankee", "duration": "3:47", "genre": "Reggaeton", "cost": 45, "popularity": 88},
    {"id": 4, "title": "Bohemian Rhapsody", "artist": "Queen", "duration": "5:55", "genre": "Rock", "cost": 60, "popularity": 92},
    {"id": 5, "title": "Hotel California", "artist": "Eagles", "duration": "6:30", "genre": "Rock", "cost": 55, "popularity": 85},
    {"id": 6, "title": "Thinking Out Loud", "artist": "Ed Sheeran", "duration": "4:41", "genre": "Pop", "cost": 35, "popularity": 82},
    {"id": 7, "title": "Uptown Funk", "artist": "Mark Ronson ft. Bruno Mars", "duration": "4:30", "genre": "Funk", "cost": 50, "popularity": 89},
    {"id": 8, "title": "Someone Like You", "artist": "Adele", "duration": "4:45", "genre": "Pop", "cost": 40, "popularity": 87},
    {"id": 9, "title": "Lose Yourself", "artist": "Eminem", "duration": "5:26", "genre": "Hip Hop", "cost": 45, "popularity": 86},
    {"id": 10, "title": "Perfect", "artist": "Ed Sheeran", "duration": "4:23", "genre": "Pop", "cost": 40, "popularity": 84}
  ],
  menuItems: [
    {"id": 1, "name": "Cerveza Artesanal IPA", "category": "Bebidas", "price": 120, "points": 20, "description": "Cerveza artesanal con lúpulo premium", "image3d": "🍺", "popular": true},
    {"id": 2, "name": "Mojito Clásico", "category": "Cócteles", "price": 180, "points": 30, "description": "Ron blanco, menta, lima y soda", "image3d": "🍹", "popular": true},
    {"id": 3, "name": "Hamburguesa Gourmet", "category": "Comida", "price": 280, "points": 50, "description": "Carne angus, queso cheddar, tocino", "image3d": "🍔", "popular": false},
    {"id": 4, "name": "Whisky On The Rocks", "category": "Bebidas", "price": 220, "points": 40, "description": "Whisky escocés premium con hielo", "image3d": "🥃", "popular": false},
    {"id": 5, "name": "Nachos Supreme", "category": "Comida", "price": 160, "points": 25, "description": "Nachos con queso, jalapeños y guacamole", "image3d": "🌮", "popular": true},
    {"id": 6, "name": "Margarita Premium", "category": "Cócteles", "price": 200, "points": 35, "description": "Tequila blanco, triple sec, lima", "image3d": "🍸", "popular": true}
  ],
  userData: {
    "name": "Carlos Rodriguez",
    "points": 185,
    "table_number": 7,
    "session_purchases": 2,
    "favorite_genres": ["Pop", "Rock", "Reggaeton"]
  },
  queueData: [
    {"id": 1, "song": "Blinding Lights", "artist": "The Weeknd", "user": "Mesa 3", "priority": "high", "time_added": "2:34 PM"},
    {"id": 2, "song": "Despacito", "artist": "Luis Fonsi", "user": "Mesa 7", "priority": "normal", "time_added": "2:36 PM"},
    {"id": 3, "song": "Bohemian Rhapsody", "artist": "Queen", "user": "Mesa 12", "priority": "normal", "time_added": "2:38 PM"}
  ],
  barStats: {
    "active_tables": 15,
    "total_songs_played": 47,
    "revenue_today": 2840,
    "top_genre": "Pop",
    "avg_wait_time": "8 min"
  }
};

// Application State
let currentRole = null;
let personalQueue = [];
let cart = [];
let filteredSongs = [...appData.songs];
let filteredMenuItems = [...appData.menuItems];

// Global Functions (available in HTML)
window.goToHome = function() {
  console.log('Going to home...');
  currentRole = null;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('landing-page').classList.add('active');
  showToast('Regresando al inicio', 'info');
};

window.selectRole = function(role) {
  console.log('Role selected:', role);
  currentRole = role;
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  if (role === 'cliente') {
    document.getElementById('cliente-page').classList.add('active');
    setTimeout(() => {
      initMobileNavigation();
      initClientFeatures();
    }, 100);
  } else if (role === 'admin') {
    document.getElementById('admin-page').classList.add('active');
    setTimeout(() => {
      initAdminNavigation();
      initAdminFeatures();
    }, 100);
  }
  
  showToast(`Bienvenido al panel de ${role}`, 'success');
};

// Utility Functions
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s reverse';
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

function formatCurrency(amount) {
  return `$${amount.toLocaleString()}`;
}

// Initialize Role Selection
function initRoleSelection() {
  console.log('Initializing role selection...');
  
  // Wait for DOM to be fully loaded
  setTimeout(() => {
    const roleCards = document.querySelectorAll('.role-card');
    console.log('Found role cards:', roleCards.length);
    
    roleCards.forEach((card, index) => {
      console.log(`Setting up role card ${index}:`, card.dataset.role);
      
      // Use addEventListener with proper scope
      card.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const role = this.dataset.role;
        console.log('Role card clicked:', role);
        selectRole(role);
      });
      
      // Also add keyboard support
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
    });
  }, 100);
}

// Mobile Navigation
function initMobileNavigation() {
  console.log('Initializing mobile navigation...');
  
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.mobile-section');
  
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const targetSection = this.dataset.section;
      console.log('Mobile nav clicked:', targetSection);
      
      // Update navigation
      navItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
      
      // Update sections
      sections.forEach(section => section.classList.remove('active'));
      const targetSectionEl = document.querySelector(`[data-section="${targetSection}"]`);
      if (targetSectionEl) {
        targetSectionEl.classList.add('active');
      }
    });
  });
}

// Admin Navigation
function initAdminNavigation() {
  console.log('Initializing admin navigation...');
  
  const adminNavItems = document.querySelectorAll('.admin-nav-item');
  const adminSections = document.querySelectorAll('.admin-section');
  
  adminNavItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const targetSection = this.dataset.adminSection;
      console.log('Admin nav clicked:', targetSection);
      
      // Update navigation
      adminNavItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
      
      // Update sections
      adminSections.forEach(section => section.classList.remove('active'));
      const targetSectionEl = document.querySelector(`[data-admin-section="${targetSection}"]`);
      if (targetSectionEl) {
        targetSectionEl.classList.add('active');
      }
    });
  });
}

// Client Features
function initClientFeatures() {
  console.log('Initializing client features...');
  initQRScanner();
  initSongSearch();
  initMenuSearch();
  initPointsSystem();
  renderSongsList();
  renderMenuItems();
  renderPersonalQueue();
  updatePointsDisplay();
}

function initQRScanner() {
  const simulateBtn = document.querySelector('.simulate-scan');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showToast('QR escaneado correctamente! 🎵');
      
      // Switch to search section after scan
      setTimeout(() => {
        const searchNavItem = document.querySelector('[data-section="buscar"]');
        if (searchNavItem) {
          searchNavItem.click();
        }
      }, 1000);
    });
  }
}

function initSongSearch() {
  const searchInput = document.querySelector('.search-input');
  const genreButtons = document.querySelectorAll('.genre-btn');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      filterSongs(query, getActiveGenre());
    });
  }
  
  genreButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      genreButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      const genre = this.dataset.genre;
      const query = searchInput ? searchInput.value.toLowerCase() : '';
      filterSongs(query, genre);
    });
  });
}

function filterSongs(query = '', genre = 'all') {
  filteredSongs = appData.songs.filter(song => {
    const matchesQuery = song.title.toLowerCase().includes(query) || 
                        song.artist.toLowerCase().includes(query);
    const matchesGenre = genre === 'all' || song.genre === genre;
    return matchesQuery && matchesGenre;
  });
  
  renderSongsList();
}

function getActiveGenre() {
  const activeBtn = document.querySelector('.genre-btn.active');
  return activeBtn ? activeBtn.dataset.genre : 'all';
}

function renderSongsList() {
  const songsList = document.getElementById('songs-list');
  if (!songsList) return;
  
  songsList.innerHTML = '';
  
  filteredSongs.forEach(song => {
    const songCard = document.createElement('div');
    songCard.className = 'song-card';
    songCard.innerHTML = `
      <div class="song-header">
        <div class="song-info">
          <h4>${song.title}</h4>
          <div class="artist">${song.artist}</div>
        </div>
        <div class="song-cost">${song.cost} pts</div>
      </div>
      <div class="song-meta">
        <div>
          <span class="song-duration">${song.duration}</span>
          <span class="song-genre"> • ${song.genre}</span>
        </div>
        <button type="button" class="add-to-queue" data-song-id="${song.id}">
          Agregar a Cola
        </button>
      </div>
    `;
    
    songsList.appendChild(songCard);
  });
  
  // Add event listeners for add to queue buttons
  document.querySelectorAll('.add-to-queue').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const songId = parseInt(this.dataset.songId);
      addToPersonalQueue(songId);
    });
  });
}

function addToPersonalQueue(songId) {
  const song = appData.songs.find(s => s.id === songId);
  if (!song) return;
  
  if (appData.userData.points < song.cost) {
    showToast('No tienes suficientes puntos', 'error');
    return;
  }
  
  const queueItem = {
    id: Date.now(),
    song: song.title,
    artist: song.artist,
    duration: song.duration,
    cost: song.cost,
    addedAt: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  };
  
  personalQueue.push(queueItem);
  appData.userData.points -= song.cost;
  
  renderPersonalQueue();
  updatePointsDisplay();
  showToast(`"${song.title}" agregada a tu cola`);
}

function renderPersonalQueue() {
  const queueContainer = document.getElementById('personal-queue');
  if (!queueContainer) return;
  
  queueContainer.innerHTML = '';
  
  if (personalQueue.length === 0) {
    queueContainer.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); padding: 2rem;">Tu cola está vacía. ¡Agrega algunas canciones!</p>';
    updateQueueStats(0, 0);
    return;
  }
  
  personalQueue.forEach((item, index) => {
    const queueItem = document.createElement('div');
    queueItem.className = 'queue-item';
    queueItem.innerHTML = `
      <div class="queue-position">${index + 1}</div>
      <div class="queue-song-title">${item.song}</div>
      <div class="queue-artist">${item.artist}</div>
      <div class="queue-meta">
        <span>Agregada a las ${item.addedAt}</span>
        <span>${item.duration}</span>
      </div>
    `;
    
    queueContainer.appendChild(queueItem);
  });
  
  // Update queue stats
  const totalTime = personalQueue.reduce((acc, item) => {
    const [min, sec] = item.duration.split(':').map(Number);
    return acc + min + (sec / 60);
  }, 0);
  
  updateQueueStats(personalQueue.length, Math.round(totalTime));
}

function updateQueueStats(songCount, totalTime) {
  const queueStats = document.querySelector('.queue-stats span');
  if (queueStats) {
    queueStats.textContent = `${songCount} canciones | Tiempo estimado: ${totalTime} min`;
  }
}

function initMenuSearch() {
  const menuFilterButtons = document.querySelectorAll('.menu-filter-btn');
  
  menuFilterButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      menuFilterButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      const category = this.dataset.category;
      filterMenuItems(category);
    });
  });
}

function filterMenuItems(category = 'all') {
  filteredMenuItems = category === 'all' 
    ? [...appData.menuItems]
    : appData.menuItems.filter(item => item.category === category);
  
  renderMenuItems();
}

function renderMenuItems() {
  const menuContainer = document.getElementById('menu-items');
  if (!menuContainer) return;
  
  menuContainer.innerHTML = '';
  
  filteredMenuItems.forEach(item => {
    const menuCard = document.createElement('div');
    menuCard.className = 'menu-card';
    menuCard.innerHTML = `
      <div class="menu-image">
        ${item.image3d}
        ${item.popular ? '<div class="popular-badge">Popular</div>' : ''}
      </div>
      <div class="menu-content">
        <h4 class="menu-title">${item.name}</h4>
        <p class="menu-description">${item.description}</p>
        <div class="menu-footer">
          <div>
            <div class="menu-price">${formatCurrency(item.price)}</div>
            <div class="menu-points">+${item.points} puntos</div>
          </div>
          <button type="button" class="add-to-cart" data-item-id="${item.id}">
            Agregar
          </button>
        </div>
      </div>
    `;
    
    menuContainer.appendChild(menuCard);
  });
  
  // Add event listeners for add to cart buttons
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const itemId = parseInt(this.dataset.itemId);
      addToCart(itemId);
    });
  });
}

function addToCart(itemId) {
  const item = appData.menuItems.find(i => i.id === itemId);
  if (!item) return;
  
  const existingItem = cart.find(c => c.id === itemId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  
  updateCartDisplay();
  showToast(`${item.name} agregado al carrito`);
}

function updateCartDisplay() {
  const cartButton = document.querySelector('.cart-button');
  if (!cartButton) return;
  
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  cartButton.innerHTML = `
    <span>🛒 Carrito (${totalItems})</span>
    <span class="cart-total">${formatCurrency(totalPrice)}</span>
  `;
  
  if (totalItems > 0) {
    cartButton.style.display = 'flex';
    cartButton.onclick = openCartModal;
  } else {
    cartButton.style.display = 'none';
  }
}

function openCartModal() {
  const modal = document.getElementById('cart-modal');
  const cartItems = document.getElementById('cart-items');
  
  if (!modal || !cartItems) return;
  
  cartItems.innerHTML = '';
  
  cart.forEach(item => {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--color-border);">
        <div>
          <div style="font-weight: 500;">${item.name}</div>
          <div style="color: var(--color-text-secondary); font-size: 0.875rem;">
            ${formatCurrency(item.price)} x ${item.quantity}
          </div>
        </div>
        <div style="font-weight: 600; color: var(--color-accent);">
          ${formatCurrency(item.price * item.quantity)}
        </div>
      </div>
    `;
    cartItems.appendChild(cartItem);
  });
  
  modal.classList.remove('hidden');
}

function initPointsSystem() {
  updatePointsDisplay();
  
  const confirmOrderBtn = document.getElementById('confirm-order');
  if (confirmOrderBtn) {
    confirmOrderBtn.addEventListener('click', confirmOrder);
  }
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('cart-modal').classList.add('hidden');
    });
  });
  
  // Add points redemption functionality
  const pointsActions = document.querySelector('.points-actions .btn');
  if (pointsActions) {
    pointsActions.addEventListener('click', function(e) {
      e.preventDefault();
      if (appData.userData.points >= 50) {
        appData.userData.points -= 50;
        showToast('¡50 puntos canjeados por una canción gratis!', 'success');
        updatePointsDisplay();
        addPointsHistory('-50 pts - Canje por canción', new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      } else {
        showToast('No tienes suficientes puntos', 'error');
      }
    });
  }
}

function confirmOrder() {
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const pointsEarned = cart.reduce((sum, item) => sum + (item.points * item.quantity), 0);
  
  appData.userData.points += pointsEarned;
  appData.userData.session_purchases += cart.length;
  
  updatePointsDisplay();
  cart = [];
  updateCartDisplay();
  
  document.getElementById('cart-modal').classList.add('hidden');
  showToast(`Pedido confirmado! +${pointsEarned} puntos ganados`, 'success');
  
  // Update history
  addPointsHistory(`+${pointsEarned} pts - Compra realizada`, new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
}

function updatePointsDisplay() {
  document.querySelectorAll('.points-display').forEach(display => {
    display.textContent = `⭐ ${appData.userData.points} puntos`;
  });
  
  const pointsNumber = document.querySelector('.points-number');
  if (pointsNumber) {
    pointsNumber.textContent = appData.userData.points;
  }
}

function addPointsHistory(action, time) {
  const historyContainer = document.querySelector('.points-history');
  if (!historyContainer) return;
  
  const historyItem = document.createElement('div');
  historyItem.className = 'history-item';
  historyItem.innerHTML = `
    <span>${action}</span>
    <span class="history-time">${time}</span>
  `;
  
  // Insert at the beginning after the h3
  const h3 = historyContainer.querySelector('h3');
  if (h3) {
    h3.insertAdjacentElement('afterend', historyItem);
  } else {
    historyContainer.appendChild(historyItem);
  }
  
  // Keep only last 5 items (excluding h3)
  const items = historyContainer.querySelectorAll('.history-item');
  if (items.length > 5) {
    historyContainer.removeChild(items[items.length - 1]);
  }
}

// Admin Features
function initAdminFeatures() {
  console.log('Initializing admin features...');
  initDashboard();
  initGlobalQueue();
  initStats();
  initMenuAdmin();
  renderAdminMenuItems();
}

function initDashboard() {
  // Update dashboard stats
  const statCards = document.querySelectorAll('.stat-card .stat-number');
  if (statCards.length >= 4) {
    statCards[0].textContent = appData.barStats.active_tables;
    statCards[1].textContent = appData.barStats.total_songs_played;
    statCards[2].textContent = formatCurrency(appData.barStats.revenue_today);
    statCards[3].textContent = appData.barStats.avg_wait_time;
  }
  
  // Initialize playback controls
  document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const symbol = this.textContent;
      switch(symbol) {
        case '⏸️':
          this.textContent = '▶️';
          showToast('Música pausada');
          break;
        case '▶️':
          this.textContent = '⏸️';
          showToast('Reproduciendo música');
          break;
        case '⏭️':
          showToast('Siguiente canción');
          break;
        case '⏮️':
          showToast('Canción anterior');
          break;
      }
    });
  });
}

function initGlobalQueue() {
  renderGlobalQueue();
  
  document.querySelectorAll('.queue-controls .btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const text = this.textContent;
      if (text.includes('Reproducir')) {
        showToast('Cola iniciada');
      } else if (text.includes('Pausar')) {
        showToast('Cola pausada');
      } else if (text.includes('Aleatorio')) {
        showToast('Modo aleatorio activado');
      }
    });
  });
}

function renderGlobalQueue() {
  const globalQueue = document.getElementById('global-queue');
  if (!globalQueue) return;
  
  globalQueue.innerHTML = '';
  
  appData.queueData.forEach((item, index) => {
    const queueItem = document.createElement('div');
    queueItem.className = 'queue-item';
    queueItem.innerHTML = `
      <div class="queue-position">${index + 1}</div>
      <div class="queue-song-title">${item.song}</div>
      <div class="queue-artist">${item.artist}</div>
      <div class="queue-meta">
        <span>Solicitada por ${item.user}</span>
        <span>${item.time_added}</span>
      </div>
      <div style="margin-top: 0.5rem;">
        <span class="status status--${item.priority === 'high' ? 'warning' : 'info'}" style="font-size: 0.75rem;">
          ${item.priority === 'high' ? 'Prioridad Alta' : 'Normal'}
        </span>
      </div>
    `;
    
    globalQueue.appendChild(queueItem);
  });
}

function initStats() {
  // Initialize Chart.js
  setTimeout(() => {
    const ctx = document.getElementById('revenueChart');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
          datasets: [{
            label: 'Ingresos Diarios',
            data: [1200, 1900, 3000, 2500, 2200, 3200, 2840],
            borderColor: '#8B5CF6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#f5f5f5'
              }
            }
          },
          scales: {
            y: {
              ticks: {
                color: '#a7a9a9',
                callback: function(value) {
                  return '$' + value.toLocaleString();
                }
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            },
            x: {
              ticks: {
                color: '#a7a9a9'
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            }
          }
        }
      });
    }
  }, 500);
}

function initMenuAdmin() {
  const addItemBtn = document.querySelector('.menu-admin-header .btn');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showToast('Función de agregar item disponible próximamente', 'info');
    });
  }
}

function renderAdminMenuItems() {
  const adminMenuGrid = document.getElementById('admin-menu-items');
  if (!adminMenuGrid) return;
  
  adminMenuGrid.innerHTML = '';
  
  appData.menuItems.forEach(item => {
    const adminCard = document.createElement('div');
    adminCard.className = 'card';
    adminCard.innerHTML = `
      <div class="card__body">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem;">${item.name}</h4>
            <div style="color: var(--color-text-secondary); font-size: 0.875rem;">${item.category}</div>
          </div>
          <div style="font-size: 2rem;">${item.image3d}</div>
        </div>
        <p style="color: var(--color-text-secondary); font-size: 0.875rem; margin-bottom: 1rem;">${item.description}</p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 1.25rem; font-weight: 600; color: var(--color-accent);">${formatCurrency(item.price)}</div>
            <div style="color: var(--color-text-secondary); font-size: 0.75rem;">+${item.points} puntos</div>
          </div>
          <div>
            <button type="button" class="btn btn--sm btn--outline admin-edit-btn" style="margin-right: 0.5rem;" data-item-id="${item.id}">Editar</button>
            <button type="button" class="btn btn--sm admin-delete-btn" style="background: var(--color-error); color: white;" data-item-id="${item.id}">Eliminar</button>
          </div>
        </div>
      </div>
    `;
    
    adminMenuGrid.appendChild(adminCard);
  });
  
  // Add event listeners for admin buttons
  document.querySelectorAll('#admin-menu-items .btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const action = this.textContent;
      showToast(`Función "${action}" disponible próximamente`, 'info');
    });
  });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing Encore application...');
  
  // Initialize role selection
  initRoleSelection();
  
  // Load saved data from localStorage
  const savedData = localStorage.getItem('encoreData');
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      if (parsed.points !== undefined) {
        appData.userData.points = parsed.points;
      }
    } catch (e) {
      console.log('No saved data found or invalid format');
    }
  }
  
  // Save data periodically
  setInterval(() => {
    try {
      localStorage.setItem('encoreData', JSON.stringify({
        points: appData.userData.points,
        personalQueue: personalQueue,
        cart: cart
      }));
    } catch (e) {
      console.log('Could not save to localStorage');
    }
  }, 5000);
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
      });
    }
  });
  
  // Add simulated real-time updates for admin
  setInterval(() => {
    if (currentRole === 'admin') {
      const statsUpdate = Math.floor(Math.random() * 100);
      if (statsUpdate < 5) { // 5% chance every 10 seconds
        appData.barStats.total_songs_played += 1;
        const statCards = document.querySelectorAll('.stat-card .stat-number');
        if (statCards.length >= 2) {
          statCards[1].textContent = appData.barStats.total_songs_played;
        }
        showToast('Nueva canción añadida a la cola global', 'info');
      }
    }
  }, 10000);
  
  console.log('🎵 Encore Application Initialized Successfully');
  showToast('¡Bienvenido a Encore! Selecciona tu rol para comenzar', 'info');
});