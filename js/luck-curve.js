  /*!
   * js/luck-curve.js — Curva de Suerte (Luck) account-wide de GW2
   * Proyecto: Bóveda del Gato Negro (GW2 Wallet Ligero)
   * Versión: 1.0.0 (2026-09-29)
   *
   * Fuente de datos: GW2 Wiki — https://wiki.guildwars2.com/wiki/Luck
   *   - Mecánica de "magic find" account-wide (introducida 2013-09-03).
   *   - El endpoint /v2/account/luck existe desde 2019-04-08.
   *   - Esta NO es una moneda de /v2/currencies: no aparece en ese endpoint.
   *
   * CUMULATIVE[i] = luck total consumido necesario para alcanzar el nivel de
   * magic find (i + 1). Ej: CUMULATIVE[0] = 100 (de 0 a 1 pct de MF).
   * CUMULATIVE[299] = 4295450 = tope de 300 pct de magic find base.
   *
   * Módulo autocontenido (IIFE) — expone window.LuckCurve.
   * No toca DOM, no hace fetch, no persiste.
   */

  (function (root) {
    'use strict';

    // Luck acumulado necesario para cada nivel de magic find (1..300).
    var CUMULATIVE = [
    100,200,300,400,500,600,700,800,910,1020,1130,1240,1360,1480,1600,
    1730,1860,2000,2150,2300,2460,2630,2810,3000,3200,3410,3630,3860,4110,4370,
    4640,4930,5240,5560,5900,6260,6640,7040,7460,7900,8370,8860,9380,9920,10490,
    11090,11720,12380,13070,13790,14550,15340,16170,17030,17930,18870,19850,20870,21940,23050,
    24200,25400,26650,27950,29300,30700,32150,33660,35220,36840,38510,40240,42030,43890,45810,
    47790,49840,51960,54150,56410,58740,61140,63620,66170,68800,71510,74300,77170,80130,83170,
    86300,89520,92830,96230,99720,103300,106980,110760,114640,118620,122700,126890,131180,135580,140090,
    144710,149440,154290,159250,164330,169530,174850,180300,185870,191570,197400,203360,209450,215670,222030,
    228530,235160,241940,248860,255920,263130,270490,278000,285660,293480,301460,309590,317880,326340,334960,
    343750,352710,361840,371140,380610,390260,400090,410100,420290,430660,441220,451970,462910,474040,485370,
    496890,508610,520530,532660,544990,557530,570280,583240,596420,609810,623420,637250,651310,665590,680100,
    694840,709810,725010,740450,756130,772050,788210,804620,821270,838170,855330,872740,890410,908340,926530,
    944980,963700,982690,1001950,1021480,1041290,1061380,1081750,1102400,1123340,1144560,1166070,1187880,1209980,1232380,
    1255080,1278080,1301390,1325000,1348920,1373160,1397710,1422580,1447770,1473280,1499120,1525280,1551780,1578610,1605770,
    1633270,1661110,1689290,1717820,1746700,1775930,1805510,1835450,1865450,1895450,1925450,1955450,1985450,2015450,2045450,
    2075450,2105450,2135450,2165450,2195450,2225450,2255450,2285450,2315450,2345450,2375450,2405450,2435450,2465450,2495450,
    2525450,2555450,2585450,2615450,2645450,2675450,2705450,2735450,2765450,2795450,2825450,2855450,2885450,2915450,2945450,
    2975450,3005450,3035450,3065450,3095450,3125450,3155450,3185450,3215450,3245450,3275450,3305450,3335450,3365450,3395450,
    3425450,3455450,3485450,3515450,3545450,3575450,3605450,3635450,3665450,3695450,3725450,3755450,3785450,3815450,3845450,
    3875450,3905450,3935450,3965450,3995450,4025450,4055450,4085450,4115450,4145450,4175450,4205450,4235450,4265450,4295450
    ];

    var MF_CAP = 300;                       // pct de magic find base tope
    var LUCK_CAP = CUMULATIVE[MF_CAP - 1];  // 4295450
    var LUCK_OVERFLOW = 472510;             // luck extra que se sigue acumulando tras el tope

    /**
     * Convierte un valor de luck crudo en el KPI de progreso.
     * @param {number} value luck consumido (0 si la API devuelve [])
     * @returns {{value:number, mf:number, missing:number, nextLuck:number,
     *            capped:boolean, pct:number, maxed:boolean, overflow:number}}
     */
    function fromLuck(value) {
      var v = Number(value);
      if (!isFinite(v) || v < 0) v = 0;
      v = Math.floor(v);

      // Nivel actual = ultimo umbral CUMULATIVE que cabe en v
      var lvl = -1;
      for (var i = 0; i < MF_CAP; i++) {
        if (v >= CUMULATIVE[i]) lvl = i; else break;
      }

      if (lvl >= MF_CAP - 1) {
        return {
          value: v,
          mf: MF_CAP,
          missing: 0,
          nextLuck: 0,
          capped: true,
          pct: 100,
          maxed: true,
          overflow: Math.max(0, v - LUCK_CAP)
        };
      }

      var nextLuck = CUMULATIVE[lvl + 1];
      var base = lvl < 0 ? 0 : CUMULATIVE[lvl];
      return {
        value: v,
        mf: lvl + 1,             // pct de MF base alcanzado
        missing: nextLuck - v,   // luck que falta para el proximo +1 pct
        nextLuck: nextLuck,
        capped: false,
        pct: nextLuck > base ? Math.round((v - base) / (nextLuck - base) * 100) : 100,
        maxed: false,
        overflow: 0
      };
    }

    root.LuckCurve = {
      MF_CAP: MF_CAP,
      LUCK_CAP: LUCK_CAP,
      LUCK_OVERFLOW: LUCK_OVERFLOW,
      CUMULATIVE: CUMULATIVE,
      fromLuck: fromLuck
    };

  })(typeof window !== 'undefined' ? window : this);
