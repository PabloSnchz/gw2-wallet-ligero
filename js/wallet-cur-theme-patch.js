/*!
 * Wallet CurTheme Patch — SOLO Cartera (detección robusta), SIN glow (solo borde)
 * v2.3.1 (2026-03-01)
 */

(function () {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from((r||document).querySelectorAll(s));

  console.info('[WalletCurThemePatch] v2.3.1 — scope cartera, detección robusta, solo borde');

  // === Paleta (6 divisas con color) ===
  const COLORS = {
    gems:            '#4BBDF0',
    coins:           '#F4C542',
    karma:           '#AF63DF',
    laurels:         '#2BC14E',
    trade_contracts: '#28C3BB',
    elegy_mosaic:    '#E2AE43',
    default:         '#FFFFFF'
  };

  const N = s => String(s||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]/g,'')
    .replace(/\s+/g,' ')
    .trim();

  // --- Resolución por título (ES/EN, sing/plural)
  const EXACT = new Map([
    ['gema','gems'], ['gemas','gems'],
    ['moneda','coins'], ['monedas','coins'],
    ['karma','karma'],
    ['laurel','laurels'], ['laureles','laurels'],
    ['contrato comercial','trade_contracts'], ['contratos comerciales','trade_contracts'],
    ['mosaico de elegia','elegy_mosaic'], ['mosaicos de elegia','elegy_mosaic'],
    ['gem','gems'], ['gems','gems'],
    ['coin','coins'], ['coins','coins'],
    ['laurel','laurels'], ['laurels','laurels'],
    ['trade contract','trade_contracts'], ['trade contracts','trade_contracts'],
    ['elegy mosaic','elegy_mosaic'], ['elegy mosaics','elegy_mosaic']
  ]);
  const STARTS = [
    ['gema','gems'], ['gem','gems'],
    ['moneda','coins'], ['coin','coins'],
    ['karma','karma'],
    ['laurel','laurels'],
    ['contrato comercial','trade_contracts'], ['trade contract','trade_contracts'],
    ['mosaico de elegia','elegy_mosaic'], ['elegy mosaic','elegy_mosaic']
  ];
  const TOKENS = new Map([
    ['gema','gems'], ['gem','gems'],
    ['moneda','coins'], ['coin','coins'], ['oro','coins'], ['gold','coins'], ['plata','coins'], ['silver','coins'], ['cobre','coins'], ['copper','coins'],
    ['karma','karma'],
    ['laurel','laurels'], ['laurels','laurels'],
    ['contrato','trade_contracts'], ['contracts','trade_contracts'],
    ['elegia','elegy_mosaic'], ['elegy','elegy_mosaic']
  ]);

  function keyFromTitle(raw){
    const t = N(raw);
    if (!t) return 'default';
    if (EXACT.has(t)) return EXACT.get(t);
    for (const [p,k] of STARTS) if (t.startsWith(p)) return k;
    for (const w of t.split(' ')) if (TOKENS.has(w)) return TOKENS.get(w);
    return 'default';
  }

  function findTitleEl(card){
    return (
      card.querySelector('.wv-card__top .wv-card__name') ||
      card.querySelector('.wv-card__name') ||
      card.querySelector('h1,h2,h3') ||
      card.querySelector('[class*="title"]') ||
      card.querySelector('[class*="name"]')
    );
  }

  // === Detección robusta del panel Cartera ===
  function detectWalletHost() {
    // 1) id directo
    let p = $('#walletPanel');
    if (p && p.isConnected) return p;

    // 2) secciones típicas con data-view=cards
    p = $('section[data-view="cards"]');
    if (p && p.isConnected) return p;

    // 3) heurísticas por id/clase que contengan wallet
    p = $('section[id*="wallet"], div[id*="wallet"], section[class*="wallet"], div[class*="wallet"]');
    if (p && p.isConnected) return p;

    // 4) fallback: contenedor con heading cercano que diga “Divisas” / “Cartera”
    const h = $$('h1,h2,h3').find(hh => /divisas|cartera|wallet/i.test(hh.textContent||''));
    if (h) {
      // buscamos un contenedor ancestro razonable
      let node = h;
      for (let i=0;i<5 && node; i++) {
        if (node.tagName && /SECTION|DIV|MAIN|ARTICLE/.test(node.tagName)) return node;
        node = node.parentElement;
      }
    }
    return null;
  }

  // === Encontrar tarjetas SOLO dentro del wallet ===
  function findCards(walletHost){
    return Array.from(new Set([
      ...walletHost.querySelectorAll('article'),
      ...walletHost.querySelectorAll('[class*="card"]'),
      ...walletHost.querySelectorAll('[class*="Card"]')
    ])).filter(el => el.offsetParent !== null);
  }

  // === Pintar una tarjeta (solo borde) ===
  function paintCard(card){
    try {
      // Resolver key (respetamos data-cur si existe)
      let key = card.getAttribute('data-cur');
      if (!key) {
        const titleEl = findTitleEl(card);
        key = keyFromTitle(titleEl ? titleEl.textContent : '');
        card.setAttribute('data-cur', key);
      }
      if (!COLORS[key]) key = 'default';
      const hex = COLORS[key];
      const isColor = (key !== 'default');

      // Título
      const title = findTitleEl(card);
      if (title) title.style.setProperty('color', isColor ? hex : '#FFFFFF', 'important');

      // Tarjeta: SOLO BORDE (1px). Sin glow.
      card.style.setProperty('border', '1px solid ' + (isColor ? hex : '#FFFFFF'), 'important');
      card.style.removeProperty('box-shadow');
      card.style.setProperty('border-radius', '10px', 'important');

      // Icono: aro fino (1px), sin glow.
      const iconWrap = card.querySelector('.wv-card__iconWrap') || card.querySelector('[class*="icon"]');
      if (iconWrap) {
        iconWrap.style.setProperty('outline', '1px solid ' + (isColor ? hex : '#FFFFFF'), 'important');
        iconWrap.style.setProperty('outline-offset', '0px', 'important');
        iconWrap.style.removeProperty('box-shadow');
        iconWrap.style.setProperty('border-radius', '6px', 'important');
      }

      // Cantidad / badge fuerte (opcional: en color solo para las 6)
      const amount = card.querySelector('.cur-amt, .wallet-amt, .w-amt, .pill.value, .value, .wv-badge strong');
      if (amount) amount.style.setProperty('color', isColor ? hex : '#FFFFFF', 'important');

    } catch (_){}
  }

  function paintAllIn(walletHost){
    const cards = findCards(walletHost);
    cards.forEach(paintCard);
  }

  // === Ciclo robusto: esperar panel, luego observar SOLO el panel ===
  let walletHost = null, moGlobal = null, moWallet = null, pollT = null;

  function tryBootWallet(){
    walletHost = detectWalletHost();
    if (!walletHost) return false;

    // Pintado inicial
    requestAnimationFrame(()=> paintAllIn(walletHost));

    // Observar SOLO el wallet
    if (moWallet) moWallet.disconnect();
    moWallet = new MutationObserver((muts)=>{
      if (muts.some(m => (m.addedNodes && m.addedNodes.length))) {
        requestAnimationFrame(()=> paintAllIn(walletHost));
      }
    });
    moWallet.observe(walletHost, { childList:true, subtree:true });

    return true;
  }

  function boot(){
    if (tryBootWallet()) return;

    // 1) Polling corto (espera a que aparezca el panel)
    let tries = 0;
    clearInterval(pollT);
    pollT = setInterval(()=>{
      if (tryBootWallet() || ++tries > 40) {
        clearInterval(pollT);
      }
    }, 100); // 4s máximo

    // 2) Observador global (por si el panel se inyecta más tarde)
    if (!moGlobal) {
      moGlobal = new MutationObserver(()=>{
        if (walletHost) return;
        if (tryBootWallet()) {
          moGlobal.disconnect();
          moGlobal = null;
        }
      });
      moGlobal.observe(document.body, { childList:true, subtree:true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Reintentar al cambiar de tab
  window.addEventListener('hashchange', boot);
  document.addEventListener('gn:tabchange', (ev)=>{
    if (ev?.detail?.view === 'cards') boot();
  });

  // === Diagnóstico ===
  window.__WalletCurDiag = function(){
    const res = {
      walletFound: !!walletHost,
      walletNode: walletHost,
      cards: walletHost ? findCards(walletHost).length : 0,
      sample: []
    };
    if (walletHost) {
      findCards(walletHost).slice(0,8).forEach(c=>{
        const t = (findTitleEl(c)||{}).textContent || '';
        const k = c.getAttribute('data-cur');
        res.sample.push({ title: String(t).trim(), dataCur: k, color: COLORS[k] || COLORS.default });
      });
    }
    console.log('[WalletCurThemePatch diag]', res);
    return res;
  };

})();