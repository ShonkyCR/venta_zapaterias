/* Zapatería Red — Analítica con gráficos SVG (sin dependencias). */
async function api(action, opts = {}) {
  const res = await fetch('api.php?action=' + action, { credentials: 'same-origin', ...opts });
  if (res.status === 401) { location.href = 'admin.html'; throw new Error('auth'); }
  return res.json();
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function barChart(el, items) {
  if (!items.length) { el.innerHTML = '<p class="table-sub">Sin datos.</p>'; return; }
  const max = Math.max(...items.map(i => Number(i.valor)), 1);
  const W = 620, rowH = 46, H = items.length * rowH + 12;
  let y = 10, s = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Valor por categoría">`;
  items.forEach(c => {
    const w = Math.max(6, (Number(c.valor) / max) * 360);
    s += `<text x="0" y="${y + 17}">${esc(c.categoria)}</text>`;
    s += `<rect x="160" y="${y}" width="${w.toFixed(0)}" height="22" rx="11" fill="#dc2626"><animate attributeName="width" from="0" to="${w.toFixed(0)}" dur="0.8s" fill="freeze"/></rect>`;
    s += `<text x="${(165 + w).toFixed(0)}" y="${y + 16}">${money(Number(c.valor))}</text>`;
    y += rowH;
  });
  el.innerHTML = s + '</svg>';
}

function donut(el, items) {
  const total = items.reduce((n, i) => n + Number(i.stock), 0);
  if (!total) { el.innerHTML = '<p class="table-sub">Sin stock registrado.</p>'; return; }
  const colors = ['#dc2626', '#1c1a18', '#f59e0b', '#347044', '#7c3aed'];
  const R = 70, C = 2 * Math.PI * R;
  let acc = 0, i = 0, segs = '', legend = '';
  items.forEach(c => {
    const frac = Number(c.stock) / total;
    const len = (frac * C).toFixed(1);
    const off = (-acc * C).toFixed(1);
    segs += `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="26" stroke-dasharray="${len} ${C.toFixed(1)}" stroke-dashoffset="${off}" transform="rotate(-90 90 90)"/>`;
    legend += `<div class="low-item"><span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colors[i % colors.length]}"></i> ${esc(c.categoria)}</span><b>${c.stock} pares</b></div>`;
    acc += frac; i++;
  });
  el.innerHTML = `<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap"><svg class="chart-svg" style="max-width:210px" viewBox="0 0 180 180" role="img" aria-label="Stock por categoría"><circle cx="90" cy="90" r="${R}" fill="none" stroke="#f1efec" stroke-width="26"/>${segs}<text x="90" y="88" text-anchor="middle" class="donut-center">${total}</text><text x="90" y="108" text-anchor="middle" style="font-size:11px;fill:#8a8179">pares</text></svg><div style="flex:1;min-width:200px">${legend}</div></div>`;
}

document.querySelector('#logout-btn').onclick = async () => {
  await api('logout', { method: 'POST' });
  location.href = 'admin.html';
};

(async () => {
  try {
    const me = await api('me');
    document.querySelector('#admin-name').textContent = me.user.nombre;
    document.querySelector('#admin-email').textContent = me.user.email;
    document.querySelector('#admin-initial').textContent = (me.user.nombre || 'A')[0].toUpperCase();
    const [a, p] = await Promise.all([api('analitica'), api('productos')]);
    document.querySelector('#a-products').textContent = a.resumen.n;
    document.querySelector('#a-stock').textContent = a.resumen.stock;
    document.querySelector('#a-value').textContent = money(Number(a.resumen.valor));
    document.querySelector('#a-cats').textContent = (a.por_categoria || []).length;
    barChart(document.querySelector('#chart-barras'), a.por_categoria || []);
    donut(document.querySelector('#chart-dona'), a.por_categoria || []);
    const top = (p.productos || []).map(x => ({ ...x, valor: Number(x.precio) * Number(x.stock) })).sort((x, y) => y.valor - x.valor).slice(0, 5);
    document.querySelector('#top-body').innerHTML = top.map(x => `<tr><td>${esc(x.nombre)}</td><td>${esc(x.marca || '')}</td><td>${x.stock} pares</td><td>${money(x.valor)}</td></tr>`).join('') || '<tr><td colspan="4">Sin datos</td></tr>';
    document.querySelector('#low-list').innerHTML = (a.stock_bajo || []).map(x => `<div class="low-item"><span>${esc(x.nombre)} <small class="table-sub">${esc(x.marca || '')}</small></span><b class="low-stock">${x.stock} pares</b></div>`).join('') || '<p class="table-sub">Todo el stock está saludable.</p>';
  } catch (e) { /* redirección a login en 401 */ }
})();
