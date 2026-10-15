/* Página de produto (PDP). */
(() => {
  'use strict';
  const { $, esc, icon, brl, ars, url, PRODUCTS, byId, brandBySlug, TIPOS, COLECOES, COTA, listBrl, stdBrl, cotaBrl, pct, isCota, state, cardHTML, addQty, setQty, totalQty, toast } = LC;
  const main = $('[data-pdp]');
  const id = new URLSearchParams(location.search).get('id');
  const p = byId[id];

  if (!p) {
    main.innerHTML = `<section class="section"><div class="container notfound">
      ${icon('wine', 'ic--xl')}
      <h1 class="page-title">Rótulo não encontrado</h1>
      <p class="page-sub">Este produto pode ter saído do catálogo. Veja rótulos parecidos:</p>
      <div class="hero__ctas"><a class="btn btn--primary btn--lg" href="catalogo.html">Ir para o catálogo</a><a class="btn btn--ghost btn--lg" href="index.html">Voltar ao início</a></div>
    </div></section>`;
    LC.init();
    return;
  }

  document.title = `${p.nome} · La Costa Vinoteca`;
  const brand = brandBySlug[p.bodegaSlug];
  const tipo = TIPOS[p.tipo];
  const ICONS = { 'Variedade': 'grape', 'Variedades': 'grape', 'Composição varietal': 'grape', 'Região': 'pin', 'Origem': 'pin', 'Denominação': 'pin', 'País': 'pin', 'Altitude': 'mountain', 'Amadurecimento': 'clock', 'Temperatura de serviço': 'thermo', 'Teor alcoólico': 'info', 'Volume': 'wine', 'Produtor': 'award', 'Vinícola': 'award' };
  const short = (p.ficha || []).filter(([, v]) => v.length <= 60);
  const long = (p.ficha || []).filter(([, v]) => v.length > 60);
  const facts = [
    ['Tipo', tipo.label, 'wine'],
    p.uva && !short.some(([k]) => /Variedade|Composição/.test(k)) ? ['Uva', p.uva, 'grape'] : null,
    ...short.filter(([k]) => k !== 'Tipo').map(([k, v]) => [k, v, ICONS[k] || 'info']),
  ].filter(Boolean).filter((f, i, a) => a.findIndex(x => x[0] === f[0]) === i);
  const descParas = [...long.map(([k, v]) => `<h3>${esc(k)}</h3><p>${esc(v)}</p>`),
    ...(p.desc || '').split(/\n{2,}/).map(t => t.trim()).filter(Boolean).map(t =>
      t.length < 40 && t === t.toUpperCase() ? `<h3>${esc(t.charAt(0) + t.slice(1).toLowerCase())}</h3>` : `<p>${esc(t)}</p>`)].join('');

  const sameBrand = PRODUCTS.filter(x => x.id !== p.id && x.bodegaSlug === p.bodegaSlug).slice(0, 4);
  const similar = PRODUCTS.filter(x => x.id !== p.id && !sameBrand.includes(x) && x.tipo === p.tipo && (p.uva ? x.uva === p.uva : true))
    .sort((a, b) => Math.abs(a.std - p.std) - Math.abs(b.std - p.std)).slice(0, 4);
  const crumbsCat = url.catalog({ tipo: p.tipo });

  main.innerHTML = `
  <section class="pdp">
    <div class="container">
      <nav class="crumbs" aria-label="Você está em">
        <a href="index.html">Início</a>${icon('chev-r', 'ic--sm')}<a href="catalogo.html">Catálogo</a>${icon('chev-r', 'ic--sm')}<a href="${crumbsCat}">${tipo.plural}</a>${icon('chev-r', 'ic--sm')}<span aria-current="page">${esc(p.nome)}</span>
      </nav>
      <div class="pdp__grid">
        <div class="pdp__media">
          <div class="pdp__stage">
            <div class="card__badges" data-pdp-badges></div>
            <img src="${p.img}" alt="Garrafa de ${esc(p.nome)}" width="300" height="375" fetchpriority="high">
          </div>
          ${p.tags.length ? `<div class="pdp__tags">${p.tags.filter(t => COLECOES[t]).map(t => `<a class="chip" href="${url.catalog({ colecao: t })}">${icon(COLECOES[t].icon, 'ic--sm')}${COLECOES[t].label}</a>`).join('')}</div>` : ''}
        </div>

        <div class="pdp__info">
          <a class="pdp__brand" href="${url.catalog({ vinicola: p.bodegaSlug })}">${esc(p.bodega)} ${icon('arrow', 'ic--sm')}</a>
          <h1 class="pdp__title">${esc(p.nome)}</h1>
          <p class="pdp__meta">${[p.uva, tipo.label, p.tipo === 'whisky' || p.tipo === 'destilado' ? null : '750 ml'].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}</p>

          <div class="pdp__price" data-pdp-price></div>

          <div class="pdp__buy">
            <div class="stepper stepper--lg" role="group" aria-label="Quantidade">
              <button type="button" aria-label="Diminuir quantidade" data-q-dec>${icon('minus', 'ic--sm')}</button>
              <output data-q>1</output>
              <button type="button" aria-label="Aumentar quantidade" data-q-inc>${icon('plus', 'ic--sm')}</button>
            </div>
            <button class="btn btn--primary btn--lg pdp__add" type="button" data-pdp-add>${icon('bag')}<span>Adicionar ao pedido</span></button>
          </div>
          <p class="pdp__incart" data-pdp-incart hidden></p>
          <button class="link-arrow pdp__fill" type="button" data-fill hidden></button>

          <div class="meter-card" data-meter-card>
            <div class="meter-card__head">
              <p class="meter-card__label"><strong data-meter-count>0</strong> de 16 garrafas</p>
              <p class="meter-card__hint" data-meter-hint>Faltam 16 para liberar −20%</p>
            </div>
            <div class="meter meter--sm" role="progressbar" aria-label="Progresso da cota" aria-valuemin="0" aria-valuemax="16" aria-valuenow="0" data-meter></div>
          </div>

          <ul class="pdp__trust">
            <li>${icon('pin')}<span><strong>Retirada em frente à aduana</strong>Alba Posse, todos os dias das 8:00 às 17:30</span></li>
            <li>${icon('wallet')}<span><strong>Pague só depois de confirmar</strong>PIX ou dinheiro, após checarmos o estoque</span></li>
            <li>${icon('shield')}<span><strong>Dentro da sua cota</strong>16 garrafas = 12 L isentos por CPF na Receita</span></li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section class="section section--tint pdp-details">
    <div class="container pdp-details__grid">
      <div>
        <h2 class="h2">Ficha técnica</h2>
        <dl class="facts">${facts.map(([k, v, ic]) => `<div>${icon(ic)}<dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
          <div>${icon('award')}<dt>Vinícola</dt><dd><a href="${url.catalog({ vinicola: p.bodegaSlug })}">${esc(p.bodega)}</a></dd></div>
        </dl>
      </div>
      <div class="prose">
        <h2 class="h2">Sobre este rótulo</h2>
        ${descParas || `<p>${esc(p.nome)} é ${tipo.label === 'Outros' ? 'um produto' : 'um ' + tipo.label.toLowerCase()} da ${esc(p.bodega)}${p.uva ? `, elaborado com ${esc(p.uva)}` : ''}. Peça pelo site e retire na loja em Alba Posse.</p>`}
        <p class="prose__note">${icon('info', 'ic--sm')}Descrição fornecida pela vinícola.</p>
      </div>
    </div>
  </section>

  ${sameBrand.length ? `<section class="section">
    <div class="container">
      <header class="section__head section__head--split">
        <div><p class="eyebrow eyebrow--gold">Mesma vinícola</p><h2 class="h2">Mais de ${esc(p.bodega)}</h2></div>
        <a class="link-arrow" href="${url.catalog({ vinicola: p.bodegaSlug })}">Ver todos de ${esc(p.bodega)} ${icon('arrow')}</a>
      </header>
      <div class="grid">${sameBrand.map(cardHTML).join('')}</div>
    </div>
  </section>` : ''}

  ${similar.length ? `<section class="section${sameBrand.length ? ' section--tint' : ''}">
    <div class="container">
      <header class="section__head section__head--split">
        <div><p class="eyebrow eyebrow--gold">Para completar a cota</p><h2 class="h2">Você também pode gostar</h2></div>
        <a class="link-arrow" href="${p.uva ? url.catalog({ uva: p.uva }) : crumbsCat}">Ver ${p.uva ? esc(p.uva) : tipo.plural.toLowerCase()} ${icon('arrow')}</a>
      </header>
      <div class="grid">${similar.map(cardHTML).join('')}</div>
    </div>
  </section>` : ''}`;

  // ---------- Preço + compra ----------
  let qty = 1;
  function renderPrice() {
    const cota = isCota();
    const now = cota ? cotaBrl(p) : stdBrl(p);
    $('[data-pdp-price]').innerHTML = `
      <div class="pdp__now"><span class="pdp__value${cota ? ' is-cota' : ''}">${brl(now)}</span><span class="price__was">${brl(cota ? stdBrl(p) : listBrl(p))}</span>
        <span class="badge ${cota ? 'badge--green' : 'badge--wine'}">−${pct(now, listBrl(p))}%</span></div>
      <p class="pdp__pix">por garrafa, via PIX ou dinheiro · ${ars(cota ? Math.min(p.std, p.ars * LC.COTA_DISC) : p.std)}</p>
      <div class="cota-box${cota ? ' is-on' : ''}">
        ${icon(cota ? 'check' : 'box')}
        <div>${cota
          ? `<strong>Preço cota ativo: ${brl(cotaBrl(p))}</strong><span>Seu pedido tem 16 garrafas ou mais, então todos os rótulos saem com 20% de desconto.</span>`
          : `<strong>${brl(cotaBrl(p))} na cota de 16 garrafas</strong><span>Completando 16 garrafas (pode misturar rótulos), cada uma sai 20% abaixo do preço de tabela. Economia de ${brl(stdBrl(p) - cotaBrl(p))} por garrafa.</span>`}</div>
      </div>`;
    $('[data-pdp-badges]').innerHTML = p.tags.includes('organico') ? `<span class="badge badge--gold">${icon('leaf')}Orgânico</span>` : '';
    const inCart = state.cart[p.id] || 0;
    const ic = $('[data-pdp-incart]');
    ic.hidden = !inCart;
    ic.innerHTML = `${icon('check', 'ic--sm')}${inCart} no seu pedido · <button type="button" data-cart-open>ver pedido</button>`;
    const missing = COTA - totalQty();
    const fill = $('[data-fill]');
    fill.hidden = missing <= 0 || missing > 15;
    fill.innerHTML = `Completar a cota com este rótulo (+${missing}) ${icon('arrow', 'ic--sm')}`;
  }
  const qOut = $('[data-q]');
  $('[data-q-inc]').addEventListener('click', () => { qty = Math.min(48, qty + 1); qOut.textContent = qty; });
  $('[data-q-dec]').addEventListener('click', () => { qty = Math.max(1, qty - 1); qOut.textContent = qty; });
  $('[data-pdp-add]').addEventListener('click', e => {
    addQty(p.id, qty);
    const btn = e.currentTarget;
    btn.classList.add('is-done'); $('span', btn).textContent = 'Adicionado!';
    setTimeout(() => { btn.classList.remove('is-done'); $('span', btn).textContent = 'Adicionar ao pedido'; }, 1600);
    if (totalQty() < COTA) toast(`${qty}× ${esc(p.nome)} no pedido · ${totalQty()}/16`);
    qty = 1; qOut.textContent = 1;
  });
  $('[data-fill]').addEventListener('click', () => { const m = COTA - totalQty(); if (m > 0) setQty(p.id, (state.cart[p.id] || 0) + m); });
  LC.onCart(renderPrice);
  renderPrice();
  LC.init();
})();
