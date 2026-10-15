/* Catálogo: filtros facetados, ordenação, busca e URL sincronizada. */
(() => {
  'use strict';
  const { $, $$, esc, norm, icon, brl, url, PRODUCTS, BRANDS, brandBySlug, TIPOS, COLECOES, stdBrl, cardHTML, searchProducts, openDialog } = LC;
  const PAGE = 24;
  const PRICES = [
    { id: 'ate-30', label: 'Até R$ 30', test: v => v < 30 },
    { id: '30-60', label: 'R$ 30 a R$ 60', test: v => v >= 30 && v < 60 },
    { id: '60-120', label: 'R$ 60 a R$ 120', test: v => v >= 60 && v < 120 },
    { id: '120', label: 'Acima de R$ 120', test: v => v >= 120 },
  ];
  const TIPO_ORDER = ['tinto', 'branco', 'rose', 'espumante', 'laranja', 'whisky', 'destilado', 'outro'];
  const list = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);

  // ---------- Estado <-> URL ----------
  const S = { tipo: [], uva: [], vinicola: [], preco: '', colecao: '', q: '', ordem: 'relevancia', shown: PAGE, uvaAll: false, vinAll: false, vinQ: '' };
  function readURL() {
    const u = new URLSearchParams(location.search);
    S.tipo = list(u.get('tipo')).filter(t => TIPOS[t]);
    S.uva = list(u.get('uva'));
    S.vinicola = list(u.get('vinicola')).filter(s => brandBySlug[s]);
    S.preco = PRICES.some(p => p.id === u.get('preco')) ? u.get('preco') : '';
    S.colecao = COLECOES[u.get('colecao')] ? u.get('colecao') : '';
    S.q = (u.get('q') || '').trim();
    S.ordem = ['relevancia', 'menor', 'maior', 'nome'].includes(u.get('ordem')) ? u.get('ordem') : 'relevancia';
    S.shown = PAGE;
  }
  function writeURL(push) {
    const p = {};
    if (S.q) p.q = S.q;
    if (S.colecao) p.colecao = S.colecao;
    if (S.tipo.length) p.tipo = S.tipo.join(',');
    if (S.uva.length) p.uva = S.uva.join(',');
    if (S.vinicola.length) p.vinicola = S.vinicola.join(',');
    if (S.preco) p.preco = S.preco;
    if (S.ordem !== 'relevancia') p.ordem = S.ordem;
    const qs = new URLSearchParams(p).toString();
    history[push ? 'pushState' : 'replaceState'](null, '', 'catalogo.html' + (qs ? '?' + qs : ''));
  }

  // ---------- Filtragem facetada ----------
  const base = () => S.q ? searchProducts(S.q) : PRODUCTS;
  function match(p, skip) {
    if (skip !== 'colecao' && S.colecao && !p.tags.includes(S.colecao)) return false;
    if (skip !== 'tipo' && S.tipo.length && !S.tipo.includes(p.tipo)) return false;
    if (skip !== 'uva' && S.uva.length && !S.uva.includes(p.uva)) return false;
    if (skip !== 'vinicola' && S.vinicola.length && !S.vinicola.includes(p.bodegaSlug)) return false;
    if (skip !== 'preco' && S.preco && !PRICES.find(x => x.id === S.preco).test(stdBrl(p))) return false;
    return true;
  }
  function results() {
    const r = base().filter(p => match(p));
    const by = {
      menor: (a, b) => a.std - b.std,
      maior: (a, b) => b.std - a.std,
      nome: (a, b) => a.nome.localeCompare(b.nome, 'pt'),
      relevancia: (a, b) => (rank(b) - rank(a)),
    }[S.ordem];
    return S.q && S.ordem === 'relevancia' ? r : r.slice().sort(by);
  }
  const rank = p => (p.tags.includes('mais-vendido') ? 3 : 0) + (p.tags.includes('oferta') ? 2 : 0) + (p.tags.length ? 1 : 0);
  function facet(key, valueOf) {
    const counts = new Map();
    base().filter(p => match(p, key)).forEach(p => { const v = valueOf(p); if (v) counts.set(v, (counts.get(v) || 0) + 1); });
    return counts;
  }

  // ---------- Render: filtros ----------
  function check(key, value, label, n, checked) {
    return `<label class="fcheck${!n && !checked ? ' is-zero' : ''}">
      <input type="checkbox" data-f="${key}" value="${esc(value)}"${checked ? ' checked' : ''}${!n && !checked ? ' disabled' : ''}>
      <span class="fcheck__box" aria-hidden="true">${icon('check', 'ic--sm')}</span>
      <span class="fcheck__label">${esc(label)}</span><span class="fcheck__n">${n}</span></label>`;
  }
  function filtersHTML() {
    const tipoC = facet('tipo', p => p.tipo);
    const uvaC = facet('uva', p => p.uva);
    const vinC = facet('vinicola', p => p.bodegaSlug);
    const precoC = new Map(PRICES.map(r => [r.id, base().filter(p => match(p, 'preco') && r.test(stdBrl(p))).length]));
    const uvas = [...uvaC.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
    S.uva.forEach(u => { if (!uvas.includes(u)) uvas.push(u); });
    const uvaShown = S.uvaAll ? uvas : uvas.slice(0, 8);
    const vins = BRANDS.filter(b => vinC.get(b.slug) || S.vinicola.includes(b.slug))
      .filter(b => !S.vinQ || norm(b.nome).includes(norm(S.vinQ)))
      .sort((a, b) => (vinC.get(b.slug) || 0) - (vinC.get(a.slug) || 0) || a.nome.localeCompare(b.nome, 'pt'));
    const vinShown = S.vinAll || S.vinQ ? vins : vins.slice(0, 8);
    return `
      <div class="fgroup">
        <p class="fgroup__title">Tipo</p>
        ${TIPO_ORDER.filter(t => tipoC.get(t) || S.tipo.includes(t)).map(t => check('tipo', t, TIPOS[t].short, tipoC.get(t) || 0, S.tipo.includes(t))).join('')}
      </div>
      <div class="fgroup">
        <p class="fgroup__title">Uva</p>
        ${uvaShown.map(u => check('uva', u, u, uvaC.get(u) || 0, S.uva.includes(u))).join('') || '<p class="fgroup__empty">Sem uvas para esta seleção.</p>'}
        ${uvas.length > 8 ? `<button class="fmore" type="button" data-toggle="uvaAll">${S.uvaAll ? 'Mostrar menos' : `Mostrar todas (${uvas.length})`}</button>` : ''}
      </div>
      <div class="fgroup">
        <p class="fgroup__title">Vinícola</p>
        <label class="fsearch">${icon('search', 'ic--sm')}<input type="search" placeholder="Buscar vinícola" value="${esc(S.vinQ)}" data-vinq aria-label="Buscar vinícola"></label>
        ${vinShown.map(b => check('vinicola', b.slug, b.nome, vinC.get(b.slug) || 0, S.vinicola.includes(b.slug))).join('') || '<p class="fgroup__empty">Nenhuma vinícola encontrada.</p>'}
        ${!S.vinQ && vins.length > 8 ? `<button class="fmore" type="button" data-toggle="vinAll">${S.vinAll ? 'Mostrar menos' : `Mostrar todas (${vins.length})`}</button>` : ''}
      </div>
      <div class="fgroup">
        <p class="fgroup__title">Preço por garrafa</p>
        ${PRICES.map(r => `<label class="fcheck fcheck--radio${!precoC.get(r.id) && S.preco !== r.id ? ' is-zero' : ''}">
          <input type="radio" name="preco-${Math.random().toString(36).slice(2, 6)}" data-f="preco" value="${r.id}"${S.preco === r.id ? ' checked' : ''}${!precoC.get(r.id) && S.preco !== r.id ? ' disabled' : ''}>
          <span class="fcheck__box" aria-hidden="true"></span><span class="fcheck__label">${r.label}</span><span class="fcheck__n">${precoC.get(r.id)}</span></label>`).join('')}
        ${S.preco ? '<button class="fmore" type="button" data-clear="preco">Qualquer preço</button>' : ''}
      </div>`;
  }

  // ---------- Render: cabeçalho, chips ativos, resultados ----------
  const activeCount = () => S.tipo.length + S.uva.length + S.vinicola.length + (S.preco ? 1 : 0) + (S.colecao ? 1 : 0) + (S.q ? 1 : 0);
  function heading(n) {
    const title = $('[data-cat-title]'), sub = $('[data-cat-sub]'), logo = $('[data-cat-logo]');
    let t = 'Catálogo completo', crumb = null;
    logo.hidden = true;
    if (S.q) t = `Resultados para “${S.q}”`;
    else if (S.vinicola.length === 1 && !S.tipo.length && !S.uva.length) {
      const b = brandBySlug[S.vinicola[0]];
      t = b.nome; crumb = ['Vinícolas', 'vinicolas.html'];
      logo.hidden = false;
      logo.innerHTML = b.logo ? `<img src="${b.logo}" alt="" width="96" height="96">` : `<span class="monogram">${esc(b.nome.replace(/^(Bodega|Familia|Família)\s+/i, '').charAt(0))}</span>`;
    }
    else if (S.tipo.length === 1 && !S.uva.length) t = TIPOS[S.tipo[0]].plural;
    else if (S.uva.length === 1 && !S.tipo.length) t = S.uva[0];
    else if (S.colecao && activeCount() === 1) t = COLECOES[S.colecao].label;
    else if (activeCount()) {
      const parts = [...S.uva, ...S.tipo.map(x => TIPOS[x].short), ...S.vinicola.map(v => brandBySlug[v].nome), S.colecao && COLECOES[S.colecao].label, S.preco && PRICES.find(x => x.id === S.preco).label].filter(Boolean);
      t = parts.length <= 3 ? parts.join(' · ') : 'Seleção filtrada';
    }
    title.textContent = t;
    document.title = `${t} · La Costa Vinoteca`;
    sub.textContent = `${n} rótulo${n === 1 ? '' : 's'} · preços em reais com câmbio do dia`;
    const crumbs = [`<a href="index.html">Início</a>`];
    if (crumb) crumbs.push(`<a href="${crumb[1]}">${crumb[0]}</a>`);
    if (t !== 'Catálogo completo') crumbs.push(`<a href="catalogo.html">Catálogo</a>`);
    crumbs.push(`<span aria-current="page">${esc(t)}</span>`);
    $('[data-crumbs]').innerHTML = crumbs.join(icon('chev-r', 'ic--sm'));
    $('[data-colecoes]').innerHTML = [['', 'Todos'], ...Object.entries(COLECOES).map(([k, v]) => [k, v.label, v.icon])]
      .map(([k, label, ic]) => `<button type="button" class="pill${S.colecao === k ? ' is-active' : ''}" aria-pressed="${S.colecao === k}" data-colecao="${k}">${ic ? icon(ic, 'ic--sm') : ''}${label}</button>`).join('');
  }
  function activeHTML() {
    const chip = (key, value, label) => `<button type="button" class="achip" data-remove="${key}" data-value="${esc(value)}" aria-label="Remover filtro ${esc(label)}">${esc(label)}${icon('x', 'ic--sm')}</button>`;
    const c = [];
    if (S.q) c.push(chip('q', S.q, `Busca: ${S.q}`));
    if (S.colecao) c.push(chip('colecao', S.colecao, COLECOES[S.colecao].label));
    S.tipo.forEach(t => c.push(chip('tipo', t, TIPOS[t].short)));
    S.uva.forEach(u => c.push(chip('uva', u, u)));
    S.vinicola.forEach(v => c.push(chip('vinicola', v, brandBySlug[v].nome)));
    if (S.preco) c.push(chip('preco', S.preco, PRICES.find(p => p.id === S.preco).label));
    return c.length ? c.join('') + `<button type="button" class="achip achip--clear" data-clear-all>Limpar tudo</button>` : '';
  }
  function emptyHTML() {
    const sugg = ['Malbec', 'Chardonnay', 'Espumante', 'Cabernet Franc'];
    return `<div class="grid-empty">${icon('wine', 'ic--xl')}
      <h2>Nenhum rótulo encontrado</h2>
      <p>${S.q ? `Não encontramos “${esc(S.q)}” no catálogo.` : 'Nenhum rótulo combina com todos esses filtros.'} Tente remover algum filtro ou explore:</p>
      <div class="chips">${sugg.map(s => `<a class="chip" href="${url.catalog({ q: s })}">${s}</a>`).join('')}</div>
      ${activeCount() ? '<button class="btn btn--primary" type="button" data-clear-all>Limpar filtros</button>' : ''}
    </div>`;
  }

  const grid = $('[data-results]');
  function render(opts = {}) {
    const r = results();
    heading(r.length);
    const fh = filtersHTML();
    // Preserva o foco ao redesenhar os filtros (teclado e leitores de tela)
    const ae = document.activeElement;
    const box = ae?.closest?.('[data-filters], [data-filters-m]');
    const focusSel = !box ? null : ae.matches('[data-vinq]') ? '[data-vinq]'
      : ae.dataset.f ? `[data-f="${ae.dataset.f}"][value="${CSS.escape(ae.value)}"]`
      : ae.dataset.toggle ? `[data-toggle="${ae.dataset.toggle}"]` : null;
    $('[data-filters]').innerHTML = `<div class="filters__head"><p class="filters__title">Filtrar</p>${activeCount() ? '<button class="fmore" type="button" data-clear-all>Limpar tudo</button>' : ''}</div>` + fh;
    $('[data-filters-m]').innerHTML = fh;
    if (box && focusSel) {
      const el = $(focusSel, box);
      if (el) { el.focus({ preventScroll: true }); if (el.matches('[data-vinq]')) el.setSelectionRange(el.value.length, el.value.length); }
    }
    $('[data-active]').innerHTML = activeHTML();
    const n = activeCount() - (S.q ? 1 : 0);
    const fc = $('[data-filters-count]'); fc.hidden = !n; fc.textContent = n;
    $('[data-apply]').textContent = `Ver ${r.length} rótulo${r.length === 1 ? '' : 's'}`;
    $('[data-count]').innerHTML = `<strong>${r.length}</strong> rótulo${r.length === 1 ? '' : 's'}`;
    $('[data-sort]').value = S.ordem;
    if (opts.results !== false) {
      const slice = r.slice(0, S.shown);
      grid.classList.remove('is-swapping');
      grid.innerHTML = r.length ? slice.map(cardHTML).join('') : emptyHTML();
      if (!LC.reduced && opts.animate !== false) { void grid.offsetWidth; grid.classList.add('is-swapping'); }
    }
    const more = $('[data-more-wrap]');
    more.hidden = r.length <= S.shown;
    $('[data-more-info]').textContent = `Mostrando ${Math.min(S.shown, r.length)} de ${r.length}`;
  }
  function apply(push = false) { S.shown = PAGE; writeURL(push); render(); }

  // ---------- Eventos ----------
  document.addEventListener('change', e => {
    const f = e.target.closest('[data-f]');
    if (!f) return;
    const k = f.dataset.f;
    if (k === 'preco') S.preco = f.value;
    else S[k] = f.checked ? [...new Set([...S[k], f.value])] : S[k].filter(v => v !== f.value);
    apply();
  });
  document.addEventListener('input', e => { if (e.target.matches('[data-vinq]')) { S.vinQ = e.target.value; render({ results: false }); } });
  document.addEventListener('click', e => {
    const t = e.target;
    const tog = t.closest('[data-toggle]'); if (tog) { S[tog.dataset.toggle] = !S[tog.dataset.toggle]; render({ results: false }); return; }
    const cl = t.closest('[data-clear]'); if (cl) { S[cl.dataset.clear] = ''; apply(); return; }
    if (t.closest('[data-clear-all]')) { Object.assign(S, { tipo: [], uva: [], vinicola: [], preco: '', colecao: '', q: '', vinQ: '' }); apply(true); return; }
    const rm = t.closest('[data-remove]');
    if (rm) { const k = rm.dataset.remove, v = rm.dataset.value; if (Array.isArray(S[k])) S[k] = S[k].filter(x => x !== v); else S[k] = ''; apply(); return; }
    const col = t.closest('[data-colecao]'); if (col) { S.colecao = col.dataset.colecao; apply(); return; }
    if (t.closest('[data-more]')) {
      const prev = S.shown; S.shown += PAGE;
      const r = results();
      grid.insertAdjacentHTML('beforeend', r.slice(prev, S.shown).map(cardHTML).join(''));
      render({ results: false });
      $$('[data-card]', grid)[prev]?.querySelector('a')?.focus({ preventScroll: true });
    }
  });
  $('[data-sort]').addEventListener('change', e => { S.ordem = e.target.value; apply(); });
  $('[data-filters-open]').addEventListener('click', () => openDialog($('#filters-sheet')));
  addEventListener('popstate', () => { readURL(); render(); });

  readURL();
  render();
  LC.init();
})();
