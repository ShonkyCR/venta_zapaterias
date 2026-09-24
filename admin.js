/* Zapatería Red — Panel conectado al API PHP + MySQL (sesión). */
const body = document.querySelector('#inventory-body');
const query = document.querySelector('#admin-search');
const filter = document.querySelector('#admin-filter');
const modal = document.querySelector('#product-modal');
const form = document.querySelector('#product-form');
let rows = [];
let delFotos = new Set();
let portadaId = 0;

async function api(action, opts = {}) {
  const res = await fetch('api.php?action=' + action, { credentials: 'same-origin', ...opts });
  const data = await res.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
  if (res.status === 401) { showLogin(); throw new Error('auth'); }
  return data;
}
function showLogin() { document.querySelector('#login-overlay').classList.remove('hidden'); }
function hideLogin() { document.querySelector('#login-overlay').classList.add('hidden'); }

// ---------- Sesión ----------
document.querySelector('#login-form').onsubmit = async e => {
  e.preventDefault();
  const err = document.querySelector('#login-error');
  err.textContent = 'Verificando…';
  const data = await api('login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: document.querySelector('#login-email').value, password: document.querySelector('#login-pass').value })
  });
  if (!data.ok) { err.textContent = data.error || 'No se pudo entrar'; return; }
  err.textContent = '';
  setUser(data.user);
  hideLogin();
  init();
};
document.querySelector('#logout-btn').onclick = async () => {
  await api('logout', { method: 'POST' });
  location.reload();
};
function setUser(u) {
  document.querySelector('#admin-name').textContent = u.nombre;
  document.querySelector('#admin-email').textContent = u.email;
  document.querySelector('#admin-initial').textContent = (u.nombre || 'A')[0].toUpperCase();
}

// ---------- Catálogos ----------
async function loadCatalogos() {
  const [cats, talles] = await Promise.all([api('categorias'), api('talles')]);
  const cs = document.querySelector('#f-categoria');
  const ts = document.querySelector('#f-talle');
  cs.innerHTML = '<option value="">— Sin categoría —</option>' + (cats.items || []).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  ts.innerHTML = '<option value="">— Sin talle —</option>' + (talles.items || []).map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
}

// ---------- Productos ----------
async function loadProductos() {
  const data = await api('productos?q=' + encodeURIComponent(query.value) + '&estado=' + encodeURIComponent(filter.value));
  rows = data.productos || [];
  renderTable();
  document.querySelector('#sync-time').textContent = new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}
function renderTable() {
  body.innerHTML = rows.map(p => `<tr><td>${p.imagen ? `<img src="${p.imagen}" alt="">` : ''}${p.nombre}<small class="table-sub">${p.marca || ''} · SKU-ZR-${String(p.id).padStart(4, '0')} · ${p.fotos} foto(s)</small></td><td>${p.categoria || '—'}</td><td>${money(Number(p.precio))}</td><td class="${p.stock < 8 ? 'low-stock' : ''}">${p.stock} pares</td><td><span class="status ${p.stock > 0 ? '' : 'off'}">● ${p.stock > 0 ? 'Activo' : 'Sin stock'}</span></td><td>${p.imagen ? '✓' : '—'}</td><td><button class="row-action" title="Editar" data-edit="${p.id}">✎</button> <button class="row-action danger" title="Eliminar" data-del="${p.id}">⌫</button></td></tr>`).join('');
  document.querySelector('#table-count').textContent = `Mostrando ${rows.length} productos`;
  body.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => openEdit(Number(el.dataset.edit)));
  body.querySelectorAll('[data-del]').forEach(el => el.onclick = () => delProducto(Number(el.dataset.del)));
}
async function delProducto(id) {
  const p = rows.find(x => x.id === id);
  if (!confirm(`¿Eliminar "${p ? p.nombre : id}" de la base de datos?`)) return;
  const data = await api('eliminar_producto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  if (!data.ok) { alert(data.error || 'No se pudo eliminar'); return; }
  loadProductos(); loadAnalitica();
}
query.oninput = loadProductos;
filter.onchange = loadProductos;

// ---------- Modal crear/editar ----------
function openCreate() {
  form.reset();
  document.querySelector('#f-id').value = '';
  document.querySelector('#modal-title').textContent = 'Agregar producto';
  document.querySelector('#f-existing').innerHTML = '<span class="table-sub">Aún no hay fotos guardadas.</span>';
  document.querySelector('#f-preview').innerHTML = '';
  document.querySelector('#f-cover-name').textContent = '—';
  document.querySelector('#form-error').textContent = '';
  delFotos = new Set(); portadaId = 0;
  modal.showModal();
}
async function openEdit(id) {
  const data = await api('producto&id=' + id);
  if (!data.ok) { alert(data.error || 'No se pudo cargar'); return; }
  const p = data.producto;
  form.reset();
  document.querySelector('#f-id').value = p.id;
  document.querySelector('#modal-title').textContent = 'Editar producto';
  document.querySelector('#f-nombre').value = p.nombre;
  document.querySelector('#f-marca').value = p.marca || '';
  document.querySelector('#f-precio').value = p.precio;
  document.querySelector('#f-stock').value = p.stock;
  document.querySelector('#f-categoria').value = p.categoria_id || '';
  document.querySelector('#f-talle').value = p.talle_id || '';
  document.querySelector('#f-descripcion').value = p.descripcion || '';
  document.querySelector('#f-preview').innerHTML = '';
  document.querySelector('#form-error').textContent = '';
  delFotos = new Set(); portadaId = 0;
  renderExisting(p.imagenes || []);
  modal.showModal();
}
function renderExisting(imgs) {
  const box = document.querySelector('#f-existing');
  const visibles = imgs.filter(i => !delFotos.has(i.id));
  if (!visibles.length) { box.innerHTML = '<span class="table-sub">Sin fotos guardadas.</span>'; }
  else {
    box.innerHTML = visibles.map(i => `<div class="photo-item ${i.es_portada == 1 ? 'is-cover' : ''}"><img src="${i.url}" alt=""><button type="button" class="del" data-delfoto="${i.id}" title="Eliminar">✕</button><button type="button" class="cover" data-portada="${i.id}" title="Portada">${i.es_portada == 1 ? '● Portada' : '○ Portada'}</button></div>`).join('');
  }
  const port = visibles.find(i => i.es_portada == 1) || visibles[0];
  document.querySelector('#f-cover-name').textContent = port ? port.url.split('/').pop() : '—';
  box.querySelectorAll('[data-delfoto]').forEach(b => b.onclick = () => { delFotos.add(Number(b.dataset.delfoto)); renderExisting(imgs); });
  box.querySelectorAll('[data-portada]').forEach(b => b.onclick = () => {
    portadaId = Number(b.dataset.portada);
    imgs.forEach(i => i.es_portada = (i.id === portadaId ? 1 : 0));
    renderExisting(imgs);
  });
  box._imgs = imgs;
}
document.querySelector('#f-fotos').onchange = e => {
  const box = document.querySelector('#f-preview');
  box.innerHTML = '';
  [...e.target.files].forEach(f => {
    const r = new FileReader();
    r.onload = () => { box.innerHTML += `<div class="photo-item"><img src="${r.result}" alt=""></div>`; };
    r.readAsDataURL(f);
  });
};
form.onsubmit = async e => {
  e.preventDefault();
  const err = document.querySelector('#form-error');
  const fd = new FormData();
  const id = document.querySelector('#f-id').value;
  fd.append('nombre', document.querySelector('#f-nombre').value.trim());
  fd.append('marca', document.querySelector('#f-marca').value.trim() || 'Red Label');
  fd.append('precio', document.querySelector('#f-precio').value);
  fd.append('stock', document.querySelector('#f-stock').value || 0);
  fd.append('categoria_id', document.querySelector('#f-categoria').value);
  fd.append('talle_id', document.querySelector('#f-talle').value);
  fd.append('descripcion', document.querySelector('#f-descripcion').value.trim());
  [...document.querySelector('#f-fotos').files].forEach(f => fd.append('fotos[]', f));
  err.textContent = 'Guardando…';
  try {
    let data;
    if (id) {
      fd.append('id', id);
      fd.append('eliminar_fotos', JSON.stringify([...delFotos]));
      if (portadaId) fd.append('portada_id', portadaId);
      data = await api('actualizar_producto', { method: 'POST', body: fd });
    } else {
      data = await api('crear_producto', { method: 'POST', body: fd });
    }
    if (!data.ok) { err.textContent = data.error || 'No se pudo guardar'; return; }
    modal.close();
    loadProductos(); loadAnalitica();
  } catch (ex) { if (ex.message !== 'auth') err.textContent = 'Error de conexión'; }
};
document.querySelectorAll('#open-product-modal,#open-product-modal-top').forEach(btn => btn.onclick = openCreate);
document.querySelector('#modal-close').onclick = () => modal.close();

// ---------- Analítica ----------
async function loadAnalitica() {
  const data = await api('analitica');
  if (!data.ok) return;
  document.querySelector('#metric-products').textContent = data.resumen.n;
  document.querySelector('#metric-stock').textContent = data.resumen.stock;
  document.querySelector('#metric-value').textContent = money(Number(data.resumen.valor));
  document.querySelector('#metric-out').textContent = (data.stock_bajo || []).filter(x => x.stock <= 0).length;
  // El detalle con gráficos vive en analitica.html
}

// ---------- Clientes ----------
async function loadClientes() {
  const data = await api('clientes');
  if (!data.ok) return;
  const me = document.querySelector('#admin-email').textContent;
  document.querySelector('#clients-body').innerHTML = (data.clientes || []).map(u => `<tr><td>${u.nombre}</td><td>${u.email}</td><td><select class="role-select" data-rol="${u.id}" ${u.email === me ? 'disabled' : ''}><option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>admin</option><option value="usuario" ${u.rol === 'usuario' ? 'selected' : ''}>usuario</option></select></td><td>${u.email === me ? '<span class="table-sub">Tú</span>' : `<button class="row-action danger" data-deluser="${u.id}" title="Eliminar">⌫</button>`}</td></tr>`).join('');
  document.querySelectorAll('[data-rol]').forEach(s => s.onchange = async () => {
    const r = await api('actualizar_rol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(s.dataset.rol), rol: s.value }) });
    if (!r.ok) { alert(r.error || 'No se pudo cambiar el rol'); loadClientes(); }
  });
  document.querySelectorAll('[data-deluser]').forEach(b => b.onclick = async () => {
    if (!confirm('¿Eliminar este usuario?')) return;
    await api('eliminar_usuario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(b.dataset.deluser) }) });
    loadClientes();
  });
}

/* La configuración (perfil, usuarios y tienda) vive en configuracion.html */

// ---------- Nav activa ----------
document.querySelectorAll('.admin-sidebar nav a').forEach(a => a.onclick = () => {
  document.querySelectorAll('.admin-sidebar nav a').forEach(x => x.classList.remove('active'));
  a.classList.add('active');
});

// ---------- Arranque ----------
async function init() {
  await loadCatalogos();
  await loadProductos();
  await loadAnalitica();
  await loadClientes();
}
(async () => {
  try {
    const me = await api('me');
    setUser(me.user);
    hideLogin();
    init();
  } catch (e) { showLogin(); }
})();
