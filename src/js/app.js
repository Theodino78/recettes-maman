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


// ============================================
// Ajouter une recette : lien Instagram / TikTok / YouTube → file d'import → fiche
// ============================================
const APP_KEY = location.hostname.includes('maman') || location.port === '8766' ? 'maman' : 'pwa';
const INBOX_API = 'https://august-maman.vercel.app/api/inbox';
const getImports = () => { try { return JSON.parse(localStorage.getItem('august-imports') || '[]'); } catch { return []; } };
const saveImports = (list) => { try { localStorage.setItem('august-imports', JSON.stringify(list.slice(0, 30))); } catch {} };
let importTimer = null;

function openAdd(prefill = '') {
  document.querySelectorAll('.add-overlay, .add-modal').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.className = 'shop-overlay add-overlay';
  overlay.onclick = closeAdd;
  const modal = document.createElement('div');
  modal.className = 'shop-modal add-modal';
  modal.innerHTML = `
    <div class="shop-header">
      <span class="shop-header-title">➕ Ajouter une recette</span>
      <button class="shop-close" onclick="window.app.closeAdd()">✕</button>
    </div>
    <div class="shop-body">
      <div class="add-hint">Colle le lien d'un reel Instagram, d'une vidéo TikTok ou YouTube. La fiche (ingrédients, étapes, temps) arrive dans l'app une fois traitée.</div>
      <div class="add-row">
        <input id="add-url" type="url" inputmode="url" autocomplete="off" placeholder="https://www.instagram.com/reel/…" value="${escapeAttr(prefill)}">
        <button class="add-paste" onclick="window.app.pasteAdd()">Coller</button>
      </div>
      <div class="shop-order" onclick="window.app.submitAdd()">Ajouter à ${APP_KEY === 'maman' ? 'Recettes Maman' : 'August'}</div>
      <div id="add-list"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  requestAnimationFrame(() => { overlay.classList.add('open'); modal.classList.add('open'); });
  renderImports();
  refreshImports();
}
function closeAdd() {
  document.querySelectorAll('.add-overlay, .add-modal').forEach(el => { el.classList.remove('open'); setTimeout(() => el.remove(), 300); });
}
async function pasteAdd() {
  try { document.getElementById('add-url').value = (await navigator.clipboard.readText()).trim(); }
  catch { showToast('Appuie longuement dans le champ puis « Coller »'); }
}
async function submitAdd() {
  const input = document.getElementById('add-url');
  const url = (input.value.match(/https?:\/\/\S+/) || [''])[0];
  if (!url) { showToast('Colle un lien Instagram, TikTok ou YouTube'); return; }
  try {
    const r = await fetch(INBOX_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, app: APP_KEY }) });
    const data = await r.json();
    if (!r.ok) { showToast('❌ ' + (data.error || 'Lien refusé')); return; }
    const list = getImports().filter(x => x.code !== data.code);
    list.unshift({ code: data.code, url, at: Date.now(), ...data });
    saveImports(list);
    input.value = '';
    showToast(data.status === 'done' ? '✅ Déjà traitée' : '📥 Envoyée — la fiche arrive bientôt');
    renderImports();
  } catch { showToast('❌ Pas de connexion'); }
}
function renderImports() {
  const box = document.getElementById('add-list');
  if (!box) return;
  const list = getImports();
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="shop-rayon">Mes imports</div>' + list.map(it => {
    const label = it.title || it.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42) + '…';
    const status = it.status === 'done'
      ? (RECIPES.some(r => r.id === it.id) ? `<button class="add-open" onclick="window.app.openImported('${it.id}')">Ouvrir</button>` : `<button class="add-open" onclick="location.href='./?open=${it.id || ''}'">Recharger</button>`)
      : it.status === 'failed' ? `<span class="add-status failed" title="${escapeAttr(it.reason || '')}">Échec</span>`
      : '<span class="add-status">En cours…</span>';
    return `<div class="add-item"><span class="add-item-label">${escapeHtml(label)}</span>${status}</div>`;
  }).join('') + (list.some(it => it.status === 'failed') ? '<div class="add-hint">Échec : le post est privé, supprimé, ou ne contient pas de recette.</div>' : '');
}
async function refreshImports() {
  const pending = getImports().filter(it => it.status !== 'done' && it.status !== 'failed');
  if (!pending.length) return;
  try {
    const r = await fetch(`${INBOX_API}?app=${APP_KEY}&codes=${pending.map(p => p.code).join(',')}`);
    const st = await r.json();
    saveImports(getImports().map(it => st[it.code] ? { ...it, ...st[it.code] } : it));
    renderImports();
  } catch {}
}
function openImported(id) { closeAdd(); showRecipe(id); }

// Nombre de convives : base = « N pers. » de la recette, sinon 4
const servingsState = {};
const baseServings = (recipe) => { const m = String(recipe.serves || '').match(/(\d+)/); return m ? +m[1] : 4; };
const currentServings = (recipe) => servingsState[recipe.id] || baseServings(recipe);
const servingsFactor = (recipe) => currentServings(recipe) / baseServings(recipe);
function fmtNum(x, unitless) {
  if (unitless) return String(Math.max(1, Math.round(x)));
  const r = x >= 100 ? Math.round(x / 5) * 5 : x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
  return String(r).replace('.', ',');
}
// Multiplie tous les nombres d'une quantité (« 200 g », « 1/2 », « 2 (≈ 500 g) », « 1,5 kg »)
function scaleQty(qty, f) {
  const q = String(qty || '');
  if (f === 1 || !q || q === 'QS' || q === 'à vérifier' || !/\d|½|¼|¾/.test(q)) return q;
  const unitless = /^\s*[≈~]?\s*[\d.,/½¼¾]+\s*$/.test(q);
  return q.replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/¾/g, '3/4')
    .replace(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+)|(\d+(?:[.,]\d+)?)/g, (m, a, b, c) => {
      const v = a ? parseFloat(a.replace(',', '.')) / +b : parseFloat(c.replace(',', '.'));
      return fmtNum(v * f, unitless);
    });
}
function setServings(id, delta) {
  const recipe = RECIPES.find(r => r.id === id);
  if (!recipe) return;
  servingsState[id] = Math.min(30, Math.max(1, currentServings(recipe) + delta));
  const f = servingsFactor(recipe);
  document.querySelectorAll('#page-recipe-detail .ing').forEach((el, i) => {
    el.querySelector('.ing-qty').textContent = scaleQty(recipe.ingredients[i].qty, f);
  });
  const n = document.getElementById('servings-n');
  if (n) n.textContent = currentServings(recipe);
}

let currentRecipeId = null;
function showRecipe(id) {
  const recipe = RECIPES.find(r => r.id === id);
  if (!recipe) return;
  currentRecipeId = id;
  
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
  // Reels, posts (/p/) et IGTV : l'URL /p/{id}/embed/ marche pour les trois
  const igId = recipe.linkType === 'instagram' && recipe.link
    ? recipe.link.match(/\/(?:reels?|p|tv)\/([^\/\?]+)/)?.[1] : null;
  if (igId) {
    embedHtml = `
      <div class="video-embed">
        <iframe src="https://www.instagram.com/p/${igId}/embed/" loading="lazy"
          width="100%" frameborder="0" scrolling="no"
          allowtransparency="true" allowfullscreen="true"></iframe>
      </div>`;
  }

  let html = `
    <div class="detail-header">
      <button class="back-btn" onclick="window.app.goBack()">← Retour</button>
      <h2 class="detail-title">${recipe.title} ${favBtn(recipe.id, 'fav-detail')}</h2>
      <div class="detail-meta">
        ${recipe.time && recipe.time !== '—' ? `<span>⏱ ${recipe.time}</span>` : ''}
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
  
  // Ingredients + convives
  const f = servingsFactor(recipe);
  const baseKnown = /\d/.test(String(recipe.serves || ''));
  html += `<div class="section-hdr servings-hdr">🧂 Ingrédients
    <div class="servings">
      <button onclick="window.app.setServings('${recipe.id}', -1)" aria-label="Moins">−</button>
      <span>👤 <b id="servings-n">${currentServings(recipe)}</b> pers.</span>
      <button onclick="window.app.setServings('${recipe.id}', 1)" aria-label="Plus">+</button>
    </div></div>
    ${baseKnown ? '' : '<div class="servings-note">Nombre de personnes non précisé par la recette : base de 4.</div>'}
    <div class="ing-list">`;
  recipe.ingredients.forEach(ing => {
    html += `<div class="ing" onclick="window.app.checkIng(this)">
      <div class="ing-dot"></div>
      <span class="ing-qty">${scaleQty(ing.qty, f)}</span>
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
    <div class="btn btn-action btn-delete" onclick="window.app.deleteRecipe('${recipe.id}')">🗑️ Supprimer</div>
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
  const hidden = JSON.parse(localStorage.getItem('august-hidden') || '[]');
  grid.innerHTML = RECIPES.filter(r => !hidden.includes(r.id)).map(r => renderCard(r, true)).join('');
  renderTagChips();
  applyFilters();
}

// Favoris (mémorisés sur l'appareil)
const getFavs = () => { try { return JSON.parse(localStorage.getItem('august-favs') || '[]'); } catch { return []; } };
const isFav = (id) => getFavs().includes(id);
function toggleFav(id, ev) {
  if (ev) ev.stopPropagation();
  const favs = getFavs();
  const on = !favs.includes(id);
  const next = on ? [...favs, id] : favs.filter(x => x !== id);
  try { localStorage.setItem('august-favs', JSON.stringify(next)); } catch {}
  document.querySelectorAll(`[data-fav="${id}"]`).forEach(b => { b.classList.toggle('on', on); b.textContent = on ? '♥' : '♡'; });
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) card.dataset.fav = on;
  showToast(on ? '♥ Ajoutée aux favoris' : 'Retirée des favoris');
  if (currentCat === 'favs') applyFilters();
}
const favBtn = (id, cls = '') => `<button class="fav-btn ${cls}${isFav(id) ? ' on' : ''}" data-fav="${id}" onclick="window.app.toggleFav('${id}', event)" aria-label="Favori">${isFav(id) ? '♥' : '♡'}</button>`;

function renderCard(recipe, showChef = true) {
  const gradient = CAT_GRADIENTS[recipe.cat] || CAT_GRADIENTS.default;
  const isAdvanced = recipe.difficulty === 'Avancé';
  const imgStyle = recipe.image 
    ? `background-image: url('${recipe.image}'); background-size: cover; background-position: center;`
    : `background: ${gradient};`;
  const cookedIds = JSON.parse(localStorage.getItem('august-cooked') || '[]');
  const isCooked = cookedIds.includes(recipe.id);
  return `<div class="card${isAdvanced ? ' card-advanced' : ''}" 
    data-id="${recipe.id}" data-cat="${recipe.cat}" data-fav="${isFav(recipe.id)}" data-veggie="${recipe.veggie || false}" 
    data-difficulty="${recipe.difficulty}"
    onclick="window.app.showRecipe('${recipe.id}')">
    ${isCooked ? '<span class="card-cooked-badge">✅</span>' : ''}
    ${favBtn(recipe.id, 'fav-card')}
    <div class="card-img" style="${imgStyle}">
      ${recipe.image ? '' : `<span class="card-emoji-overlay">${recipe.emoji}</span>`}
    </div>
    <div class="card-body">
      <div class="card-title">${recipe.title}</div>
      ${showChef ? `<div class="card-chef">${recipe.chefName}</div>` : ''}
      <div class="card-meta">${recipe.time && recipe.time !== '—' ? `⏱${recipe.time} · ` : ''}${recipe.difficulty}</div>
    </div>
  </div>`;
}

// ============================================
// Filtering
// ============================================
// Recherche : titre, chef, ingrédients, catégorie — sans accents, tous les mots doivent matcher
const norm = (t) => (t || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const CAT_WORDS = {
  sauce: 'sauce', pates: 'pates pasta', entree: 'entree salade', poisson: 'poisson fruits de mer',
  viande: 'viande', accompagnement: 'accompagnement legumes', dessert: 'dessert sucre gateau', plat: 'plat'
};
const SEARCH_INDEX = new Map(RECIPES.map(r => [r.id, norm([
  r.title, r.chefName, r.chef, CAT_WORDS[r.cat] || r.cat, r.veggie ? 'veggie vegetarien' : '',
  ...(r.ingredients || []).map(i => i.name)
].join(' '))]));
// Catégories par ingrédient principal et par type de plat, déduites du titre et des ingrédients.
// where: 'title' = titre seulement ; 'all' = titre + ingrédients (viandes/poissons : présents = plat principal).
const TAG_RULES = [
  { id: 'poulet', label: '🐔 Poulet', where: 'all', re: /\b(poulet|volaille|dinde|pintade)\b/ },
  { id: 'boeuf', label: '🐄 Bœuf & veau', where: 'all', re: /\b(boeuf|veau|steak|entrecote|bavette|paleron)\b/ },
  { id: 'porc', label: '🐖 Porc', where: 'all', re: /\b(porc|jambon|lardons?|chorizo|saucisses?|filet mignon|travers)\b/ },
  { id: 'agneau', label: '🐑 Agneau', where: 'all', re: /\b(agneau|souris d'agneau|gigot)\b/ },
  { id: 'poisson', label: '🐟 Poisson', where: 'all', re: /\b(poissons?|saumon|thon|cabillaud|bar|daurade|dorade|lotte|sardines?|maquereau|truite|merlu|colin|lieu|sole|haddock|anchois)\b/ },
  { id: 'fruits-de-mer', label: '🦐 Fruits de mer', where: 'all', re: /\b(crevettes?|gambas|saint-jacques|st-jacques|moules|calamars?|encornets?|poulpe|seiche|homard|crabe|langoustines?)\b/ },
  { id: 'oeufs', label: '🥚 Œufs', where: 'title', re: /\b(oeufs?|omelette|frittata|shakshuka)\b/ },
  { id: 'pates-riz', label: '🍝 Pâtes & riz', where: 'title', re: /\b(pates|pasta|spaghetti|tagliatelles?|linguine|rigatoni|penne|orecchiette|lasagnes?|gnocchis?|risotto|riz|nouilles|vermicelles)\b/ },
  { id: 'courgette', label: '🥒 Courgette', where: 'title', re: /\bcourgettes?\b/ },
  { id: 'aubergine', label: '🍆 Aubergine', where: 'title', re: /\baubergines?\b/ },
  { id: 'tomate', label: '🍅 Tomate', where: 'title', re: /\btomates?\b/ },
  { id: 'pomme-de-terre', label: '🥔 Pomme de terre', where: 'title', re: /\b(pommes? de terre|patates?|frites|puree)\b/ },
  { id: 'champignons', label: '🍄 Champignons', where: 'title', re: /\b(champignons?|cepes?|girolles?|morilles?)\b/ },
  { id: 'chocolat', label: '🍫 Chocolat', where: 'title', re: /\b(chocolat|cacao|brownies?)\b/ },
  { id: 'fruits', label: '🍓 Fruits', where: 'title', re: /\b(fraises?|framboises?|myrtilles?|mures?|cerises?|abricots?|peches?|prunes?|mirabelles?|pommes?|poires?|citron|orange|mangue|ananas|banane|figues?|rhubarbe|fruits)\b/ },
  { id: 'tarte', label: '🥧 Tartes & quiches', where: 'title', re: /\b(tartes?|tartelettes?|quiches?|tatin|galette)\b/ },
  { id: 'gateau', label: '🍰 Gâteaux', where: 'title', re: /\b(gateaux?|cakes?|clafoutis|fondant|moelleux|cheesecake|financiers?|madeleines?|cookies?|biscuits?|muffins?|crumble)\b/ },
  { id: 'creme', label: '🍮 Crèmes & mousses', where: 'title', re: /\b(cremes?|mousses?|panna cotta|tiramisu|flan|sorbet|glace)\b/ },
  { id: 'soupe', label: '🥣 Soupes', where: 'title', re: /\b(soupes?|veloute|potage|bouillon|gaspacho|ramen|pho)\b/ },
  { id: 'salade', label: '🥗 Salades', where: 'title', re: /\b(salades?|taboule|bowl)\b/ },
  { id: 'gratin', label: '🧀 Gratins & four', where: 'title', re: /\b(gratin|gratine|parmentier|lasagnes?|au four|roti|rotie)\b/ },
  { id: 'sandwich', label: '🥪 Sandwichs & wraps', where: 'title', re: /\b(sandwichs?|burgers?|wraps?|tacos?|croque|pita|shawarma|bagel|toast)\b/ },
  { id: 'apero', label: '🫒 Apéro', where: 'title', re: /\b(apero|dips?|houmous|tapenade|rillettes|tartinade|bruschetta|blinis|gougeres)\b/ },
];
const recipeTags = (r) => {
  const title = norm(r.title);
  const all = title + ' ' + norm((r.ingredients || []).map(i => i.name).join(' '));
  return TAG_RULES.filter(t => t.re.test(t.where === 'all' ? all : title)).map(t => t.id);
};
const RECIPE_TAGS = new Map(RECIPES.map(r => [r.id, recipeTags(r)]));
RECIPES.forEach(r => SEARCH_INDEX.set(r.id, SEARCH_INDEX.get(r.id) + ' ' + RECIPE_TAGS.get(r.id).join(' ')));
let currentTag = null;


// Accueil : tuiles de catégories (types de plat + ingrédients), puis la liste filtrée
const HOME_CATS = [
  { kind: 'cat', id: 'entree', label: 'Entrées' }, { kind: 'cat', id: 'plat', label: 'Plats' },
  { kind: 'cat', id: 'viande', label: 'Viandes' }, { kind: 'cat', id: 'poisson', label: 'Poissons' },
  { kind: 'cat', id: 'pates', label: 'Pâtes & riz' }, { kind: 'cat', id: 'accompagnement', label: 'Accompagnements' },
  { kind: 'cat', id: 'sauce', label: 'Sauces' }, { kind: 'cat', id: 'dessert', label: 'Desserts' },
  { kind: 'cat', id: 'veggie', label: 'Veggie' },
];
function homeCatRecipes(c) {
  if (c.kind === 'tag') return RECIPES.filter(r => (RECIPE_TAGS.get(r.id) || []).includes(c.id));
  if (c.id === 'veggie') return RECIPES.filter(r => r.veggie && r.cat !== 'dessert');
  return RECIPES.filter(r => r.cat === c.id);
}
function renderHomeCats() {
  const box = document.getElementById('home-cats');
  if (!box) return;
  const tile = (c) => {
    const list = homeCatRecipes(c);
    if (!list.length) return '';
    const cover = list.find(r => r.image) || {};
    const bg = cover.image ? `background-image:url('${cover.image}')` : `background:${CAT_GRADIENTS[c.id] || CAT_GRADIENTS.default}`;
    return `<div class="cat-tile" style="${bg}" onclick="window.app.openHomeCat('${c.kind}','${c.id}')">
      <span class="cat-tile-label">${c.label}<small>${list.length}</small></span></div>`;
  };
  const tags = TAG_RULES.filter(t => homeCatRecipes({ kind: 'tag', id: t.id }).length >= 3)
    .map(t => ({ kind: 'tag', id: t.id, label: t.label.replace(/^\S+\s/, '') }));
  const favN = getFavs().length;
  box.innerHTML = `
    ${favN ? `<div class="cat-all" onclick="window.app.openHomeCat('cat','favs')">♥ Mes favoris <small>${favN}</small></div>` : ''}
    <div class="cat-section">Par type de plat</div>
    <div class="cat-grid">${HOME_CATS.map(tile).join('')}</div>
    <div class="cat-section">Par ingrédient ou envie</div>
    <div class="cat-grid">${tags.map(tile).join('')}</div>
    <div class="cat-all" onclick="window.app.openHomeCat('cat','all')">Toutes les recettes <small>${RECIPES.length}</small></div>`;
}
function setHomeMode(mode) {
  const list = document.getElementById('home-list'), cats = document.getElementById('home-cats');
  if (!list || !cats) return;
  list.hidden = mode !== 'list';
  cats.hidden = mode !== 'cats';
  if (mode === 'cats') renderHomeCats();
}
function openHomeCat(kind, id) {
  currentTag = null; currentCat = 'all';
  document.querySelectorAll('#tag-chips .chip, .filter-chips .chip').forEach(c => c.classList.remove('active'));
  if (kind === 'tag') {
    currentTag = id;
    const chip = [...document.querySelectorAll('#tag-chips .chip')].find(c => c.getAttribute('onclick').includes(`'${id}'`));
    if (chip) chip.classList.add('active');
  } else {
    currentCat = id;
    const chip = [...document.querySelectorAll('.filter-chips:not(.tag-chips) .chip')].find(c => c.getAttribute('onclick').includes(`'${id}'`));
    if (chip) chip.classList.add('active');
  }
  setHomeMode('list');
  applyFilters();
  window.scrollTo(0, 0);
}
function backToCats() {
  const input = document.getElementById('home-search');
  if (input) input.value = '';
  currentQuery = []; currentTag = null; currentCat = 'all';
  setHomeMode('cats');
  window.scrollTo(0, 0);
}

function renderTagChips() {
  const box = document.getElementById('tag-chips');
  if (!box) return;
  const hidden = JSON.parse(localStorage.getItem('august-hidden') || '[]');
  const counts = {};
  RECIPES.filter(r => !hidden.includes(r.id)).forEach(r => RECIPE_TAGS.get(r.id).forEach(t => counts[t] = (counts[t] || 0) + 1));
  const min = RECIPES.length > 60 ? 3 : 1; // n'affiche que les catégories assez remplies
  box.innerHTML = TAG_RULES.filter(t => (counts[t.id] || 0) >= min).map(t =>
    `<div class="chip chip-tag${currentTag === t.id ? ' active' : ''}" onclick="window.app.filterTag('${t.id}', this)">${t.label} <span class="chip-count">${counts[t.id]}</span></div>`
  ).join('');
}

function filterTag(tag, chipEl) {
  currentTag = currentTag === tag ? null : tag; // re-taper désélectionne
  document.querySelectorAll('#tag-chips .chip').forEach(c => c.classList.remove('active'));
  if (currentTag && chipEl) chipEl.classList.add('active');
  applyFilters();
}
let currentCat = 'all';
let currentQuery = [];

function applyFilters() {
  const grid = document.getElementById('home-grid');
  let shown = 0;
  grid.querySelectorAll('.card').forEach((card, i) => {
    const catOk = currentCat === 'all' || card.dataset.cat === currentCat ||
      (currentCat === 'favs' && isFav(card.dataset.id)) ||
      (currentCat === 'veggie' && card.dataset.veggie === 'true' && card.dataset.cat !== 'dessert');
    const text = SEARCH_INDEX.get(card.dataset.id) || '';
    const tagOk = !currentTag || (RECIPE_TAGS.get(card.dataset.id) || []).includes(currentTag);
    const show = catOk && tagOk && currentQuery.every(w => text.includes(w));
    card.style.display = show ? '' : 'none';
    card.style.animation = 'none'; // l'animation d'entrée ne sert qu'au premier affichage
    shown += show;
  });
  const count = document.getElementById('search-count');
  if (count) count.textContent = (currentQuery.length || currentTag) ? `${shown}` : '';
  const empty = document.getElementById('search-empty');
  if (empty) empty.hidden = shown > 0;
}

function filter(cat, chipEl) {
  if (chipEl) {
    chipEl.closest('.filter-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chipEl.classList.add('active');
  }
  currentCat = cat;
  applyFilters();
}

function search(q) {
  currentQuery = norm(q).split(/\s+/).filter(Boolean);
  if (currentQuery.length) setHomeMode('list');
  applyFilters();
}

function filterChef(chipEl, cat) {
  if (chipEl) {
    chipEl.closest('.filter-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chipEl.classList.add('active');
  }
  
  const grid = chipEl.closest('.page').querySelector('.grid');
  grid.querySelectorAll('.card').forEach(card => {
    const show = cat === 'all' || card.dataset.cat === cat || (cat === 'veggie' && card.dataset.veggie === 'true' && card.dataset.cat !== 'dessert');
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
  shopItems(recipe).forEach((ing, idx) => {
    const rayon = ing.rayon || 'epicerie';
    if (!grouped[rayon]) grouped[rayon] = [];
    grouped[rayon].push({ ...ing, idx });
  });

  let bodyHtml = '<div class="shop-hint">Touche ce que tu as déjà : le reste part dans la commande.</div>';
  RAYON_ORDER.forEach(rayon => {
    if (!grouped[rayon]) return;
    bodyHtml += `<div class="shop-rayon">${RAYON_LABELS[rayon] || rayon}</div>`;
    grouped[rayon].forEach((ing, i) => {
      bodyHtml += `<div class="shop-item${ing.pantry ? ' checked' : ''}" data-idx="${ing.idx}" onclick="window.app.toggleShopItem(this)">
        <div class="shop-item-dot">${ing.pantry ? '✓' : ''}</div>
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
      <span class="shop-header-title">🛒 ${recipe.title} · ${currentServings(recipe)} pers.</span>
      <button class="shop-close" onclick="window.app.closeShop()">✕</button>
    </div>
    <div class="shop-body">
      ${bodyHtml}
      <div class="shop-order" onclick="window.app.orderIngredients('${recipeId}')">🌿 Commander chez Biocoop <span class="shop-order-sub">prompt pour Grok</span></div>
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

// Prompt de commande pour un agent (Grok ou autre) à partir des ingrédients non cochés
// Nom de produit à acheter : sans la préparation (« aubergines en tranches, précuites » → « aubergines »)
const PREP_WORDS = /\s+(en (tranches?|rondelles|brunoise|cubes?|dés|lamelles|quartiers|morceaux|julienne|bâtonnets|poudre fine)|émincée?s?|hachée?s?|râpée?s?|ciselée?s?|pelée?s?|coupée?s?|tranchée?s?|précuite?s?|cuite?s?|égouttée?s?|rincée?s?|refroidie?s?|fondue?s?|tiède|froide?s?|mou|ramollie?|battue?s?|pressée?s?|zestée?s?|lavée?s?|dénoyautée?s?|équeutée?s?|snackée?s?|grillée?s?|torréfiée?s?)\b.*$/i;
function shopName(name) {
  let n = (name || '').replace(/\s*\([^)]*\)/g, '').split(/,|;| pour (la|le|les|l')\b/)[0];
  n = n.replace(PREP_WORDS, '').replace(/^(de |d'|du |des )/i, '').trim();
  return n || name;
}

// Ce qu'on achète : la liste d'achat de la fiche si elle existe, sinon les ingrédients nettoyés
function shopItems(recipe) {
  const f = servingsFactor(recipe);
  if (recipe.shopping && recipe.shopping.length) {
    return recipe.shopping.map(it => ({ name: it.product, qty: (it.estimate && !String(it.qty).includes('≈') ? '≈ ' : '') + scaleQty(it.qty, f), rayon: it.rayon, pantry: it.pantry, estimate: it.estimate }));
  }
  return recipe.ingredients.map(ing => ({ name: shopName(ing.name), qty: scaleQty(ing.qty, f), rayon: ing.rayon }));
}

function buildOrderPrompt(recipe) {
  const modal = [...document.querySelectorAll('.shop-modal')].pop(); // la fenêtre la plus récente
  const have = new Set(modal ? [...modal.querySelectorAll('.shop-item.checked')].map(el => +el.dataset.idx) : []);
  const items = shopItems(recipe).filter((_, i) => !have.has(i));
  if (!items.length) return null;
  const known = (q) => q && q !== 'QS' && q !== 'à vérifier';
  const line = (it) => `- ${it.name} : ${known((it.qty || '').trim()) ? it.qty : 'quantité à estimer'}`;
  const serves = `${currentServings(recipe)} personnes`;
  return `Sur biocoop.fr, remplis mon panier pour la recette « ${recipe.title} », pour ${serves}.\n\n` +
    `Produits à acheter :\n${items.map(line).join('\n')}\n\n` +
    `Consignes :\n` +
    `- Produits Biocoop ; prends le format le plus proche au-dessus de la quantité demandée.\n` +
    `- « ≈ » = quantité estimée ; « quantité à estimer » = choisis une quantité raisonnable pour ce nombre de personnes et liste tes hypothèses.\n` +
    `- Si un produit manque, propose l'équivalent le plus proche et dis-le-moi.\n` +
    `- Montre-moi le panier et le total AVANT de valider : ne passe pas la commande sans mon accord.`;
}

function orderIngredients(recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;
  const prompt = buildOrderPrompt(recipe);
  if (!prompt) { showToast('Tout est coché : rien à commander'); return; }
  // Feuille de partage (iPhone : envoyer à Grok, WhatsApp…) ; sinon copie + ouverture de Grok
  if (navigator.share) {
    navigator.share({ title: `Courses — ${recipe.title}`, text: prompt }).catch(() => {});
    return;
  }
  copyText(prompt).finally(() => {
    showToast('✅ Prompt copié — colle-le dans Grok');
    window.open('https://grok.com/?q=' + encodeURIComponent(prompt), '_blank');
  });
}

function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  };
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback());
  }
  return Promise.resolve(fallback());
}

function copyShopList(recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;
  const modal = [...document.querySelectorAll('.shop-modal')].pop();
  const have = new Set(modal ? [...modal.querySelectorAll('.shop-item.checked')].map(el => +el.dataset.idx) : []);
  const grouped = {};
  shopItems(recipe).forEach((it, i) => {
    if (have.has(i)) return;
    (grouped[it.rayon || 'epicerie'] = grouped[it.rayon || 'epicerie'] || []).push(it);
  });
  let text = `🛒 ${recipe.title} — ${currentServings(recipe)} pers.\n\n`;
  RAYON_ORDER.forEach(rayon => {
    if (!grouped[rayon]) return;
    text += `${RAYON_LABELS[rayon] || rayon}\n`;
    grouped[rayon].forEach(it => { text += `  □ ${it.qty} ${it.name}\n`; });
    text += '\n';
  });
  copyText(text.trim()).then(ok => showToast(ok ? '✅ Liste copiée !' : '❌ Impossible de copier'));
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
  
  chatRecipe = RECIPES.find(r => r.id === currentRecipeId);
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
    const chefRecipes = RECIPES.filter(r => r.chef === chef.id);
    const count = chefRecipes.length;
    if (count === 0) return '';
    const topRecipe = chefRecipes[0];
    const img = topRecipe && topRecipe.image 
      ? `<img class="chef-avatar-img" src="${topRecipe.image}" alt="${chef.name}">`
      : `<div class="chef-avatar-emoji">${chef.emoji}</div>`;
    return `<div class="chef-card-visual" onclick="window.app.showChef('${chef.id}')">
      ${img}
      <div class="chef-info">
        <div class="chef-name">${chef.name}</div>
        <div class="chef-desc">${chef.desc}</div>
        <div class="chef-count">${count} recette${count > 1 ? 's' : ''}</div>
      </div>
    </div>`;
  }).join('');
  page.innerHTML = header + '<div class="chefs-list">' + cards + '</div>';
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
  registerSW();
  
  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => nav(btn.dataset.page));
  });
  
  updateBottomNav('home');
  setHomeMode('cats');
  const params = new URLSearchParams(location.search);
  if (params.get('add')) openAdd(params.get('add'));
  if (params.get('open') && RECIPES.some(r => r.id === params.get('open'))) showRecipe(params.get('open'));
  if (params.has('add') || params.has('open')) history.replaceState(null, '', location.pathname);
  refreshImports();
  importTimer = setInterval(refreshImports, 30000);
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


function deleteRecipe(id) {
  if (!confirm('Supprimer cette recette ?')) return;
  const hidden = JSON.parse(localStorage.getItem('august-hidden') || '[]');
  if (!hidden.includes(id)) hidden.push(id);
  localStorage.setItem('august-hidden', JSON.stringify(hidden));
  nav('home');
  renderHomeGrid();
  showToast('Recette supprimée');
}

window.app = {
  search, openAdd, closeAdd, pasteAdd, submitAdd, openImported, setServings, openHomeCat, backToCats, toggleFav, orderIngredients, filterTag,
  nav, goBack, deleteRecipe, setView, showRecipe, showChef, filter, filterChef,
  checkIng, checkStep, toggleDetail, showAsk, closeAsk, showShop, closeShop,
  toggleShopItem, copyShopList,
  showInteract, showCooked, closeCookedModal, showToast,
  toggleOnboardChip, selectOnboardGoal,
  closeChat, sendChat, sendSuggestion
};

document.addEventListener('DOMContentLoaded', init);
