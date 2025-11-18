(function(){
  const grid = document.getElementById('grid');
  const q = document.getElementById('q');
  const clearSearchBtn = document.getElementById('clear-search');
  const refreshBtn = document.getElementById('refresh');
  const filters = document.getElementById('filters');
  const sortSelect = document.getElementById('sort');
  const statsBar = document.getElementById('stats');
  const craftSelect = document.getElementById('craft-select');
  const craftResult = document.getElementById('craft-result');
  const tabButtons = document.querySelectorAll('.tab');
  const browseContent = document.getElementById('browse-content');
  const craftContent = document.getElementById('craft-content');

  const API = 'https://arcraiders.wiki/w/api.php';
  const LOOT_PAGE = 'Loot';
  const BLUEPRINTS_PAGE = 'Blueprints';

  let DATA = [];
  let RECIPES = {}; // Crafting recipes keyed by item name
  let activeFilters = new Set();
  let currentSort = 'name';
  let currentTab = 'browse';

  function htmlesc(s=''){return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[c]));}

  // Convert item name to local image filename
  function getLocalImagePath(name) {
    if (!name) return '';
    // Convert to lowercase, replace spaces with hyphens, remove special chars
    const filename = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `img/${filename}.png`;
  }

  // Tab switching
  function switchTab(tabName) {
    currentTab = tabName;
    tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (tabName === 'browse') {
      browseContent.classList.add('active');
      craftContent.classList.remove('active');
    } else {
      browseContent.classList.remove('active');
      craftContent.classList.add('active');
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  function cardTemplate(it){
    const url = `https://arcraiders.wiki/wiki/${encodeURIComponent(it.name.replace(/ /g,'_'))}`;

    // Build detailed keep info with tooltips
    const keepParts = [];
    if (it.keepQuests) {
      const tooltip = it.keepQuestsFor ? ` title="${htmlesc(it.keepQuestsFor)}"` : '';
      keepParts.push(`<span${tooltip}>Quests</span>`);
    }
    if (it.keepProjects) {
      const tooltip = it.keepProjectsFor ? ` title="${htmlesc(it.keepProjectsFor)}"` : '';
      keepParts.push(`<span${tooltip}>Projects</span>`);
    }
    if (it.keepWorkshop) {
      const tooltip = it.keepWorkshopFor ? ` title="${htmlesc(it.keepWorkshopFor)}"` : '';
      keepParts.push(`<span${tooltip}>Workshop</span>`);
    }
    const keepRow = keepParts.join(' • ');

    const recycle = it.cantRecycle ? '<span class="pill" title="Cannot be recycled">🚫 cannot</span>' : '<span class="pill" title="Recycles into parts">♻️ recycles</span>';
    const price = it.sellPrice ? `<span class="pill" title="Sell price">💵 ${it.sellPrice}</span>` : '';
    const rarityClass = it.rarity ? ` rarity-${it.rarity.toLowerCase()}` : '';
    const rarity = it.rarity ? `<span class="pill${rarityClass}" title="Rarity">${htmlesc(it.rarity)}</span>` : '';
    const cat = it.category ? `<span class="pill" title="Category">${htmlesc(it.category)}</span>` : '';

    const localImg = getLocalImagePath(it.name);

    return `
      <article class="card" data-name="${htmlesc(it.name.toLowerCase())}" data-rarity="${htmlesc((it.rarity||'').toLowerCase())}" data-category="${htmlesc((it.category||'').toLowerCase())}" data-keepquests="${!!it.keepQuests}" data-keepprojects="${!!it.keepProjects}" data-keepworkshop="${!!it.keepWorkshop}" data-recyclable="${!it.cantRecycle}" data-cantrecycle="${it.cantRecycle}">
        <div class="thumb">${localImg ? `<img loading="lazy" src="${htmlesc(localImg)}" alt="${htmlesc(it.name)} thumbnail" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=\\'muted\\'>no image</div>'">` : '<div class="muted">no image</div>'}</div>
        <div class="meta">
          <div class="row"><a href="${url}" target="_blank" rel="noopener"><b>${htmlesc(it.name)}</b></a></div>
          <div class="row">${rarity} ${cat} ${recycle} ${price}</div>
          ${keepRow ? `<div class="muted keep-for">Keep for: ${keepRow}</div>` : ''}
          ${it.recycles ? `<div class="muted">Recycles: ${htmlesc(it.recycles)}</div>` : ''}
        </div>
      </article>`;
  }

  function render(){
    const term = q.value.trim().toLowerCase();

    let items = DATA;
    if (activeFilters.size){
      items = items.filter(it => {
        for (const f of activeFilters){
          if (f === 'keepQuests' && !it.keepQuests) return false;
          if (f === 'keepProjects' && !it.keepProjects) return false;
          if (f === 'keepWorkshop' && !it.keepWorkshop) return false;
          if (f === 'recyclable' && it.cantRecycle) return false;
          if (f === 'cantRecycle' && !it.cantRecycle) return false;
        }
        return true;
      });
    }

    if (term){
      items = items.filter(it => (it.name+" "+(it.rarity||'')+" "+(it.category||'')+" "+(it.recycles||'')+" "+(it.keepQuests?"quests":"")+" "+(it.keepProjects?"projects":"")+" "+(it.keepWorkshop?"workshop":"")).toLowerCase().includes(term));
    }

    // Sort items
    const rarityOrder = { 'legendary': 5, 'epic': 4, 'rare': 3, 'uncommon': 2, 'common': 1 };
    if (currentSort === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'name-desc') {
      items.sort((a, b) => b.name.localeCompare(a.name));
    } else if (currentSort === 'price-high') {
      items.sort((a, b) => (b.sellPrice || 0) - (a.sellPrice || 0));
    } else if (currentSort === 'price-low') {
      items.sort((a, b) => (a.sellPrice || 0) - (b.sellPrice || 0));
    } else if (currentSort === 'rarity') {
      items.sort((a, b) => (rarityOrder[b.rarity?.toLowerCase()] || 0) - (rarityOrder[a.rarity?.toLowerCase()] || 0));
    }

    // Calculate stats
    const totalItems = DATA.length;
    const displayedItems = items.length;
    const totalValue = items.reduce((sum, it) => sum + (it.sellPrice || 0), 0);
    const avgValue = displayedItems > 0 ? Math.round(totalValue / displayedItems) : 0;

    // Update stats bar
    statsBar.innerHTML = `
      <span class="stat">Showing <strong>${displayedItems}</strong> of <strong>${totalItems}</strong> items</span>
      <span class="stat">Total value: <strong>$${totalValue.toLocaleString()}</strong></span>
      <span class="stat">Avg value: <strong>$${avgValue.toLocaleString()}</strong></span>
    `;

    grid.innerHTML = items.map(cardTemplate).join('');
  }

  filters.addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip'); if(!chip) return;
    const key = chip.dataset.key;
    const on = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', on? 'false':'true');
    if(on) activeFilters.delete(key); else activeFilters.add(key);
    render();
  });

  q.addEventListener('input', render);
  clearSearchBtn.addEventListener('click', () => { q.value = ''; render(); });
  refreshBtn.addEventListener('click', () => { fetchLive(); });
  sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; render(); });

  function cellHasContent(td){
    if(!td) return { hasContent: false, text: '' };
    const text = (td.textContent||'').trim();
    // Check for checkmarks, yes, or any actual text content
    const hasContent = text.length > 0 && text !== '-' && text !== 'N/A' && text !== '—';
    return { hasContent, text };
  }

  function extractThumbFromCell(td){
    if(!td) return '';
    const img = td.querySelector('img');
    if(!img) return '';
    let src = img.getAttribute('data-src') || img.getAttribute('src') || '';
    if(!src){
      const ss = (img.getAttribute('srcset')||'').split(',').map(s=>s.trim().split(' ')[0]).filter(Boolean);
      if(ss.length) src = ss[ss.length-1];
    }
    if(src && src.startsWith('//')) src = 'https:'+src;
    return src;
  }

  async function fetchLive(){
    grid.innerHTML = '<div class="notice">Fetching live data from ARC Raiders Wiki…</div>';
    try{
      // Fetch Loot page (items data)
      const lootUrl = `${API}?action=parse&format=json&page=${encodeURIComponent(LOOT_PAGE)}&prop=text&origin=*`;
      console.log('Fetching loot from:', lootUrl);
      const lootRes = await fetch(lootUrl);
      if (!lootRes.ok) throw new Error(`Loot HTTP ${lootRes.status}: ${lootRes.statusText}`);
      const lootData = await lootRes.json();
      const lootHtml = lootData.parse?.text?.['*'] || '';
      const lootDoc = new DOMParser().parseFromString(lootHtml, 'text/html');

      // Find the loot table (headers: Name, Rarity, Recycles To, Sell Price, Category, Keep for Quests/Workshop)
      let lootTable = Array.from(lootDoc.querySelectorAll('table')).find(t => /\bName\b/i.test(t.textContent) && /Sell Price/i.test(t.textContent));
      if(!lootTable){ throw new Error('Loot table not found'); }

      const items = [];
      const rows = Array.from(lootTable.querySelectorAll('tr')).slice(1); // skip header

      for(const tr of rows){
        const tds = tr.querySelectorAll('td');

        // Debug first 10 rows - show ALL columns to find Keep for data
        if(items.length < 10) {
          console.log(`\n=== Row ${items.length} ===`);
          const nameText = tds[0]?.textContent?.trim();
          console.log('Name:', nameText);
          console.log('Columns:', tds.length);
          for(let i = 0; i < tds.length; i++) {
            const text = tds[i]?.textContent?.trim();
            if(text && text.length > 0) {
              console.log(`  [${i}]: ${text.substring(0, 60)}`);
            }
          }
        }

        if(tds.length < 11) continue;
        const nameA = tds[0]?.querySelector('a');
        const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent||'').trim();
        if(!name) continue;

        const rarity = (tds[2]?.textContent||'').trim();
        const recycles = (tds[4]?.textContent||'').trim();
        const sellText = (tds[6]?.textContent||'').trim();
        const sellPrice = parseInt((sellText.match(/\d[\d,]*/)||[''])[0].replace(/,/g,''))||null;
        const category = (tds[8]?.textContent||'').trim();

        // Parse the "Keep for Quests/Workshop" column (column 10 - single column with combined data)
        const keepData = cellHasContent(tds[10]);
        const keepText = keepData.text.toLowerCase();

        // Debug items with keep data
        if(items.length < 5 && keepData.hasContent) {
          console.log(`Item "${name}" has keep data:`, keepData.text);
        }

        // Check for Workshop, Quest, Expedition/Project keywords in the combined text
        const keepWorkshop = /workshop/i.test(keepText);
        const keepQuests = /quest/i.test(keepText);
        const keepProjects = /expedition|project/i.test(keepText);

        const cantRecycle = /cannot|can't|not recyclable|n\/a/i.test((recycles||''));

        items.push({
          name, rarity, recycles, sellPrice, category,
          keepWorkshop, keepQuests, keepProjects,
          keepWorkshopFor: keepWorkshop ? keepData.text : '',
          keepQuestsFor: keepQuests ? keepData.text : '',
          keepProjectsFor: keepProjects ? keepData.text : '',
          cantRecycle, thumb: ''
        });
      }

      DATA = items;

      // Debug: Show how many items have each "keep for" flag
      const keepStats = {
        workshop: items.filter(it => it.keepWorkshop).length,
        quests: items.filter(it => it.keepQuests).length,
        projects: items.filter(it => it.keepProjects).length
      };
      console.log('Keep for stats:', keepStats);
      console.log('Sample items with keepWorkshop:', items.filter(it => it.keepWorkshop).slice(0, 3).map(it => ({name: it.name, text: it.keepWorkshopFor})));
      console.log('Sample items with keepQuests:', items.filter(it => it.keepQuests).slice(0, 3).map(it => ({name: it.name, text: it.keepQuestsFor})));
      console.log('Sample items with keepProjects:', items.filter(it => it.keepProjects).slice(0, 3).map(it => ({name: it.name, text: it.keepProjectsFor})));

      // Fetch Blueprints page (crafting recipes)
      console.log('Fetching blueprints...');
      const blueprintsUrl = `${API}?action=parse&format=json&page=${encodeURIComponent(BLUEPRINTS_PAGE)}&prop=text&origin=*`;
      const blueprintsRes = await fetch(blueprintsUrl);
      if (!blueprintsRes.ok) throw new Error(`Blueprints HTTP ${blueprintsRes.status}`);
      const blueprintsData = await blueprintsRes.json();
      const blueprintsHtml = blueprintsData.parse?.text?.['*'] || '';
      const blueprintsDoc = new DOMParser().parseFromString(blueprintsHtml, 'text/html');

      // Find blueprints table
      let blueprintsTable = Array.from(blueprintsDoc.querySelectorAll('table')).find(t => /Blueprint Name/i.test(t.textContent) && /Crafting Recipe/i.test(t.textContent));
      if(blueprintsTable){
        const bpRows = Array.from(blueprintsTable.querySelectorAll('tr')).slice(1); // skip header
        for(const tr of bpRows){
          const tds = tr.querySelectorAll('td');
          if(tds.length < 3) continue;
          const nameA = tds[0]?.querySelector('a');
          const blueprintName = nameA ? nameA.textContent.trim() : (tds[0]?.textContent||'').trim();
          if(!blueprintName) continue;

          const workshop = (tds[1]?.textContent||'').trim();
          const recipeText = (tds[2]?.textContent||'').trim();

          // Parse recipe: "5x Item Name, 3x Another Item"
          const ingredients = [];
          const parts = recipeText.split(/[,\n]+/).map(p => p.trim()).filter(Boolean);
          for(const part of parts){
            const match = part.match(/^(\d+)x?\s*(.+)$/i);
            if(match){
              ingredients.push({ qty: parseInt(match[1]), name: match[2].trim() });
            }
          }

          RECIPES[blueprintName] = { workshop, ingredients };
        }
      }

      console.log(`Loaded ${items.length} items and ${Object.keys(RECIPES).length} recipes`);

      // Generate list of needed images
      const neededImages = items.map(it => getLocalImagePath(it.name)).sort();
      console.log('\n=== Images needed (${neededImages.length} total) ===');
      console.log(neededImages.join('\n'));
      console.log('\nRun: python download_images.py');

      // Populate craft select dropdown
      const craftableItems = Object.keys(RECIPES).sort();
      craftSelect.innerHTML = '<option value="">-- Select an item --</option>' +
        craftableItems.map(name => `<option value="${htmlesc(name)}">${htmlesc(name)}</option>`).join('');

      render();
    }catch(err){
      console.error('Live fetch failed:', err);
      grid.innerHTML = `<div class="notice" style="border-color:var(--warn);color:var(--warn)">
        <b>Failed to fetch live data</b><br>
        Error: ${err.message}<br>
        Using fallback data instead. Check browser console for details.
      </div>`;
      DATA = fallback();
      render();
    }
  }

  function fallback(){
    // Minimal offline data so the page still works without network.
    return [
      {name:'Syringe', rarity:'Common', recycles:'Cannot be Recycled', sellPrice:200, category:'Medical', keepWorkshop:false, keepQuests:false, keepProjects:false, keepWorkshopFor:'', keepQuestsFor:'', keepProjectsFor:'', thumb:'', cantRecycle:true},
      {name:'Water Pump', rarity:'Rare', recycles:'6x Metal Parts', sellPrice:2000, category:'Recyclable', keepWorkshop:false, keepQuests:false, keepProjects:true, keepWorkshopFor:'', keepQuestsFor:'', keepProjectsFor:'5x Project IV', thumb:'', cantRecycle:false},
      {name:'Battery', rarity:'Uncommon', recycles:'2x Metal Parts', sellPrice:250, category:'Topside Material', keepWorkshop:false, keepQuests:true, keepProjects:true, keepWorkshopFor:'', keepQuestsFor:'2x Power Up', keepProjectsFor:'3x Project II', thumb:'', cantRecycle:false},
      {name:'Cooling Fan', rarity:'Rare', recycles:'14x Plastic Parts, 4x Wires', sellPrice:2000, category:'Recyclable', keepWorkshop:false, keepQuests:false, keepProjects:true, keepWorkshopFor:'', keepQuestsFor:'', keepProjectsFor:'1x Project III', thumb:'', cantRecycle:false}
    ];
  }

  // Recursive crafting calculator
  function calculateMaterials(itemName, quantity = 1, depth = 0) {
    const recipe = RECIPES[itemName];
    if (!recipe) {
      // Base material (no recipe)
      return [{ name: itemName, qty: quantity, depth, isBase: true }];
    }

    const results = [];
    // Add the crafted item itself
    results.push({ name: itemName, qty: quantity, depth, isBase: false, workshop: recipe.workshop });

    // Recursively calculate ingredients
    for (const ingredient of recipe.ingredients) {
      const subMaterials = calculateMaterials(ingredient.name, ingredient.qty * quantity, depth + 1);
      results.push(...subMaterials);
    }

    return results;
  }

  // Flatten and aggregate materials
  function aggregateMaterials(materials) {
    const totals = {};
    const hierarchy = [];

    for (const mat of materials) {
      if (mat.depth === 0) {
        hierarchy.push(mat); // Top-level item
      } else if (mat.isBase) {
        // Aggregate base materials
        if (!totals[mat.name]) {
          totals[mat.name] = 0;
        }
        totals[mat.name] += mat.qty;
      }
    }

    return { totals, hierarchy };
  }

  // Render crafting tree
  function renderCraftingTree(itemName) {
    const recipe = RECIPES[itemName];
    if (!recipe) {
      craftResult.innerHTML = '<div class="notice">No recipe found for this item.</div>';
      return;
    }

    const materials = calculateMaterials(itemName, 1);
    const { totals } = aggregateMaterials(materials);

    // Build materials tree recursively
    function buildTree(name, qty, depth = 0) {
      const recipe = RECIPES[name];
      const indent = '  '.repeat(depth);
      const itemUrl = `https://arcraiders.wiki/wiki/${encodeURIComponent(name.replace(/ /g,'_'))}`;

      if (!recipe) {
        // Base material
        return `<div class="craft-item base" style="padding-left: ${depth * 20}px">
          <span class="craft-qty">${qty}×</span>
          <a href="${itemUrl}" target="_blank" rel="noopener">${htmlesc(name)}</a>
          <span class="craft-badge base">Base Material</span>
        </div>`;
      }

      // Craftable item
      let html = `<div class="craft-item craftable" style="padding-left: ${depth * 20}px">
        <span class="craft-qty">${qty}×</span>
        <a href="${itemUrl}" target="_blank" rel="noopener"><strong>${htmlesc(name)}</strong></a>
        <span class="craft-badge workshop">${htmlesc(recipe.workshop)}</span>
      </div>`;

      // Add ingredients
      for (const ingredient of recipe.ingredients) {
        html += buildTree(ingredient.name, ingredient.qty * qty, depth + 1);
      }

      return html;
    }

    // Build summary of base materials
    const baseMaterialsList = Object.entries(totals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, qty]) => {
        const itemUrl = `https://arcraiders.wiki/wiki/${encodeURIComponent(name.replace(/ /g,'_'))}`;
        return `<li><span class="craft-qty">${qty}×</span> <a href="${itemUrl}" target="_blank" rel="noopener">${htmlesc(name)}</a></li>`;
      })
      .join('');

    craftResult.innerHTML = `
      <div class="craft-header">
        <h2>Crafting: ${htmlesc(itemName)}</h2>
        <p class="craft-workshop">Required workshop: <strong>${htmlesc(recipe.workshop)}</strong></p>
      </div>

      <div class="craft-section">
        <h3>📋 Materials Needed (Total)</h3>
        <ul class="craft-materials-list">${baseMaterialsList}</ul>
      </div>

      <div class="craft-section">
        <h3>🌳 Crafting Tree</h3>
        <div class="craft-tree">${buildTree(itemName, 1)}</div>
      </div>
    `;
  }

  // Craft select handler
  craftSelect.addEventListener('change', (e) => {
    const itemName = e.target.value;
    if (itemName) {
      renderCraftingTree(itemName);
    } else {
      craftResult.innerHTML = '';
    }
  });

  // init
  fetchLive();
})();
