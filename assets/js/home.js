/* Home: vitrine com abas, caixas prontas, vinícolas, contagem regressiva. */
(() => {
  'use strict';
  const { $, $$, esc, icon, brl, url, reduced, PRODUCTS, byId, BRANDS, COLECOES, listBrl, cotaBrl, cardHTML, addMany, totalQty, COTA, toast, openDialog } = LC;
  const EVENT = new Date('2026-12-19T18:00:00-03:00');
  const PER_TAB = 8;

  // ---------- Vitrine ----------
  const state = { tab: 'oferta', type: '' };
  const grid = $('[data-grid]');
  const tabs = $$('[data-tabs] [role="tab"]');
  function renderGrid() {
    const all = PRODUCTS.filter(p => p.tags.includes(state.tab) && (!state.type || p.tipo === state.type));
    const list = all.slice(0, PER_TAB);
    grid.classList.remove('is-swapping');
    grid.innerHTML = list.length ? list.map(cardHTML).join('')
      : `<div class="grid-empty">${icon('wine', 'ic--xl')}<p>Nenhum rótulo deste tipo em <strong>${COLECOES[state.tab].label}</strong> nesta semana.</p><button class="btn btn--ghost" type="button" data-type-reset>Ver todos os tipos</button></div>`;
    if (!reduced) { void grid.offsetWidth; grid.classList.add('is-swapping'); }
    const more = $('[data-vitrine-more]');
    const params = { colecao: state.tab }; if (state.type) params.tipo = state.type;
    more.href = url.catalog(params);
    more.innerHTML = `Ver ${all.length > PER_TAB ? 'todos os ' + all.length : 'mais'} em ${COLECOES[state.tab].label} ${icon('arrow')}`;
  }
  function selectTab(btn, focus) {
    tabs.forEach(t => { const on = t === btn; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
    state.tab = btn.dataset.tab;
    if (focus) btn.focus();
    renderGrid();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); selectTab(tabs[(i + k + tabs.length) % tabs.length], true); }
      if (e.key === 'Home') { e.preventDefault(); selectTab(tabs[0], true); }
      if (e.key === 'End') { e.preventDefault(); selectTab(tabs[tabs.length - 1], true); }
    });
  });
  const chips = $$('[data-type-filter] .chip');
  function setType(t) { state.type = t; chips.forEach(x => { const on = x.dataset.type === t; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on); }); renderGrid(); }
  chips.forEach(c => c.addEventListener('click', () => setType(c.dataset.type)));
  document.addEventListener('click', e => { if (e.target.closest('[data-type-reset]')) setType(''); });

  // ---------- Caixas prontas ----------
  const BOXES = [
    { id: 'malbec', title: 'Malbec argentino', desc: 'Cinco expressões da uva símbolo da Argentina, do dia a dia ao orgânico.', items: { 9533: 4, 9360: 4, 7356: 4, 7160: 2, 9478: 2 } },
    { id: 'mix', title: 'Mix da casa', desc: 'Tintos, brancos e rosés para o churrasco, a praia e o presente.', items: { 9537: 3, 9533: 3, 9520: 3, 9522: 2, 9422: 3, 9492: 2 }, featured: true },
    { id: 'premium', title: 'Seleção premium', desc: 'Achaval Ferrer, Sposato e microvinificações para guardar ou presentear.', items: { 9379: 2, 9387: 2, 9466: 3, 9439: 3, 8497: 3, 8777: 3 } },
  ].map(b => ({ ...b, items: Object.fromEntries(Object.entries(b.items).filter(([id]) => byId[id])) }));
  const shelfOk = p => p.img.endsWith('.png') && p.id !== 8497;
  $('[data-boxes]').innerHTML = BOXES.map(b => {
    let list = 0, cota = 0, n = 0;
    for (const [id, q] of Object.entries(b.items)) { const p = byId[id]; list += listBrl(p) * q; cota += cotaBrl(p) * q; n += q; }
    const shelf = Object.keys(b.items).map(id => byId[id]).filter(shelfOk);
    const extra = PRODUCTS.filter(p => shelfOk(p) && b.id === 'malbec' && p.uva === 'Malbec' && !b.items[p.id]);
    const imgs = [...shelf, ...extra].slice(0, 5).map(p => `<img src="${p.img}" alt="" width="96" height="120" loading="lazy">`).join('');
    const items = Object.entries(b.items).map(([id, q]) => `<li><a href="${url.product(byId[id])}">${q}× ${esc(byId[id].nome)}</a></li>`).join('');
    return `<article class="box${b.featured ? ' box--featured' : ''}">
      ${b.featured ? '<span class="badge badge--gold box__ribbon">Mais pedida</span>' : ''}
      <div class="box__shelf" aria-hidden="true">${imgs}</div>
      <h3 class="box__title">${b.title}</h3>
      <p class="box__desc">${b.desc}</p>
      <ul class="box__list">${items}</ul>
      <div class="box__price">
        <small>${n} garrafas · preço cota</small>
        <strong>${brl(cota)}</strong>
        <small><s>${brl(list)}</s> · <span class="save">economia de ${brl(list - cota)}</span></small>
      </div>
      <button type="button" class="btn ${b.featured ? 'btn--gold' : 'btn--primary'} btn--lg btn--block" data-box="${b.id}">${icon('box')}Levar a caixa (${n})</button>
    </article>`;
  }).join('');
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-box]');
    if (!b) return;
    const box = BOXES.find(x => x.id === b.dataset.box);
    const before = totalQty();
    addMany(box.items);
    if (before >= COTA) toast(`Caixa ${box.title} adicionada`);
    openDialog($('#cart'));
  });

  // ---------- Vinícolas (as que têm logo e mais rótulos) ----------
  const top = BRANDS.filter(b => b.logo).sort((a, b) => b.n - a.n).slice(0, 17);
  $('[data-brands]').innerHTML = top.map(b =>
    `<li><a href="${url.catalog({ vinicola: b.slug })}"><img src="${b.logo}" alt="${esc(b.nome)}" loading="lazy" decoding="async"><span>${esc(b.nome)} · ${b.n} rótulo${b.n > 1 ? 's' : ''}</span></a></li>`).join('') +
    `<li class="brands__more"><a href="vinicolas.html"><strong>Ver todas</strong><span>${BRANDS.length} vinícolas no catálogo</span></a></li>`;

  // ---------- Contagem regressiva ----------
  function countdown() {
    const ms = Math.max(0, EVENT - Date.now());
    $('[data-cd-d]').textContent = Math.floor(ms / 864e5);
    $('[data-cd-h]').textContent = String(Math.floor(ms / 36e5) % 24).padStart(2, '0');
    $('[data-cd-m]').textContent = String(Math.floor(ms / 6e4) % 60).padStart(2, '0');
  }

  renderGrid();
  countdown(); setInterval(countdown, 30000);
  LC.init();
})();
