// August PWA — Main Application Logic
import { RECIPES, CHEFS, CAT_GRADIENTS } from '../data/recipes.js';

// ============================================
// Utilities
// ============================================
function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================
// State
// ============================================
let currentPage = 'home';
let previousPage = null;
let expandedSteps = {};

// ============================================
// Toast System
// ============================================
function showToast(message, duration = 3000) {
  // Remove existing toast
  document.querySelectorAll('.toast').forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('visible'));
  
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
// Navigation
// ============================================
function nav(page) {
  previousPage = currentPage;
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
  }
  updateBottomNav(page);
  window.scrollTo(0, 0);
}

function goBack() {
  if (previousPage) {
    nav(previousPage);
  } else {
    nav('home');
  }
}

function updateBottomNav(page) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page || 
      (page.startsWith('recipe-') && btn.dataset.page === 'home') ||
      (page.startsWith('chef-') && btn.dataset.page === 'chefs'));
  });
}

// ============================================
// Recipe Rendering
// ============================================
function showRecipe(id) {
  const recipe = RECIPES.find(r => r.id === id);
  if (!recipe) return;
  
  expandedSteps = {};
  
  const page = document.getElementById('page-recipe-detail');
  page.innerHTML = renderRecipeDetail(recipe);
  nav('recipe-detail');
}

function renderRecipeDetail(recipe) {
  const linkLabel = recipe.linkType === 'instagram' ? '📸 Voir sur Instagram' :
                    recipe.linkType === 'youtube' ? '▶ Voir sur YouTube' : '🔗 Voir la source';
  
  // Instagram embed: extract reel/post ID and create iframe
  let embedHtml = '';
  if (recipe.linkType === 'instagram' && recipe.link && recipe.link.includes('/reel/')) {
    const reelId = recipe.link.match(/\/reel\/([^\/\?]+)/)?.[1];
    if (reelId) {
      embedHtml = `
        <div class="video-embed">
          <iframe src="https://www.instagram.com/reel/${reelId}/embed/" 
            width="100%" height="420" frameborder="0" scrolling="no" 
            allowtransparency="true" allowfullscreen="true"
            style="border-radius: 12px; background: #000; max-width: 100%;"></iframe>
        </div>`;
    }
  }
  
  let html = `
    <div class="detail-header">
      <button class="back-btn" onclick="window.app.goBack()">← Retour</button>
      <h2 class="detail-title">${recipe.title}</h2>
      <div class="detail-meta">
        <span>⏱ ${recipe.time}</span>
        <span>👤 ${recipe.serves}</span>
        <span>📊 ${recipe.difficulty}</span>
      </div>
    </div>
    ${embedHtml}
    <a href="${recipe.link}" target="_blank" class="source-link">${linkLabel}</a>
  `;
  
  // Techniques
  if (recipe.techniques && recipe.techniques.length) {
    html += '<div class="techniques">';
    recipe.techniques.forEach(t => {
      html += `<span class="tech-tag"><span class="ask-term" data-ask="${escapeAttr(t.ask)}">${t.name}</span></span>`;
    });
    html += '</div>';
  }
  
  // Ingredients
  html += '<div class="section-hdr">🧂 Ingrédients</div><div class="ing-list">';
  recipe.ingredients.forEach(ing => {
    html += `<div class="ing" onclick="window.app.checkIng(this)">
      <div class="ing-dot"></div>
      <span class="ing-qty">${ing.qty}</span>
      <span class="ing-name">${ing.name}</span>
    </div>`;
  });
  html += '</div>';
  
  // Steps
  html += '<div class="section-hdr">👨‍🍳 Étapes</div><div class="steps-list">';
  recipe.steps.forEach((step, i) => {
    const n = i + 1;
    const hasDetail = !!step.detail;
    const metaItems = [];
    if (step.duration) metaItems.push(`⏱ ${step.duration}`);
    if (step.temperature) metaItems.push(`🌡 ${step.temperature}`);
    const metaHtml = metaItems.length ? `<div class="step-meta">${metaItems.join(' · ')}</div>` : '';
    
    // Process text with ask terms
    let stepText = step.text;
    if (step.askTerm) {
      const at = step.askTerm;
      stepText = stepText.replace(at.text, `<span class="ask-term" data-ask="${escapeAttr(at.ask)}">${at.text}</span>`);
    }
    // Handle inline <ask> tags from text
    stepText = stepText.replace(/<ask t='([^']*)'>(.*?)<\/ask>/g, 
      (_, ask, text) => `<span class="ask-term" data-ask="${escapeAttr(ask)}">${text}</span>`);
    
    html += `<div class="step" data-step="${n}" onclick="window.app.checkStep(this, '${recipe.id}')">
      <div class="step-n">${n}</div>
      <div class="step-content">
        <div class="step-txt">${stepText}</div>
        ${metaHtml}
        ${hasDetail ? `<button class="step-detail-toggle" onclick="event.stopPropagation(); window.app.toggleDetail(this, ${i}, '${recipe.id}')">
          <span class="detail-arrow">›</span> Plus de détails
        </button>
        <div class="step-detail" id="detail-${recipe.id}-${i}">
          <p>${step.detail}</p>
        </div>` : ''}
      </div>
    </div>`;
  });
  html += '</div>';
  
  // Tips
  if (recipe.tips) {
    html += `<div class="tips">💡 ${recipe.tips}</div>`;
  }
  
  // Action buttons
  html += `<div class="action-buttons">
    <div class="btn btn-action" onclick="window.app.showShop('${recipe.id}')">🛒 Liste de courses</div>
    <div class="btn btn-action" onclick="window.app.showInteract()">💬 Interagir</div>
    <div class="btn btn-action btn-photo" onclick="window.app.showCooked('${recipe.id}')">📸 J'ai cuisiné ce plat</div>
  </div>`;
  
  return html;
}

function toggleDetail(btn, stepIndex, recipeId) {
  const key = `${recipeId}-${stepIndex}`;
  const detailEl = document.getElementById(`detail-${key}`);
  if (!detailEl) return;
  
  const isOpen = expandedSteps[key];
  if (isOpen) {
    detailEl.classList.remove('open');
    btn.classList.remove('open');
    expandedSteps[key] = false;
  } else {
    detailEl.classList.add('open');
    btn.classList.add('open');
    expandedSteps[key] = true;
  }
}

// ============================================
// Home Grid Rendering
// ============================================
function renderHomeGrid() {
  const grid = document.getElementById('home-grid');
  grid.innerHTML = RECIPES.map(r => renderCard(r, true)).join('');
}

function renderCard(recipe, showChef = true) {
  const gradient = CAT_GRADIENTS[recipe.cat] || CAT_GRADIENTS.default;
  const isAdvanced = recipe.difficulty === 'Avancé';
  const imgStyle = recipe.image 
    ? `background-image: url('${recipe.image}'); background-size: cover; background-position: center;`
    : `background: ${gradient};`;
  const cookedIds = JSON.parse(localStorage.getItem('august-cooked') || '[]');
  const isCooked = cookedIds.includes(recipe.id);
  return `<div class="card${isAdvanced ? ' card-advanced' : ''}" 
    data-cat="${recipe.cat}" data-veggie="${recipe.veggie || false}" 
    data-difficulty="${recipe.difficulty}"
    onclick="window.app.showRecipe('${recipe.id}')">
    ${isCooked ? '<span class="card-cooked-badge">✅</span>' : ''}
    <div class="card-img" style="${imgStyle}">
      <span class="card-emoji-overlay">${recipe.emoji}</span>
    </div>
    <div class="card-body">
      <div class="card-title">${recipe.title}</div>
      ${showChef ? `<div class="card-chef">${recipe.chefName}</div>` : ''}
      <div class="card-meta">⏱${recipe.time} · ${recipe.difficulty}</div>
    </div>
  </div>`;
}

// ============================================
// Filtering
// ============================================
function filter(cat, chipEl) {
  if (chipEl) {
    chipEl.closest('.filter-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chipEl.classList.add('active');
  }
  
  const grid = document.getElementById('home-grid');
  const cards = grid.querySelectorAll('.card');
  cards.forEach((card, i) => {
    const show = cat === 'all' || card.dataset.cat === cat || (cat === 'veggie' && card.dataset.veggie === 'true');
    card.style.display = show ? '' : 'none';
    if (show) {
      card.style.animationDelay = `${i * 50}ms`;
    }
  });
}

function filterChef(chipEl, cat) {
  if (chipEl) {
    chipEl.closest('.filter-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chipEl.classList.add('active');
  }
  
  const grid = chipEl.closest('.page').querySelector('.grid');
  grid.querySelectorAll('.card').forEach(card => {
    const show = cat === 'all' || card.dataset.cat === cat || (cat === 'veggie' && card.dataset.veggie === 'true');
    card.style.display = show ? '' : 'none';
  });
}

// ============================================
// Chef Pages
// ============================================
function showChef(id) {
  const chef = CHEFS.find(c => c.id === id);
  if (!chef) return;
  
  const recipes = RECIPES.filter(r => r.chef === id);
  const page = document.getElementById('page-chef-detail');
  
  const cats = [...new Set(recipes.map(r => r.cat))];
  const catLabels = {
    sauce: '🫕 Sauce', pates: '🍝 Pâtes', entree: '🥗 Entrée',
    poisson: '🐟 Poisson', dessert: '🍫 Dessert', viande: '🥩 Viande',
    accompagnement: '🥬 Accomp.'
  };
  
  let chipsHtml = '<div class="filter-chips"><div class="chip active" onclick="window.app.filterChef(this,\'all\')">Tout</div>';
  cats.forEach(cat => {
    chipsHtml += `<div class="chip" onclick="window.app.filterChef(this,'${cat}')">${catLabels[cat] || cat}</div>`;
  });
  chipsHtml += '</div>';
  
  page.innerHTML = `
    <div class="profile-hdr">
      <button class="back-btn" onclick="window.app.nav('chefs')">← Chefs</button>
      <h2>${chef.emoji} ${chef.name}${chef.verified ? ' ✓' : ''}</h2>
      <p>${chef.desc} · ${recipes.length} recette${recipes.length > 1 ? 's' : ''}</p>
    </div>
    ${chipsHtml}
    <div class="grid">
      ${recipes.map(r => renderCard(r, false)).join('')}
    </div>
  `;
  
  nav('chef-detail');
}

// ============================================
// Interactions
// ============================================
function checkIng(el) {
  el.classList.toggle('done');
  const dot = el.querySelector('.ing-dot');
  if (el.classList.contains('done')) {
    dot.textContent = '✓';
  } else {
    dot.textContent = '';
  }
}

function checkStep(el, recipeId) {
  if (event && (event.target.classList.contains('ask-term') || 
      event.target.classList.contains('step-detail-toggle') ||
      event.target.classList.contains('detail-arrow'))) return;
  
  el.classList.toggle('done');
  const stepN = el.querySelector('.step-n');
  if (el.classList.contains('done')) {
    stepN.textContent = '✓';
  } else {
    stepN.textContent = el.dataset.step;
  }
}

// ============================================
// Ask Bubble (term explanations)
// ============================================
function showAsk(text) {
  closeAsk();
  const bubble = document.createElement('div');
  bubble.className = 'ask-bubble';
  bubble.innerHTML = `${text}<button class="ask-close" onclick="window.app.closeAsk()">✕</button>`;
  document.body.appendChild(bubble);
}

function closeAsk() {
  document.querySelectorAll('.ask-bubble').forEach(b => b.remove());
}

document.addEventListener('click', (e) => {
  const askTerm = e.target.closest('.ask-term');
  if (askTerm) {
    e.stopPropagation();
    showAsk(askTerm.dataset.ask);
    return;
  }
  if (!e.target.closest('.ask-bubble') && !e.target.closest('.ask-term')) {
    closeAsk();
  }
});

// ============================================
// Shopping List (Liste de courses par rayon)
// ============================================
const RAYON_LABELS = {
  boucherie: '🥩 Boucherie / Poissonnerie',
  cremerie: '🧀 Crémerie',
  legumes: '🥦 Fruits & Légumes',
  epicerie: '🌾 Épicerie',
  boissons: '🍷 Boissons'
};

const RAYON_ORDER = ['boucherie', 'cremerie', 'legumes', 'epicerie', 'boissons'];

function showShop(recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;

  // Remove existing
  document.querySelectorAll('.shop-overlay, .shop-modal').forEach(el => el.remove());

  // Group ingredients by rayon
  const grouped = {};
  recipe.ingredients.forEach(ing => {
    const rayon = ing.rayon || 'epicerie';
    if (!grouped[rayon]) grouped[rayon] = [];
    grouped[rayon].push(ing);
  });

  let bodyHtml = '';
  RAYON_ORDER.forEach(rayon => {
    if (!grouped[rayon]) return;
    bodyHtml += `<div class="shop-rayon">${RAYON_LABELS[rayon] || rayon}</div>`;
    grouped[rayon].forEach((ing, i) => {
      bodyHtml += `<div class="shop-item" onclick="window.app.toggleShopItem(this)">
        <div class="shop-item-dot"></div>
        <span class="shop-item-text">${ing.name}</span>
        <span class="shop-item-qty">${ing.qty}</span>
      </div>`;
    });
  });

  const overlay = document.createElement('div');
  overlay.className = 'shop-overlay';
  overlay.onclick = closeShop;
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.className = 'shop-modal';
  modal.innerHTML = `
    <div class="shop-header">
      <span class="shop-header-title">🛒 Liste de courses — ${recipe.title}</span>
      <button class="shop-close" onclick="window.app.closeShop()">✕</button>
    </div>
    <div class="shop-body">
      ${bodyHtml}
      <div class="shop-copy" onclick="window.app.copyShopList('${recipeId}')">📋 Copier la liste</div>
    </div>
  `;
  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    modal.classList.add('open');
  });
}

function closeShop() {
  document.querySelector('.shop-overlay')?.classList.remove('open');
  document.querySelector('.shop-modal')?.classList.remove('open');
  setTimeout(() => {
    document.querySelectorAll('.shop-overlay, .shop-modal').forEach(el => el.remove());
  }, 300);
}

function toggleShopItem(el) {
  el.classList.toggle('checked');
  const dot = el.querySelector('.shop-item-dot');
  dot.textContent = el.classList.contains('checked') ? '✓' : '';
}

function copyShopList(recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;

  const grouped = {};
  recipe.ingredients.forEach(ing => {
    const rayon = ing.rayon || 'epicerie';
    if (!grouped[rayon]) grouped[rayon] = [];
    grouped[rayon].push(ing);
  });

  let text = `🛒 ${recipe.title}\n\n`;
  RAYON_ORDER.forEach(rayon => {
    if (!grouped[rayon]) return;
    text += `${RAYON_LABELS[rayon]}\n`;
    grouped[rayon].forEach(ing => {
      text += `  □ ${ing.qty} ${ing.name}\n`;
    });
    text += '\n';
  });

  navigator.clipboard.writeText(text).then(() => {
    showToast('✅ Liste copiée !');
  }).catch(() => {
    showToast('❌ Impossible de copier');
  });
}

// ============================================
// Photo "J'ai cuisiné ce plat"
// ============================================
let currentCookedRecipeId = null;

function showCooked(recipeId) {
  currentCookedRecipeId = recipeId;
  // Create hidden file input
  let fileInput = document.getElementById('cooked-file-input');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment';
    fileInput.id = 'cooked-file-input';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleCookedPhoto);
    document.body.appendChild(fileInput);
  }
  fileInput.value = '';
  fileInput.click();
}

function handleCookedPhoto(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const recipe = RECIPES.find(r => r.id === currentCookedRecipeId);
  if (!recipe) return;

  const photoUrl = URL.createObjectURL(file);
  const technique = recipe.techniques?.[0]?.name || 'cette recette';

  // Save to localStorage
  const cooked = JSON.parse(localStorage.getItem('august-cooked') || '[]');
  if (!cooked.includes(recipe.id)) {
    cooked.push(recipe.id);
    localStorage.setItem('august-cooked', JSON.stringify(cooked));
  }

  // Show celebration modal
  const overlay = document.createElement('div');
  overlay.className = 'cooked-overlay';
  overlay.innerHTML = `
    <div class="cooked-modal">
      <img class="cooked-photo" src="${photoUrl}" alt="Ma photo" />
      <div class="cooked-title">🎉 Bravo ! Tu as cuisiné ${recipe.title} !</div>
      <div class="cooked-subtitle">Technique débloquée : ${technique}</div>
      <button class="cooked-close" onclick="window.app.closeCookedModal()">Fermer</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Launch confetti
  launchConfetti();

  // Re-render home grid to show badge
  renderHomeGrid();
  restoreView();
}

function closeCookedModal() {
  document.querySelectorAll('.cooked-overlay').forEach(el => el.remove());
  document.querySelectorAll('.confetti-container').forEach(el => el.remove());
}

function launchConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  const colors = ['#d97706', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6'];
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.animationDelay = Math.random() * 1 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = (6 + Math.random() * 8) + 'px';
    piece.style.height = (6 + Math.random() * 8) + 'px';
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 4000);
}

// ============================================
// Chat Modal (Interagir with real AI)
// ============================================
let chatRecipe = null;
let chatMessages = [];
let chatLoading = false;

function showInteract() {
  // Find the current recipe from state
  const detailPage = document.getElementById('page-recipe-detail');
  const titleEl = detailPage.querySelector('.detail-title');
  if (!titleEl) {
    showToast('💬 Ouvre une recette d\'abord');
    return;
  }
  
  // Find the recipe by title match
  const title = titleEl.textContent;
  chatRecipe = RECIPES.find(r => r.title === title);
  if (!chatRecipe) {
    showToast('💬 Recette introuvable');
    return;
  }
  
  chatMessages = [];
  renderChatModal();
  openChat();
}

function renderChatModal() {
  // Remove existing
  document.querySelectorAll('.chat-overlay, .chat-modal').forEach(el => el.remove());
  
  const overlay = document.createElement('div');
  overlay.className = 'chat-overlay';
  overlay.onclick = closeChat;
  document.body.appendChild(overlay);
  
  const modal = document.createElement('div');
  modal.className = 'chat-modal';
  modal.id = 'chat-modal';
  modal.innerHTML = `
    <div class="chat-header">
      <span class="chat-header-title">💬 August — ${chatRecipe.title}</span>
      <button class="chat-close" onclick="window.app.closeChat()">✕</button>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="chat-msg chat-msg-ai">
        <div class="chat-msg-label">August</div>
        Salut ! Pose-moi n'importe quelle question sur cette recette — substitutions, techniques, temps de cuisson… 🧑‍🍳
      </div>
    </div>
    <div class="chat-suggestions" id="chat-suggestions">
      <div class="chat-suggestion" onclick="window.app.sendSuggestion(this)">Substitutions possibles ?</div>
      <div class="chat-suggestion" onclick="window.app.sendSuggestion(this)">Peut-on préparer à l'avance ?</div>
      <div class="chat-suggestion" onclick="window.app.sendSuggestion(this)">Accord vin ?</div>
    </div>
    <div class="chat-input-area">
      <input type="text" class="chat-input" id="chat-input" placeholder="Pose ta question…" autocomplete="off" />
      <button class="chat-send" id="chat-send" onclick="window.app.sendChat()">↑</button>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Enter key
  const input = modal.querySelector('#chat-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
}

function openChat() {
  requestAnimationFrame(() => {
    document.querySelector('.chat-overlay')?.classList.add('open');
    document.querySelector('.chat-modal')?.classList.add('open');
    setTimeout(() => document.getElementById('chat-input')?.focus(), 300);
  });
}

function closeChat() {
  document.querySelector('.chat-overlay')?.classList.remove('open');
  document.querySelector('.chat-modal')?.classList.remove('open');
  setTimeout(() => {
    document.querySelectorAll('.chat-overlay, .chat-modal').forEach(el => el.remove());
  }, 300);
}

function sendSuggestion(el) {
  const text = el.textContent;
  document.getElementById('chat-input').value = text;
  sendChat();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input?.value?.trim();
  if (!message || chatLoading) return;
  
  input.value = '';
  chatLoading = true;
  
  // Hide suggestions after first message
  const suggestions = document.getElementById('chat-suggestions');
  if (suggestions) suggestions.style.display = 'none';
  
  // Add user message
  appendChatMsg(message, 'user');
  
  // Show typing indicator
  showTyping();
  
  // Disable send button
  const sendBtn = document.getElementById('chat-send');
  if (sendBtn) sendBtn.disabled = true;
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeId: chatRecipe.id,
        recipeTitle: chatRecipe.title,
        recipeData: {
          ingredients: chatRecipe.ingredients,
          steps: chatRecipe.steps.map(s => ({
            text: s.text,
            duration: s.duration,
            temperature: s.temperature,
            detail: s.detail
          })),
          techniques: chatRecipe.techniques,
          tips: chatRecipe.tips
        },
        message
      })
    });
    
    removeTyping();
    
    if (!response.ok) {
      appendChatMsg('Oups, problème de connexion… Réessaie ! 🔌', 'ai');
    } else {
      const data = await response.json();
      appendChatMsg(data.reply || 'Hmm, pas de réponse…', 'ai');
    }
  } catch (err) {
    removeTyping();
    appendChatMsg('Impossible de me connecter. Vérifie ta connexion internet ! 📡', 'ai');
  }
  
  chatLoading = false;
  if (sendBtn) sendBtn.disabled = false;
  input?.focus();
}

function appendChatMsg(text, role) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
  const msg = document.createElement('div');
  msg.className = `chat-msg chat-msg-${role}`;
  
  if (role === 'ai') {
    msg.innerHTML = `<div class="chat-msg-label">August</div>${escapeHtml(text)}`;
  } else {
    msg.textContent = text;
  }
  
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.id = 'chat-typing';
  typing.innerHTML = '<div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  document.getElementById('chat-typing')?.remove();
}

// ============================================
// Netflix-style Onboarding
// ============================================
const ONBOARD_CHEFS = [
  { id: 'steflequellec', name: 'Stéphanie Le Quellec', emoji: '👩‍🍳' },
  { id: 'whoogys', name: 'Whoogys', emoji: '🧑‍🍳' },
  { id: 'francoisregisgaudry', name: 'François-Régis Gaudry', emoji: '🎙️' },
  { id: 'cyril-lignac', name: 'Cyril Lignac', emoji: '👨‍🍳' },
  { id: 'thierry-marx', name: 'Thierry Marx', emoji: '🥋' },
  { id: 'norbert-tarayre', name: 'Norbert Tarayre', emoji: '🤪' },
  { id: 'juan-arbelaez', name: 'Juan Arbelaez', emoji: '🇨🇴' },
  { id: 'mory-sacko', name: 'Mory Sacko', emoji: '🌍' },
  { id: 'alexia-duchene', name: 'Alexia Duchêne', emoji: '🌟' },
  { id: 'julien-sebbag', name: 'Julien Sebbag', emoji: '🔥' }
];

const ONBOARD_CATEGORIES = [
  { id: 'viande', name: 'Viande', emoji: '🥩' },
  { id: 'poisson', name: 'Poisson', emoji: '🐟' },
  { id: 'pates', name: 'Pâtes', emoji: '🍝' },
  { id: 'entree', name: 'Entrées', emoji: '🥗' },
  { id: 'dessert', name: 'Desserts', emoji: '🍫' },
  { id: 'sauce', name: 'Sauces', emoji: '🫕' },
  { id: 'accompagnement', name: 'Accompagnements', emoji: '🥬' },
  { id: 'asiatique', name: 'Cuisine asiatique', emoji: '🍜' }
];

const ONBOARD_GOALS = [
  { id: 'quotidien', name: 'Cuisiner au quotidien', emoji: '🏡' },
  { id: 'progresser', name: 'Progresser en technique', emoji: '📈' },
  { id: 'impressionner', name: 'Impressionner mes invités', emoji: '✨' },
  { id: 'mieux-manger', name: 'Manger mieux', emoji: '🥦' }
];

function initOnboarding() {
  if (localStorage.getItem('august-onboarded')) return;
  
  const onboarding = document.getElementById('onboarding');
  if (!onboarding) return;
  onboarding.style.display = 'block';
  
  let current = 0;
  const screens = onboarding.querySelectorAll('.onboard-screen');
  const dots = onboarding.querySelectorAll('.onboard-dot');
  const btn = onboarding.querySelector('.onboard-btn');
  
  // Populate screen 1: Chef selection
  const chefGrid = document.getElementById('onboard-chefs-grid');
  if (chefGrid) {
    chefGrid.innerHTML = ONBOARD_CHEFS.map(c => 
      `<div class="onboard-chip" data-id="${c.id}" onclick="window.app.toggleOnboardChip(this)">
        <span class="onboard-chip-emoji">${c.emoji}</span>
        <span class="onboard-chip-name">${c.name}</span>
      </div>`
    ).join('');
  }
  
  // Populate screen 2: Category selection
  const catGrid = document.getElementById('onboard-cats-grid');
  if (catGrid) {
    catGrid.innerHTML = ONBOARD_CATEGORIES.map(c =>
      `<div class="onboard-chip" data-id="${c.id}" onclick="window.app.toggleOnboardChip(this)">
        <span class="onboard-chip-emoji">${c.emoji}</span>
        <span class="onboard-chip-name">${c.name}</span>
      </div>`
    ).join('');
  }
  
  // Populate screen 3: Goal selection
  const goalGrid = document.getElementById('onboard-goals-grid');
  if (goalGrid) {
    goalGrid.innerHTML = ONBOARD_GOALS.map(g =>
      `<div class="onboard-goal" data-id="${g.id}" onclick="window.app.selectOnboardGoal(this)">
        <span class="onboard-goal-emoji">${g.emoji}</span>
        <span class="onboard-goal-name">${g.name}</span>
      </div>`
    ).join('');
  }
  
  function showScreen(index) {
    screens.forEach((s, i) => {
      s.classList.remove('active', 'exiting');
      if (i === index) {
        requestAnimationFrame(() => s.classList.add('active'));
      }
      if (i === current && i !== index) s.classList.add('exiting');
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    current = index;
    btn.textContent = index === screens.length - 1 ? 'C\'est parti !' : 'Suivant';
  }
  
  showScreen(0);
  
  btn.addEventListener('click', () => {
    if (current < screens.length - 1) {
      showScreen(current + 1);
    } else {
      onboarding.style.opacity = '0';
      onboarding.style.transition = 'opacity 400ms ease';
      setTimeout(() => {
        onboarding.style.display = 'none';
        localStorage.setItem('august-onboarded', 'true');
      }, 400);
    }
  });
}

function toggleOnboardChip(el) {
  el.classList.toggle('selected');
}

function selectOnboardGoal(el) {
  el.closest('.onboard-grid').querySelectorAll('.onboard-goal').forEach(g => g.classList.remove('selected'));
  el.classList.add('selected');
}

// ============================================
// Chefs List Rendering
// ============================================
function renderChefsList() {
  const page = document.getElementById('page-chefs');
  const header = '<div class="header"><h1>Chefs</h1></div>';
  const cards = CHEFS.map(chef => {
    const count = RECIPES.filter(r => r.chef === chef.id).length;
    return `<div class="chef-card" onclick="window.app.showChef('${chef.id}')">
      <div class="chef-avatar">${chef.emoji}</div>
      <div>
        <div class="chef-name">${chef.name}${chef.verified ? ' ✓' : ''}</div>
        <div class="chef-desc">${chef.desc} · ${count} recettes</div>
      </div>
    </div>`;
  }).join('');
  page.innerHTML = header + cards;
}

// ============================================
// Service Worker Registration
// ============================================
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });
  }
}

// ============================================
// Init
// ============================================
function init() {
  renderHomeGrid();
  renderChefsList();
  initOnboarding();
  registerSW();
  
  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => nav(btn.dataset.page));
  });
  
  updateBottomNav('home');
}

// Export for inline handlers

// ============================================
// View Toggle (grid/list)
// ============================================
function setView(mode, btnEl) {
  if (btnEl) {
    btnEl.closest('.view-toggle').querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }
  const grid = document.getElementById('home-grid');
  if (mode === 'list') {
    grid.classList.add('list-view');
  } else {
    grid.classList.remove('list-view');
  }
  localStorage.setItem('august-view', mode);
}

// Restore view preference
function restoreView() {
  const mode = localStorage.getItem('august-view');
  if (mode === 'list') {
    const grid = document.getElementById('home-grid');
    if (grid) grid.classList.add('list-view');
    const btn = document.querySelector('.view-btn:nth-child(2)');
    if (btn) {
      btn.closest('.view-toggle')?.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  }
}

window.app = {
  nav, goBack, setView, showRecipe, showChef, filter, filterChef,
  checkIng, checkStep, toggleDetail, showAsk, closeAsk, showShop, closeShop,
  toggleShopItem, copyShopList,
  showInteract, showCooked, closeCookedModal, showToast,
  toggleOnboardChip, selectOnboardGoal,
  closeChat, sendChat, sendSuggestion
};

document.addEventListener('DOMContentLoaded', init);
