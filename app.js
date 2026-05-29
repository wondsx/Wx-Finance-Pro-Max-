(() => {
'use strict';

const Core = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => crypto.randomUUID();
  const esc = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const clone = v => window.structuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  const money = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const parseMoney = value => Number(String(value ?? '').replace(/\D+/g, '') || 0);
  const fmtDate = iso => iso ? new Intl.DateTimeFormat('es-CO').format(new Date(iso + 'T00:00:00')) : '';
  const todayISO = () => { const n = new Date(); const off = n.getTimezoneOffset() * 60000; return new Date(n.getTime() - off).toISOString().slice(0, 10); };
  const cap = s => { const t = String(s || ''); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };
  const semanticEmoji = name => {
    const t = String(name || '').toUpperCase();
    if (t.includes('NEQUI')) return '🟣'; if (t.includes('TARJETA')) return '💳'; if (t.includes('BILLETERA')) return '👛';
    if (t.includes('AHORRO')) return '🐍'; if (t.includes('COMIDA')) return '🍽️'; if (t.includes('PASAJES')) return '🚌';
    if (t.includes('META')) return '🎯'; if (t.includes('DEUDA')) return '🐍'; return '✨';
  };
  const nextPeriod = q => {
    const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const p = String(q || 'JUNIO Q1').trim().split(' ');
    const suf = (p.at(-1) || 'Q1').toUpperCase();
    const mes = p.slice(0, -1).join(' ').toUpperCase() || 'JUNIO';
    if (suf === 'Q1') return `${mes} Q2`;
    const i = meses.indexOf(mes);
    return `${meses[(i + 1 + 12) % 12]} Q1`;
  };
  const setTriggerLabel = (btnSel, label, placeholder = false) => {
    const btn = $(btnSel); if (!btn) return;
    btn.innerHTML = `<span class="${placeholder ? 'placeholder' : ''}">${esc(label || 'Seleccionar')}</span><span>▾</span>`;
  };
  const bindMoneyMask = selector => {
    $$(selector).forEach(input => {
      if (input.dataset.moneyMaskBound) return;
      input.dataset.moneyMaskBound = '1';
      const sync = () => {
        const raw = parseMoney(input.value);
        input.dataset.raw = String(raw);
        input.value = raw ? new Intl.NumberFormat('es-CO').format(raw) : '';
      };
      input.addEventListener('input', sync);
      input.addEventListener('blur', sync);
      sync();
    });
  };
  const toast = (msg, type = 'ok') => {
    const t = $('#toast');
    t.textContent = msg;
    t.style.display = 'block';
    t.style.background = type === 'error' ? '#8f2344' : type === 'warn' ? '#7b5a11' : '#0f6d5f';
    t.style.color = '#fff';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.style.display = 'none', 2800);
  };
  return { $, $$, uid, esc, clone, money, parseMoney, fmtDate, todayISO, cap, semanticEmoji, nextPeriod, setTriggerLabel, bindMoneyMask, toast };
})();

const Infra = (() => {
  const DB_NAME = 'wx-financiero-idb-v4';
  const STORE_NAME = 'app';
  const LEGACY_KEY = 'wx-financiero-db-v1';
  let dbPromise = null;
  const DEFAULT_DB = {
    schemaVersion: 4,
    config: { sueldoMensual: 1840000, quincenaActiva: 'JUNIO Q1', moneda: 'COP', prioridadId: 'deuda-1', bolsilloPrincipalId: 'bol-nequi' },
    wallets: [
      { id:'bol-nequi', nombre:'NEQUI', saldo:215000, tipo:'digital', activo:true },
      { id:'bol-tarjeta', nombre:'TARJETA', saldo:40000, tipo:'digital', activo:true },
      { id:'bol-billetera', nombre:'BILLETERA', saldo:7000, tipo:'efectivo', activo:true },
      { id:'bol-alcancia', nombre:'ALCANCÍA', saldo:40000, tipo:'ahorro', activo:true }
    ],
    categories: [
      { id:'cat-ingreso', nombre:'INGRESO', presupuesto:0, gastado:0, activa:true, especial:'ingreso', restriccion:'AMBAS', controlGerencial:false, metaId:'' },
      { id:'cat-transferencia', nombre:'TRANSFERENCIA', presupuesto:0, gastado:0, activa:true, especial:'transferencia', restriccion:'AMBAS', controlGerencial:false, metaId:'' },
      { id:'cat-riesgo', nombre:'FONDO RIESGO', presupuesto:25000, gastado:0, activa:true, especial:'riesgo', restriccion:'AMBAS', controlGerencial:false, metaId:'' },
      { id:'cat-antojos', nombre:'ANTOJOS', presupuesto:50000, gastado:0, activa:true, especial:'', restriccion:'Q1', controlGerencial:true, metaId:'' },
      { id:'cat-comida', nombre:'COMIDA', presupuesto:200000, gastado:0, activa:true, especial:'', restriccion:'Q1', controlGerencial:false, metaId:'' },
      { id:'cat-pasajes', nombre:'PASAJES', presupuesto:200000, gastado:0, activa:true, especial:'', restriccion:'Q1', controlGerencial:false, metaId:'' },
      { id:'cat-ahorro-deuda', nombre:'AHORRO DEUDA', presupuesto:700000, gastado:0, activa:true, especial:'', restriccion:'Q2', controlGerencial:false, metaId:'deuda-1' }
    ],
    goals: [
      { id:'meta-nariz', nombre:'Operación Nariz', objetivo:12000000, acumulado:0, activa:true },
      { id:'meta-brackets', nombre:'Tratamiento Brackets', objetivo:6000000, acumulado:0, activa:true }
    ],
    debts: [
      { id:'deuda-1', nombre:'Liquidar deuda', objetivo:1800000, abonado:500000, activa:true, prioridad:1 }
    ],
    movements: [], periods: [], wishlist: [], auditLog: []
  };
  const normalize = data => {
    const x = Core.clone(data || {});
    x.schemaVersion = 4;
    x.config ||= {};
    x.config.sueldoMensual = Number(x.config.sueldoMensual || 1840000);
    x.config.quincenaActiva = String(x.config.quincenaActiva || 'JUNIO Q1');
    x.config.moneda = 'COP';
    x.config.prioridadId ||= x.config.prioridadMetaId || x.config.prioridadDeudaId || 'deuda-1';
    x.wallets = (x.wallets || x.bolsillos || []).map(w => ({ id:w.id || Core.uid(), nombre:w.nombre || 'Bolsillo', saldo:Number(w.saldo)||0, tipo:w.tipo || 'digital', activo:w.activo !== false }));
    x.categories = (x.categories || x.categorias || []).map(c => ({ id:c.id || Core.uid(), nombre:c.nombre || 'Categoría', presupuesto:Number(c.presupuesto)||0, gastado:Number(c.gastado)||0, activa:c.activa !== false, especial:c.especial || '', restriccion:String(c.restriccion || 'AMBAS').toUpperCase(), controlGerencial:!!c.controlGerencial, metaId:c.metaId || '' }));
    x.goals = (x.goals || x.metas || []).map(g => ({ id:g.id || Core.uid(), nombre:g.nombre || 'Meta', objetivo:Number(g.objetivo)||0, acumulado:Number(g.acumulado)||0, activa:g.activa !== false }));
    x.debts = (x.debts || x.deudas || []).map((d, i) => ({ id:d.id || Core.uid(), nombre:d.nombre || 'Deuda', objetivo:Number(d.objetivo)||0, abonado:Number(d.abonado ?? d.acumulado)||0, activa:d.activa !== false, prioridad:Number(d.prioridad)||i+1 }));
    x.movements = (x.movements || x.historial || []).map(m => ({ ...m, id:m.id || Core.uid() }));
    x.periods = (x.periods || x.cierres || []).map(p => ({ ...p, id:p.id || Core.uid() }));
    x.wishlist = (x.wishlist || []).map(w => ({ id:w.id || Core.uid(), nombre:w.nombre || '', precio:Number(w.precio)||0, tienda:w.tienda || '', imagen:w.imagen || '', createdAt:w.createdAt || new Date().toISOString() }));
    x.auditLog = x.auditLog || [];
    if (!x.wallets.length) x.wallets = Core.clone(DEFAULT_DB.wallets);
    if (!x.categories.length) x.categories = Core.clone(DEFAULT_DB.categories);
    if (!x.goals.length) x.goals = Core.clone(DEFAULT_DB.goals);
    if (!x.debts.length) x.debts = Core.clone(DEFAULT_DB.debts);
    x.config.bolsilloPrincipalId ||= x.wallets[0]?.id || '';
    return x;
  };
  const open = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tr = db.transaction(STORE_NAME, mode);
      const store = tr.objectStore(STORE_NAME);
      const out = fn(store, tr);
      tr.oncomplete = () => resolve(out);
      tr.onerror = () => reject(tr.error);
      tr.onabort = () => reject(tr.error);
    });
  };
  const get = async key => new Promise(async (resolve, reject) => {
    try {
      const db = await open();
      const tr = db.transaction(STORE_NAME, 'readonly');
      const store = tr.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  const set = async (key, value) => tx('readwrite', store => store.put(value, key));
  const migrateLegacyIfNeeded = async () => {
    const existing = await get('db');
    if (existing) return normalize(existing);
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw);
        const migrated = normalize(legacy);
        await set('db', migrated);
        return migrated;
      } catch (e) {}
    }
    const fresh = normalize(DEFAULT_DB);
    await set('db', fresh);
    return fresh;
  };
  const loadDB = async () => normalize(await migrateLegacyIfNeeded());
  const saveDB = async db => set('db', normalize(db));
  return { DEFAULT_DB, normalize, loadDB, saveDB };
})();

const Store = (() => {
  let state = Core.clone(Infra.DEFAULT_DB);
  const listeners = new Set();
  const get = () => state;
  const set = next => { state = next; listeners.forEach(fn => fn(state)); };
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  return { get, set, subscribe };
})();

const Domain = (() => {
  const cloneState = s => Core.clone(s);
  const getWallet = (s, id) => s.wallets.find(x => x.id === id);
  const getCategory = (s, id) => s.categories.find(x => x.id === id);
  const getGoal = (s, id) => s.goals.find(x => x.id === id);
  const getDebt = (s, id) => s.debts.find(x => x.id === id);
  const totalDisponible = s => s.wallets.filter(w => w.activo).reduce((a, b) => a + (Number(b.saldo) || 0), 0);
  const totalLiquido = s => s.wallets.filter(w => w.activo && w.tipo !== 'ahorro').reduce((a, b) => a + (Number(b.saldo) || 0), 0);
  const totalAhorro = s => s.wallets.filter(w => w.activo && w.tipo === 'ahorro').reduce((a, b) => a + (Number(b.saldo) || 0), 0);
  const totalGastado = s => s.categories.filter(c => c.activa && !c.especial).reduce((a, b) => a + (Number(b.gastado) || 0), 0);
  const validRestriction = (cat, quincena) => {
    const r = String(cat.restriccion || 'AMBAS').toUpperCase();
    const q = String(quincena || '').toUpperCase();
    if (r === 'AMBAS') return true; if (r === 'Q1') return q.includes('Q1'); if (r === 'Q2') return q.includes('Q2');
    return true;
  };
  // Una categoría se considera de "Deseos" si está marcada como especial 'deseos'
  // o si su nombre alude a antojos/deseos. Al elegirla en el cajero se puede pagar
  // directamente un deseo del catálogo.
  const isWishCategory = cat => {
    if (!cat) return false;
    if (cat.especial === 'deseos') return true;
    const n = String(cat.nombre || '').toUpperCase();
    return n.includes('ANTOJO') || n.includes('DESEO');
  };
  const log = (s, action, detail) => { s.auditLog.unshift({ id: Core.uid(), action, detail, at: new Date().toISOString() }); if (s.auditLog.length > 300) s.auditLog.length = 300; };
  
  const registerIncome = (state, payload) => {
    const s = cloneState(state), w = getWallet(s, payload.bolsilloId), c = getCategory(s, payload.categoriaId);
    if (!w || !c) throw new Error('Bolsillo o categoría no encontrada.');
    w.saldo += payload.valor;
    s.movements.unshift({ id:Core.uid(), fecha:payload.fecha, concepto:payload.concepto, categoriaId:c.id, categoriaNombre:c.nombre, valor:payload.valor, bolsilloId:w.id, bolsilloNombre:w.nombre, quincena:s.config.quincenaActiva, tipo:'ingreso' });
    log(s, 'income', payload); return s;
  };
  const registerTransfer = (state, payload) => {
    const s = cloneState(state), o = getWallet(s, payload.origenId), d = getWallet(s, payload.destinoId), c = getCategory(s, payload.categoriaId);
    if (!o || !d || !c) throw new Error('Transferencia inválida.');
    if (o.id === d.id) throw new Error('Origen y destino no pueden ser iguales.');
    if (o.saldo < payload.valor) throw new Error('Fondos insuficientes.');
    o.saldo -= payload.valor; d.saldo += payload.valor;
    s.movements.unshift({ id:Core.uid(), fecha:payload.fecha, concepto:payload.concepto, categoriaId:c.id, categoriaNombre:c.nombre, valor:payload.valor, origenId:o.id, origenNombre:o.nombre, destinoId:d.id, destinoNombre:d.nombre, quincena:s.config.quincenaActiva, tipo:'transferencia' });
    log(s, 'transfer', payload); return s;
  };
  const registerRisk = (state, payload) => {
    const s = cloneState(state), o = getWallet(s, payload.origenId), d = getWallet(s, payload.destinoId), c = getCategory(s, payload.categoriaId);
    if (!o || !d || !c) throw new Error('Fondo Riesgo inválido.');
    if (String(o.nombre).toUpperCase() !== 'NEQUI') throw new Error('Fondo Riesgo debe salir de NEQUI.');
    if (!['TARJETA', 'BILLETERA'].includes(String(d.nombre).toUpperCase())) throw new Error('Destino inválido para Fondo Riesgo.');
    if (o.saldo < payload.valor) throw new Error('Fondos insuficientes.');
    o.saldo -= payload.valor; d.saldo += payload.valor; c.gastado += payload.valor;
    s.movements.unshift({ id:Core.uid(), fecha:payload.fecha, concepto:payload.concepto, categoriaId:c.id, categoriaNombre:c.nombre, valor:payload.valor, origenId:o.id, origenNombre:o.nombre, destinoId:d.id, destinoNombre:d.nombre, quincena:s.config.quincenaActiva, tipo:'riesgo' });
    log(s, 'risk', payload); return s;
  };
  const registerExpense = (state, payload) => {
    const s = cloneState(state), w = getWallet(s, payload.bolsilloId), c = getCategory(s, payload.categoriaId);
    if (!w || !c) throw new Error('Gasto inválido.');
    if (!validRestriction(c, s.config.quincenaActiva)) throw new Error('La categoría no aplica para esta quincena.');
    // Compra de un deseo del catálogo directamente desde el cajero.
    let wish = null;
    if (payload.wishId) {
      wish = s.wishlist.find(x => x.id === payload.wishId);
      if (!wish) throw new Error('Debe seleccionar un deseo válido del catálogo.');
    }
    if (w.saldo < payload.valor) throw new Error('Fondos insuficientes en el bolsillo.');
    w.saldo -= payload.valor; c.gastado += payload.valor;
    if (payload.deudaId) {
      const d = getDebt(s, payload.deudaId); if (!d) throw new Error('Debe seleccionar una deuda.'); d.abonado += payload.valor;
    }
    // Una categoría puede estar vinculada a una meta o a una deuda (metaId). El abono
    // se refleja en el objetivo correspondiente para que todo quede conectado.
    let metaLinkId = '';
    if (c.metaId && !payload.deudaId) {
      const goal = getGoal(s, c.metaId);
      if (goal) { goal.acumulado += payload.valor; metaLinkId = c.metaId; }
      else { const linkedDebt = getDebt(s, c.metaId); if (linkedDebt) { linkedDebt.abonado += payload.valor; metaLinkId = c.metaId; } }
    }
    const mov = { id:Core.uid(), fecha:payload.fecha, concepto:payload.concepto, categoriaId:c.id, categoriaNombre:c.nombre, valor:payload.valor, bolsilloId:w.id, bolsilloNombre:w.nombre, quincena:s.config.quincenaActiva, tipo:'gasto', deudaId:payload.deudaId || '', metaLinkId };
    if (wish) { mov.wishData = wish; s.wishlist = s.wishlist.filter(x => x.id !== wish.id); }
    s.movements.unshift(mov);
    log(s, 'expense', payload); return s;
  };
  const reverseMovement = (state, movementId) => {
    const s = cloneState(state), m = s.movements.find(x => x.id === movementId); if (!m) throw new Error('Movimiento no encontrado.');
    if (m.tipo === 'ingreso') { const w = getWallet(s, m.bolsilloId); if (w) w.saldo = Math.max(0, w.saldo - m.valor); }
    if (m.tipo === 'transferencia') { const o = getWallet(s, m.origenId), d = getWallet(s, m.destinoId); if (o) o.saldo += m.valor; if (d) d.saldo = Math.max(0, d.saldo - m.valor); }
    if (m.tipo === 'riesgo') { const o = getWallet(s, m.origenId), d = getWallet(s, m.destinoId), c = getCategory(s, m.categoriaId); if (o) o.saldo += m.valor; if (d) d.saldo = Math.max(0, d.saldo - m.valor); if (c) c.gastado = Math.max(0, c.gastado - m.valor); }
    if (m.tipo === 'gasto') {
        const w = getWallet(s, m.bolsilloId), c = getCategory(s, m.categoriaId);
        if (w) w.saldo += m.valor;
        if (c) c.gastado = Math.max(0, c.gastado - m.valor);
        if (m.deudaId) { const d = getDebt(s, m.deudaId); if (d) d.abonado = Math.max(0, d.abonado - m.valor); }
        if (m.metaLinkId) {
            const g = getGoal(s, m.metaLinkId); if (g) g.acumulado = Math.max(0, g.acumulado - m.valor);
            const d2 = getDebt(s, m.metaLinkId); if (d2) d2.abonado = Math.max(0, d2.abonado - m.valor);
        }
        // Si el movimiento provino de comprar un deseo, lo devolvemos al catálogo.
        if (m.wishData) {
            s.wishlist.unshift(m.wishData);
        }
    }
    s.movements = s.movements.filter(x => x.id !== movementId);
    log(s, 'reverse', { movementId }); return s;
  };

  const buyWishlist = (state, payload) => {
    const s = cloneState(state), item = s.wishlist.find(w => w.id === payload.wishId), wallet = getWallet(s, payload.bolsilloId);
    if (!item || !wallet) throw new Error('Compra inválida.');
    if (wallet.saldo < item.precio) throw new Error('Fondos insuficientes para comprar este deseo.');
    
    wallet.saldo -= item.precio;
    s.movements.unshift({ 
        id:Core.uid(), 
        fecha:Core.todayISO(), 
        concepto:`Compra de Antojo: ${item.nombre}`, 
        categoriaId:'', 
        categoriaNombre:'WISHLIST', 
        valor:item.precio, 
        bolsilloId:wallet.id, 
        bolsilloNombre:wallet.nombre, 
        quincena:s.config.quincenaActiva, 
        tipo:'gasto',
        wishData: item 
    });
    s.wishlist = s.wishlist.filter(w => w.id !== item.id);
    log(s, 'buy_wishlist', payload); return s;
  };
  const closePeriod = state => {
    const s = cloneState(state), siguiente = Core.nextPeriod(s.config.quincenaActiva), mitad = Math.round((Number(s.config.sueldoMensual) || 0) / 2);
    s.periods.push({ id:Core.uid(), quincena:s.config.quincenaActiva, salario:s.config.sueldoMensual, totalGastado:totalGastado(s), disponible:totalDisponible(s), closedAt:new Date().toISOString() });
    s.categories.forEach(c => { c.gastado = 0; });
    s.config.quincenaActiva = siguiente;
    const w = getWallet(s, s.config.bolsilloPrincipalId || s.wallets[0]?.id);
    if (w) w.saldo += mitad;
    s.movements.unshift({ id:Core.uid(), fecha:Core.todayISO(), concepto:'PAGO DE QUINCENA', categoriaId:'cat-ingreso', categoriaNombre:'INGRESO', valor:mitad, bolsilloId:w?.id || '', bolsilloNombre:w?.nombre || '', quincena:siguiente, tipo:'ingreso' });
    log(s, 'close_period', { siguiente }); return s;
  };
  return { totalDisponible, totalLiquido, totalAhorro, totalGastado, validRestriction, isWishCategory, registerIncome, registerTransfer, registerRisk, registerExpense, reverseMovement, buyWishlist, closePeriod };
})();

const UI = (() => {
  const q = Core.$;
  const qq = Core.$$;
  const byId = id => document.getElementById(id);
  const getState = () => Store.get();
  const sync = ('BroadcastChannel' in window) ? new BroadcastChannel('wx-financiero-sync') : null;
  let _suppressBroadcast = false;
  const saveAndCommit = async next => {
    Store.set(next);
    await Infra.saveDB(next);
    renderActive();
    if (sync && !_suppressBroadcast) { try { sync.postMessage({ type: 'state-changed' }); } catch (e) {} }
  };
  // Recarga el estado desde la base persistente y repinta. Usado para mantener
  // sincronizadas todas las pestañas/ventanas abiertas del mismo navegador.
  let _reloadTimer = null;
  const reloadFromStore = () => {
    clearTimeout(_reloadTimer);
    _reloadTimer = setTimeout(async () => {
      try {
        const loaded = await Infra.loadDB();
        _suppressBroadcast = true;
        Store.set(loaded);
        _suppressBroadcast = false;
        renderActive();
      } catch (e) {}
    }, 60);
  };

  /* Confirmación premium basada en modal (reemplaza window.confirm) */
  let _confirmResolver = null;
  const settleConfirm = val => { const r = _confirmResolver; _confirmResolver = null; if (r) r(val); };
  const askConfirm = (title, message, { okText = 'Confirmar', danger = true } = {}) => new Promise(resolve => {
    settleConfirm(false);
    _confirmResolver = resolve;
    openModal(title, `<p class="confirm-msg">${Core.esc(message)}</p>`,
      `<button class="btn ${danger ? 'danger-btn' : 'primary'}" type="button" data-confirm-ok="1">${Core.esc(okText)}</button><button class="btn secondary" type="button" data-confirm-cancel="1">Cancelar</button>`);
  });

  /* Tema claro/oscuro persistente */
  const THEME_KEY = 'wx-financiero-theme';
  const applyTheme = t => {
    const theme = t === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#eef3fb' : '#0b1220');
    const btn = byId('themeToggle'); if (btn) btn.textContent = theme === 'light' ? '☀' : '☾';
  };
  const toggleTheme = () => {
    const next = (document.documentElement.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  };


  const openModal = (title, bodyHTML, actionsHTML = '') => { 
    byId('modalTitle').textContent = title; 
    byId('modalBody').innerHTML = bodyHTML; 
    byId('modalActions').innerHTML = actionsHTML; 
    byId('modalOverlay').classList.add('open'); 
  };
  const closeModal = () => { byId('modalOverlay').classList.remove('open'); settleConfirm(false); };
  
  const openSelectionSheet = (title, options, selectedValue, onPick) => {
    byId('sheetTitle').textContent = title;
    byId('sheetBody').innerHTML = `<div class="sheet-list">${options.map(opt => `<button class="sheet-option ${String(opt.value)===String(selectedValue)?'active':''}" type="button" data-sheet-value="${Core.esc(opt.value)}"><strong>${Core.esc(opt.label)}</strong>${opt.sub?`<div style="margin-top:4px;color:var(--muted);font-size:.8rem">${Core.esc(opt.sub)}</div>`:''}</button>`).join('')}</div>`;
    byId('sheetActions').innerHTML = '<button class="btn secondary" type="button" data-close-sheet="1" style="width:100%;">Cerrar</button>';
    byId('sheetOverlay').classList.add('open');
    qq('#sheetBody [data-sheet-value]').forEach(btn => btn.addEventListener('click', () => { onPick(btn.dataset.sheetValue); closeSheet(); }));
  };
  const closeSheet = () => byId('sheetOverlay').classList.remove('open');
  
  const bindDynamicSheet = (btnSel, inputSel, title, getOptions, getLabel) => {
    const btn = q(btnSel), input = q(inputSel); if (!btn || !input) return;
    // Guardamos siempre las últimas funciones/datos en el propio botón para que el
    // selector use información fresca (deudas, deseos, bolsillos recién creados, etc.)
    // en lugar de quedar atrapado en el estado capturado en el primer enlace.
    btn._sheetGetOptions = getOptions;
    btn._sheetGetLabel = getLabel;
    btn._sheetTitle = title;
    const refresh = () => { const opts = btn._sheetGetOptions(); const label = btn._sheetGetLabel(input.value, opts); Core.setTriggerLabel(btnSel, label, !input.value); };
    if (btn.dataset.sheetBound !== '1') {
      btn.dataset.sheetBound = '1';
      btn.addEventListener('click', () => openSelectionSheet(btn._sheetTitle, btn._sheetGetOptions(), input.value, v => { input.value = v; refresh(); input.dispatchEvent(new Event('change', {bubbles: true})); }));
    }
    refresh();
  };
  const currentView = () => document.querySelector('.view.active')?.id || 'dashboard';
  const setTab = id => {
    qq('.view').forEach(v => v.classList.toggle('active', v.id === id));
    qq('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    const meta = byId(id); byId('pageTitle').textContent = meta?.dataset.title || 'Wx'; byId('pageSubtitle').textContent = meta?.dataset.subtitle || '';
    history.replaceState(null, '', '#' + id);
    render(id);
  };
  
  const renderDashboard = s => {
    const debt = [...s.debts.filter(d => d.activa)].sort((a,b) => a.prioridad - b.prioridad)[0];
    const pct = debt && debt.objetivo > 0 ? Math.min((debt.abonado / debt.objetivo) * 100, 100) : 0;
    byId('dashDisponible').textContent = Core.money(Domain.totalLiquido(s));
    byId('dashSaldoTotal').textContent = 'Patrimonio total: ' + Core.money(Domain.totalDisponible(s)) + ' · Ahorro: ' + Core.money(Domain.totalAhorro(s));
    byId('dashPct').textContent = Math.round(pct) + '%'; byId('dashDonut').style.setProperty('--p', pct + '%');
    byId('dashMissionTitle').textContent = debt?.nombre || 'Sin deuda prioritaria';
    byId('dashMissionHint').textContent = 'Progreso: ' + Math.round(pct) + '%';
    byId('dashMissionGap').textContent = Core.money(Math.max((debt?.objetivo||0) - (debt?.abonado||0), 0));
    byId('dashQuincena').textContent = s.config.quincenaActiva; byId('dashWishCount').textContent = String(s.wishlist.length);
    const wl = byId('dashWallets'); wl.innerHTML = '';
    s.wallets.filter(w => w.activo).forEach(w => wl.insertAdjacentHTML('beforeend', `<div class="item"><div><strong>${Core.esc(Core.semanticEmoji(w.nombre))} ${Core.esc(w.nombre)}</strong><small>${Core.esc(Core.cap(w.tipo))}</small></div><span class="badge money">${Core.money(w.saldo)}</span></div>`));
    const cl = byId('dashCriticalCats'); cl.innerHTML = '';
    const ordered = s.categories.filter(c => c.activa && !c.especial).map(c => ({ ...c, pct: c.presupuesto > 0 ? (c.gastado / c.presupuesto) * 100 : 0 })).sort((a,b) => b.pct - a.pct).slice(0, 4);
    if (!ordered.length) cl.innerHTML = '<div class="note">Sin categorías críticas.</div>';
    ordered.forEach(c => cl.insertAdjacentHTML('beforeend', `<div class="item"><div><strong>${Core.esc(c.nombre)}</strong><small class="money">${Core.money(c.gastado)} de ${Core.money(c.presupuesto)}</small></div><span class="badge ${c.pct>=100?'danger':c.pct>=70?'warn':'ok'}">${Math.round(c.pct)}%</span></div>`));
  };
  const renderPlan = s => {
    const body = byId('planBody'); body.innerHTML = '';
    s.categories.filter(c => c.activa && !c.especial).forEach(c => {
      const pct = c.presupuesto > 0 ? (c.gastado / c.presupuesto) * 100 : 0;
      const disp = Math.max(c.presupuesto - c.gastado, 0);
      const chip = (c.restriccion || 'AMBAS').toLowerCase() === 'q1' ? 'q1' : (c.restriccion || 'AMBAS').toLowerCase() === 'q2' ? 'q2' : 'ambas';
      body.insertAdjacentHTML('beforeend', `<tr><td>${Core.esc(c.nombre)}</td><td>${Core.money(c.gastado)}</td><td>${Core.money(c.presupuesto)}</td><td>${Core.money(disp)}</td><td><span class="chip ${chip}">${Core.esc(c.restriccion || 'AMBAS')}</span></td><td>${pct>=100?'Crítica':pct>=70?'Vigilar':'OK'}</td></tr>`);
    });
  };
  const renderHistory = s => {
    bindDynamicSheet('#filtroQuincenaBtn','#filtroQuincena','Filtro quincena',() => [{ value:'', label:'Todas' }, ...[...new Set(s.movements.map(m => m.quincena).filter(Boolean))].map(v => ({ value:v, label:v }))],(v, opts) => opts.find(o => o.value === v)?.label || 'Todas');
    bindDynamicSheet('#filtroCategoriaBtn','#filtroCategoria','Filtro categoría',() => [{ value:'', label:'Todas' }, ...[...new Set(s.movements.map(m => m.categoriaNombre).filter(Boolean))].map(v => ({ value:v, label:v }))],(v, opts) => opts.find(o => o.value === v)?.label || 'Todas');
    const fq = byId('filtroQuincena').value, fc = byId('filtroCategoria').value;
    const term = (byId('histSearch')?.value || '').trim().toLowerCase();
    const rows = s.movements.filter(m => (!fq || m.quincena === fq) && (!fc || m.categoriaNombre === fc) && (!term || `${m.concepto || ''} ${m.categoriaNombre || ''} ${m.bolsilloNombre || ''} ${m.origenNombre || ''} ${m.destinoNombre || ''}`.toLowerCase().includes(term)));
    const body = byId('historialBody'); body.innerHTML = '';
    if (!rows.length) { body.innerHTML = '<tr><td colspan="7" class="empty-cell">Sin movimientos que coincidan con el filtro.</td></tr>'; return; }
    const tipoTag = { ingreso:'ok', gasto:'danger', transferencia:'primary', riesgo:'warn' };
    rows.forEach(m => {
      const pocket = m.tipo === 'transferencia' || m.tipo === 'riesgo' ? `${Core.esc(m.origenNombre || '')} → ${Core.esc(m.destinoNombre || '')}` : Core.esc(m.bolsilloNombre || '');
      const sign = m.tipo === 'ingreso' ? '+' : m.tipo === 'gasto' || m.tipo === 'riesgo' ? '−' : '';
      const valCls = m.tipo === 'ingreso' ? 'val-pos' : (m.tipo === 'gasto' || m.tipo === 'riesgo') ? 'val-neg' : '';
      body.insertAdjacentHTML('beforeend', `<tr><td>${Core.fmtDate(m.fecha)}</td><td>${Core.esc(m.concepto)}</td><td><span class="chip ${tipoTag[m.tipo]||''}">${Core.esc(m.categoriaNombre || '')}</span></td><td class="money ${valCls}">${sign}${Core.money(m.valor)}</td><td>${pocket}</td><td>${Core.esc(m.quincena || '')}</td><td><button class="btn danger-btn sm" type="button" data-action="reverse-movement" data-id="${m.id}">Revertir</button></td></tr>`);
    });
  };
  const renderGoals = s => {
    const mg = byId('metasGrid'); mg.innerHTML = '';
    s.goals.filter(g => g.activa).forEach(g => {
      const pct = g.objetivo > 0 ? Math.min((g.acumulado / g.objetivo) * 100, 100) : 0;
      mg.insertAdjacentHTML('beforeend', `<article class="card"><div class="section-title"><h3>${Core.esc(Core.semanticEmoji(g.nombre))} ${Core.esc(g.nombre)}</h3><span>Meta</span></div><div class="money" style="font-size:1.45rem">${Core.money(g.acumulado)}</div><div style="color:var(--muted);margin-top:4px" class="money">de ${Core.money(g.objetivo)}</div><div class="progress"><span style="width:${pct}%"></span></div><div style="color:var(--muted);margin-top:10px">${Math.round(pct)}% completado</div></article>`);
    });
    const dg = byId('debtsGrid'); dg.innerHTML = '';
    s.debts.filter(d => d.activa).sort((a,b) => a.prioridad - b.prioridad).forEach(d => {
      const pct = d.objetivo > 0 ? Math.min((d.abonado / d.objetivo) * 100, 100) : 0;
      dg.insertAdjacentHTML('beforeend', `<article class="debt-card"><div class="section-title"><h3>${Core.esc(Core.semanticEmoji(d.nombre))} ${Core.esc(d.nombre)}</h3><span>Prioridad ${d.prioridad}</span></div><div style="font-size:1.35rem;color:var(--danger)" class="money">${Core.money(Math.max(d.objetivo - d.abonado, 0))}</div><div style="color:var(--muted)">Faltante</div><div class="progress"><span style="width:${pct}%"></span></div><div style="display:flex;justify-content:space-between;color:var(--muted)" class="money"><span>${Core.money(d.abonado)}</span><span>${Math.round(pct)}%</span></div></article>`);
    });
  };

  const renderWishlist = s => {
    bindDynamicSheet('#wOrdenBtn','#wOrden','Orden',() => [{value:'new',label:'Más recientes'},{value:'price-desc',label:'Precio: mayor a menor'},{value:'price-asc',label:'Precio: menor a mayor'},{value:'name',label:'Nombre A-Z'}],(v, opts) => opts.find(o => o.value === v)?.label || 'Más recientes');
    bindDynamicSheet('#wPocketBuyBtn','#wPocketBuy','Bolsillo de referencia',() => s.wallets.filter(w => w.activo).map(w => ({ value:w.id, label:`${Core.semanticEmoji(w.nombre)} ${w.nombre}`, sub:Core.money(w.saldo) })),(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar bolsillo');
    if (!byId('wPocketBuy').value) byId('wPocketBuy').value = s.wallets.find(w => w.activo)?.id || '';
    let items = [...s.wishlist]; const order = byId('wOrden').value || 'new';
    if (order === 'price-desc') items.sort((a,b) => b.precio - a.precio); else if (order === 'price-asc') items.sort((a,b) => a.precio - b.precio); else if (order === 'name') items.sort((a,b) => String(a.nombre).localeCompare(String(b.nombre), 'es')); else items.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    
    byId('wTotalEstimado').textContent = 'Total: ' + Core.money(items.reduce((a,b) => a + (Number(b.precio)||0), 0));
    byId('wCountKpi').textContent = String(items.length);
    byId('wAvgKpi').textContent = Core.money(items.length ? items.reduce((a,b) => a + b.precio, 0) / items.length : 0);
    byId('wMaxKpi').textContent = Core.money(items.reduce((m, x) => Math.max(m, Number(x.precio)||0), 0));
    
    const grid = byId('wishlistGrid'); grid.innerHTML = '';
    if (!items.length) { grid.innerHTML = '<div class="note" style="grid-column: 1 / -1;">Sin deseos todavía. ¡Ahorra y planea tu próximo objetivo!</div>'; return; }
    
    items.forEach(w => {
      const isUrl = w.tienda && w.tienda.startsWith('http');
      const storeLink = isUrl ? w.tienda : (w.tienda ? `https://www.google.com/search?q=comprar+${encodeURIComponent(w.tienda)}+${encodeURIComponent(w.nombre)}` : '#');
      // En el inventario mostramos un nombre legible de la tienda (el dominio) en
      // lugar de la URL completa de la página.
      let storeName = w.tienda || '';
      if (isUrl) { try { storeName = new URL(w.tienda).hostname.replace(/^www\./, ''); } catch (e) { storeName = w.tienda; } }
      const storeLabel = storeName || 'Sin tienda configurada';

      grid.insertAdjacentHTML('beforeend', `
        <article class="wish-card">
            <div class="wish-media${w.imagen ? ' is-clickable' : ''}"${w.imagen ? ` data-action="view-wish-image" data-id="${w.id}" title="Ver imagen completa"` : ''}>${w.imagen?`<img src="${Core.esc(w.imagen)}" alt="${Core.esc(w.nombre)}">`:`<div style="font-weight:900;color:var(--muted);font-size:2rem;">WX</div>`}</div>
            <h4 class="wish-title">${Core.esc(w.nombre)}</h4>
            <div class="wish-store">${Core.esc(storeLabel)}</div>
            <div class="wish-price money">${Core.money(w.precio)}</div>
            <div class="wish-actions">
                <a href="${storeLink}" target="${isUrl ? '_blank' : '_self'}" class="btn secondary sm btn-full" ${!w.tienda ? 'style="pointer-events:none;opacity:0.4;"' : ''}>🔗 Ir a la tienda</a>
                <button class="btn secondary sm" type="button" data-action="edit-wish" data-id="${w.id}">Editar</button>
                <button class="btn primary sm" type="button" data-action="confirm-buy-wish" data-id="${w.id}">Comprar</button>
                <button class="btn danger-btn sm btn-full" type="button" data-action="delete-wish" data-id="${w.id}">Eliminar</button>
            </div>
        </article>
      `);
    });
  };

  const renderSummary = s => {
    const body = byId('resumenBody'); body.innerHTML = '';
    if (!s.periods.length) body.innerHTML = '<tr><td colspan="4" style="color:var(--muted);padding:22px">Aún no hay cierres.</td></tr>';
    [...s.periods].reverse().forEach(p => body.insertAdjacentHTML('beforeend', `<tr><td>${Core.esc(p.quincena)}</td><td>${Core.money(p.salario)}</td><td>${Core.money(p.totalGastado)}</td><td>${Core.money(p.disponible)}</td></tr>`));
    byId('cierrePeriodo').textContent = s.config.quincenaActiva; byId('cierreTotalBolsillos').textContent = Core.money(Domain.totalDisponible(s)); byId('cierreTotalGastado').textContent = Core.money(Domain.totalGastado(s));
  };
  const renderSettings = s => {
    byId('ajSueldo').value = new Intl.NumberFormat('es-CO').format(Number(s.config.sueldoMensual)||0);
    bindDynamicSheet('#ajQuincenaBtn','#ajQuincena','Quincena activa',() => [{ value:'ENERO Q1',label:'ENERO Q1'},{ value:'ENERO Q2',label:'ENERO Q2'},{ value:'FEBRERO Q1',label:'FEBRERO Q1'},{ value:'FEBRERO Q2',label:'FEBRERO Q2'},{ value:'MARZO Q1',label:'MARZO Q1'},{ value:'MARZO Q2',label:'MARZO Q2'},{ value:'ABRIL Q1',label:'ABRIL Q1'},{ value:'ABRIL Q2',label:'ABRIL Q2'},{ value:'MAYO Q1',label:'MAYO Q1'},{ value:'MAYO Q2',label:'MAYO Q2'},{ value:'JUNIO Q1',label:'JUNIO Q1'},{ value:'JUNIO Q2',label:'JUNIO Q2'},{ value:'JULIO Q1',label:'JULIO Q1'},{ value:'JULIO Q2',label:'JULIO Q2'},{ value:'AGOSTO Q1',label:'AGOSTO Q1'},{ value:'AGOSTO Q2',label:'AGOSTO Q2'},{ value:'SEPTIEMBRE Q1',label:'SEPTIEMBRE Q1'},{ value:'SEPTIEMBRE Q2',label:'SEPTIEMBRE Q2'},{ value:'OCTUBRE Q1',label:'OCTUBRE Q1'},{ value:'OCTUBRE Q2',label:'OCTUBRE Q2'},{ value:'NOVIEMBRE Q1',label:'NOVIEMBRE Q1'},{ value:'NOVIEMBRE Q2',label:'NOVIEMBRE Q2'},{ value:'DICIEMBRE Q1',label:'DICIEMBRE Q1'},{ value:'DICIEMBRE Q2',label:'DICIEMBRE Q2'}],(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar quincena');
    byId('ajQuincena').value = s.config.quincenaActiva;
    bindDynamicSheet('#ajMetaPrioritariaBtn','#ajMetaPrioritaria','Meta / deuda prioritaria',() => [{ value:'', label:'Sin prioridad' }, ...s.debts.filter(d => d.activa).map(d => ({ value:d.id, label:`🐍 ${d.nombre}` })), ...s.goals.filter(g => g.activa).map(g => ({ value:g.id, label:`🎯 ${g.nombre}` }))],(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar prioridad');
    byId('ajMetaPrioritaria').value = s.config.prioridadId || '';
    bindDynamicSheet('#ajBolsilloPrincipalBtn','#ajBolsilloPrincipal','Bolsillo principal',() => s.wallets.filter(w => w.activo).map(w => ({ value:w.id, label:`${Core.semanticEmoji(w.nombre)} ${w.nombre}` })),(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar bolsillo');
    byId('ajBolsilloPrincipal').value = s.config.bolsilloPrincipalId || '';
    byId('walletsCrud').innerHTML = s.wallets.map(w => `<div class="item"><div><strong>${Core.esc(Core.semanticEmoji(w.nombre))} ${Core.esc(w.nombre)}</strong><small>${Core.esc(Core.cap(w.tipo))} · ${w.activo?'Activo':'Inactivo'}</small></div><div class="actions"><button class="btn secondary sm" type="button" data-action="edit-wallet" data-id="${w.id}">Editar</button><button class="btn danger-btn sm" type="button" data-action="delete-wallet" data-id="${w.id}">Eliminar</button></div></div>`).join('');
    byId('catsCrud').innerHTML = s.categories.map(c => `<div class="item"><div><strong>${Core.esc(c.nombre)}</strong><small>${Core.esc(c.restriccion)} · ${c.controlGerencial?'Control gerencial':'Libre'}</small></div><div class="actions"><button class="btn secondary sm" type="button" data-action="edit-category" data-id="${c.id}">Editar</button><button class="btn danger-btn sm" type="button" data-action="delete-category" data-id="${c.id}">Eliminar</button></div></div>`).join('');
    byId('goalsCrud').innerHTML = s.goals.map(g => `<div class="item"><div><strong>${Core.esc(g.nombre)}</strong><small class="money">${Core.money(g.acumulado)} de ${Core.money(g.objetivo)}</small></div><div class="actions"><button class="btn secondary sm" type="button" data-action="edit-goal" data-id="${g.id}">Editar</button><button class="btn danger-btn sm" type="button" data-action="delete-goal" data-id="${g.id}">Eliminar</button></div></div>`).join('');
    byId('debtsCrud').innerHTML = s.debts.map(d => `<div class="item"><div><strong>${Core.esc(d.nombre)}</strong><small class="money">Prioridad ${d.prioridad} · ${Core.money(d.abonado)} de ${Core.money(d.objetivo)}</small></div><div class="actions"><button class="btn secondary sm" type="button" data-action="edit-debt" data-id="${d.id}">Editar</button><button class="btn danger-btn sm" type="button" data-action="delete-debt" data-id="${d.id}">Eliminar</button></div></div>`).join('');
    Core.bindMoneyMask('#ajSueldo');
  };
  const hydrateCajero = s => {
    if (!byId('cajFecha').value) byId('cajFecha').value = Core.todayISO();
    bindDynamicSheet('#cajCategoriaBtn','#cajCategoria','Categoría',() => s.categories.filter(c => c.activa).map(c => ({ value:c.id, label:c.nombre, sub:c.especial ? `Especial: ${c.especial}` : `Restricción: ${c.restriccion}` })),(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar categoría');
    bindDynamicSheet('#cajBolsilloBtn','#cajBolsillo','Bolsillo',() => s.wallets.filter(w => w.activo).map(w => ({ value:w.id, label:`${Core.semanticEmoji(w.nombre)} ${w.nombre}`, sub:Core.money(w.saldo) })),(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar bolsillo');
    bindDynamicSheet('#cajOrigenBtn','#cajOrigen','Bolsillo origen',() => s.wallets.filter(w => w.activo).map(w => ({ value:w.id, label:`${Core.semanticEmoji(w.nombre)} ${w.nombre}`, sub:Core.money(w.saldo) })),(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar origen');
    bindDynamicSheet('#cajDestinoBtn','#cajDestino','Bolsillo destino',() => s.wallets.filter(w => w.activo).map(w => ({ value:w.id, label:`${Core.semanticEmoji(w.nombre)} ${w.nombre}`, sub:Core.money(w.saldo) })),(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar destino');
    bindDynamicSheet('#cajDeudaBtn','#cajDeuda','Deuda objetivo',() => s.debts.filter(d => d.activa).sort((a,b) => a.prioridad - b.prioridad).map(d => ({ value:d.id, label:`🐍 ${d.nombre}`, sub:`Faltan ${Core.money(Math.max(d.objetivo - d.abonado, 0))}` })),(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar deuda');
    bindDynamicSheet('#cajDeseoBtn','#cajDeseo','Deseo del catálogo',() => s.wishlist.map(w => ({ value:w.id, label:`✨ ${w.nombre}`, sub:Core.money(w.precio) })),(v, opts) => opts.find(o => o.value === v)?.label || 'Seleccionar deseo');
    if (!byId('cajCategoria').value) byId('cajCategoria').value = s.categories.find(c => c.activa)?.id || '';
    if (!byId('cajBolsillo').value) byId('cajBolsillo').value = s.wallets.find(w => w.activo)?.id || '';
    updateCajeroUI(s); Core.bindMoneyMask('#cajValor');
  };
  const updateCajeroUI = s => {
    const cat = s.categories.find(c => c.id === byId('cajCategoria').value);
    const special = cat?.especial || '';
    byId('cajBolsilloSlot').classList.toggle('is-hidden', special === 'transferencia' || special === 'riesgo');
    byId('cajOrigenSlot').classList.toggle('is-hidden', !(special === 'transferencia' || special === 'riesgo'));
    byId('cajDestinoSlot').classList.toggle('is-hidden', !(special === 'transferencia' || special === 'riesgo'));
    const tram = String(cat?.nombre || '').toUpperCase() === 'AHORRO DEUDA';
    byId('cajDeudaSlot').classList.toggle('is-hidden', !tram);
    // Selector de deseos: visible al elegir una categoría de Deseos/Antojos.
    const wishCat = Domain.isWishCategory(cat);
    byId('cajDeseoSlot').classList.toggle('is-hidden', !wishCat);
    if (!wishCat && byId('cajDeseo').value) byId('cajDeseo').value = '';
    if (wishCat) {
      const wish = s.wishlist.find(w => w.id === byId('cajDeseo').value);
      if (wish) {
        const valorInput = byId('cajValor');
        valorInput.value = new Intl.NumberFormat('es-CO').format(Number(wish.precio) || 0);
        valorInput.dataset.raw = String(Number(wish.precio) || 0);
        if (!byId('cajConcepto').value.trim()) byId('cajConcepto').value = wish.nombre;
      }
    }
    byId('cajRiskNote').hidden = special !== 'riesgo';
    const walletId = (special === 'transferencia' || special === 'riesgo') ? byId('cajOrigen').value : byId('cajBolsillo').value;
    const w = s.wallets.find(x => x.id === walletId);
    byId('cajSaldoRef').textContent = w ? `Saldo disponible: ${Core.money(w.saldo)}` : 'Seleccione un bolsillo';
    const mb = byId('cajModeLabel');
    const mh = byId('cajModeHint');
    if (mb) {
      const MODES = {
        ingreso:      { t:'📥 Ingreso',        bg:'rgba(82,219,168,.16),rgba(82,219,168,.08)',  bc:'rgba(82,219,168,.30)',  c:'var(--ok)'     },
        transferencia:{ t:'🔁 Transferencia',  bg:'rgba(56,202,255,.16),rgba(114,128,255,.10)', bc:'rgba(56,202,255,.28)',  c:'var(--primary)'},
        riesgo:       { t:'⚠️ Fondo Riesgo',   bg:'rgba(255,200,67,.16),rgba(255,200,67,.08)',  bc:'rgba(255,200,67,.30)',  c:'var(--warn)'   },
      };
      const tramMode  = { t:'🐍 Tramacazo', bg:'rgba(255,96,136,.16),rgba(255,96,136,.08)', bc:'rgba(255,96,136,.30)', c:'var(--danger)' };
      const defMode   = { t:'💸 Gasto',     bg:'rgba(56,202,255,.14),rgba(114,128,255,.08)', bc:'rgba(56,202,255,.20)', c:'var(--primary)'};
      const st = MODES[special] || (tram ? tramMode : defMode);
      mb.textContent = st.t;
      mb.style.background = `linear-gradient(135deg,${st.bg})`;
      mb.style.borderColor = st.bc;
      mb.style.color = st.c;
    }
    if (mh) mh.textContent = cat ? `${cat.nombre}${cat.restriccion && cat.restriccion !== 'AMBAS' ? ' · Solo ' + cat.restriccion : ''}` : 'Seleccione una categoría para comenzar';
  };
  const render = viewId => {
    const s = getState();
    if (viewId === 'dashboard') renderDashboard(s);
    if (viewId === 'plan') renderPlan(s);
    if (viewId === 'historial') renderHistory(s);
    if (viewId === 'metas') renderGoals(s);
    if (viewId === 'wishlist') renderWishlist(s);
    if (viewId === 'resumen') renderSummary(s);
    if (viewId === 'ajustes') renderSettings(s);
    if (viewId === 'cajero') hydrateCajero(s);
  };
  const renderActive = () => render(currentView());
  const renderEverything = () => ['dashboard','plan','historial','metas','wishlist','resumen','ajustes','cajero'].forEach(render);
  const exportJSON = async auto => {
    const s = getState();
    const blob = new Blob([JSON.stringify(s, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `wx-financiero-${s.config.quincenaActiva.replaceAll(' ','-').toLowerCase()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
    if (!auto) Core.toast('Backup exportado.');
  };
  const importJSON = async file => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const next = Infra.normalize(parsed);
    await saveAndCommit(next);
    Core.toast('Backup importado correctamente.');
  };

  /* ======================================================================
     REESTRUCTURACIÓN DE FORMULARIOS MODALES (CAJERO-GRID MASTER)
     ====================================================================== */
  const walletForm = item => {
    const x = item || { id:'', nombre:'', saldo:0, tipo:'digital', activo:true };
    openModal(item ? 'Editar bolsillo' : 'Nuevo bolsillo', `
      <div class="cajero-grid">
        <div class="cajero-slot"><div class="field"><label>Nombre</label><input id="mWalNombre" type="text" autocomplete="off" value="${Core.esc(x.nombre)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Saldo</label><input id="mWalSaldo" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat('es-CO').format(Number(x.saldo)||0)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Tipo</label><button class="select-trigger" id="mWalTipoBtn" type="button"></button><input id="mWalTipo" type="hidden" value="${Core.esc(x.tipo || 'digital')}"></div></div>
      </div>`, 
      `<button class="btn primary" type="button" data-modal-save="wallet">Guardar</button><button class="btn secondary" type="button" data-close-modal="1">Cancelar</button>`);
    byId('modalBox').dataset.editId = x.id || '';
    bindDynamicSheet('#mWalTipoBtn','#mWalTipo','Tipo de bolsillo',() => [{value:'digital',label:'Digital'},{value:'efectivo',label:'Efectivo'},{value:'ahorro',label:'Ahorro'}],(v, opts) => opts.find(o => o.value === v)?.label || 'Digital');
    Core.bindMoneyMask('#mWalSaldo');
  };

  const categoryForm = item => {
    const x = item || { id:'', nombre:'', presupuesto:0, gastado:0, especial:'', restriccion:'AMBAS', controlGerencial:false, metaId:'', activa:true };
    const s = getState();
    openModal(item ? 'Editar categoría' : 'Nueva categoría', `
      <div class="cajero-grid">
        <div class="cajero-slot"><div class="field"><label>Nombre</label><input id="mCatNombre" type="text" autocomplete="off" value="${Core.esc(x.nombre)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Presupuesto</label><input id="mCatPresupuesto" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat('es-CO').format(Number(x.presupuesto)||0)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Gastado actual</label><input id="mCatGastado" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat('es-CO').format(Number(x.gastado)||0)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Especial</label><input id="mCatEspecial" type="text" autocomplete="off" value="${Core.esc(x.especial||'')}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Restricción</label><button class="select-trigger" id="mCatRestriccionBtn" type="button"></button><input id="mCatRestriccion" type="hidden" value="${Core.esc(x.restriccion||'AMBAS')}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Control gerencial</label><button class="select-trigger" id="mCatControlBtn" type="button"></button><input id="mCatControl" type="hidden" value="${String(!!x.controlGerencial)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Meta vinculada</label><button class="select-trigger" id="mCatMetaBtn" type="button"></button><input id="mCatMeta" type="hidden" value="${Core.esc(x.metaId||'')}"></div></div>
      </div>`, 
      `<button class="btn primary" type="button" data-modal-save="category">Guardar</button><button class="btn secondary" type="button" data-close-modal="1">Cancelar</button>`);
    byId('modalBox').dataset.editId = x.id || '';
    bindDynamicSheet('#mCatRestriccionBtn','#mCatRestriccion','Restricción',() => [{value:'AMBAS',label:'♾️ Ambas'},{value:'Q1',label:'① Solo Q1'},{value:'Q2',label:'② Solo Q2'}],(v, opts) => opts.find(o => o.value === v)?.label || 'AMBAS');
    bindDynamicSheet('#mCatControlBtn','#mCatControl','Control gerencial',() => [{value:'false',label:'No'},{value:'true',label:'Sí'}],(v, opts) => opts.find(o => o.value === v)?.label || 'No');
    bindDynamicSheet('#mCatMetaBtn','#mCatMeta','Meta vinculada',() => [{value:'',label:'Sin meta vinculada'}, ...s.goals.filter(g=>g.activa).map(g => ({value:g.id,label:`🎯 ${g.nombre}`})), ...s.debts.filter(d=>d.activa).map(d => ({value:d.id,label:`🐍 ${d.nombre}`}))],(v, opts) => opts.find(o => o.value === v)?.label || 'Sin meta vinculada');
    Core.bindMoneyMask('#mCatPresupuesto, #mCatGastado');
  };

  const goalForm = item => {
    const x = item || { id:'', nombre:'', objetivo:0, acumulado:0, activa:true };
    openModal(item ? 'Editar meta' : 'Nueva meta', `
      <div class="cajero-grid">
        <div class="cajero-slot"><div class="field"><label>Nombre</label><input id="mGoalNombre" type="text" autocomplete="off" value="${Core.esc(x.nombre)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Objetivo</label><input id="mGoalObjetivo" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat('es-CO').format(Number(x.objetivo)||0)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Acumulado</label><input id="mGoalAcumulado" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat('es-CO').format(Number(x.acumulado)||0)}"></div></div>
      </div>`, 
      `<button class="btn primary" type="button" data-modal-save="goal">Guardar</button><button class="btn secondary" type="button" data-close-modal="1">Cancelar</button>`);
    byId('modalBox').dataset.editId = x.id || ''; Core.bindMoneyMask('#mGoalObjetivo, #mGoalAcumulado');
  };

  const debtForm = item => {
    const s = getState();
    const x = item || { id:'', nombre:'', objetivo:0, abonado:0, activa:true, prioridad:s.debts.length + 1 };
    openModal(item ? 'Editar deuda' : 'Nueva deuda', `
      <div class="cajero-grid">
        <div class="cajero-slot"><div class="field"><label>Nombre</label><input id="mDebtNombre" type="text" autocomplete="off" value="${Core.esc(x.nombre)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Objetivo</label><input id="mDebtObjetivo" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat('es-CO').format(Number(x.objetivo)||0)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Abonado</label><input id="mDebtAbonado" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat('es-CO').format(Number(x.abonado)||0)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Prioridad</label><input id="mDebtPrioridad" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat('es-CO').format(Number(x.prioridad)||1)}"></div></div>
      </div>`, 
      `<button class="btn primary" type="button" data-modal-save="debt">Guardar</button><button class="btn secondary" type="button" data-close-modal="1">Cancelar</button>`);
    byId('modalBox').dataset.editId = x.id || ''; Core.bindMoneyMask('#mDebtObjetivo, #mDebtAbonado, #mDebtPrioridad');
  };

  const wishlistForm = item => {
    const x = item || { id:'', nombre:'', precio:0, tienda:'', imagen:'', createdAt:new Date().toISOString() };
    openModal('Editar deseo', `
      <div class="cajero-grid">
        <div class="cajero-slot half"><div class="field"><label>Nombre</label><input id="mWishNombre" type="text" autocomplete="off" placeholder="Ej. Monitor OLED PG32UCDM" value="${Core.esc(x.nombre)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Precio</label><input id="mWishPrecio" type="text" inputmode="numeric" autocomplete="off" placeholder="$ 0" value="${new Intl.NumberFormat('es-CO').format(Number(x.precio)||0)}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>Tienda / Enlace</label><input id="mWishTienda" type="url" autocomplete="off" placeholder="https://..." value="${Core.esc(x.tienda||'')}"></div></div>
        <div class="cajero-slot half"><div class="field"><label>URL de la Imagen</label><input id="mWishImagen" type="url" autocomplete="off" placeholder="Pega el enlace a la foto..." value="${Core.esc(x.imagen||'')}"></div></div>
      </div>`, 
      `<button class="btn primary" type="button" data-modal-save="wish">Guardar</button><button class="btn secondary" type="button" data-close-modal="1">Cancelar</button>`);
    byId('modalBox').dataset.editId = x.id || '';
    Core.bindMoneyMask('#mWishPrecio');
  };

  const confirmBuyWish = (id) => {
    const s = getState();
    const wish = s.wishlist.find(w => w.id === id);
    if(!wish) return;
    
    const pocketOptions = s.wallets.filter(w => w.activo).map(w => `<option value="${w.id}">${w.nombre} (Disponible: ${Core.money(w.saldo)})</option>`).join('');

    openModal('Confirmar pago de deseo', `
        <div style="text-align:center; margin-bottom: 20px;">
            <div class="money" style="font-size: 1.8rem; color: var(--primary);">${Core.money(wish.precio)}</div>
            <p style="margin: 8px 0; font-weight: bold; font-size: 1.1rem;">${Core.esc(wish.nombre)}</p>
            <p style="color: var(--muted); font-size: 0.9rem;">¿De qué bolsillo saldrá el dinero?</p>
        </div>
        <div class="field">
            <select id="confirmWishPocket" class="select-trigger" style="width:100%; appearance: auto; background: var(--glass); color: var(--text);">
                ${pocketOptions}
            </select>
        </div>
    `, `<button class="btn primary" type="button" data-action="execute-buy-wish" data-id="${wish.id}">Pagar y registrar gasto</button><button class="btn secondary" type="button" data-close-modal="1">Cancelar</button>`);
  };

  const saveModalEntity = async kind => {
    const s = Core.clone(getState());
    const editId = byId('modalBox').dataset.editId || '';
    if (kind === 'wallet') {
      const payload = { id: editId || Core.uid(), nombre: byId('mWalNombre').value.trim(), saldo: Core.parseMoney(byId('mWalSaldo').value), tipo: byId('mWalTipo').value || 'digital', activo: true };
      if (!payload.nombre) return Core.toast('Nombre requerido.','error');
      const idx = s.wallets.findIndex(x => x.id === payload.id); if (idx >= 0) s.wallets[idx] = { ...s.wallets[idx], ...payload }; else s.wallets.push(payload);
    }
    if (kind === 'category') {
      const payload = { id: editId || Core.uid(), nombre: byId('mCatNombre').value.trim(), presupuesto: Core.parseMoney(byId('mCatPresupuesto').value), gastado: Core.parseMoney(byId('mCatGastado').value), especial: byId('mCatEspecial').value.trim(), restriccion: byId('mCatRestriccion').value || 'AMBAS', controlGerencial: byId('mCatControl').value === 'true', metaId: byId('mCatMeta').value || '', activa: true };
      if (!payload.nombre) return Core.toast('Nombre requerido.','error');
      const idx = s.categories.findIndex(x => x.id === payload.id); if (idx >= 0) s.categories[idx] = { ...s.categories[idx], ...payload }; else s.categories.push(payload);
    }
    if (kind === 'goal') {
      const payload = { id: editId || Core.uid(), nombre: byId('mGoalNombre').value.trim(), objetivo: Core.parseMoney(byId('mGoalObjetivo').value), acumulado: Core.parseMoney(byId('mGoalAcumulado').value), activa: true };
      if (!payload.nombre) return Core.toast('Nombre requerido.','error');
      const idx = s.goals.findIndex(x => x.id === payload.id); if (idx >= 0) s.goals[idx] = { ...s.goals[idx], ...payload }; else s.goals.push(payload);
    }
    if (kind === 'debt') {
      const payload = { id: editId || Core.uid(), nombre: byId('mDebtNombre').value.trim(), objetivo: Core.parseMoney(byId('mDebtObjetivo').value), abonado: Core.parseMoney(byId('mDebtAbonado').value), prioridad: Core.parseMoney(byId('mDebtPrioridad').value) || 1, activa: true };
      if (!payload.nombre) return Core.toast('Nombre requerido.','error');
      const idx = s.debts.findIndex(x => x.id === payload.id); if (idx >= 0) s.debts[idx] = { ...s.debts[idx], ...payload }; else s.debts.push(payload);
    }
    if (kind === 'wish') {
      const payload = { id: editId || Core.uid(), nombre: byId('mWishNombre').value.trim(), precio: Core.parseMoney(byId('mWishPrecio').value), tienda: byId('mWishTienda').value.trim(), imagen: byId('mWishImagen').value.trim() };
      if (!payload.nombre || payload.precio <= 0) return Core.toast('Nombre y precio son obligatorios.','error');
      const idx = s.wishlist.findIndex(x => x.id === payload.id); if (idx >= 0) s.wishlist[idx] = { ...s.wishlist[idx], ...payload }; else s.wishlist.push({ ...payload, createdAt:new Date().toISOString() });
    }
    closeModal(); await saveAndCommit(s); Core.toast('Elemento guardado.');
  };
  const saveGlobalSettings = async () => {
    const s = Core.clone(getState());
    s.config.sueldoMensual = Core.parseMoney(byId('ajSueldo').value);
    s.config.quincenaActiva = byId('ajQuincena').value || s.config.quincenaActiva;
    s.config.prioridadId = byId('ajMetaPrioritaria').value || '';
    s.config.bolsilloPrincipalId = byId('ajBolsilloPrincipal').value || s.config.bolsilloPrincipalId;
    await saveAndCommit(s); Core.toast('Configuración guardada.');
  };
  const saveWishlist = async () => {
    const s = Core.clone(getState());
    const payload = { id: Core.uid(), nombre: byId('wNombre').value.trim(), precio: Core.parseMoney(byId('wPrecio').value), tienda: byId('wTienda').value.trim(), imagen: byId('wImagen').value.trim(), createdAt: new Date().toISOString() };
    if (!payload.nombre || payload.precio <= 0) return Core.toast('Nombre y precio son obligatorios.','error');
    s.wishlist.unshift(payload);
    byId('wNombre').value = ''; byId('wPrecio').value = ''; byId('wTienda').value = ''; byId('wImagen').value = '';
    await saveAndCommit(s); Core.toast('Deseo guardado en el catálogo.');
  };
  const submitCajero = async () => {
    const s = getState();
    const categoriaId = byId('cajCategoria').value; const categoria = s.categories.find(c => c.id === categoriaId); if (!categoria) return Core.toast('Seleccione una categoría.','error');
    const valor = Core.parseMoney(byId('cajValor').value); if (valor <= 0) return Core.toast('El valor debe ser mayor que cero.','error');
    const payload = { fecha: byId('cajFecha').value || Core.todayISO(), concepto: byId('cajConcepto').value.trim() || categoria.nombre, categoriaId, valor, bolsilloId: byId('cajBolsillo').value, origenId: byId('cajOrigen').value, destinoId: byId('cajDestino').value, deudaId: byId('cajDeuda').value, wishId: Domain.isWishCategory(categoria) ? byId('cajDeseo').value : '' };
    if (categoria.controlGerencial && categoria.presupuesto > 0 && (categoria.gastado + valor) > (categoria.presupuesto / 2)) { if (!(await askConfirm('Control gerencial', 'Este gasto supera la mitad del presupuesto de la categoría. ¿Desea continuar de todas formas?', { okText: 'Continuar', danger: false }))) return; }
    try {
      let next = s;
      if (categoria.especial === 'ingreso') next = Domain.registerIncome(s, payload);
      else if (categoria.especial === 'transferencia') next = Domain.registerTransfer(s, payload);
      else if (categoria.especial === 'riesgo') next = Domain.registerRisk(s, payload);
      else next = Domain.registerExpense(s, payload);
      byId('cajConcepto').value = ''; byId('cajValor').value = ''; byId('cajDeuda').value = ''; byId('cajDeseo').value = ''; await saveAndCommit(next); Core.toast('Movimiento registrado.');
    } catch (e) { Core.toast(e.message || 'Error transaccional.','error'); }
  };
  const previewClose = () => {
    const s = getState();
    const principal = s.wallets.find(w => w.id === (s.config.bolsilloPrincipalId || s.wallets[0]?.id));
    const siguiente = Core.nextPeriod(s.config.quincenaActiva); const mitad = Math.round((Number(s.config.sueldoMensual)||0)/2);
    openModal('Previsualizar cierre', `<div style="display:grid;gap:10px"><div class="item"><div><strong>Periodo actual</strong></div><span class="badge">${Core.esc(s.config.quincenaActiva)}</span></div><div class="item"><div><strong>Siguiente quincena</strong></div><span class="badge ok">${Core.esc(siguiente)}</span></div><div class="item"><div><strong>Ingreso a registrar</strong><small>en ${Core.esc(principal?.nombre || 'bolsillo principal')}</small></div><span class="badge money">${Core.money(mitad)}</span></div><div class="item"><div><strong>Total gastado</strong></div><span class="badge danger money">${Core.money(Domain.totalGastado(s))}</span></div></div>`, `<button class="btn primary" type="button" data-action="confirm-close-period">Confirmar cierre</button><button class="btn secondary" type="button" data-close-modal="1">Cancelar</button>`);
  };
  const doClosePeriod = async () => {
    const next = Domain.closePeriod(getState());
    await saveAndCommit(next); closeModal(); await exportJSON(true); Core.toast('Cierre ejecutado.');
  };
  
  const quickAction = type => {
    setTab('cajero');
    const s = getState();
    const findByName = name => s.categories.find(c => String(c.nombre).toUpperCase() === name)?.id || '';
    
    // NUEVA LÓGICA: Selección automática para INGRESO
    if (type === 'INGRESO') byId('cajCategoria').value = s.categories.find(c => c.especial === 'ingreso')?.id || '';
    if (type === 'GASTO') byId('cajCategoria').value = s.categories.find(c => c.activa && !c.especial)?.id || '';
    if (type === 'TRANSFERENCIA') byId('cajCategoria').value = findByName('TRANSFERENCIA');
    if (type === 'TRAMACAZO') byId('cajCategoria').value = findByName('AHORRO DEUDA');
    
    updateCajeroUI(getState()); render('cajero');
  };
  
  const deleteEntity = async (kind, id) => {
    const cur = getState();
    const labels = { wallet: 'bolsillo', category: 'categoría', goal: 'meta', debt: 'deuda', wish: 'deseo' };
    const collections = { wallet: cur.wallets, category: cur.categories, goal: cur.goals, debt: cur.debts, wish: cur.wishlist };
    const target = (collections[kind] || []).find(x => x.id === id);
    const nombre = target?.nombre || 'este elemento';
    let warn = '';
    if (kind === 'wallet') { const used = cur.movements.filter(m => m.bolsilloId === id || m.origenId === id || m.destinoId === id).length; if (used) warn = ` Hay ${used} movimiento(s) en el historial que lo referencian (se conservarán como registro).`; }
    if (kind === 'category') { const used = cur.movements.filter(m => m.categoriaId === id).length; if (used) warn = ` Hay ${used} movimiento(s) asociados (se conservarán como registro).`; }
    if (!(await askConfirm(`Eliminar ${labels[kind] || 'elemento'}`, `¿Eliminar "${nombre}"?${warn}`, { okText: 'Eliminar' }))) return;
    const s = Core.clone(cur);
    if (kind === 'wallet') { s.wallets = s.wallets.filter(x => x.id !== id); if (s.config.bolsilloPrincipalId === id) s.config.bolsilloPrincipalId = s.wallets.find(w => w.activo)?.id || s.wallets[0]?.id || ''; }
    if (kind === 'category') { s.categories = s.categories.filter(x => x.id !== id); }
    if (kind === 'goal') { s.goals = s.goals.filter(x => x.id !== id); s.categories.forEach(c => { if (c.metaId === id) c.metaId = ''; }); if (s.config.prioridadId === id) s.config.prioridadId = ''; }
    if (kind === 'debt') { s.debts = s.debts.filter(x => x.id !== id); if (s.config.prioridadId === id) s.config.prioridadId = s.debts.find(d => d.activa)?.id || ''; }
    if (kind === 'wish') { s.wishlist = s.wishlist.filter(x => x.id !== id); }
    await saveAndCommit(s); Core.toast('Elemento eliminado.','warn');
  };

  const initEvents = () => {
    byId('modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeModal(); });
    byId('sheetOverlay').addEventListener('click', e => { if (e.target.id === 'sheetOverlay') closeSheet(); });
    document.addEventListener('click', async e => {
      const t = e.target.closest('button,[data-action],[data-tab],[data-quick],[data-close-modal],[data-close-sheet],[data-modal-save]');
      if (!t) return;
      if (t.dataset.tab) return setTab(t.dataset.tab);
      if (t.dataset.quick) return quickAction(t.dataset.quick);
      if (t.dataset.closeModal) return closeModal();
      if (t.dataset.confirmOk) { byId('modalOverlay').classList.remove('open'); return settleConfirm(true); }
      if (t.dataset.confirmCancel) return closeModal();
      if (t.dataset.closeSheet) return closeSheet();
      if (t.dataset.modalSave) return saveModalEntity(t.dataset.modalSave);
      if (t.id === 'guardarGlobalBtn') return saveGlobalSettings();
      if (t.id === 'wAgregarBtn') return saveWishlist();
      if (t.id === 'cajConfirmarBtn') return submitCajero();
      if (t.id === 'cajLimpiarBtn') { byId('cajConcepto').value=''; byId('cajValor').value=''; return Core.toast('Formulario limpio.'); }
      if (t.id === 'previewCierreBtn') return previewClose();
      if (t.id === 'backupTopBtn' || t.id === 'exportarJsonBtn') return exportJSON(false);
      if (t.id === 'importarJsonBtn') return byId('importFileInput').click();
      if (t.id === 'resetDbBtn') { if (!(await askConfirm('Resetear sistema', 'Esto borrará TODOS los datos y restaurará los valores de fábrica. Esta acción no se puede deshacer.', { okText: 'Borrar todo' }))) return; await saveAndCommit(Infra.normalize(Core.clone(Infra.DEFAULT_DB))); return Core.toast('Sistema reseteado.', 'warn'); }
      if (t.id === 'nuevoBolsilloBtn') return walletForm();
      if (t.id === 'nuevaCategoriaBtn') return categoryForm();
      if (t.id === 'nuevaMetaBtn') return goalForm();
      if (t.id === 'nuevaDeudaBtn') return debtForm();
      if (t.dataset.action === 'reverse-movement') { if (!(await askConfirm('Revertir movimiento', 'Se revertirán matemáticamente los saldos afectados y el movimiento se eliminará del historial.', { okText: 'Revertir' }))) return; try { return saveAndCommit(Domain.reverseMovement(getState(), t.dataset.id)); } catch (err) { return Core.toast(err.message,'error'); } }
      
      if (t.dataset.action === 'confirm-buy-wish') return confirmBuyWish(t.dataset.id);
      if (t.dataset.action === 'view-wish-image') {
        const wish = getState().wishlist.find(x => x.id === t.dataset.id);
        if (wish?.imagen) openModal(wish.nombre || 'Imagen', `<div class="lightbox"><img src="${Core.esc(wish.imagen)}" alt="${Core.esc(wish.nombre)}"></div>`, '<button class="btn secondary" type="button" data-close-modal="1" style="width:100%;">Cerrar</button>');
        return;
      }
      if (t.dataset.action === 'execute-buy-wish') { 
          const pocketId = byId('confirmWishPocket').value;
          try { 
              await saveAndCommit(Domain.buyWishlist(getState(), { wishId:t.dataset.id, bolsilloId:pocketId })); 
              closeModal();
              return Core.toast('¡Felicidades! Deseo comprado y registrado.', 'ok');
          } catch (err) { return Core.toast(err.message,'error'); } 
      }
      
      if (t.dataset.action === 'edit-wish') return wishlistForm(getState().wishlist.find(x => x.id === t.dataset.id));
      if (t.dataset.action === 'delete-wish') return deleteEntity('wish', t.dataset.id);
      if (t.dataset.action === 'edit-wallet') return walletForm(getState().wallets.find(x => x.id === t.dataset.id));
      if (t.dataset.action === 'delete-wallet') return deleteEntity('wallet', t.dataset.id);
      if (t.dataset.action === 'edit-category') return categoryForm(getState().categories.find(x => x.id === t.dataset.id));
      if (t.dataset.action === 'delete-category') return deleteEntity('category', t.dataset.id);
      if (t.dataset.action === 'edit-goal') return goalForm(getState().goals.find(x => x.id === t.dataset.id));
      if (t.dataset.action === 'delete-goal') return deleteEntity('goal', t.dataset.id);
      if (t.dataset.action === 'edit-debt') return debtForm(getState().debts.find(x => x.id === t.dataset.id));
      if (t.dataset.action === 'delete-debt') return deleteEntity('debt', t.dataset.id);
      if (t.dataset.action === 'confirm-close-period') return doClosePeriod();
    });
    document.addEventListener('change', e => {
      if (['cajCategoria','cajBolsillo','cajOrigen','cajDestino','cajDeuda','cajDeseo','filtroQuincena','filtroCategoria','wOrden','wPocketBuy'].includes(e.target.id)) renderActive();
    });
    document.addEventListener('input', e => {
      if (e.target.id === 'histSearch') renderHistory(getState());
    });
    byId('importFileInput').addEventListener('change', async e => {
      const f = e.target.files?.[0]; if (!f) return; try { await importJSON(f); } catch (err) { Core.toast('JSON inválido.','error'); } e.target.value = '';
    });
    byId('themeToggle').addEventListener('click', toggleTheme);
    // Sincronización entre pestañas/ventanas del mismo navegador
    if (sync) sync.onmessage = e => { if (e.data?.type === 'state-changed') reloadFromStore(); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reloadFromStore(); });
    window.addEventListener('focus', reloadFromStore);
    // Atajos de teclado (experiencia de escritorio)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (byId('sheetOverlay').classList.contains('open')) return closeSheet();
        if (byId('modalOverlay').classList.contains('open')) return closeModal();
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const id = e.target?.id;
        if (id === 'cajValor' || id === 'cajConcepto') { e.preventDefault(); submitCajero(); }
        else if (['wNombre','wPrecio','wTienda','wImagen'].includes(id)) { e.preventDefault(); saveWishlist(); }
      }
    });
  };
  const init = async () => {
    try { applyTheme(localStorage.getItem(THEME_KEY) || 'dark'); } catch (e) { applyTheme('dark'); }
    const loaded = await Infra.loadDB(); Store.set(loaded); initEvents();
    Core.bindMoneyMask('#cajValor, #wPrecio, #ajSueldo');
    const hash = location.hash.replace('#',''); setTab(hash && byId(hash) ? hash : 'dashboard'); renderEverything();
    if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }
  };
  return { init, renderActive };
})();

window.addEventListener('DOMContentLoaded', () => { UI.init().catch(err => { console.error(err); Core.toast('Error de inicialización.','error'); }); });
})();