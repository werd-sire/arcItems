/**
 * ARC Raiders Items & Crafting Calculator
 * Alpine.js Application
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('arcApp', () => ({
    // Data
    items: [],
    recipes: {},
    filteredItems: [],
    workshopStations: [],

    // Equipment data
    weapons: [],
    shields: [],
    augments: [],
    healing: [],
    quickUse: [],
    grenades: [],
    traps: [],

    // UI State
    currentTab: 'browse',
    isLoading: false,
    error: null,
    showSettings: false,

    // Browse state
    searchTerm: '',
    currentSort: 'name',
    viewMode: 'grid',
    activeFilters: new Set(),

    // Craft state
    selectedRecipe: '',
    craftResult: null,
    pinnedRecipes: [],

    // Inventory state
    inventory: {},
    shoppingList: {},

    // Completion tracking for quests/workshop
    completedRequirements: new Set(),

    // Quick add
    quickAddItem: '',
    quickAddQty: 1,

    // Computed
    storageInfo: '0 KB',

    // Toast notifications
    toasts: [],
    toastId: 0,

    // Filter options
    availableFilters: [
      { key: 'loot', label: 'Loot' },
      { key: 'weapon', label: 'Weapons' },
      { key: 'shield', label: 'Shields' },
      { key: 'augment', label: 'Augments' },
      { key: 'healing', label: 'Healing' },
      { key: 'grenade', label: 'Grenades' },
      { key: 'trap', label: 'Traps' },
      { key: 'quickUse', label: 'Quick Use' },
      { key: 'keepQuests', label: 'Keep for Quests' },
      { key: 'keepProjects', label: 'Keep for Projects' },
      { key: 'keepWorkshop', label: 'Keep for Workshop' },
      { key: 'recyclable', label: 'Recyclable' },
      { key: 'cantRecycle', label: 'Cannot Recycle' }
    ],

    // Computed property for recipe names
    get recipeNames() {
      return Object.keys(this.recipes).sort();
    },

    // Computed stats
    get totalValue() {
      return this.filteredItems.reduce((sum, it) => sum + (it.sellPrice || 0), 0);
    },

    get avgValue() {
      return this.filteredItems.length > 0
        ? Math.round(this.totalValue / this.filteredItems.length)
        : 0;
    },

    // Initialize
    async init() {
      // Load saved state from localForage
      await this.loadSavedState();

      // Fetch data
      await this.fetchData();

      // Initialize Lucide icons
      if (window.lucide) {
        lucide.createIcons();
      }

      // Watch for icon updates
      this.$watch('currentTab', () => {
        this.$nextTick(() => lucide.createIcons());
      });

      this.$watch('filteredItems', () => {
        this.$nextTick(() => lucide.createIcons());
      });

      // Update storage info
      this.updateStorageInfo();

      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts();
    },

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
          // Escape to blur input
          if (e.key === 'Escape') {
            e.target.blur();
          }
          return;
        }

        // Tab switching with number keys
        if (e.key === '1') {
          this.currentTab = 'browse';
        } else if (e.key === '2') {
          this.currentTab = 'craft';
        } else if (e.key === '3') {
          this.currentTab = 'workshop';
        } else if (e.key === '4') {
          this.currentTab = 'inventory';
        }

        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          this.currentTab = 'browse';
          this.$nextTick(() => {
            document.querySelector('input[type="text"]')?.focus();
          });
        }

        // R to refresh
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
          this.refreshData();
        }

        // Escape to close settings
        if (e.key === 'Escape') {
          this.showSettings = false;
        }
      });
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 3000) {
      const id = ++this.toastId;
      this.toasts.push({ id, message, type });

      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, duration);
    },

    // Load saved state from localForage
    async loadSavedState() {
      try {
        const [inventory, shoppingList, pinnedRecipes, prefs, completed] = await Promise.all([
          localforage.getItem('arcraiders_inventory'),
          localforage.getItem('arcraiders_shoppingList'),
          localforage.getItem('arcraiders_pinnedRecipes'),
          localforage.getItem('arcraiders_preferences'),
          localforage.getItem('arcraiders_completedRequirements')
        ]);

        if (inventory) this.inventory = inventory;
        if (shoppingList) this.shoppingList = shoppingList;
        if (pinnedRecipes) this.pinnedRecipes = pinnedRecipes;
        if (completed) this.completedRequirements = new Set(completed);
        if (prefs) {
          if (prefs.viewMode) this.viewMode = prefs.viewMode;
          if (prefs.currentSort) this.currentSort = prefs.currentSort;
        }
      } catch (err) {
        console.error('Failed to load saved state:', err);
      }
    },

    // Save state to localForage
    async saveState() {
      try {
        await Promise.all([
          localforage.setItem('arcraiders_inventory', this.inventory),
          localforage.setItem('arcraiders_shoppingList', this.shoppingList),
          localforage.setItem('arcraiders_pinnedRecipes', this.pinnedRecipes),
          localforage.setItem('arcraiders_completedRequirements', [...this.completedRequirements]),
          localforage.setItem('arcraiders_preferences', {
            viewMode: this.viewMode,
            currentSort: this.currentSort
          })
        ]);
        this.updateStorageInfo();
      } catch (err) {
        console.error('Failed to save state:', err);
      }
    },

    // Toggle completion status for a requirement (quest/workshop)
    toggleCompleted(itemName, type) {
      const key = `${itemName}:${type}`;
      if (this.completedRequirements.has(key)) {
        this.completedRequirements.delete(key);
      } else {
        this.completedRequirements.add(key);
      }
      // Force reactivity
      this.completedRequirements = new Set(this.completedRequirements);
      this.saveState();
    },

    // Check if a requirement is completed
    isCompleted(itemName, type) {
      return this.completedRequirements.has(`${itemName}:${type}`);
    },

    // Fetch data from wiki
    async fetchData() {
      this.isLoading = true;
      this.error = null;

      try {
        const API = 'https://arcraiders.wiki/w/api.php';

        // Fetch Loot page
        const lootUrl = `${API}?action=parse&format=json&page=Loot&prop=text&origin=*`;
        const lootRes = await fetch(lootUrl);
        if (!lootRes.ok) throw new Error(`Loot HTTP ${lootRes.status}`);

        const lootData = await lootRes.json();
        const lootHtml = lootData.parse?.text?.['*'] || '';
        const lootDoc = new DOMParser().parseFromString(lootHtml, 'text/html');

        // Parse items
        this.items = this.parseLootTable(lootDoc);

        // Fetch Blueprints page
        const bpUrl = `${API}?action=parse&format=json&page=Blueprints&prop=text&origin=*`;
        const bpRes = await fetch(bpUrl);
        if (!bpRes.ok) throw new Error(`Blueprints HTTP ${bpRes.status}`);

        const bpData = await bpRes.json();
        const bpHtml = bpData.parse?.text?.['*'] || '';
        const bpDoc = new DOMParser().parseFromString(bpHtml, 'text/html');

        // Parse recipes
        this.recipes = this.parseBlueprintsTable(bpDoc);

        // Fetch Equipment pages in parallel
        console.log('Fetching equipment pages...');
        const equipmentPages = ['Weapons', 'Shields', 'Augments', 'Healing', 'Quick_Use', 'Grenades', 'Traps'];
        const equipmentPromises = equipmentPages.map(page =>
          fetch(`${API}?action=parse&format=json&page=${encodeURIComponent(page)}&prop=text&origin=*`)
            .then(res => res.json())
            .then(data => ({ page, html: data.parse?.text?.['*'] || '' }))
            .catch(err => {
              console.error(`Failed to fetch ${page}:`, err);
              return { page, html: '' };
            })
        );

        const equipmentResults = await Promise.all(equipmentPromises);

        for (const { page, html } of equipmentResults) {
          if (!html) continue;
          const doc = new DOMParser().parseFromString(html, 'text/html');

          switch (page) {
            case 'Weapons':
              this.weapons = this.parseWeaponsPage(doc);
              break;
            case 'Shields':
              this.shields = this.parseShieldsPage(doc);
              break;
            case 'Augments':
              this.augments = this.parseAugmentsPage(doc);
              break;
            case 'Healing':
              this.healing = this.parseHealingPage(doc);
              break;
            case 'Quick_Use':
              this.quickUse = this.parseQuickUsePage(doc);
              break;
            case 'Grenades':
              this.grenades = this.parseGrenadesPage(doc);
              break;
            case 'Traps':
              this.traps = this.parseTrapsPage(doc);
              break;
          }
        }

        // Combine all items for unified browsing
        // Start with loot items (they have the most complete data)
        const lootItems = this.items.map(i => ({ ...i, itemType: 'loot', itemTypes: ['loot'] }));
        const lootMap = new Map(lootItems.map(i => [i.name.toLowerCase(), i]));

        // Create equipment type mappings
        const equipmentByName = new Map();

        const addEquipment = (items, typeName) => {
          for (const item of items) {
            const key = item.name.toLowerCase();
            if (!equipmentByName.has(key)) {
              equipmentByName.set(key, { types: [], data: {} });
            }
            equipmentByName.get(key).types.push(typeName);
            // Merge equipment-specific data
            Object.assign(equipmentByName.get(key).data, item);
          }
        };

        addEquipment(this.weapons, 'weapon');
        addEquipment(this.shields, 'shield');
        addEquipment(this.augments, 'augment');
        addEquipment(this.healing, 'healing');
        addEquipment(this.quickUse, 'quickUse');
        addEquipment(this.grenades, 'grenade');
        addEquipment(this.traps, 'trap');

        // Merge equipment data into loot items and add itemTypes
        for (const [name, equipment] of equipmentByName) {
          if (lootMap.has(name)) {
            // Item exists in loot - merge equipment data and types
            const lootItem = lootMap.get(name);
            Object.assign(lootItem, equipment.data);
            lootItem.itemTypes = ['loot', ...equipment.types];
          } else {
            // Item only exists in equipment - add as new item
            const primaryType = equipment.types[0];
            lootItems.push({
              ...equipment.data,
              itemType: primaryType,
              itemTypes: equipment.types
            });
          }
        }

        this.items = lootItems;

        console.log(`Combined ${lootItems.length} items (with equipment data merged into loot items)`);

        // Build workshop data
        this.buildWorkshopData();

        console.log(`Loaded ${this.items.length} items (${this.items.filter(i => i.itemType === 'loot').length} loot, ${this.weapons.length} weapons, ${this.shields.length} shields, ${this.augments.length} augments, ${this.healing.length} healing, ${this.quickUse.length} quick use, ${this.grenades.length} grenades, ${this.traps.length} traps) and ${Object.keys(this.recipes).length} recipes`);

        // Initial render
        this.renderItems();

      } catch (err) {
        console.error('Fetch failed:', err);
        this.error = `Failed to fetch data: ${err.message}. Using fallback data.`;
        this.items = this.getFallbackData();
        this.recipes = {};
        this.renderItems();
      } finally {
        this.isLoading = false;
      }
    },

    // Refresh data
    async refreshData() {
      await this.fetchData();
    },

    // Parse loot table
    parseLootTable(doc) {
      const items = [];

      // Find all tables and look for the loot table
      const tables = Array.from(doc.querySelectorAll('table'));
      console.log('Found', tables.length, 'tables');

      const lootTable = tables.find(t =>
        /\bName\b/i.test(t.textContent) && /Sell Price/i.test(t.textContent)
      );

      if (!lootTable) {
        console.error('Loot table not found. Table contents:', tables.map(t => t.textContent.substring(0, 100)));
        throw new Error('Loot table not found');
      }

      const rows = Array.from(lootTable.querySelectorAll('tr')).slice(1);
      console.log('Found', rows.length, 'rows in loot table');

      // Debug first row to understand structure
      if (rows.length > 0) {
        const firstRow = rows[0];
        const tds = firstRow.querySelectorAll('td');
        console.log('First row has', tds.length, 'columns');
        for (let i = 0; i < Math.min(tds.length, 15); i++) {
          console.log(`Column ${i}:`, tds[i]?.textContent?.trim().substring(0, 50));
        }
      }

      for (const tr of rows) {
        const tds = tr.querySelectorAll('td');

        // Table has 6 columns: Name, Rarity, Recycles To, Sell Price, Category, Keep for
        if (tds.length < 6) continue;

        const nameA = tds[0]?.querySelector('a');
        const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
        if (!name) continue;

        // Parse 6-column structure
        const rarity = (tds[1]?.textContent || '').trim();
        const recycles = (tds[2]?.textContent || '').trim();
        const sellText = (tds[3]?.textContent || '').trim();
        const sellPrice = parseInt((sellText.match(/\d[\d,]*/) || [''])[0].replace(/,/g, '')) || null;
        const category = (tds[4]?.textContent || '').trim();
        const keepText = (tds[5]?.textContent || '').trim().toLowerCase();

        const keepWorkshop = /workshop/i.test(keepText);
        const keepQuests = /quest/i.test(keepText);
        const keepProjects = /expedition|project/i.test(keepText);

        const cantRecycle = /cannot|can't|not recyclable|n\/a/i.test(recycles) || recycles === '-';

        // Get original case text for tooltip
        const keepTextOriginal = (tds[5]?.textContent || '').trim();

        items.push({
          name,
          rarity,
          recycles,
          sellPrice,
          category,
          keepWorkshop,
          keepQuests,
          keepProjects,
          keepWorkshopFor: keepWorkshop ? keepTextOriginal : '',
          keepQuestsFor: keepQuests ? keepTextOriginal : '',
          keepProjectsFor: keepProjects ? keepTextOriginal : '',
          cantRecycle
        });
      }

      console.log('Parsed', items.length, 'items');
      if (items.length > 0) {
        console.log('Sample item:', items[0]);
      }

      return items;
    },

    // Parse blueprints table
    parseBlueprintsTable(doc) {
      const recipes = {};

      const table = Array.from(doc.querySelectorAll('table')).find(t =>
        /Blueprint Name/i.test(t.textContent) && /Crafting Recipe/i.test(t.textContent)
      );

      if (!table) return recipes;

      const rows = Array.from(table.querySelectorAll('tr')).slice(1);

      for (const tr of rows) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 3) continue;

        const nameA = tds[0]?.querySelector('a');
        const blueprintName = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
        if (!blueprintName) continue;

        const workshop = (tds[1]?.textContent || '').trim();
        const recipeText = (tds[2]?.textContent || '').trim();

        // Parse ingredients
        const ingredients = [];
        const parts = recipeText.split(/[,\n]+/).map(p => p.trim()).filter(Boolean);

        for (const part of parts) {
          const match = part.match(/^(\d+)x?\s*(.+)$/i);
          if (match) {
            ingredients.push({ qty: parseInt(match[1]), name: match[2].trim() });
          }
        }

        // Parse sources
        const sources = {
          loot: tds[3]?.textContent?.toLowerCase().includes('yes') || false,
          harvester: tds[4]?.textContent?.toLowerCase().includes('yes') || false,
          quest: tds[5]?.querySelector('a')?.textContent?.trim() || '',
          trials: tds[6]?.querySelector('a')?.textContent?.trim() || ''
        };

        recipes[blueprintName] = { workshop, ingredients, sources };
      }

      return recipes;
    },

    // Parse Weapons page (8 tables by weapon category)
    parseWeaponsPage(doc) {
      const weapons = [];
      const tables = doc.querySelectorAll('table');

      for (const table of tables) {
        const headerRow = table.querySelector('tr');
        if (!headerRow || !/Weapon/i.test(headerRow.textContent)) continue;

        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        for (const tr of rows) {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 7) continue;

          const nameA = tds[0]?.querySelector('a');
          const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
          if (!name) continue;

          weapons.push({
            name,
            category: 'Weapon',
            ammoType: (tds[2]?.textContent || '').trim(),
            firingMode: (tds[3]?.textContent || '').trim(),
            damage: parseFloat((tds[4]?.textContent || '0').trim()) || 0,
            firingRate: parseFloat((tds[5]?.textContent || '0').trim()) || 0,
            relativeDPS: parseFloat((tds[6]?.textContent || '0').trim()) || 0,
            range: parseFloat((tds[7]?.textContent || '0').trim()) || 0,
            rarity: 'Rare', // Default, weapons don't have explicit rarity
            sellPrice: null,
            cantRecycle: true
          });
        }
      }

      return weapons;
    },

    // Parse Shields page
    parseShieldsPage(doc) {
      const shields = [];
      const table = doc.querySelector('table');
      if (!table) return shields;

      const rows = Array.from(table.querySelectorAll('tr')).slice(1);

      for (const tr of rows) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 4) continue;

        const nameA = tds[0]?.querySelector('a');
        const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
        if (!name) continue;

        shields.push({
          name,
          category: 'Shield',
          shieldCharge: parseInt((tds[2]?.textContent || '0').trim()) || 0,
          damageMitigation: (tds[3]?.textContent || '').trim(),
          movementPenalty: (tds[4]?.textContent || '').trim(),
          rarity: name.includes('Heavy') ? 'Epic' : name.includes('Medium') ? 'Rare' : 'Uncommon',
          sellPrice: null,
          cantRecycle: true
        });
      }

      return shields;
    },

    // Parse Augments page (4 tiers)
    parseAugmentsPage(doc) {
      const augments = [];
      const tables = doc.querySelectorAll('table');

      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        for (const tr of rows) {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 6) continue;

          const nameA = tds[0]?.querySelector('a');
          const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
          if (!name) continue;

          // Determine rarity by Mk level
          let rarity = 'Common';
          if (name.includes('Mk. 3')) rarity = 'Epic';
          else if (name.includes('Mk. 2')) rarity = 'Rare';
          else if (name.includes('Mk. 1')) rarity = 'Uncommon';

          augments.push({
            name,
            category: 'Augment',
            weightLimit: parseFloat((tds[2]?.textContent || '0').trim()) || 0,
            backpackSlots: parseInt((tds[3]?.textContent || '0').trim()) || 0,
            safePocketSlots: parseInt((tds[4]?.textContent || '0').trim()) || 0,
            quickUseSlots: parseInt((tds[5]?.textContent || '0').trim()) || 0,
            weaponSlots: parseInt((tds[6]?.textContent || '0').trim()) || 0,
            shieldCompatibility: (tds[7]?.textContent || '').trim(),
            augmentedSlots: tds.length > 8 ? (tds[8]?.textContent || '').trim() : '',
            rarity,
            sellPrice: null,
            cantRecycle: true
          });
        }
      }

      return augments;
    },

    // Parse Healing page (3 tables: Health, Shield Recharge, Stamina)
    parseHealingPage(doc) {
      const healing = [];
      const tables = doc.querySelectorAll('table');

      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        for (const tr of rows) {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 4) continue;

          const nameA = tds[0]?.querySelector('a');
          const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
          if (!name) continue;

          // Skip if already added (some items appear in multiple tables)
          if (healing.find(h => h.name === name)) continue;

          const effectValue = (tds[2]?.textContent || '').trim();
          const duration = (tds[3]?.textContent || '').trim();

          healing.push({
            name,
            category: 'Healing',
            effectValue,
            duration,
            description: (tds[4]?.textContent || '').trim(),
            rarity: duration === '-' ? 'Rare' : 'Uncommon', // Instant items are rarer
            sellPrice: null,
            cantRecycle: true
          });
        }
      }

      return healing;
    },

    // Parse Quick Use page
    parseQuickUsePage(doc) {
      const items = [];
      const tables = doc.querySelectorAll('table');

      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        for (const tr of rows) {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 2) continue;

          const nameA = tds[0]?.querySelector('a');
          const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
          if (!name) continue;

          items.push({
            name,
            category: 'Quick Use',
            description: (tds[2]?.textContent || '').trim(),
            rarity: 'Uncommon',
            sellPrice: null,
            cantRecycle: true
          });
        }
      }

      return items;
    },

    // Parse Grenades page
    parseGrenadesPage(doc) {
      const grenades = [];
      const tables = doc.querySelectorAll('table');

      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        for (const tr of rows) {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 2) continue;

          const nameA = tds[0]?.querySelector('a');
          const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
          if (!name) continue;

          // Check for "Must Be Shot" column
          const hasShootColumn = tds.length > 2 && /yes|no/i.test(tds[2]?.textContent || '');

          grenades.push({
            name,
            category: 'Grenade',
            mustBeShot: hasShootColumn ? /yes/i.test(tds[2]?.textContent || '') : false,
            description: (tds[hasShootColumn ? 3 : 2]?.textContent || '').trim(),
            rarity: name.includes('Heavy') ? 'Rare' : 'Uncommon',
            sellPrice: null,
            cantRecycle: true
          });
        }
      }

      return grenades;
    },

    // Parse Traps page
    parseTrapsPage(doc) {
      const traps = [];
      const tables = doc.querySelectorAll('table');

      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        for (const tr of rows) {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 2) continue;

          const nameA = tds[0]?.querySelector('a');
          const name = nameA ? nameA.textContent.trim() : (tds[0]?.textContent || '').trim();
          if (!name) continue;

          traps.push({
            name,
            category: 'Trap',
            description: (tds[2]?.textContent || '').trim(),
            rarity: name.includes('Mine') ? 'Rare' : 'Uncommon',
            sellPrice: null,
            cantRecycle: true
          });
        }
      }

      return traps;
    },

    // Fallback data
    getFallbackData() {
      return [
        { name: 'Syringe', rarity: 'Common', recycles: 'Cannot be Recycled', sellPrice: 200, category: 'Medical', keepWorkshop: false, keepQuests: false, keepProjects: false, keepWorkshopFor: '', keepQuestsFor: '', keepProjectsFor: '', cantRecycle: true },
        { name: 'Water Pump', rarity: 'Rare', recycles: '6x Metal Parts', sellPrice: 2000, category: 'Recyclable', keepWorkshop: false, keepQuests: false, keepProjects: true, keepWorkshopFor: '', keepQuestsFor: '', keepProjectsFor: '5x Project IV', cantRecycle: false },
        { name: 'Battery', rarity: 'Uncommon', recycles: '2x Metal Parts', sellPrice: 250, category: 'Topside Material', keepWorkshop: false, keepQuests: true, keepProjects: true, keepWorkshopFor: '', keepQuestsFor: '2x Power Up', keepProjectsFor: '3x Project II', cantRecycle: false }
      ];
    },

    // Render items with filters and sorting
    renderItems() {
      let items = [...this.items];

      // Apply filters
      if (this.activeFilters.size > 0) {
        // Separate item type filters from property filters
        const typeFilters = ['loot', 'weapon', 'shield', 'augment', 'healing', 'grenade', 'trap', 'quickUse'];
        const activeTypeFilters = typeFilters.filter(t => this.activeFilters.has(t));
        const hasTypeFilter = activeTypeFilters.length > 0;

        items = items.filter(it => {
          // If type filters are active, item must match at least one of them
          // Use itemTypes array to check multiple types
          if (hasTypeFilter) {
            const itemTypes = it.itemTypes || [it.itemType];
            const matchesType = activeTypeFilters.some(f => itemTypes.includes(f));
            if (!matchesType) return false;
          }

          // Check property filters
          for (const f of this.activeFilters) {
            if (typeFilters.includes(f)) continue; // Skip type filters, already handled
            if (f === 'keepQuests' && !it.keepQuests) return false;
            if (f === 'keepProjects' && !it.keepProjects) return false;
            if (f === 'keepWorkshop' && !it.keepWorkshop) return false;
            if (f === 'recyclable' && it.cantRecycle) return false;
            if (f === 'cantRecycle' && !it.cantRecycle) return false;
          }
          return true;
        });
      }

      // Apply search
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase();
        items = items.filter(it => {
          const searchable = `${it.name} ${it.rarity || ''} ${it.category || ''} ${it.recycles || ''} ${it.keepQuests ? 'quests' : ''} ${it.keepProjects ? 'projects' : ''} ${it.keepWorkshop ? 'workshop' : ''}`.toLowerCase();
          return searchable.includes(term);
        });
      }

      // Apply sorting
      const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };

      switch (this.currentSort) {
        case 'name':
          items.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'name-desc':
          items.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'price-high':
          items.sort((a, b) => (b.sellPrice || 0) - (a.sellPrice || 0));
          break;
        case 'price-low':
          items.sort((a, b) => (a.sellPrice || 0) - (b.sellPrice || 0));
          break;
        case 'rarity':
          items.sort((a, b) => (rarityOrder[b.rarity?.toLowerCase()] || 0) - (rarityOrder[a.rarity?.toLowerCase()] || 0));
          break;
        case 'damage':
          items.sort((a, b) => (b.damage || 0) - (a.damage || 0));
          break;
        case 'dps':
          items.sort((a, b) => (b.relativeDPS || 0) - (a.relativeDPS || 0));
          break;
      }

      this.filteredItems = items;
    },

    // Toggle filter
    toggleFilter(key) {
      if (this.activeFilters.has(key)) {
        this.activeFilters.delete(key);
      } else {
        this.activeFilters.add(key);
      }
      // Force reactivity
      this.activeFilters = new Set(this.activeFilters);
      this.renderItems();
    },

    // Get local image path
    getImagePath(name) {
      if (!name) return '';
      const filename = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      return `img/${filename}.png`;
    },

    // Build workshop data from recipes
    buildWorkshopData() {
      // Static workshop upgrade requirements (from wiki research)
      const upgradeRequirements = {
        'Workbench': {
          1: [],
          2: [{ qty: 5, name: 'Metal Parts' }, { qty: 5, name: 'Rubber Parts' }],
          3: [{ qty: 3, name: 'Mechanical Components' }, { qty: 5, name: 'Wires' }]
        },
        'Gunsmith': {
          1: [{ qty: 20, name: 'Metal Parts' }, { qty: 30, name: 'Rubber Parts' }],
          2: [{ qty: 3, name: 'Rusted Tools' }, { qty: 5, name: 'Mechanical Components' }, { qty: 8, name: 'Wasp Driver' }],
          3: [{ qty: 3, name: 'Rusted Gear' }, { qty: 5, name: 'Advanced Mechanical Components' }, { qty: 4, name: 'Sentinel Firing Core' }]
        },
        'Gear Bench': {
          1: [{ qty: 15, name: 'Plastic Parts' }, { qty: 20, name: 'Rubber Parts' }],
          2: [{ qty: 3, name: 'Synth Fabric' }, { qty: 5, name: 'Wires' }],
          3: [{ qty: 5, name: 'Advanced Electrical Components' }, { qty: 3, name: 'Sensor Array' }]
        },
        'Medical Lab': {
          1: [{ qty: 10, name: 'Plastic Parts' }, { qty: 15, name: 'Wires' }],
          2: [{ qty: 3, name: 'Medical Supplies' }, { qty: 5, name: 'Chemicals' }],
          3: [{ qty: 5, name: 'Advanced Medical Supplies' }, { qty: 3, name: 'Rare Chemicals' }]
        },
        'Explosives Station': {
          1: [{ qty: 10, name: 'Metal Parts' }, { qty: 10, name: 'Chemicals' }],
          2: [{ qty: 5, name: 'Gunpowder' }, { qty: 3, name: 'Detonators' }],
          3: [{ qty: 5, name: 'Advanced Explosives' }, { qty: 3, name: 'Sensor Array' }]
        },
        'Utility Station': {
          1: [{ qty: 10, name: 'Wires' }, { qty: 15, name: 'Plastic Parts' }],
          2: [{ qty: 3, name: 'Electrical Components' }, { qty: 5, name: 'Mechanical Components' }],
          3: [{ qty: 5, name: 'Advanced Electrical Components' }, { qty: 3, name: 'Advanced Mechanical Components' }]
        },
        'Refiner': {
          1: [{ qty: 20, name: 'Metal Parts' }, { qty: 10, name: 'Wires' }],
          2: [{ qty: 5, name: 'Mechanical Components' }, { qty: 3, name: 'Electrical Components' }],
          3: [{ qty: 5, name: 'Advanced Mechanical Components' }, { qty: 5, name: 'Sensor Array' }]
        }
      };

      // Group recipes by workshop station and level
      const stationMap = {};

      for (const [recipeName, recipe] of Object.entries(this.recipes)) {
        const workshopText = recipe.workshop || '';
        // Parse "Gunsmith 2" -> station: "Gunsmith", level: 2
        const match = workshopText.match(/^(.+?)\s*(\d+)$/);
        if (!match) continue;

        const stationName = match[1].trim();
        const level = parseInt(match[2]);

        if (!stationMap[stationName]) {
          stationMap[stationName] = {};
        }
        if (!stationMap[stationName][level]) {
          stationMap[stationName][level] = [];
        }
        stationMap[stationName][level].push(recipeName);
      }

      // Convert to array format for template
      this.workshopStations = Object.entries(stationMap)
        .map(([name, levels]) => ({
          name,
          levels: Object.entries(levels)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([level, crafts]) => ({
              level: parseInt(level),
              crafts: crafts.sort(),
              requirements: upgradeRequirements[name]?.[parseInt(level)] || []
            }))
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    // Add workshop requirements to shopping list
    addWorkshopReqsToShoppingList(requirements) {
      let addedCount = 0;
      for (const req of requirements) {
        const have = this.getInventoryQuantity(req.name);
        const deficit = Math.max(0, req.qty - have);
        if (deficit > 0) {
          this.shoppingList = {
            ...this.shoppingList,
            [req.name]: (this.shoppingList[req.name] || 0) + deficit
          };
          addedCount++;
        }
      }
      this.saveState();
      if (addedCount > 0) {
        this.showToast(`Added ${addedCount} materials to shopping list`, 'success');
      } else {
        this.showToast('All materials already in inventory!', 'info');
      }
    },

    // Calculate crafting materials
    calculateCraft() {
      if (!this.selectedRecipe || !this.recipes[this.selectedRecipe]) {
        this.craftResult = null;
        return;
      }

      const recipe = this.recipes[this.selectedRecipe];
      const tree = [];
      const baseMaterials = {};

      // Recursive calculation
      const calculate = (itemName, qty, depth) => {
        const r = this.recipes[itemName];

        if (!r) {
          // Base material
          tree.push({ name: itemName, qty, depth, isBase: true });
          baseMaterials[itemName] = (baseMaterials[itemName] || 0) + qty;
          return;
        }

        // Craftable item
        tree.push({ name: itemName, qty, depth, isBase: false, workshop: r.workshop });

        for (const ing of r.ingredients) {
          calculate(ing.name, ing.qty * qty, depth + 1);
        }
      };

      calculate(this.selectedRecipe, 1, 0);

      this.craftResult = {
        workshop: recipe.workshop,
        tree,
        baseMaterials,
        sources: recipe.sources || null
      };
    },

    // Pin/unpin recipe
    togglePin(name) {
      if (this.isPinned(name)) {
        this.unpinRecipe(name);
      } else {
        this.pinRecipe(name);
      }
    },

    pinRecipe(name) {
      if (!this.pinnedRecipes.includes(name)) {
        this.pinnedRecipes = [...this.pinnedRecipes, name];
        this.saveState();
      }
    },

    unpinRecipe(name) {
      this.pinnedRecipes = this.pinnedRecipes.filter(n => n !== name);
      this.saveState();
    },

    isPinned(name) {
      return this.pinnedRecipes.includes(name);
    },

    // Inventory management
    addToInventory(name, qty = 1) {
      this.inventory = {
        ...this.inventory,
        [name]: (this.inventory[name] || 0) + qty
      };
      this.saveState();
      this.showToast(`Added ${qty}x ${name} to inventory`, 'success');
    },

    updateInventory(name, delta) {
      const newQty = (this.inventory[name] || 0) + delta;
      if (newQty <= 0) {
        this.removeFromInventory(name);
      } else {
        this.inventory = { ...this.inventory, [name]: newQty };
        this.saveState();
      }
    },

    setInventory(name, qty) {
      if (qty <= 0) {
        this.removeFromInventory(name);
      } else {
        this.inventory = { ...this.inventory, [name]: qty };
        this.saveState();
      }
    },

    removeFromInventory(name) {
      const { [name]: _, ...rest } = this.inventory;
      this.inventory = rest;
      this.saveState();
    },

    clearInventory() {
      if (confirm('Clear all inventory items?')) {
        this.inventory = {};
        this.saveState();
      }
    },

    getInventoryQuantity(name) {
      return this.inventory[name] || 0;
    },

    // Shopping list management
    addToShoppingList(name, qty = 1) {
      this.shoppingList = {
        ...this.shoppingList,
        [name]: (this.shoppingList[name] || 0) + qty
      };
      this.saveState();
      this.showToast(`Added ${qty}x ${name} to shopping list`, 'info');
    },

    updateShoppingList(name, delta) {
      const newQty = (this.shoppingList[name] || 0) + delta;
      if (newQty <= 0) {
        this.removeFromShoppingList(name);
      } else {
        this.shoppingList = { ...this.shoppingList, [name]: newQty };
        this.saveState();
      }
    },

    removeFromShoppingList(name) {
      const { [name]: _, ...rest } = this.shoppingList;
      this.shoppingList = rest;
      this.saveState();
    },

    clearShoppingList() {
      if (confirm('Clear shopping list?')) {
        this.shoppingList = {};
        this.saveState();
      }
    },

    // Add craft materials to shopping list
    addCraftToShoppingList() {
      if (!this.craftResult) return;

      let addedCount = 0;
      for (const [name, needed] of Object.entries(this.craftResult.baseMaterials)) {
        const have = this.getInventoryQuantity(name);
        const deficit = Math.max(0, needed - have);
        if (deficit > 0) {
          this.shoppingList = {
            ...this.shoppingList,
            [name]: (this.shoppingList[name] || 0) + deficit
          };
          addedCount++;
        }
      }
      this.saveState();
      if (addedCount > 0) {
        this.showToast(`Added ${addedCount} materials to shopping list`, 'success');
      } else {
        this.showToast('All materials already in inventory!', 'info');
      }
    },

    // Quick add
    quickAdd(target) {
      if (!this.quickAddItem) return;

      if (target === 'inventory') {
        this.addToInventory(this.quickAddItem, this.quickAddQty);
      } else {
        this.addToShoppingList(this.quickAddItem, this.quickAddQty);
      }

      this.quickAddItem = '';
      this.quickAddQty = 1;
    },

    // Export data
    async exportData() {
      const data = {
        inventory: this.inventory,
        shoppingList: this.shoppingList,
        pinnedRecipes: this.pinnedRecipes,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arcraiders-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    // Import data
    async importData(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.version) {
          throw new Error('Invalid file format');
        }

        if (data.inventory) this.inventory = data.inventory;
        if (data.shoppingList) this.shoppingList = data.shoppingList;
        if (data.pinnedRecipes) this.pinnedRecipes = data.pinnedRecipes;

        await this.saveState();
        alert('Data imported successfully!');
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }

      // Reset file input
      event.target.value = '';
    },

    // Clear all data
    async clearAllData() {
      if (confirm('This will delete all your inventory, shopping list, pinned recipes, and completed items. Continue?')) {
        this.inventory = {};
        this.shoppingList = {};
        this.pinnedRecipes = [];
        this.completedRequirements = new Set();
        await localforage.clear();
        this.showSettings = false;
      }
    },

    // Update storage info
    async updateStorageInfo() {
      try {
        const keys = await localforage.keys();
        let totalSize = 0;

        for (const key of keys) {
          const value = await localforage.getItem(key);
          totalSize += new Blob([JSON.stringify(value)]).size;
        }

        this.storageInfo = `${(totalSize / 1024).toFixed(1)} KB`;
      } catch (err) {
        this.storageInfo = 'Unknown';
      }
    }
  }));
});
