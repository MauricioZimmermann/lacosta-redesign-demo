/* La Costa Vinoteca: núcleo compartilhado (shell, carrinho, busca, status ao vivo, WhatsApp demo).
   Cada página tem só o <main>; header, footer e diálogos são montados aqui. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');

  // ---------- Regras de negócio ----------
  const RATE = 310;            // R$ 1 = $ 310 (produção: endpoint com cache por hora)
  const COTA_DISC = 0.80;      // a partir de 16 garrafas: tabela −20%
  const COTA = 16;             // 12 L por CPF = 16 × 750 ml
  const WA_NUMBER = '5493487204742';
  const TZ = 'America/Argentina/Buenos_Aires';

  const DATA = window.LC_DATA || { products: [], brands: [], guia: [] };
  const PRODUCTS = DATA.products;
  const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const BRANDS = DATA.brands;
  const brandBySlug = Object.fromEntries(BRANDS.map(b => [b.slug, b]));

  const TIPOS = {
    tinto: { label: 'Tinto', plural: 'Vinhos tintos', short: 'Tintos' },
    branco: { label: 'Branco', plural: 'Vinhos brancos', short: 'Brancos' },
    rose: { label: 'Rosé', plural: 'Vinhos rosés', short: 'Rosés' },
    espumante: { label: 'Espumante', plural: 'Espumantes', short: 'Espumantes' },
    laranja: { label: 'Laranja', plural: 'Vinhos laranja', short: 'Laranja' },
    whisky: { label: 'Whisky', plural: 'Whiskys', short: 'Whiskys' },
    destilado: { label: 'Destilado', plural: 'Destilados', short: 'Destilados' },
    outro: { label: 'Outros', plural: 'Outras bebidas', short: 'Outros' },
  };
  const COLECOES = {
    oferta: { label: 'Ofertas da semana', icon: 'tag' },
    'mais-vendido': { label: 'Mais vendidos', icon: 'flame' },
    reserva: { label: 'Reserva', icon: 'award' },
    organico: { label: 'Orgânicos', icon: 'leaf' },
  };

  // ---------- Utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const arsFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const brl = n => brlFmt.format(n);
  const ars = n => arsFmt.format(n);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const icon = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const page = document.body.dataset.page || '';

  const store = {
    get(k, d) { try { const v = localStorage.getItem('lc_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('lc_' + k, JSON.stringify(v)); } catch { /* modo privado */ } },
  };

  // Preços
  const listBrl = p => p.ars / RATE;
  const stdBrl = p => p.std / RATE;
  const cotaBrl = p => Math.min(p.std, p.ars * COTA_DISC) / RATE;
  const pct = (a, b) => Math.round((1 - a / b) * 100);

  // ---------- Estado do carrinho ----------
  const state = { cart: store.get('cart', {}), adults: store.get('adults', 1), name: store.get('name', ''), date: store.get('date', '') };
  for (const id in state.cart) if (!byId[id] || state.cart[id] <= 0) delete state.cart[id];
  const totalQty = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
  const isCota = () => totalQty() >= COTA;
  const unitNow = p => isCota() ? cotaBrl(p) : stdBrl(p);
  const listeners = [];

  function setQty(id, qty) {
    const before = totalQty();
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = qty;
    store.set('cart', state.cart);
    update(before);
  }
  const addQty = (id, n) => setQty(id, (state.cart[id] || 0) + n);
  function addMany(items) {
    const before = totalQty();
    for (const [id, q] of Object.entries(items)) if (byId[id]) state.cart[id] = (state.cart[id] || 0) + q;
    store.set('cart', state.cart);
    update(before);
  }

  // ---------- URLs internas ----------
  const url = {
    product: p => `produto.html?id=${p.id}`,
    catalog: (params = {}) => 'catalogo.html' + (Object.keys(params).length ? '?' + new URLSearchParams(params) : ''),
  };

  // ---------- Shell ----------
  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></symbol>
    <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></symbol>
    <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
    <symbol id="i-arrow-l" viewBox="0 0 24 24"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></symbol>
    <symbol id="i-chev-r" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
    <symbol id="i-chev-d" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>
    <symbol id="i-ship" viewBox="0 0 24 24"><path d="M12 10.189V14"/><path d="M12 2v3"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"/><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></symbol>
    <symbol id="i-wine" viewBox="0 0 24 24"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></symbol>
    <symbol id="i-bag" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></symbol>
    <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></symbol>
    <symbol id="i-flame" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></symbol>
    <symbol id="i-tag" viewBox="0 0 24 24"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/></symbol>
    <symbol id="i-award" viewBox="0 0 24 24"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></symbol>
    <symbol id="i-star" viewBox="0 0 24 24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></symbol>
    <symbol id="i-box" viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></symbol>
    <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></symbol>
    <symbol id="i-cal" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
    <symbol id="i-nav" viewBox="0 0 24 24"><path d="M3 11 22 2l-9 19-2-8-8-2z"/></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></symbol>
    <symbol id="i-insta" viewBox="0 0 24 24"><rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><path d="M17.5 6.5h.01"/></symbol>
    <symbol id="i-car" viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></symbol>
    <symbol id="i-walk" viewBox="0 0 24 24"><circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 3v4"/><path d="m6 12 3-4 4 1 3 3h3"/><path d="m12 14-1-5"/></symbol>
    <symbol id="i-filter" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></symbol>
    <symbol id="i-grape" viewBox="0 0 24 24"><path d="M22 5V2l-5.89 5.89"/><circle cx="16.6" cy="15.89" r="3"/><circle cx="8.11" cy="7.4" r="3"/><circle cx="12.35" cy="11.65" r="3"/><circle cx="13.91" cy="5.85" r="3"/><circle cx="18.15" cy="10.09" r="3"/><circle cx="6.56" cy="13.2" r="3"/><circle cx="10.8" cy="17.44" r="3"/><circle cx="5" cy="19" r="3"/></symbol>
    <symbol id="i-thermo" viewBox="0 0 24 24"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></symbol>
    <symbol id="i-mountain" viewBox="0 0 24 24"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></symbol>
    <symbol id="i-book" viewBox="0 0 24 24"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></symbol>
    <symbol id="i-receipt" viewBox="0 0 24 24"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></symbol>
    <symbol id="i-wa" viewBox="0 0 24 24"><path stroke="none" fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></symbol>
  </defs></svg>`;

  const cur = p => page === p ? ' aria-current="page"' : '';
  const megaCount = fn => PRODUCTS.filter(fn).length;
  const TOP = `
  <a class="skip" href="#main">Pular para o conteúdo</a>
  <div class="statusbar" role="region" aria-label="Status da loja e da travessia">
    <div class="container statusbar__inner">
      <span class="status-item"><strong>R$ 1 = $ ${RATE}</strong><span class="hide-sm"> · câmbio de hoje</span></span>
      <span class="status-item"><span class="dot" data-store-dot></span><span data-store-label>Loja aberta</span></span>
      <span class="status-item hide-sm">${icon('ship')}<span data-ferry-label>Balsa operando</span></span>
      <span class="status-item hide-md">${icon('wallet')}PIX ou dinheiro</span>
      <a class="status-link hide-sm" href="travessia.html">Planejar travessia ${icon('arrow')}</a>
    </div>
  </div>
  <header class="header" data-header>
    <div class="container header__inner">
      <button class="icon-btn show-mobile" type="button" aria-label="Abrir menu" aria-controls="mobile-nav" aria-expanded="false" data-menu-open>${icon('menu', 'ic--lg')}</button>
      <a class="logo" href="index.html" aria-label="La Costa Vinoteca, início"><span class="logo__mark" aria-hidden="true"></span></a>
      <nav class="nav" aria-label="Principal">
        <ul class="nav__list">
          <li class="nav__item has-mega">
            <button class="nav__link" type="button" aria-expanded="false" aria-controls="mega-vinhos" data-mega-toggle${page === 'catalogo' ? ' aria-current="page"' : ''}>Vinhos ${icon('chev-d', 'ic--sm')}</button>
            <div class="mega" id="mega-vinhos">
              <div class="mega__col">
                <p class="eyebrow">Por tipo</p>
                ${['tinto', 'branco', 'rose', 'espumante', 'laranja'].map(t => `<a href="${url.catalog({ tipo: t })}">${TIPOS[t].short} <small>${megaCount(p => p.tipo === t)}</small></a>`).join('')}
              </div>
              <div class="mega__col">
                <p class="eyebrow">Por uva</p>
                ${['Malbec', 'Cabernet Sauvignon', 'Cabernet Franc', 'Pinot Noir', 'Chardonnay', 'Torrontés'].map(u => `<a href="${url.catalog({ uva: u })}">${u} <small>${megaCount(p => p.uva === u)}</small></a>`).join('')}
              </div>
              <div class="mega__col">
                <p class="eyebrow">Outras bebidas</p>
                <a href="${url.catalog({ tipo: 'whisky' })}">Whiskys <small>${megaCount(p => p.tipo === 'whisky')}</small></a>
                <a href="${url.catalog({ tipo: 'destilado' })}">Gin, vodka e licores <small>${megaCount(p => p.tipo === 'destilado')}</small></a>
                <p class="eyebrow mega__sub">Coleções</p>
                <a href="${url.catalog({ colecao: 'reserva' })}">Reserva</a>
                <a href="${url.catalog({ colecao: 'organico' })}">Orgânicos</a>
              </div>
              <a class="mega__feature" href="index.html#caixas">
                <span class="eyebrow eyebrow--gold">Novo</span>
                <strong>Caixas prontas de 16</strong>
                <span>Cota completa em um clique, já com 20% off.</span>
              </a>
              <a class="mega__all" href="catalogo.html">Ver o catálogo completo ${icon('arrow')}</a>
            </div>
          </li>
          <li><a class="nav__link" href="${url.catalog({ colecao: 'oferta' })}">Ofertas</a></li>
          <li><a class="nav__link" href="vinicolas.html"${cur('vinicolas')}>Vinícolas</a></li>
          <li><a class="nav__link" href="como-comprar.html"${cur('como-comprar')}>Como comprar</a></li>
          <li><a class="nav__link" href="travessia.html"${cur('travessia')}>Travessia</a></li>
        </ul>
      </nav>
      <div class="header__actions">
        <button class="search-trigger" type="button" data-search-open aria-label="Buscar vinhos">
          ${icon('search')}<span class="hide-mobile">Buscar por vinho, uva ou vinícola</span><kbd class="hide-mobile">/</kbd>
        </button>
        <button class="cart-btn" type="button" data-cart-open aria-label="Abrir carrinho, 0 garrafas">
          <svg class="cart-ring" viewBox="0 0 44 44" aria-hidden="true"><circle class="cart-ring__track" cx="22" cy="22" r="20"/><circle class="cart-ring__fill" cx="22" cy="22" r="20" data-cart-ring/></svg>
          ${icon('bag', 'ic--lg')}<span class="cart-btn__count" data-cart-count>0</span>
        </button>
      </div>
    </div>
  </header>`;

  const BOTTOM = `
  <footer class="footer">
    <div class="container">
      <div class="footer__grid">
        <div class="footer__brand">
          <a href="index.html" aria-label="La Costa Vinoteca, início"><span class="logo__mark logo__mark--light" aria-hidden="true"></span></a>
          <p>Vinhos argentinos selecionados, com atendimento em português e retirada em frente à aduana de Alba Posse.</p>
          <div class="footer__social">
            <a class="icon-btn icon-btn--light" href="https://www.instagram.com/la_costa_vinoteca" target="_blank" rel="noopener" aria-label="Instagram (abre em nova aba)">${icon('insta')}</a>
            <button class="icon-btn icon-btn--light" type="button" data-wa="Olá, La Costa! Vim pelo site." aria-label="Falar no WhatsApp">${icon('wa')}</button>
          </div>
        </div>
        <nav aria-label="Comprar"><p class="footer__title">Comprar</p>
          <a href="catalogo.html">Catálogo completo</a><a href="${url.catalog({ colecao: 'oferta' })}">Ofertas da semana</a><a href="index.html#caixas">Caixas prontas</a><a href="vinicolas.html">Vinícolas</a></nav>
        <nav aria-label="Guias"><p class="footer__title">Guias</p>
          <a href="travessia.html">Guia da travessia</a><a href="guia-de-cata.html">Guia de degustação</a><a href="como-comprar.html">Como comprar</a></nav>
        <nav aria-label="Políticas"><p class="footer__title">Políticas</p>
          <a href="precos.html">Preços e descontos</a><a href="como-comprar.html#perguntas">Perguntas frequentes</a><a href="index.html#onde-retirar">Retirada na loja</a></nav>
      </div>
      <div class="footer__bar">
        <p><strong>Importante:</strong> não realizamos envios para o Brasil. Retirada somente na loja, todos os dias das 8:00 às 17:30.</p>
        <p>Beba com moderação. Venda proibida para menores de 18 anos. © 2026 La Costa Vinoteca.</p>
      </div>
    </div>
  </footer>

  <dialog class="sheet sheet--left" id="mobile-nav" aria-label="Menu">
    <div class="sheet__head">
      <span class="logo__mark" aria-hidden="true"></span>
      <button class="icon-btn" type="button" aria-label="Fechar menu" data-close>${icon('x', 'ic--lg')}</button>
    </div>
    <nav class="mnav" aria-label="Menu mobile">
      <a href="index.html">Início</a>
      <a href="catalogo.html">Catálogo completo</a>
      <a href="${url.catalog({ colecao: 'oferta' })}">Ofertas da semana</a>
      <a href="index.html#caixas">Caixas prontas de 16</a>
      <a href="vinicolas.html">Vinícolas</a>
      <a href="como-comprar.html">Como comprar</a>
      <a href="travessia.html">Planejar travessia</a>
      <a href="guia-de-cata.html">Guia de degustação</a>
      <p class="eyebrow">Por tipo</p>
      <div class="mnav__chips">
        ${['tinto', 'branco', 'rose', 'espumante', 'whisky', 'destilado'].map(t => `<a class="chip" href="${url.catalog({ tipo: t })}">${TIPOS[t].short}</a>`).join('')}
      </div>
    </nav>
    <button class="btn btn--wa btn--block" type="button" data-wa="Olá, La Costa! Vim pelo site.">${icon('wa')}Falar no WhatsApp</button>
  </dialog>

  <div class="cotabar" data-cotabar hidden>
    <div class="cotabar__info">
      <p><strong data-cotabar-count>0</strong>/16 garrafas</p>
      <div class="cotabar__track"><span data-cotabar-fill></span></div>
    </div>
    <button class="btn btn--primary" type="button" data-cart-open>Ver pedido <span data-cotabar-total></span></button>
  </div>

  <button class="fab" type="button" data-wa="Olá, La Costa! Vim pelo site." aria-label="Falar no WhatsApp" data-fab>
    ${icon('wa')}<span class="fab__label">Fale conosco</span>
  </button>

  <dialog class="sheet sheet--right drawer" id="cart" aria-labelledby="cart-title">
    <div class="sheet__head">
      <h2 class="drawer__title" id="cart-title">Seu pedido</h2>
      <button class="icon-btn" type="button" aria-label="Fechar carrinho" data-close>${icon('x', 'ic--lg')}</button>
    </div>
    <div class="drawer__meter">
      <div class="meter-card__head">
        <p class="meter-card__label"><strong data-meter-count>0</strong> de 16 garrafas</p>
        <p class="meter-card__hint" data-meter-hint>Faltam 16 para liberar −20%</p>
      </div>
      <div class="meter meter--sm" role="progressbar" aria-label="Progresso da cota" aria-valuemin="0" aria-valuemax="16" aria-valuenow="0" data-meter></div>
    </div>
    <div class="drawer__body">
      <ul class="lines" data-lines></ul>
      <div class="empty" data-empty>
        ${icon('wine', 'ic--xl')}
        <p><strong>Seu carrinho está vazio.</strong> Que tal começar por um Malbec?</p>
        <a class="btn btn--ghost" href="${url.catalog({ uva: 'Malbec' })}">Ver Malbecs</a>
      </div>
      <div class="checkout" data-checkout>
        <div class="field-inline">
          <span>${icon('users')}Adultos na travessia</span>
          <span class="stepper">
            <button type="button" aria-label="Menos adultos" data-adults-dec>${icon('minus', 'ic--sm')}</button>
            <output data-adults>1</output>
            <button type="button" aria-label="Mais adultos" data-adults-inc>${icon('plus', 'ic--sm')}</button>
          </span>
        </div>
        <p class="warn" data-cap-warn hidden>${icon('alert', 'ic--sm')}<span></span></p>
        <div class="fields">
          <label class="field"><span>Seu nome</span><input type="text" autocomplete="name" placeholder="Como devemos te chamar?" data-name></label>
          <label class="field"><span>Dia da retirada</span><input type="date" data-date></label>
        </div>
      </div>
    </div>
    <div class="drawer__foot" data-foot>
      <dl class="totals">
        <div><dt>Subtotal (preço de tabela)</dt><dd data-t-list>—</dd></div>
        <div class="totals__save"><dt data-t-save-label>Desconto</dt><dd data-t-save>—</dd></div>
        <div class="totals__grand"><dt>Total estimado</dt><dd data-t-total>—</dd></div>
      </dl>
      <p class="fine">Em reais via PIX, câmbio R$ 1 = $ ${RATE}. O valor final é confirmado pela equipe antes do pagamento.</p>
      <details class="preview">
        <summary>Ver mensagem que será enviada</summary>
        <div class="bubble"><pre data-wa-preview></pre></div>
      </details>
      <button class="btn btn--wa btn--lg btn--block" type="button" data-wa-send>${icon('wa')}Enviar pedido pelo WhatsApp</button>
    </div>
  </dialog>

  <dialog class="search" id="search" aria-label="Buscar vinhos">
    <div class="search__box">
      ${icon('search', 'ic--lg')}
      <input type="search" placeholder="Malbec, Achaval Ferrer, espumante…" aria-label="Buscar por vinho, uva ou vinícola" autocomplete="off" data-search-input>
      <button class="icon-btn" type="button" aria-label="Fechar busca" data-close>${icon('x', 'ic--lg')}</button>
    </div>
    <div class="search__suggest" data-search-suggest>
      <p class="eyebrow">Buscas populares</p>
      <div class="chips">
        ${['Malbec', 'Achaval Ferrer', 'Espumante', 'Cabernet Franc', 'Chandon', 'Whisky'].map(q => `<button class="chip" type="button" data-q="${q}">${q}</button>`).join('')}
      </div>
    </div>
    <ul class="search__results" data-search-results></ul>
    <a class="search__all" href="catalogo.html" data-search-all>Ver todos os resultados no catálogo ${icon('arrow')}</a>
  </dialog>

  <dialog class="age" id="age" aria-labelledby="age-title" aria-describedby="age-desc">
    <span class="logo__mark" aria-hidden="true"></span>
    <h2 id="age-title">Você tem 18 anos ou mais?</h2>
    <p id="age-desc">Este site apresenta bebidas alcoólicas. A venda é proibida para menores de idade.</p>
    <div class="age__ctas">
      <button class="btn btn--primary btn--lg" type="button" data-age-yes>Sim, tenho 18+</button>
      <button class="btn btn--ghost btn--lg" type="button" data-age-no>Não</button>
    </div>
    <p class="age__no" data-age-msg hidden>Volte quando tiver 18 anos. Obrigado pela visita!</p>
  </dialog>

  <dialog class="wa" id="wa" aria-labelledby="wa-title">
    <div class="wa__head">
      <span class="wa__avatar" aria-hidden="true"><span class="logo__mark logo__mark--light"></span></span>
      <div><p class="wa__name" id="wa-title">La Costa Vinoteca</p><p class="wa__status" data-wa-status>online</p></div>
      <button class="icon-btn icon-btn--light" type="button" aria-label="Fechar conversa" data-close>${icon('x', 'ic--lg')}</button>
    </div>
    <div class="wa__body" data-wa-body aria-live="polite"></div>
    <div class="wa__foot">
      <p class="wa__note">${icon('info', 'ic--sm')}Simulação para a demonstração. No site publicado, a mensagem abre direto no WhatsApp da loja.</p>
      <div class="wa__ctas">
        <button class="btn btn--ghost" type="button" data-close>Continuar no site</button>
        <a class="btn btn--wa" href="#" target="_blank" rel="noopener" data-wa-real>${icon('wa')}Abrir no WhatsApp</a>
      </div>
    </div>
  </dialog>

  <div class="toast" role="status" aria-live="polite" data-toast></div>`;

  document.body.insertAdjacentHTML('afterbegin', SPRITE + TOP);
  document.body.insertAdjacentHTML('beforeend', BOTTOM);

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('[data-toast]');
    t.className = 'toast is-on' + (kind ? ' is-' + kind : '');
    t.innerHTML = icon(kind === 'success' ? 'check' : 'wine') + `<span>${msg}</span>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2800);
  }

  // ---------- Card de produto ----------
  function priceHTML(p) {
    const cota = isCota();
    const now = unitNow(p);
    return `
      <div class="price__main">
        <span class="price__now${cota ? ' flip' : ''}">${brl(now)}</span>
        <span class="price__was">${brl(cota ? stdBrl(p) : listBrl(p))}</span>
      </div>
      ${cota
        ? `<span class="price__cota">${icon('check')}Preço cota ativo</span>`
        : `<button type="button" class="price__cota" data-tip="${p.id}" aria-label="${brl(cotaBrl(p))} na cota de 16 garrafas. O que é isso?">${brl(cotaBrl(p))} na cota<span class="wide-only"> de 16</span> ${icon('info')}</button>`}
      <span class="price__ars">${ars(cota ? Math.min(p.std, p.ars * COTA_DISC) : p.std)}<span class="wide-only"> · via PIX ou dinheiro</span></span>`;
  }
  function addHTML(p) {
    const q = state.cart[p.id] || 0;
    if (!q) return `<button type="button" class="btn btn--primary" data-add="${p.id}">${icon('plus')}Adicionar</button>`;
    return `<div class="stepper" role="group" aria-label="Quantidade de ${esc(p.nome)}">
      <button type="button" data-dec="${p.id}" aria-label="Remover uma">${icon(q === 1 ? 'trash' : 'minus', 'ic--sm')}</button>
      <output aria-live="polite">${q}</output>
      <button type="button" data-inc="${p.id}" aria-label="Adicionar mais uma">${icon('plus', 'ic--sm')}</button>
    </div>`;
  }
  function badgesHTML(p) {
    const b = [isCota() ? `<span class="badge badge--green">−${pct(cotaBrl(p), listBrl(p))}%</span>`
      : `<span class="badge badge--wine">−${pct(p.std, p.ars)}%</span><span class="badge badge--gold">até −20%</span>`];
    if (p.tags.includes('organico')) b.push(`<span class="badge badge--gold">${icon('leaf')}Orgânico</span>`);
    return b.join('');
  }
  function metaLine(p) { return [p.uva, TIPOS[p.tipo]?.label].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · '); }
  function cardHTML(p, i = 0) {
    const q = state.cart[p.id] || 0;
    return `<article class="card${q ? ' in-cart' : ''}${isCota() ? ' cota-on' : ''}" data-card="${p.id}" style="--i:${i % 12}">
      <a class="card__media" href="${url.product(p)}" tabindex="-1" aria-hidden="true">
        <div class="card__badges" data-badges>${badgesHTML(p)}</div>
        <img src="${p.img}" alt="" width="240" height="300" loading="lazy" decoding="async">
      </a>
      <div class="card__body">
        <p class="card__brand">${esc(p.bodega)}</p>
        <h3 class="card__name"><a href="${url.product(p)}">${esc(p.nome)}</a></h3>
        <p class="card__meta">${esc(metaLine(p))}</p>
        <div class="price" data-price>${priceHTML(p)}</div>
        <div class="card__add" data-addwrap>${addHTML(p)}</div>
      </div>
    </article>`;
  }
  function refreshCards(cotaChanged) {
    $$('[data-card]').forEach(card => {
      const p = byId[card.dataset.card];
      const q = state.cart[p.id] || 0;
      card.classList.toggle('in-cart', q > 0);
      card.classList.toggle('cota-on', isCota());
      const wrap = $('[data-addwrap]', card);
      const hadStepper = !!$('.stepper', wrap);
      if (hadStepper !== q > 0) {
        const hadFocus = wrap.contains(document.activeElement);
        wrap.innerHTML = addHTML(p);
        if (hadFocus) $(q ? '[data-inc]' : '[data-add]', wrap)?.focus();
      } else if (q) {
        $('output', wrap).textContent = q;
        $('[data-dec] use', wrap).setAttribute('href', q === 1 ? '#i-trash' : '#i-minus');
      }
      if (cotaChanged) { $('[data-price]', card).innerHTML = priceHTML(p); $('[data-badges]', card).innerHTML = badgesHTML(p); }
    });
  }

  // Ações de carrinho (delegadas, valem para qualquer página)
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]'), inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (add) { const p = byId[add.dataset.add]; addQty(p.id, 1); if (totalQty() < COTA) toast(`${esc(p.nome)} adicionado · ${totalQty()}/16`); }
    else if (inc) addQty(+inc.dataset.inc, 1);
    else if (dec) addQty(+dec.dataset.dec, -1);
  });

  // Tooltip "o que é preço cota"
  let tipEl;
  function closeTip() { tipEl?.remove(); tipEl = null; }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tip]');
    closeTip();
    if (!b) return;
    const p = byId[b.dataset.tip];
    tipEl = document.createElement('div');
    tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip');
    tipEl.innerHTML = `<strong>Preço cota: ${brl(cotaBrl(p))}</strong><br>Levando 16 garrafas ou mais (pode misturar rótulos), cada uma sai por este valor: 20% abaixo do preço de tabela. 16 garrafas = 12 L, sua cota isenta na Receita.`;
    document.body.append(tipEl);
    const r = b.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(12, Math.min(r.left, innerWidth - w - 12)) + 'px';
    tipEl.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8) + 'px';
  });
  addEventListener('scroll', closeTip, { passive: true });

  // ---------- Medidores + atualização global ----------
  function cartTotals() {
    let list = 0, total = 0;
    for (const [id, q] of Object.entries(state.cart)) { const p = byId[id]; list += listBrl(p) * q; total += unitNow(p) * q; }
    return { list, total, save: list - total };
  }
  function renderMeters(qty) {
    const full = qty >= COTA;
    $$('[data-meter]').forEach(m => {
      if (!m.children.length) m.innerHTML = Array.from({ length: COTA }, (_, i) => `<i style="--i:${i}"></i>`).join('');
      [...m.children].forEach((c, i) => {
        const on = i < Math.min(qty, COTA);
        if (on && !c.classList.contains('on')) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
        c.classList.toggle('on', on);
      });
      m.classList.toggle('is-full', full);
      m.setAttribute('aria-valuenow', Math.min(qty, COTA));
      m.setAttribute('aria-valuetext', `${qty} de 16 garrafas`);
    });
    $$('[data-meter-count]').forEach(el => el.textContent = qty);
    const saving = cartTotals().save;
    $$('[data-meter-hint]').forEach(el => {
      el.classList.toggle('is-full', full);
      el.textContent = full ? `Cota completa! Economia de ${brl(saving)}` : `Faltam ${COTA - qty} para liberar −20%`;
    });
    $$('[data-meter-card]').forEach(el => el.classList.toggle('is-full', full));
  }

  function update(before = totalQty()) {
    const qty = totalQty();
    const cotaChanged = (before >= COTA) !== (qty >= COTA);
    const full = qty >= COTA;
    const count = $('[data-cart-count]');
    if (count.textContent !== String(qty)) { count.textContent = qty; count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump'); }
    $('[data-cart-ring]').style.strokeDashoffset = 125.66 * (1 - Math.min(qty, COTA) / COTA);
    const cartBtn = $('.cart-btn');
    cartBtn.classList.toggle('is-full', full);
    cartBtn.setAttribute('aria-label', `Abrir carrinho, ${qty} garrafas`);
    renderMeters(qty);
    refreshCards(cotaChanged);
    renderCart();
    const bar = $('[data-cotabar]');
    bar.hidden = qty === 0;
    bar.classList.toggle('is-full', full);
    $('[data-cotabar-count]').textContent = qty;
    $('[data-cotabar-fill]').style.width = Math.min(qty / COTA, 1) * 100 + '%';
    $('[data-cotabar-total]').textContent = qty ? '· ' + brl(cartTotals().total) : '';
    $('[data-fab]').classList.toggle('is-hidden', qty > 0 && innerWidth < 1024);
    if (cotaChanged && full) {
      $$('[data-meter]').forEach(m => { m.classList.remove('celebrate'); void m.offsetWidth; m.classList.add('celebrate'); });
      toast(`Cota completa! Todos os preços com −20%. Você economiza ${brl(cartTotals().save)}`, 'success');
    } else if (cotaChanged && !full) {
      toast('Abaixo de 16 garrafas: o preço cota foi removido');
    }
    listeners.forEach(fn => fn({ qty, cotaChanged }));
  }

  // ---------- Carrinho ----------
  function renderCart() {
    const ids = Object.keys(state.cart);
    const qty = totalQty();
    $('[data-empty]').hidden = ids.length > 0;
    $('[data-checkout]').hidden = !ids.length;
    $('[data-foot]').hidden = !ids.length;
    const lines = $('[data-lines]');
    const focusedId = document.activeElement?.closest?.('[data-line]')?.dataset.line;
    const focusedAct = document.activeElement?.dataset?.inc ? 'inc' : document.activeElement?.dataset?.dec ? 'dec' : null;
    lines.innerHTML = ids.map(id => {
      const p = byId[id], q = state.cart[id];
      return `<li class="line" data-line="${id}">
        <a class="line__img" href="${url.product(p)}" tabindex="-1" aria-hidden="true"><img src="${p.img}" alt="" width="48" height="60"></a>
        <div><a class="line__name" href="${url.product(p)}">${esc(p.nome)}</a><p class="line__unit">${brl(unitNow(p))} / un.${isCota() ? ' · preço cota' : ''}</p></div>
        <div class="line__right">
          <span class="line__total">${brl(unitNow(p) * q)}</span>
          <div class="stepper" role="group" aria-label="Quantidade de ${esc(p.nome)}">
            <button type="button" data-dec="${id}" aria-label="Remover uma">${icon(q === 1 ? 'trash' : 'minus', 'ic--sm')}</button>
            <output>${q}</output>
            <button type="button" data-inc="${id}" aria-label="Adicionar mais uma">${icon('plus', 'ic--sm')}</button>
          </div>
        </div>
      </li>`;
    }).join('');
    if (focusedId && focusedAct) $(`[data-line="${focusedId}"] [data-${focusedAct}]`, lines)?.focus();
    const t = cartTotals();
    $('[data-t-list]').textContent = brl(t.list);
    $('[data-t-save-label]').textContent = isCota() ? 'Desconto cota (−20%)' : 'Desconto da semana';
    $('[data-t-save]').textContent = '− ' + brl(t.save);
    $('[data-t-total]').textContent = brl(t.total);
    const cap = COTA * state.adults;
    const warn = $('[data-cap-warn]');
    warn.hidden = qty <= cap;
    if (qty > cap) $('span', warn).textContent = `${qty} garrafas passam da cota isenta de ${state.adults} adulto${state.adults > 1 ? 's' : ''} (${cap}). Informe ${Math.ceil(qty / COTA)} adultos ou a Receita cobra imposto sobre o excedente.`;
    $('[data-adults]').textContent = state.adults;
    $('[data-wa-preview]').textContent = buildMessage();
  }
  function buildMessage() {
    const qty = totalQty(), t = cartTotals();
    const lines = Object.entries(state.cart).map(([id, q]) => `• ${q}× ${byId[id].nome} (${brl(unitNow(byId[id]))}) = ${brl(unitNow(byId[id]) * q)}`);
    const date = state.date ? new Date(state.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : 'a combinar';
    return [
      `Olá, La Costa! Quero fazer um pedido para retirada${state.name ? `. Sou ${state.name}` : ''}.`, '',
      ...lines, '',
      `Garrafas: ${qty}${qty >= COTA ? ' (cota completa, −20%)' : ` (faltam ${COTA - qty} para a cota)`}`,
      `Total estimado: ${brl(t.total)} (economia de ${brl(t.save)})`,
      `Câmbio usado: R$ 1 = $ ${RATE}`,
      `Adultos na travessia: ${state.adults}`,
      `Retirada: ${date}`,
      'Pagamento: PIX', '',
      'Podem confirmar o estoque e o valor final?',
    ].join('\n');
  }
  $('[data-adults-inc]').addEventListener('click', () => { state.adults = Math.min(8, state.adults + 1); store.set('adults', state.adults); renderCart(); });
  $('[data-adults-dec]').addEventListener('click', () => { state.adults = Math.max(1, state.adults - 1); store.set('adults', state.adults); renderCart(); });
  const nameIn = $('[data-name]'), dateIn = $('[data-date]');
  nameIn.value = state.name; dateIn.value = state.date;
  dateIn.min = new Date().toISOString().slice(0, 10);
  nameIn.addEventListener('input', () => { state.name = nameIn.value.trim(); store.set('name', state.name); renderCart(); });
  dateIn.addEventListener('change', () => { state.date = dateIn.value; store.set('date', state.date); renderCart(); });

  // ---------- WhatsApp (simulação dentro da demo) ----------
  const waDlg = $('#wa');
  function openWhatsApp(message, reply) {
    const body = $('[data-wa-body]');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    body.innerHTML = `<p class="wa__day">Hoje</p><div class="wa__msg wa__msg--out"><pre>${esc(message)}</pre><span class="wa__time">${time} ${icon('check', 'ic--sm')}</span></div>`;
    $('[data-wa-real]').href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
    $('[data-wa-status]').textContent = 'online';
    openDialog(waDlg);
    body.scrollTop = body.scrollHeight;
    setTimeout(() => { if (!waDlg.open) return; $('[data-wa-status]').textContent = 'digitando…'; body.insertAdjacentHTML('beforeend', '<div class="wa__typing" data-typing><i></i><i></i><i></i></div>'); body.scrollTop = body.scrollHeight; }, 700);
    setTimeout(() => {
      if (!waDlg.open) return;
      $('[data-typing]')?.remove();
      $('[data-wa-status]').textContent = 'online';
      body.insertAdjacentHTML('beforeend', `<div class="wa__msg wa__msg--in"><pre>${esc(reply)}</pre><span class="wa__time">${time}</span></div>`);
      body.scrollTop = body.scrollHeight;
    }, 2100);
  }
  $('[data-wa-send]').addEventListener('click', () => {
    const t = cartTotals();
    $('#cart').close();
    openWhatsApp(buildMessage(), `Olá${state.name ? ', ' + state.name : ''}! Recebemos seu pedido de ${totalQty()} garrafas. Já estamos conferindo o estoque e em instantes enviamos o total final em reais (estimado ${brl(t.total)}) e a chave PIX.`);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-wa]');
    if (b) openWhatsApp(b.dataset.wa, b.dataset.waReply || 'Olá! Que bom falar com você. Como podemos ajudar? Atendemos em português, todos os dias das 8:00 às 17:30.');
  });

  // ---------- Diálogos ----------
  let lastFocus;
  function openDialog(d) {
    if (d.open) return;
    $$('dialog[open]').forEach(o => { if (o !== d && o.id !== 'age') o.close(); });
    lastFocus = document.activeElement;
    d.showModal();
    document.body.style.overflow = 'hidden';
  }
  $$('dialog').forEach(d => {
    d.addEventListener('close', () => { if (!$('dialog[open]')) document.body.style.overflow = ''; lastFocus?.focus?.({ preventScroll: true }); });
    d.addEventListener('click', e => {
      if (e.target === d && d.id !== 'age') d.close();
      if (e.target.closest('[data-close]')) d.close();
      const a = e.target.closest('a[href]');
      if (a && d.id === 'mobile-nav') {
        const h = a.getAttribute('href');
        if (h.startsWith('index.html#') && (page === 'home')) { e.preventDefault(); d.close(); lastFocus = null; $(h.slice(10))?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }
      }
    });
  });
  $$('[data-cart-open]').forEach(b => b.addEventListener('click', () => openDialog($('#cart'))));
  document.addEventListener('click', e => { if (e.target.closest('[data-cart-open]') && !e.target.closest('header, [data-cotabar]')) openDialog($('#cart')); });
  $('[data-menu-open]').addEventListener('click', e => { e.currentTarget.setAttribute('aria-expanded', 'true'); openDialog($('#mobile-nav')); });
  $('#mobile-nav').addEventListener('close', () => $('[data-menu-open]').setAttribute('aria-expanded', 'false'));

  // Links "index.html#x" na própria home: rolagem suave sem recarregar
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="index.html#"]');
    if (a && page === 'home') { const t = $(a.getAttribute('href').slice(10)); if (t) { e.preventDefault(); closeMega(); t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); history.replaceState(null, '', a.getAttribute('href').slice(10)); } }
  });

  // Mega menu
  const megaBtn = $('[data-mega-toggle]'), mega = $('#mega-vinhos');
  function closeMega() { mega.classList.remove('is-open'); megaBtn.setAttribute('aria-expanded', 'false'); }
  megaBtn.addEventListener('click', () => { const o = !mega.classList.contains('is-open'); mega.classList.toggle('is-open', o); megaBtn.setAttribute('aria-expanded', o); if (o) $('a', mega).focus({ preventScroll: true }); });
  document.addEventListener('click', e => { if (!e.target.closest('.has-mega')) closeMega(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeTip();
    if (mega.classList.contains('is-open')) { closeMega(); megaBtn.focus(); }
  });

  // ---------- Busca instantânea (catálogo inteiro) ----------
  const search = $('#search'), sIn = $('[data-search-input]'), sRes = $('[data-search-results]'), sSug = $('[data-search-suggest]');
  const index = PRODUCTS.map(p => ({ p, h: norm([p.nome, p.uva, p.bodega, TIPOS[p.tipo]?.label, p.tags.join(' ')].join(' ')) }));
  function openSearch(q = '') { openDialog(search); sIn.value = q; runSearch(); sIn.focus(); }
  $('[data-search-open]').addEventListener('click', () => openSearch());
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.target.closest('input, textarea, select') && !$('dialog[open]:not(#age)')) { e.preventDefault(); openSearch(); }
  });
  $$('[data-q]').forEach(c => c.addEventListener('click', () => { sIn.value = c.dataset.q; runSearch(); sIn.focus(); }));
  const hl = (text, q) => {
    const i = norm(text).indexOf(norm(q));
    return !q || i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  };
  function searchProducts(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index.filter(x => words.every(w => x.h.includes(w)))
      .map(x => ({ p: x.p, s: norm(x.p.nome).startsWith(words[0]) ? 0 : norm(x.p.nome).includes(words[0]) ? 1 : 2 }))
      .sort((a, b) => a.s - b.s).map(x => x.p);
  }
  let sTimer;
  sIn.addEventListener('input', () => { clearTimeout(sTimer); sTimer = setTimeout(runSearch, 60); });
  function runSearch() {
    const q = sIn.value.trim();
    sSug.hidden = !!q;
    const all = $('[data-search-all]');
    all.href = q ? url.catalog({ q }) : 'catalogo.html';
    if (!q) { sRes.innerHTML = ''; all.innerHTML = `Ver o catálogo completo ${icon('arrow')}`; return; }
    const hits = searchProducts(q);
    all.innerHTML = hits.length ? `Ver todos os ${hits.length} resultados ${icon('arrow')}` : `Ver o catálogo completo ${icon('arrow')}`;
    sRes.innerHTML = hits.length ? hits.slice(0, 7).map((p, i) => `<li><a href="${url.product(p)}"${i === 0 ? ' class="is-active"' : ''}>
      <img src="${p.img}" alt="" width="44" height="54">
      <span><span class="r-name">${hl(p.nome, q)}</span><br><span class="r-meta">${hl(p.bodega, q)}${p.uva ? ' · ' + hl(p.uva, q) : ''}</span></span>
      <span class="r-price">${brl(unitNow(p))}</span></a></li>`).join('')
      : `<li class="search__empty">Nenhum rótulo encontrado para “${esc(q)}”. Tente buscar pela uva (Malbec), pela vinícola ou pelo tipo (espumante).</li>`;
  }
  sIn.addEventListener('keydown', e => {
    const items = $$('a', sRes);
    if (e.key === 'Enter') { e.preventDefault(); const a = items.find(x => x.classList.contains('is-active')); location.href = a ? a.href : $('[data-search-all]').href; return; }
    if (!items.length) return;
    let i = items.findIndex(a => a.classList.contains('is-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); items[i]?.classList.remove('is-active');
      i = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[i].classList.add('is-active'); items[i].scrollIntoView({ block: 'nearest' });
    }
  });

  // ---------- Status ao vivo: loja + balsa ----------
  function arNow() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map(p => [p.type, p.value]));
    return { day: parts.weekday, min: (+parts.hour) * 60 + (+parts.minute) };
  }
  const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const dur = m => m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
  const setText = (sel, txt) => $$(sel).forEach(el => el.textContent = txt);
  function updateLive() {
    const { day, min } = arNow();
    const weekend = day === 'Sat' || day === 'Sun';
    const open = 480, close = 1050;
    let sDot, sShort, sLong;
    if (min >= open && min < close) { sDot = close - min <= 60 ? 'is-soon' : 'is-open'; sShort = 'Loja aberta · fecha às 17:30'; sLong = `Aberta agora · fecha em ${dur(close - min)}`; }
    else { sDot = 'is-closed'; sShort = 'Loja fechada · abre às 8:00'; sLong = `Fechada · abre ${min < open ? 'hoje' : 'amanhã'} às 8:00`; }
    const win = weekend ? [[510, 675], [870, 1050]] : [[480, 675], [840, 1050]];
    const cw = win.find(([a, b]) => min >= a && min < b), next = win.find(([a]) => min < a);
    let fDot, fShort, fLong;
    if (cw) { fDot = cw[1] - min <= 30 ? 'is-soon' : 'is-open'; fShort = `Balsa operando até ${hm(cw[1])}`; fLong = `Operando · até ${hm(cw[1])} (${dur(cw[1] - min)})`; }
    else if (next) { fDot = 'is-closed'; fShort = `Balsa volta às ${hm(next[0])}`; fLong = `Pausa · volta às ${hm(next[0])}`; }
    else { fDot = 'is-closed'; fShort = 'Balsa encerrada por hoje'; fLong = 'Encerrada · reabre amanhã de manhã'; }
    $$('[data-store-dot]').forEach(d => d.className = d.className.replace(/\bis-\w+/g, '').trim() + ' ' + sDot);
    $$('[data-ferry-dot]').forEach(d => d.className = d.className.replace(/\bis-\w+/g, '').trim() + ' ' + fDot);
    setText('[data-store-label]', sShort); setText('[data-store-long]', sLong);
    setText('[data-ferry-label]', fShort); setText('[data-ferry-long]', fLong);
    setText('[data-lampa-long]', cw ? 'Saídas a cada ~10 min agora' : `Fora do horário · volta ${next ? 'às ' + hm(next[0]) : 'amanhã'}`);
    $$('[data-sched]').forEach(r => r.classList.toggle('is-today', r.dataset.sched === (weekend ? 'weekend' : 'weekday')));
  }

  // ---------- Calculadora da travessia (se existir na página) ----------
  const calcEl = $('[data-calc]');
  if (calcEl) {
    const calc = { mode: 'car', people: 2 };
    const AR_CAR = { 1: 17000, 2: 21000, 3: 25000, 4: 29000, 5: 29000 };
    const render = () => {
      const n = calc.people;
      $('[data-calc-people]').textContent = n;
      if (calc.mode === 'car') { const a = AR_CAR[n] + 2000; $('[data-calc-ar]').textContent = `${ars(a)} (≈ ${brl(a / RATE)})`; $('[data-calc-br]').textContent = brl(55 + 10); }
      else { $('[data-calc-ar]').textContent = `${ars(n * 2000)} de taxa`; $('[data-calc-br]').textContent = `${brl(n * 15)} na Lampalagua`; }
      $('[data-calc-cota]').textContent = `${n * COTA} garrafas (${n * 12} L)`;
    };
    $$('[data-mode]').forEach(b => b.addEventListener('click', () => {
      calc.mode = b.dataset.mode;
      $$('[data-mode]').forEach(x => x.setAttribute('aria-checked', x === b));
      calc.people = Math.min(calc.people, calc.mode === 'car' ? 5 : 10);
      render();
    }));
    $('[data-calc-inc]').addEventListener('click', () => { calc.people = Math.min(calc.mode === 'car' ? 5 : 10, calc.people + 1); render(); });
    $('[data-calc-dec]').addEventListener('click', () => { calc.people = Math.max(1, calc.people - 1); render(); });
    render();
  }

  // ---------- Mapa (fachada: Google Maps só sob demanda) ----------
  $$('[data-map-load]').forEach(b => b.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = 'https://www.google.com/maps?q=-27.5709703,-54.6797339&z=16&output=embed';
    f.title = 'Mapa: La Costa Vinoteca em Alba Posse';
    f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    b.closest('[data-map]').replaceChildren(f);
  }));

  // ---------- Verificação de idade ----------
  const age = $('#age');
  if (!store.get('age_ok', false)) age.showModal();
  age.addEventListener('cancel', e => e.preventDefault());
  $('[data-age-yes]').addEventListener('click', () => { store.set('age_ok', true); age.close(); });
  $('[data-age-no]').addEventListener('click', () => { $('[data-age-msg]').hidden = false; });

  // ---------- Header, FAB, reveal ----------
  const header = $('[data-header]'), fab = $('[data-fab]');
  let fabDone = false;
  addEventListener('scroll', () => {
    header.classList.toggle('is-scrolled', scrollY > 8);
    if (!fabDone && scrollY > 400) { fabDone = true; fab.classList.add('is-expanded'); setTimeout(() => fab.classList.remove('is-expanded'), 4000); }
  }, { passive: true });
  addEventListener('resize', () => fab.classList.toggle('is-hidden', totalQty() > 0 && innerWidth < 1024));
  const io = 'IntersectionObserver' in window && new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  function observeReveals(root = document) { $$('.reveal:not(.is-in)', root).forEach((el, i) => { el.style.setProperty('--d', i % 6); io ? io.observe(el) : el.classList.add('is-in'); }); }

  // Sincroniza o carrinho entre abas
  addEventListener('storage', e => { if (e.key === 'lc_cart') { const before = totalQty(); state.cart = store.get('cart', {}); update(before); } });

  // ---------- API para as páginas ----------
  window.LC = {
    RATE, COTA, COTA_DISC, PRODUCTS, byId, BRANDS, brandBySlug, TIPOS, COLECOES, DATA,
    $, $$, esc, norm, icon, brl, ars, url, reduced, store,
    listBrl, stdBrl, cotaBrl, pct, unitNow, isCota, totalQty, state,
    cardHTML, metaLine, addQty, setQty, addMany, toast, openDialog, openWhatsApp, searchProducts, observeReveals, renderMeters,
    onCart: fn => listeners.push(fn),
    init() {
      update();
      updateLive(); setInterval(updateLive, 30000);
      observeReveals();
      header.classList.toggle('is-scrolled', scrollY > 8);
    },
  };
})();
