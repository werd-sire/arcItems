(function(){
  const grid = document.getElementById('grid');
  const q = document.getElementById('q');
  const refreshBtn = document.getElementById('refresh');
  const filters = document.getElementById('filters');
  const sortSelect = document.getElementById('sort');
  const statsBar = document.getElementById('stats');

  const API = 'https://arc-raiders.fandom.com/api.php';
  const ITEMS_PAGE = 'Items';

  let DATA = [];
  let activeFilters = new Set();
  let currentSort = 'name';

  function htmlesc(s=''){return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[c]));}

  function normUrl(u){ if(!u) return ''; if(u.startsWith('//')) return 'https:'+u; return u; }

  function cardTemplate(it){
    const url = `https://arc-raiders.fandom.com/wiki/${encodeURIComponent(it.name.replace(/ /g,'_'))}`;

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
    const should = it.shouldRecycle ? `<span class="pill" title="Recommended to recycle">✅ should recycle</span>` : '';

    return `
      <article class="card" data-name="${htmlesc(it.name.toLowerCase())}" data-rarity="${htmlesc((it.rarity||'').toLowerCase())}" data-category="${htmlesc((it.category||'').toLowerCase())}" data-keepquests="${!!it.keepQuests}" data-keepprojects="${!!it.keepProjects}" data-keepworkshop="${!!it.keepWorkshop}" data-recyclable="${!it.cantRecycle}" data-cantrecycle="${it.cantRecycle}" data-should="${it.shouldRecycle}">
        <div class="thumb">${it.thumb ? `<img loading="lazy" src="${htmlesc(it.thumb)}" alt="${htmlesc(it.name)} thumbnail">` : '<div class="muted">no image</div>'}</div>
        <div class="meta">
          <div class="row"><a href="${url}" target="_blank" rel="noopener"><b>${htmlesc(it.name)}</b></a></div>
          <div class="row">${rarity} ${cat} ${recycle} ${price} ${should}</div>
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
          if (f === 'shouldRecycle' && !it.shouldRecycle) return false;
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
      items = items.filter(it => (it.name+" "+(it.rarity||'')+" "+(it.category||'')+" "+(it.recycles||'')+" "+(it.keepQuests?"quests":"")+" "+(it.keepProjects?"projects":"")+" "+(it.keepWorkshop?"workshop":"")+" "+(it.shouldRecycle?"should recycle":"")).toLowerCase().includes(term));
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
    const shouldRecycleCount = items.filter(it => it.shouldRecycle).length;
    const totalValue = items.reduce((sum, it) => sum + (it.sellPrice || 0), 0);
    const avgValue = displayedItems > 0 ? Math.round(totalValue / displayedItems) : 0;

    // Update stats bar
    statsBar.innerHTML = `
      <span class="stat">Showing <strong>${displayedItems}</strong> of <strong>${totalItems}</strong> items</span>
      <span class="stat">Should recycle: <strong>${shouldRecycleCount}</strong></span>
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
    grid.innerHTML = '<div class="notice">Fetching live data from Fandom…</div>';
    try{
      const url = `${API}?action=parse&format=json&page=${encodeURIComponent(ITEMS_PAGE)}&prop=text&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const html = data.parse?.text?.['*'] || '';
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Find the big items table (first one with Name + Sell Price headers)
      let table = Array.from(doc.querySelectorAll('table')).find(t => /Name/i.test(t.textContent) && /Sell Price/i.test(t.textContent));
      if(!table){ throw new Error('Items table not found'); }

      const items = [];
      const rows = Array.from(table.querySelectorAll('tr')).slice(1); // skip header
      for(const tr of rows){
        const tds = tr.querySelectorAll('td');
        if(tds.length < 6) continue; // Image, Name, Rarity, Recycles, Sell, Category, KeepWs, KeepQ, KeepP (some tables vary)
        const nameA = tds[1]?.querySelector('a');
        const name = nameA ? nameA.textContent.trim() : (tds[1]?.textContent||'').trim();
        if(!name) continue;

        const rarity = (tds[2]?.textContent||'').trim();
        const recycles = (tds[3]?.textContent||'').trim();
        const sellText = (tds[4]?.textContent||'').trim();
        const sellPrice = parseInt((sellText.match(/\d[\d,]*/)||[''])[0].replace(/,/g,''))||null;
        const category = (tds[5]?.textContent||'').trim();

        // Try to capture the table's image directly
        const thumbCell = tds[0];
        let thumb = extractThumbFromCell(thumbCell);

        const wsData = cellHasContent(tds[6]);
        const qData  = cellHasContent(tds[7]);
        const pData  = cellHasContent(tds[8]);

        const keepWorkshop = wsData.hasContent;
        const keepQuests = qData.hasContent;
        const keepProjects = pData.hasContent;

        const cantRecycle = /cannot|can't|not recyclable|n\/a/.test((recycles||'').toLowerCase());
        const shouldRecycle = !cantRecycle && !(keepWorkshop || keepQuests || keepProjects);

        items.push({
          name, rarity, recycles, sellPrice, category,
          keepWorkshop, keepQuests, keepProjects,
          keepWorkshopFor: wsData.text,
          keepQuestsFor: qData.text,
          keepProjectsFor: pData.text,
          cantRecycle, shouldRecycle, thumb
        });
      }

      // Fallback: for items missing a thumbnail, try PageImages with redirects
      async function fetchThumbs(batch){
        const titles = batch.map(x => x.name.replace(/ /g,'_')).join('|');
        const u = `${API}?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=256&redirects=1&converttitles=1&titles=${encodeURIComponent(titles)}&origin=*`;
        const r = await fetch(u); const j = await r.json();
        const pages = j.query?.pages || {};
        const byTitle = {};
        for(const pid in pages){
          const p = pages[pid];
          if(!p || !p.title) continue;
          if(p.thumbnail && p.thumbnail.source){ byTitle[p.title] = p.thumbnail.source; }
        }
        batch.forEach(x => {
          const title = x.name.replace(/ /g,'_');
          x.thumb = x.thumb || byTitle[title] || '';
        });
      }

      const missing = items.filter(x => !x.thumb);
      for(let i=0;i<missing.length;i+=40){
        await fetchThumbs(missing.slice(i,i+40));
      }

      DATA = items;
      render();
    }catch(err){
      console.warn('Live fetch failed, falling back:', err);
      DATA = fallback();
      render();
    }
  }

  function fallback(){
    // Minimal offline data so the page still works without network.
    return [
      {name:'Syringe', rarity:'Common', recycles:'Cannot be Recycled', sellPrice:200, category:'Medical', keepWorkshop:false, keepQuests:false, keepProjects:false, keepWorkshopFor:'', keepQuestsFor:'', keepProjectsFor:'', thumb:'', cantRecycle:true, shouldRecycle:false},
      {name:'Water Pump', rarity:'Rare', recycles:'6x Metal Parts', sellPrice:2000, category:'Recyclable', keepWorkshop:false, keepQuests:false, keepProjects:true, keepWorkshopFor:'', keepQuestsFor:'', keepProjectsFor:'5x Project IV', thumb:'', cantRecycle:false, shouldRecycle:false},
      {name:'Battery', rarity:'Uncommon', recycles:'2x Metal Parts', sellPrice:250, category:'Topside Material', keepWorkshop:false, keepQuests:true, keepProjects:true, keepWorkshopFor:'', keepQuestsFor:'2x Power Up', keepProjectsFor:'3x Project II', thumb:'', cantRecycle:false, shouldRecycle:false},
      {name:'Cooling Fan', rarity:'Rare', recycles:'14x Plastic Parts, 4x Wires', sellPrice:2000, category:'Recyclable', keepWorkshop:false, keepQuests:false, keepProjects:true, keepWorkshopFor:'', keepQuestsFor:'', keepProjectsFor:'1x Project III', thumb:'', cantRecycle:false, shouldRecycle:false}
    ];
  }

  // init
  fetchLive();
})();
