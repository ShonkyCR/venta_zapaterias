/* Zapatería Red — Configuración: perfil, usuarios y tienda. */
async function api(action, opts = {}) {
  const res = await fetch('api.php?action=' + action, { credentials: 'same-origin', ...opts });
  if (res.status === 401 || res.status === 403) { location.href = 'admin.html'; throw new Error('auth'); }
  return res.json();
}
function setUser(u) {
  document.querySelector('#admin-name').textContent = u.nombre;
  document.querySelector('#admin-email').textContent = u.email;
  document.querySelector('#admin-initial').textContent = (u.nombre || 'A')[0].toUpperCase();
  document.querySelector('#pf-nombre').textContent = u.nombre;
  document.querySelector('#pf-email').textContent = u.email;
  document.querySelector('#pf-rol').textContent = u.rol;
  document.querySelector('#p-nombre').value = u.nombre;
  document.querySelector('#p-email').value = u.email;
}
document.querySelector('#logout-btn').onclick = async () => {
  await api('logout', { method: 'POST' });
  location.href = 'admin.html';
};

// ---------- Perfil ----------
document.querySelector('#profile-form').onsubmit = async e => {
  e.preventDefault();
  const msg = document.querySelector('#profile-msg');
  const data = await api('actualizar_perfil', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: document.querySelector('#p-nombre').value, email: document.querySelector('#p-email').value })
  });
  if (!data.ok) { msg.textContent = '✕ ' + (data.error || 'Error'); msg.style.color = '#dc2626'; return; }
  msg.textContent = '✓ Guardado'; msg.style.color = '#347044';
  const me = await api('me');
  setUser(me.user);
};
document.querySelector('#pass-form').onsubmit = async e => {
  e.preventDefault();
  const msg = document.querySelector('#pass-msg');
  const data = await api('cambiar_password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actual: document.querySelector('#pass-actual').value, nueva: document.querySelector('#pass-nueva').value })
  });
  if (!data.ok) { msg.textContent = '✕ ' + (data.error || 'Error'); msg.style.color = '#dc2626'; return; }
  msg.textContent = '✓ Clave actualizada'; msg.style.color = '#347044';
  e.target.reset();
};

// ---------- Crear usuario ----------
document.querySelector('#user-form').onsubmit = async e => {
  e.preventDefault();
  const msg = document.querySelector('#user-msg');
  const data = await api('crear_usuario', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: document.querySelector('#u-nombre').value,
      email: document.querySelector('#u-email').value,
      password: document.querySelector('#u-pass').value,
      rol: document.querySelector('#u-rol').value
    })
  });
  if (!data.ok) { msg.textContent = '✕ ' + (data.error || 'Error'); msg.style.color = '#dc2626'; return; }
  msg.textContent = '✓ Usuario creado (id ' + data.id + ')'; msg.style.color = '#347044';
  e.target.reset();
  loadUsers();
};

// ---------- Usuarios ----------
async function loadUsers() {
  const data = await api('clientes');
  if (!data.ok) return;
  const me = document.querySelector('#admin-email').textContent;
  document.querySelector('#users-body').innerHTML = (data.clientes || []).map(u => `<tr><td>${u.nombre}</td><td>${u.email}</td><td><select class="role-select" data-rol="${u.id}" ${u.email === me ? 'disabled' : ''}><option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>admin</option><option value="usuario" ${u.rol === 'usuario' ? 'selected' : ''}>usuario</option></select></td><td>${u.email === me ? '<span class="table-sub">Tú</span>' : `<button class="row-action danger" data-deluser="${u.id}" title="Eliminar">⌫</button>`}</td></tr>`).join('');
  document.querySelectorAll('[data-rol]').forEach(s => s.onchange = async () => {
    const r = await api('actualizar_rol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(s.dataset.rol), rol: s.value }) });
    if (!r.ok) { alert(r.error || 'No se pudo cambiar el rol'); loadUsers(); }
  });
  document.querySelectorAll('[data-deluser]').forEach(b => b.onclick = async () => {
    if (!confirm('¿Eliminar este usuario?')) return;
    await api('eliminar_usuario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Number(b.dataset.deluser) }) });
    loadUsers();
  });
}

// ---------- Tienda ----------
async function loadConfig() {
  const data = await api('configuracion');
  if (!data.ok) return;
  document.querySelector('#cfg-nombre').value = data.config.nombre_tienda || '';
  document.querySelector('#cfg-whatsapp').value = data.config.whatsapp || '';
  document.querySelector('#cfg-envio').value = data.config.envio_gratis_minimo || '';
  document.querySelector('#cfg-moneda').value = data.config.moneda || '';
}
document.querySelector('#config-form').onsubmit = async e => {
  e.preventDefault();
  const msg = document.querySelector('#config-msg');
  const data = await api('guardar_configuracion', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre_tienda: document.querySelector('#cfg-nombre').value,
      whatsapp: document.querySelector('#cfg-whatsapp').value,
      envio_gratis_minimo: document.querySelector('#cfg-envio').value,
      moneda: document.querySelector('#cfg-moneda').value
    })
  });
  msg.textContent = data.ok ? '✓ Guardado' : ('✕ ' + (data.error || 'Error'));
};

(async () => {
  try {
    const me = await api('me');
    setUser(me.user);
    await loadUsers();
    await loadConfig();
  } catch (e) { /* redirección a login en 401 */ }
})();
