/* WareFlow — vanilla JS warehouse picking system. State lives in one LocalStorage key. */
(() => {
'use strict';
const KEY = 'wareflow.v1';
const PRI = ['Urgent', 'High', 'Medium', 'Low'];
const ST = ['Pending', 'In Warehouse', 'In Progress', 'Completed', 'Cancelled'];
const NEXT = { 'Pending': ['In Warehouse', 'Cancelled'], 'In Warehouse': ['In Progress', 'Cancelled'], 'In Progress': ['Completed', 'Cancelled'], 'Completed': [], 'Cancelled': [] };
const AV = ['Available', 'On Break', 'Off Duty'];
const DEF = { company: 'Logistics Co.', dueSoon: 2 };
const NAV = [['dashboard', 'Overview Dashboard'], ['orders', 'Order Management'], ['picking', 'Picking Operations'], ['inventory', 'Inventory Management'], ['locations', 'Warehouse Locations'], ['workers', 'Worker Management'], ['analytics', 'Analytics & Productivity'], ['settings', 'Settings']];

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const addD = (n, b) => { const d = b ? new Date(b + 'T00:00') : new Date(); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const hay = (...a) => a.filter(x => x != null).join(' ').toLowerCase();
const cls = s => s.replace(/\s/g, '').toLowerCase();
const bd = (t, c) => `<span class="bd ${c || ''}">${esc(t)}</span>`;
const sb = s => bd(s, 's-' + cls(s));
const pb = p => bd(p, 'p-' + cls(p));
const optH = (arr, v) => arr.map(x => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`; }).join('');
const fld = (l, n, v = '', a = '', t = 'text') => `<label>${l}<input type="${t}" name="${n}" value="${esc(v)}" ${a}></label>`;
const sel = (l, n, o, v) => `<label>${l}<select name="${n}">${optH(o, v)}</select></label>`;
const empty = (t, s) => `<div class="empty"><b>${t}</b><p>${s}</p></div>`;
const card = (t, b) => `<section class="card"><h3>${t}</h3>${b}</section>`;
const kpi = (l, v, s, c = '') => `<div class="card kpi ${c}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`;
const bars = rows => { const m = Math.max(1, ...rows.map(r => r[1])); return rows.length ? `<div class="bars">${rows.map(([l, v]) => `<div class="bar"><span>${esc(l)}</span><div><i style="width:${Math.round(v / m * 100)}%"></i></div><b>${v}</b></div>`).join('')}</div>` : '<p class="muted">No data.</p>'; };
const pbar = p => `<div class="prog"><i style="width:${p}%"></i></div>`;

/* ---------- state & persistence ---------- */
function seed() {
  const workers = [['WRK-001', 'Alex Morgan', 'Picker'], ['WRK-002', 'Jordan Lee', 'Picker'], ['WRK-003', 'Sam Taylor', 'Team Lead']]
    .map(([id, name, role]) => ({ id, name, role, availability: 'Available', demo: true }));
  const inventory = [
    ['SKU-101', 'Wireless Mouse', 'Electronics', 'A', '01', '02', 42, 10], ['SKU-102', 'Mechanical Keyboard', 'Electronics', 'A', '01', '03', 18, 8],
    ['SKU-103', 'USB-C Hub', 'Electronics', 'A', '02', '01', 6, 10], ['SKU-201', 'Packing Tape', 'Packaging', 'B', '01', '01', 120, 40],
    ['SKU-202', 'Cardboard Box (M)', 'Packaging', 'B', '01', '02', 75, 30], ['SKU-203', 'Bubble Wrap Roll', 'Packaging', 'B', '02', '01', 9, 10],
    ['SKU-301', 'Safety Gloves', 'Safety', 'C', '01', '01', 60, 20], ['SKU-302', 'Hi-Vis Vest', 'Safety', 'C', '01', '02', 25, 10],
    ['SKU-401', 'Label Printer', 'Equipment', 'D', '01', '01', 8, 3], ['SKU-402', 'Pallet Jack', 'Equipment', 'D', '02', '01', 3, 2]
  ].map(([sku, name, category, aisle, rack, bin, quantity, minimumStock]) => ({ sku, name, category, description: '', aisle, rack, bin, quantity, minimumStock, demo: true }));
  const orders = [
    [1001, 'Acme Solutions', 'Rahul Sharma', 'Urgent', 'WRK-001', 'In Progress', -2, 1, [['SKU-101', 5, 5], ['SKU-103', 2, 0]]],
    [1002, 'Northwind Traders', 'Priya Nair', 'High', 'WRK-002', 'In Warehouse', -1, 2, [['SKU-201', 20, 0], ['SKU-202', 10, 0]]],
    [1003, 'Globex Logistics', 'Tom Becker', 'Medium', '', 'Pending', 0, 5, [['SKU-301', 12, 0], ['SKU-302', 6, 0]]],
    [1004, 'BlueRiver Retail', 'Meera Iyer', 'Low', 'WRK-003', 'Completed', -6, -3, [['SKU-102', 4, 4], ['SKU-101', 3, 3]]],
    [1005, 'Initech', 'Dan Wu', 'High', 'WRK-001', 'Completed', -3, -1, [['SKU-203', 5, 5]]],
    [1006, 'Umbrella Supplies', 'Lena Park', 'Urgent', '', 'Pending', -5, -1, [['SKU-401', 2, 0]]],
    [1007, 'Stark Fulfilment', 'J. Rao', 'Medium', 'WRK-002', 'Cancelled', -4, -1, [['SKU-402', 1, 0]]]
  ].map(([n, customer, placedBy, priority, workerId, status, c, d, it]) => {
    const done = status === 'Completed', createdAt = addD(c), history = [{ t: createdAt + 'T09:00', msg: 'Order created' }];
    if (status !== 'Pending') history.push({ t: createdAt + 'T10:00', msg: 'Status → ' + status });
    return { id: 'ORD-' + n, customer, placedBy, priority, workerId, status, createdAt, expectedDispatch: addD(d), items: it.map(([sku, quantity, pickedQuantity]) => ({ sku, quantity, pickedQuantity })), notes: '', demo: true, stockDeducted: done, completedAt: done ? addD(Math.min(c + 2, 0)) : null, history };
  });
  return { orders, inventory, workers, log: [], seq: 1007, settings: { ...DEF } };
}
let corrupted = false;
function load() {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d && ['orders', 'inventory', 'workers', 'log'].every(k => Array.isArray(d[k])) &&
        d.orders.every(o => o && o.id && Array.isArray(o.items) && Array.isArray(o.history) && ST.includes(o.status)) &&
        d.inventory.every(p => p && p.sku && Number.isFinite(p.quantity)) && d.workers.every(w => w && w.id)) {
        d.settings = { ...DEF, ...d.settings }; d.seq = +d.seq || 1100; return d;
      }
    } catch (e) { /* fall through */ }
    corrupted = true;
  }
  return seed();
}
let S = load(), view = 'dashboard', pickId = null, mcb = null;
const F0 = { q: '', status: '', pri: '', worker: '', sort: 'priority', iq: '', icat: '', isort: 'sku', lq: '', afrom: '', ato: '' };
let F = { ...F0 };
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save data (storage full or blocked).', 'err'); } }
function commit() { save(); render(); }

/* ---------- selectors / rules ---------- */
const inv = sku => S.inventory.find(p => p.sku === sku);
const wk = id => S.workers.find(w => w.id === id);
const getO = id => S.orders.find(o => o.id === id);
const loc = p => p ? `${p.aisle}-${p.rack}-${p.bin}` : '—';
const open = o => o.status !== 'Completed' && o.status !== 'Cancelled';
const isLow = p => p.quantity < p.minimumStock;
const reserved = (sku, ex) => S.orders.filter(o => open(o) && o.id !== ex).reduce((a, o) => a + o.items.filter(i => i.sku === sku).reduce((b, i) => b + i.quantity, 0), 0);
const avail = (sku, ex) => (inv(sku)?.quantity || 0) - reserved(sku, ex);
const cmp = (a, b) => (open(b) - open(a)) || (PRI.indexOf(a.priority) - PRI.indexOf(b.priority)) || a.expectedDispatch.localeCompare(b.expectedDispatch) || a.id.localeCompare(b.id);
const prog = o => { const t = o.items.length, n = o.items.filter(i => i.pickedQuantity >= i.quantity).length; return { n, t, pct: t ? Math.round(n / t * 100) : 0 }; };
const dueB = o => { if (!open(o)) return ''; const d = o.expectedDispatch; return d < today() ? bd('Overdue', 'p-urgent') : d <= addD(S.settings.dueSoon) ? bd('Due soon', 's-pending') : ''; };
const hist = (o, msg) => o.history.push({ t: new Date().toISOString(), msg });
const logS = (sku, delta, reason) => S.log.push({ t: new Date().toISOString(), sku, delta, reason, after: inv(sku).quantity });
const wopts = cur => [['', '— Unassigned —'], ...S.workers.filter(w => w.availability === 'Available' || w.id === cur).map(w => [w.id, w.name])];
function stats(os = S.orders) {
  const c = s => os.filter(o => o.status === s).length, done = c('Completed'), valid = os.length - c('Cancelled');
  return { total: os.length, act: os.filter(open).length, done, rate: valid ? Math.round(done / valid * 100) : 0 };
}

/* ---------- UI primitives ---------- */
function toast(msg, type = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + (type === 'err' ? 'err' : ''); t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3500);
}
function modal(title, body, cb, ok = 'Save', wide = false) {
  $('#mtitle').textContent = title; $('#mbody').innerHTML = body; $('#merr').textContent = '';
  mcb = cb; $('#mok').textContent = ok; $('#mok').hidden = !cb; $('.box').classList.toggle('wide', wide);
  $('#modal').hidden = false; ($('#mbody input:not([readonly]),#mbody select') || $('#mok')).focus();
}
const closeM = () => { $('#modal').hidden = true; mcb = null; };
const ask = (msg, fn, label = 'Confirm') => modal('Please confirm', `<p>${esc(msg)}</p>`, fn, label);

/* ---------- order form ---------- */
const rowH = i => `<div class="irow"><select name="sku" aria-label="Product">${optH([['', 'Select product…'], ...S.inventory.map(p => [p.sku, `${p.sku} · ${p.name} (${loc(p)}) — ${p.quantity} in stock`])], i.sku)}</select><input type="number" name="qty" min="1" value="${i.quantity}" aria-label="Quantity"><button type="button" class="btn sm" data-act="delrow" aria-label="Remove product">✕</button></div>`;
function orderForm(id) {
  const o = id ? getO(id) : null;
  if (o && !open(o)) return toast('Completed and cancelled orders are locked.', 'err');
  modal(o ? 'Edit ' + o.id : 'New order', `<div class="grid2">${fld('Order ID', 'oid', o ? o.id : 'ORD-' + (S.seq + 1), 'readonly')}${fld('Customer / company', 'customer', o?.customer)}${fld('Order placed by', 'placedBy', o?.placedBy, 'placeholder="Type any name"')}${sel('Priority', 'priority', PRI, o?.priority || 'Medium')}${fld('Order date', 'createdAt', o?.createdAt || today(), '', 'date')}${fld('Expected dispatch', 'expectedDispatch', o?.expectedDispatch || addD(3), '', 'date')}${sel('Assigned worker', 'workerId', wopts(o?.workerId), o?.workerId || '')}</div><h3>Products</h3><div id="rows">${(o ? o.items : [{ sku: '', quantity: 1 }]).map(rowH).join('')}</div><button type="button" class="btn sm" data-act="addrow">+ Add product</button><label style="margin-top:12px">Notes<textarea name="notes" rows="2">${esc(o?.notes)}</textarea></label>`,
    f => saveOrder(o, f), o ? 'Save changes' : 'Create order', true);
}
function saveOrder(o, f) {
  const g = n => (f.elements[n].value || '').trim();
  const customer = g('customer'), placedBy = g('placedBy'), createdAt = g('createdAt'), ed = g('expectedDispatch'), workerId = g('workerId');
  if (!customer) return 'Customer name is required.';
  if (!placedBy) return 'Enter who placed the order.';
  if (!createdAt || !ed) return 'Both dates are required.';
  if (ed < createdAt) return 'Dispatch date cannot be before the order date.';
  const items = [];
  for (const r of f.querySelectorAll('.irow')) {
    const sku = r.querySelector('[name=sku]').value, q = Number(r.querySelector('[name=qty]').value);
    if (!sku) return 'Select a product on every row.';
    if (!Number.isInteger(q) || q < 1) return 'Quantities must be whole numbers of 1 or more.';
    if (items.some(i => i.sku === sku)) return 'Each product can appear only once.';
    if (q > avail(sku, o?.id)) return `Insufficient stock for ${sku}: ${Math.max(0, avail(sku, o?.id))} available after other open orders.`;
    items.push({ sku, quantity: q, pickedQuantity: Math.min(q, o?.items.find(i => i.sku === sku)?.pickedQuantity || 0) });
  }
  if (!items.length) return 'Add at least one product.';
  if (workerId && workerId !== o?.workerId && wk(workerId)?.availability !== 'Available') return 'That worker is not available.';
  const d = { customer, placedBy, priority: g('priority'), createdAt, expectedDispatch: ed, workerId, items, notes: f.elements.notes.value.trim() };
  if (o) { Object.assign(o, d); hist(o, 'Order edited'); }
  else { const n = { id: 'ORD-' + (++S.seq), status: 'Pending', stockDeducted: false, completedAt: null, history: [], ...d }; hist(n, 'Order created'); S.orders.push(n); }
  commit(); toast(o ? 'Order updated.' : 'Order created.');
}

/* ---------- workflow ---------- */
function blockers(o) {
  if (prog(o).n < o.items.length) return 'Pick all items before completing.';
  const s = o.items.find(i => (inv(i.sku)?.quantity || 0) < i.quantity);
  return s ? `Insufficient stock for ${s.sku}.` : '';
}
function apply(o, to) {
  if (to === 'In Progress') {
    const w = wk(o.workerId);
    if (!w) return toast('Assign a worker before starting.', 'err');
    if (w.availability !== 'Available') return toast(`${w.name} is not available.`, 'err');
  }
  if (to === 'Completed') {
    const e = blockers(o); if (e) return toast(e, 'err');
    if (!o.stockDeducted) { // deduct exactly once
      o.items.forEach(i => { inv(i.sku).quantity -= i.quantity; logS(i.sku, -i.quantity, 'Order ' + o.id + ' completed'); });
      o.stockDeducted = true;
    }
    o.completedAt = today();
  }
  o.status = to; hist(o, 'Status → ' + to); commit(); toast(`${o.id} is now ${to}.`);
}
function doMove(id, to) {
  const o = getO(id);
  if (!o || !NEXT[o.status].includes(to)) return toast('That status change is not allowed.', 'err');
  if (to === 'Cancelled') return ask(`Cancel ${id}? No stock will be deducted.`, () => apply(o, to), 'Cancel order');
  if (to === 'Completed') { const e = blockers(o); if (e) return toast(e, 'err'); return ask(`Complete ${id}? Stock will be deducted once.`, () => apply(o, to), 'Complete order'); }
  apply(o, to);
}

/* ---------- views ---------- */
const V = {};
const olist = l => l.length ? `<ul class="ol">${l.map(o => `<li><button class="lnk" data-act="view" data-id="${o.id}">${o.id}</button><span>${esc(o.customer)}</span>${pb(o.priority)}${sb(o.status)}</li>`).join('')}</ul>` : '<p class="muted">Nothing here.</p>';
const wcount = (w, s) => S.orders.filter(o => o.workerId === w.id && o.status === s).length;
const avgDays = os => { const d = os.filter(o => o.completedAt); return d.length ? (d.reduce((a, o) => a + (new Date(o.completedAt) - new Date(o.createdAt)) / 864e5, 0) / d.length).toFixed(1) + ' d' : '—'; };

V.dashboard = () => {
  const s = stats(), units = S.inventory.reduce((a, p) => a + p.quantity, 0), low = S.inventory.filter(isLow).length;
  const pend = S.orders.filter(o => o.status === 'In Warehouse' || o.status === 'In Progress').reduce((a, o) => a + o.items.filter(i => i.pickedQuantity < i.quantity).length, 0);
  const recent = [...S.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, 5);
  const hp = S.orders.filter(o => open(o) && PRI.indexOf(o.priority) < 2).sort(cmp).slice(0, 5);
  const ip = S.orders.filter(o => o.status === 'In Progress');
  const cats = [...new Set(S.inventory.map(p => p.category))].map(c => [c, S.inventory.filter(p => p.category === c).reduce((a, p) => a + p.quantity, 0)]);
  return `<div class="head"><h1>Overview</h1><button class="btn pri" data-act="new">+ New order</button></div>
<div class="kpis">${kpi('Total orders', s.total, 'all records')}${kpi('Active orders', s.act, 'not completed or cancelled')}${kpi('Pending picks', pend, 'line items awaiting pick')}${kpi('Completed', s.done, 'orders')}${kpi('Inventory units', units, S.inventory.length + ' products')}${kpi('Low stock', low, 'below minimum', low ? 'warn' : '')}${kpi('Completion rate', s.rate + '%', 'excluding cancelled')}</div>
<div class="g2">${card('Recent orders', olist(recent))}${card('High-priority open orders', olist(hp))}
${card('Picking progress', ip.length ? ip.map(o => { const p = prog(o); return `<div><div class="row between"><b>${o.id}</b><small>${p.n}/${p.t} items · ${p.pct}%</small></div>${pbar(p.pct)}</div>`; }).join('') : '<p class="muted">No orders in progress.</p>')}
${card('Order status distribution', bars(ST.map(x => [x, S.orders.filter(o => o.status === x).length])))}
${card('Warehouse inventory (units by category)', bars(cats))}
${card('Worker activity', `<ul class="ol">${S.workers.map(w => `<li><span>${esc(w.name)}</span>${bd(w.availability)}<small>${wcount(w, 'In Progress')} active · ${S.orders.filter(o => o.workerId === w.id && open(o)).length} open</small></li>`).join('')}</ul>`)}
${card('Productivity summary', bars(S.workers.map(w => [w.name, wcount(w, 'Completed')])) + `<p class="muted">Avg. time to complete: ${avgDays(S.orders.filter(o => o.status === 'Completed'))}</p>`)}</div>`;
};

V.orders = () => `<div class="head"><h1>Order Management</h1><button class="btn pri" data-act="new">+ New order</button></div>
<div class="filters"><input data-f="q" type="search" value="${esc(F.q)}" placeholder="Order ID, customer, placed by, worker, product, SKU, location" aria-label="Search orders">
<select data-f="status" aria-label="Status">${optH([['', 'All statuses'], ...ST], F.status)}</select><select data-f="pri" aria-label="Priority">${optH([['', 'All priorities'], ...PRI], F.pri)}</select>
<select data-f="worker" aria-label="Worker">${optH([['', 'All workers'], ...S.workers.map(w => [w.id, w.name])], F.worker)}</select>
<select data-f="sort" aria-label="Sort">${optH([['priority', 'Sort: priority'], ['newest', 'Sort: newest'], ['oldest', 'Sort: oldest'], ['due', 'Sort: dispatch date']], F.sort)}</select><button class="btn" data-act="reset">Reset filters</button></div><div id="dyn"></div>`;
function drawOrders() {
  const q = F.q.toLowerCase().trim();
  const list = S.orders.filter(o => (!F.status || o.status === F.status) && (!F.pri || o.priority === F.pri) && (!F.worker || o.workerId === F.worker) &&
    (!q || hay(o.id, o.customer, o.placedBy, wk(o.workerId)?.name, ...o.items.flatMap(i => { const p = inv(i.sku); return [i.sku, p?.name, loc(p)]; })).includes(q)))
    .sort(F.sort === 'newest' ? (a, b) => b.createdAt.localeCompare(a.createdAt) : F.sort === 'oldest' ? (a, b) => a.createdAt.localeCompare(b.createdAt) : F.sort === 'due' ? (a, b) => a.expectedDispatch.localeCompare(b.expectedDispatch) : cmp);
  $('#dyn').innerHTML = list.length ? `<div class="card tw"><table><thead><tr><th>Order</th><th>Customer / placed by</th><th>Priority</th><th>Status</th><th>Worker</th><th>Picked</th><th>Dispatch</th><th></th></tr></thead><tbody>${list.map(o => `<tr><td><button class="lnk" data-act="view" data-id="${o.id}">${o.id}</button> ${o.demo ? bd('Demo') : ''}</td><td>${esc(o.customer)}<br><small>${esc(o.placedBy)}</small></td><td>${pb(o.priority)}</td><td>${sb(o.status)}${dueB(o)}</td><td>${esc(wk(o.workerId)?.name || '—')}</td><td>${prog(o).n}/${o.items.length}</td><td>${o.expectedDispatch}</td><td><button class="btn sm" data-act="view" data-id="${o.id}">View</button> <button class="btn sm" data-act="edit" data-id="${o.id}" ${open(o) ? '' : 'disabled'}>Edit</button> <button class="btn sm dng" data-act="del" data-id="${o.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="card">${empty('No orders match', 'Adjust the filters or create a new order.')}</div>`;
}
function detail(id) {
  const o = getO(id); if (!o) return;
  const op = open(o), w = wk(o.workerId);
  const main = o.status === 'Pending' ? `<button class="btn pri" data-act="move" data-id="${o.id}" data-to="In Warehouse">Receive into warehouse</button>` : o.status === 'In Warehouse' ? `<button class="btn pri" data-act="move" data-id="${o.id}" data-to="In Progress">Start picking</button>` : o.status === 'In Progress' ? `<button class="btn pri" data-act="openpick" data-id="${o.id}">Open picking</button>` : '';
  modal(`${o.id} · ${o.customer}`, `<p>${sb(o.status)}${pb(o.priority)}${dueB(o)}${o.demo ? bd('Demo') : ''}</p>
<dl class="dl"><dt>Placed by</dt><dd>${esc(o.placedBy)}</dd><dt>Order date</dt><dd>${o.createdAt}</dd><dt>Expected dispatch</dt><dd>${o.expectedDispatch}</dd><dt>Worker</dt><dd>${op ? `<select data-assign="${o.id}" aria-label="Assign worker">${optH(wopts(o.workerId), o.workerId)}</select>` : esc(w?.name || '—')}</dd><dt>Notes</dt><dd>${esc(o.notes) || '—'}</dd></dl>
<h3>Items</h3><div class="tw"><table><thead><tr><th>SKU</th><th>Product</th><th>Location</th><th>Qty</th><th>Picked</th></tr></thead><tbody>${o.items.map(i => { const p = inv(i.sku); return `<tr><td>${esc(i.sku)}</td><td>${esc(p?.name || 'Unknown')}</td><td><code>${loc(p)}</code></td><td>${i.quantity}</td><td>${i.pickedQuantity}</td></tr>`; }).join('')}</tbody></table></div>
<h3>History</h3><ul class="hist">${[...o.history].reverse().map(h => `<li><time>${esc(h.t.slice(0, 16).replace('T', ' '))}</time>${esc(h.msg)}</li>`).join('')}</ul>
${op ? `<div class="actions"><button class="btn" data-act="edit" data-id="${o.id}">Edit</button><button class="btn dng" data-act="move" data-id="${o.id}" data-to="Cancelled">Cancel order</button>${main}</div>` : ''}`, null, '', true);
}

V.picking = () => {
  const list = S.orders.filter(o => o.status === 'In Warehouse' || o.status === 'In Progress').sort(cmp);
  if (!list.some(o => o.id === pickId)) pickId = list[0]?.id;
  const o = getO(pickId);
  if (!o) return `<div class="head"><h1>Picking Operations</h1></div><div class="card">${empty('No orders ready for picking', 'Receive a pending order into the warehouse from Order Management.')}</div>`;
  const p = prog(o), w = wk(o.workerId), ip = o.status === 'In Progress';
  const items = [...o.items].sort((a, b) => loc(inv(a.sku)).localeCompare(loc(inv(b.sku))));
  return `<div class="head"><h1>Picking Operations</h1></div><div class="split"><div class="card list">${list.map(x => `<button class="li${x.id === pickId ? ' on' : ''}" data-act="openpick" data-id="${x.id}"><b>${x.id}</b> ${pb(x.priority)}<small>${esc(x.customer)} · ${x.status}</small></button>`).join('')}</div>
<div class="card"><div class="row between"><div><h2>${o.id} · ${esc(o.customer)}</h2><p class="muted">Worker: ${esc(w?.name || 'Unassigned')} ${dueB(o)}</p></div>${o.status === 'In Warehouse' ? `<button class="btn pri" data-act="move" data-id="${o.id}" data-to="In Progress">Start picking</button>` : ''}</div>
<p><b>${p.n} out of ${p.t} items picked — ${p.pct}%</b> <span class="muted">(${p.t - p.n} remaining)</span></p>${pbar(p.pct)}${ip ? '' : '<p class="note">Picking is locked until the order is In Progress.</p>'}
<div class="tw"><table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Location (aisle-rack-bin)</th><th>Status</th><th></th></tr></thead><tbody>${items.map(i => { const pr = inv(i.sku), done = i.pickedQuantity >= i.quantity; return `<tr><td>${esc(pr?.name || 'Unknown')}</td><td>${esc(i.sku)}</td><td>${i.quantity}</td><td><code>${loc(pr)}</code></td><td>${bd(done ? 'Picked' : 'To pick', done ? 's-completed' : 's-pending')}${pr && pr.quantity < i.quantity ? bd('Short stock', 'p-urgent') : ''}</td><td><button class="btn sm ${done ? '' : 'pri'}" data-act="${done ? 'unpick' : 'pick'}" data-id="${o.id}" data-sku="${esc(i.sku)}" ${ip ? '' : 'disabled'}>${done ? 'Undo' : 'Mark picked'}</button></td></tr>`; }).join('')}</tbody></table></div>
${ip ? `<div class="actions"><button class="btn pri" data-act="move" data-id="${o.id}" data-to="Completed" ${p.n < p.t ? 'disabled' : ''}>Complete order</button></div>` : ''}</div></div>`;
};

V.inventory = () => {
  const cats = [...new Set(S.inventory.map(p => p.category))].sort();
  return `<div class="head"><h1>Inventory Management</h1><button class="btn pri" data-act="newprod">+ Add product</button></div>
<div class="filters"><input data-f="iq" type="search" value="${esc(F.iq)}" placeholder="SKU, name, category, location" aria-label="Search products"><select data-f="icat" aria-label="Category">${optH([['', 'All categories'], ...cats], F.icat)}</select>
<select data-f="isort" aria-label="Sort">${optH([['sku', 'Sort: SKU'], ['qa', 'Quantity: low → high'], ['qd', 'Quantity: high → low']], F.isort)}</select><button class="btn" data-act="reset">Reset filters</button></div><div id="dyn"></div>
${S.log.length ? card('Recent stock adjustments', `<div class="tw"><table><thead><tr><th>Time</th><th>SKU</th><th>Change</th><th>New qty</th><th>Reason</th></tr></thead><tbody>${[...S.log].reverse().slice(0, 8).map(l => `<tr><td>${esc(l.t.slice(0, 16).replace('T', ' '))}</td><td>${esc(l.sku)}</td><td>${l.delta > 0 ? '+' : ''}${l.delta}</td><td>${l.after}</td><td>${esc(l.reason)}</td></tr>`).join('')}</tbody></table></div>`) : ''}`;
};
function drawInv() {
  const q = F.iq.toLowerCase().trim();
  const rows = S.inventory.filter(p => (!F.icat || p.category === F.icat) && (!q || hay(p.sku, p.name, p.category, loc(p)).includes(q)))
    .sort(F.isort === 'qa' ? (a, b) => a.quantity - b.quantity : F.isort === 'qd' ? (a, b) => b.quantity - a.quantity : (a, b) => a.sku.localeCompare(b.sku));
  $('#dyn').innerHTML = rows.length ? `<div class="card tw"><table><thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Location</th><th>Qty</th><th>Min</th><th>Stock</th><th></th></tr></thead><tbody>${rows.map(p => `<tr><td>${esc(p.sku)} ${p.demo ? bd('Demo') : ''}</td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td><code>${loc(p)}</code></td><td>${p.quantity}</td><td>${p.minimumStock}</td><td>${isLow(p) ? bd('Low stock', 'p-urgent') : bd('OK', 's-completed')}</td><td><button class="btn sm" data-act="adjust" data-sku="${esc(p.sku)}">Adjust</button> <button class="btn sm" data-act="editprod" data-sku="${esc(p.sku)}">Edit</button> <button class="btn sm dng" data-act="delprod" data-sku="${esc(p.sku)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="card">${empty('No products found', 'Change the filters or add a product.')}</div>`;
}
function prodForm(sku) {
  const p = sku ? inv(sku) : null;
  modal(p ? 'Edit ' + p.sku : 'Add product', `<div class="grid2">${fld('SKU', 'sku', p?.sku, p ? 'readonly' : 'placeholder="SKU-501"')}${fld('Product name', 'name', p?.name)}${fld('Category', 'category', p?.category, 'list="cats"')}<datalist id="cats">${[...new Set(S.inventory.map(x => x.category))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>${fld('Aisle', 'aisle', p?.aisle, 'maxlength="2" placeholder="A"')}${fld('Rack', 'rack', p?.rack, 'maxlength="3" placeholder="01"')}${fld('Bin', 'bin', p?.bin, 'maxlength="3" placeholder="02"')}${p ? '' : fld('Opening quantity', 'quantity', 0, 'min="0"', 'number')}${fld('Minimum stock', 'minimumStock', p?.minimumStock ?? 5, 'min="0"', 'number')}</div><label>Description<textarea name="description" rows="2">${esc(p?.description)}</textarea></label>`, f => {
    const g = n => f.elements[n].value.trim(), pad = v => /^\d$/.test(v) ? '0' + v : v;
    const d = { name: g('name'), category: g('category'), aisle: g('aisle').toUpperCase(), rack: pad(g('rack')), bin: pad(g('bin')), minimumStock: Number(g('minimumStock')), description: f.elements.description.value.trim() };
    if (!d.name || !d.category) return 'Name and category are required.';
    if (!d.aisle || !d.rack || !d.bin) return 'Aisle, rack and bin are required.';
    if (!Number.isInteger(d.minimumStock) || d.minimumStock < 0) return 'Minimum stock must be a whole number of 0 or more.';
    if (p) Object.assign(p, d);
    else {
      const s = g('sku').toUpperCase(), q = Number(g('quantity'));
      if (!/^[A-Z0-9-]{3,20}$/.test(s)) return 'SKU must be 3–20 letters, digits or dashes.';
      if (inv(s)) return 'That SKU already exists.';
      if (!Number.isInteger(q) || q < 0) return 'Quantity must be a whole number of 0 or more.';
      S.inventory.push({ sku: s, ...d, quantity: q }); if (q) logS(s, q, 'Opening stock');
    }
    commit(); toast('Product saved.');
  }, p ? 'Save changes' : 'Add product');
}

V.locations = () => `<div class="head"><h1>Warehouse Locations</h1></div><div class="filters"><input data-f="lq" type="search" value="${esc(F.lq)}" placeholder="Find a SKU or product to see its location" aria-label="Search locations"><button class="btn" data-act="reset">Reset</button></div><p class="muted">Location code format: Aisle-Rack-Bin, e.g. A-01-02. This is a storage index, not a floor plan.</p><div id="dyn"></div>`;
function drawLoc() {
  const q = F.lq.toLowerCase().trim(), by = {};
  S.inventory.filter(p => !q || hay(p.sku, p.name, loc(p)).includes(q)).forEach(p => { (((by[p.aisle] ||= {})[p.rack] ||= {})[p.bin] ||= []).push(p); });
  const A = Object.keys(by).sort();
  $('#dyn').innerHTML = A.length ? A.map(a => `<section class="card aisle"><h3>Aisle ${esc(a)}</h3><div class="racks">${Object.keys(by[a]).sort().map(r => `<div class="rack"><b>Rack ${esc(r)}</b>${Object.keys(by[a][r]).sort().map(b => `<div class="bin"><code>${esc(a)}-${esc(r)}-${esc(b)}</code>${by[a][r][b].map(p => `<br>${esc(p.name)} <small>${esc(p.sku)} · ${p.quantity} units</small>`).join('')}</div>`).join('')}</div>`).join('')}</div></section>`).join('') : `<div class="card">${empty('Nothing found', 'No SKU or product matches that search.')}</div>`;
}

V.workers = () => `<div class="head"><h1>Worker Management</h1><button class="btn pri" data-act="newwk">+ Add worker</button></div><div class="card tw"><table><thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Availability</th><th>Open orders</th><th>Active tasks</th><th>Completed</th><th></th></tr></thead><tbody>${S.workers.map(w => `<tr><td>${esc(w.id)}</td><td>${esc(w.name)}</td><td>${esc(w.role)}</td><td><select data-wav="${w.id}" aria-label="Availability for ${esc(w.name)}">${optH(AV, w.availability)}</select></td><td>${S.orders.filter(o => o.workerId === w.id && open(o)).map(o => `<button class="lnk" data-act="view" data-id="${o.id}">${o.id}</button>`).join(' ') || '—'}</td><td>${wcount(w, 'In Progress')}</td><td>${wcount(w, 'Completed')}</td><td><button class="btn sm" data-act="editwk" data-id="${w.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`;
function workerForm(id) {
  const w = id ? wk(id) : null;
  modal(w ? 'Edit ' + w.id : 'Add worker', `${fld('Full name', 'name', w?.name)}${fld('Role', 'role', w?.role || 'Picker')}${sel('Availability', 'availability', AV, w?.availability || 'Available')}`, f => {
    const name = f.elements.name.value.trim(), role = f.elements.role.value.trim();
    if (!name || !role) return 'Name and role are required.';
    if (S.workers.some(x => x.id !== w?.id && x.name.toLowerCase() === name.toLowerCase())) return 'A worker with that name already exists.';
    if (w) Object.assign(w, { name, role, availability: f.elements.availability.value });
    else S.workers.push({ id: 'WRK-' + z(Math.max(0, ...S.workers.map(x => +x.id.slice(4) || 0)) + 1).padStart(3, '0'), name, role, availability: f.elements.availability.value });
    commit(); toast('Worker saved.');
  }, 'Save');
}

V.analytics = () => {
  const os = S.orders.filter(o => (!F.afrom || o.createdAt >= F.afrom) && (!F.ato || o.createdAt <= F.ato)), s = stats(os);
  const cnt = (a, b) => [S.orders.filter(o => o.createdAt >= a && o.createdAt <= b).length, S.orders.filter(o => o.completedAt && o.completedAt >= a && o.completedAt <= b).length];
  const days = [...Array(7)].map((_, k) => { const d = addD(k - 6); return [d.slice(5), ...cnt(d, d)]; });
  const wks = [...Array(4)].map((_, k) => { const e = addD(-7 * (3 - k)), st = addD(-6, e); return ['wk ' + st.slice(5), ...cnt(st, e)]; });
  const cols = rows => { const m = Math.max(1, ...rows.flatMap(r => [r[1], r[2]])); return `<div class="cols">${rows.map(r => `<div class="col"><div class="pair"><i class="c1" style="height:${r[1] / m * 100}%" title="Created ${r[1]}"></i><i class="c2" style="height:${r[2] / m * 100}%" title="Completed ${r[2]}"></i></div>${esc(r[0])}</div>`).join('')}</div><p class="muted">Blue: created · Green: completed (max ${m})</p>`; };
  const low = S.inventory.filter(isLow).length, out = S.inventory.filter(p => p.quantity === 0).length, demo = S.orders.filter(o => o.demo).length;
  return `<div class="head"><h1>Analytics & Productivity</h1></div>
<div class="filters"><label>From (order date)<input type="date" data-f="afrom" value="${esc(F.afrom)}"></label><label>To<input type="date" data-f="ato" value="${esc(F.ato)}"></label><button class="btn" data-act="reset">Reset dates</button></div>
<p class="note">All figures are calculated from the records below. ${demo} of ${S.orders.length} orders are demo records (marked “Demo”); delete them or use your own orders to get real numbers.</p>
<div class="kpis">${kpi('Orders in range', s.total, 'processed + open')}${kpi('Completed', s.done, 'orders')}${kpi('Completion rate', s.rate + '%', 'excluding cancelled')}${kpi('Active', s.act, 'open orders')}${kpi('Low-stock products', low, out + ' out of stock', low ? 'warn' : '')}</div>
<div class="g2">${card('Priority distribution', bars(PRI.map(p => [p, os.filter(o => o.priority === p).length])))}${card('Inventory availability', bars([['In stock', S.inventory.length - low], ['Low stock', low - out], ['Out of stock', out]]))}
${card('Daily trend (last 7 days)', cols(days))}${card('Weekly trend (last 4 weeks)', cols(wks))}
${card('Worker productivity', `<div class="tw"><table><thead><tr><th>Worker</th><th>Completed</th><th>Active</th><th>Avg. completion</th></tr></thead><tbody>${S.workers.map(w => { const mine = os.filter(o => o.workerId === w.id); return `<tr><td>${esc(w.name)}</td><td>${mine.filter(o => o.status === 'Completed').length}</td><td>${mine.filter(o => o.status === 'In Progress').length}</td><td>${avgDays(mine.filter(o => o.status === 'Completed'))}</td></tr>`; }).join('')}</tbody></table></div>`)}</div>`;
};

V.settings = () => `<div class="head"><h1>Settings</h1></div><div class="g2">${card('Preferences', `<label>Company name<input id="s-co" value="${esc(S.settings.company)}"></label><label>“Due soon” window (days before dispatch)<input id="s-due" type="number" min="0" max="30" value="${S.settings.dueSoon}"></label><button class="btn pri" data-act="saveset">Save settings</button>`)}
${card('Data', `<p>${S.orders.length} orders, ${S.inventory.length} products, ${S.workers.length} workers, ${S.log.length} stock adjustments.</p><p class="muted">Data is stored in this browser’s LocalStorage. It is private to this browser and device and is not shared between users — a production deployment needs a shared database and backend.</p><button class="btn dng" data-act="resetdemo">Reset demo data</button>`)}</div>`;

/* ---------- rendering & routing ---------- */
const DRAW = { orders: drawOrders, inventory: drawInv, locations: drawLoc };
function render() {
  $('#nav').innerHTML = NAV.map(([k, t]) => `<a href="#${k}" ${k === view ? 'aria-current="page"' : ''}>${t}</a>`).join('');
  $('#co').textContent = S.settings.company;
  $('#view').innerHTML = V[view](); DRAW[view]?.();
}
function route() {
  const h = location.hash.slice(1); view = V[h] ? h : 'dashboard';
  document.body.classList.remove('nav-open'); render(); scrollTo(0, 0);
}
const go = v => { if (view === v) render(); else location.hash = v; };

/* ---------- actions (event delegation) ---------- */
const A = {
  mclose: closeM,
  new: () => orderForm(), edit: id => orderForm(id), view: id => detail(id),
  del: id => ask(`Delete ${id}? ${getO(id)?.status === 'Completed' ? 'Inventory already deducted by this order will NOT be restored.' : 'No stock will change.'}`, () => { S.orders = S.orders.filter(o => o.id !== id); commit(); toast('Order deleted.'); }, 'Delete'),
  move: (id, _, t) => { closeM(); doMove(id, t.dataset.to); },
  openpick: id => { pickId = id; closeM(); go('picking'); },
  pick: id => { const o = getO(id), i = o?.items.find(x => x.sku === arguments_sku); if (!o || o.status !== 'In Progress') return toast('Order must be In Progress to pick.', 'err'); },
  addrow: () => $('#rows').insertAdjacentHTML('beforeend', rowH({ sku: '', quantity: 1 })),
  delrow: (_, __, t) => { if (document.querySelectorAll('.irow').length > 1) t.closest('.irow').remove(); else toast('An order needs at least one product.', 'err'); },
  newprod: () => prodForm(), editprod: (_, sku) => prodForm(sku),
  delprod: (_, sku) => {
    if (S.orders.some(o => o.items.some(i => i.sku === sku))) return toast('This product is used by existing orders and cannot be deleted.', 'err');
    ask(`Delete product ${sku}?`, () => { S.inventory = S.inventory.filter(p => p.sku !== sku); commit(); toast('Product deleted.'); }, 'Delete');
  },
  adjust: (_, sku) => {
    const p = inv(sku);
    modal('Adjust stock — ' + sku, `<p>${esc(p.name)} · current quantity <b>${p.quantity}</b></p>${fld('Change (+ add / − remove)', 'delta', 0, 'step="1"', 'number')}${fld('Reason', 'reason', '', 'placeholder="e.g. Cycle count correction"')}`, f => {
      const d = Number(f.elements.delta.value), r = f.elements.reason.value.trim();
      if (!Number.isInteger(d) || !d) return 'Enter a non-zero whole number.';
      if (!r) return 'A reason is required so the change can be traced.';
      if (p.quantity + d < 0) return 'Stock cannot go below zero.';
      p.quantity += d; logS(sku, d, r); commit(); toast('Stock updated.');
    }, 'Apply');
  },
  newwk: () => workerForm(), editwk: id => workerForm(id),
  reset: () => { F = { ...F0 }; $('#gsearch').value = ''; render(); },
  saveset: () => {
    const c = $('#s-co').value.trim(), d = Number($('#s-due').value);
    if (!c || !Number.isInteger(d) || d < 0 || d > 30) return toast('Enter a company name and a due-soon window of 0–30 days.', 'err');
    S.settings = { company: c, dueSoon: d }; commit(); toast('Settings saved.');
  },
  resetdemo: () => ask('Replace ALL data with the original demo data? Your orders, products and workers will be lost.', () => { localStorage.removeItem(KEY); S = seed(); pickId = null; commit(); toast('Demo data restored.'); }, 'Reset data')
};
/* pick / unpick need the SKU argument, so they are defined with the full signature here */
A.pick = (id, sku) => {
  const o = getO(id);
  if (!o || o.status !== 'In Progress') return toast('Order must be In Progress to pick.', 'err');
  const i = o.items.find(x => x.sku === sku); if (!i || i.pickedQuantity >= i.quantity) return;
  i.pickedQuantity = i.quantity; hist(o, `Picked ${sku} ×${i.quantity}`); commit();
};
A.unpick = (id, sku) => {
  const o = getO(id);
  if (!o || o.status !== 'In Progress') return toast('Order must be In Progress to change picks.', 'err');
  const i = o.items.find(x => x.sku === sku); if (!i) return;
  i.pickedQuantity = 0; hist(o, `Pick undone for ${sku}`); commit();
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  A[t.dataset.act]?.(t.dataset.id, t.dataset.sku, t);
});
document.addEventListener('input', e => {
  const k = e.target.dataset.f; if (!k) return;
  F[k] = e.target.value;
  if (k === 'q') $('#gsearch').value = e.target.value;
  if (view === 'analytics') return render();
  DRAW[view]?.();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.assign) {
    const o = getO(t.dataset.assign), w = wk(t.value);
    if (w && w.availability !== 'Available') { toast(`${w.name} is not available.`, 'err'); return detail(o.id); }
    o.workerId = t.value; hist(o, 'Assigned to ' + (w?.name || 'nobody')); commit(); detail(o.id); toast('Worker assignment updated.');
  } else if (t.dataset.wav) {
    const w = wk(t.dataset.wav); w.availability = t.value; commit(); toast(`${w.name}: ${t.value}.`);
  }
});
$('#mform').addEventListener('submit', e => {
  e.preventDefault(); if (!mcb) return;
  const r = mcb(e.target); if (r) $('#merr').textContent = r; else closeM();
});
$('#gsearch').addEventListener('input', e => {
  F.q = e.target.value;
  if (view !== 'orders') location.hash = 'orders'; else { const x = $('[data-f=q]'); if (x) x.value = F.q; drawOrders(); }
});
$('#menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#shade').addEventListener('click', () => document.body.classList.remove('nav-open'));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeM(); });
window.addEventListener('hashchange', route);
route();
if (corrupted) toast('Stored data was invalid and has been replaced with demo data.', 'err');
})();
