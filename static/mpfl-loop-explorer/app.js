/* Parametric MPFL TCS explorer. Generic round defaults. No vendor tables. */
(function () {
  "use strict";

  const SIGMA = 5.670374419e-8;

  const DEFAULTS = {
    heatKw: 200,
    mdot: 5,
    tOutC: 70,
    cp: 4000,
    rhoF: 1000,
    muMpas: 1.0,
    kF: 0.5,
    nTrays: 30,
    aProvided: 180,
    nWings: 2,
    nPanels: 10,
    panelW: 2,
    panelL: 5,
    eps: 0.9,
    tSinkK: 180,
    nSides: 2,
    chWmm: 8,
    chHmm: 4,
    sheetMm: 0.5,
    kAl: 160,
    nCh: 80,
    rhoAl: 2700,
    massCeil: 500,
    flexIdMm: 10,
    flexLm: 0.5,
    flexWallMm: 1,
    psatKpa: 0.3,
    npshKpa: 5,
    ntuCp: 2,
    dtJc: 10,
  };

  const FIELDS = [
    { group: "Load", items: [
      { id: "heatKw", label: "Rejected heat", unit: "kW", min: 20, max: 400, step: 5, homework: true },
      { id: "mdot", label: "Loop mass flow", unit: "kg/s", min: 0.5, max: 20, step: 0.1, homework: true },
      { id: "tOutC", label: "Plate outlet T", unit: "°C", min: 20, max: 90, step: 1, homework: true },
      { id: "nTrays", label: "Tray legs", unit: "", min: 1, max: 60, step: 1, homework: true },
    ]},
    { group: "Glycol-water coolant", items: [
      { id: "cp", label: "Specific heat", unit: "J/kg·K", min: 2000, max: 5000, step: 50, homework: true },
      { id: "rhoF", label: "Density", unit: "kg/m³", min: 800, max: 1200, step: 10, homework: true },
      { id: "muMpas", label: "Viscosity", unit: "mPa·s", min: 0.3, max: 5, step: 0.05, homework: true },
      { id: "kF", label: "Fluid conductivity", unit: "W/m·K", min: 0.2, max: 0.8, step: 0.01, homework: true },
    ]},
    { group: "Radiator", items: [
      { id: "aProvided", label: "Provided area", unit: "m²", min: 40, max: 400, step: 2, homework: true },
      { id: "nWings", label: "Wings", unit: "", min: 1, max: 4, step: 1, homework: true },
      { id: "nPanels", label: "Panels / wing", unit: "", min: 2, max: 20, step: 1, homework: true },
      { id: "panelW", label: "Panel width", unit: "m", min: 0.5, max: 4, step: 0.1, homework: true },
      { id: "panelL", label: "Panel length", unit: "m", min: 1, max: 8, step: 0.1, homework: true },
      { id: "eps", label: "Emissivity", unit: "", min: 0.4, max: 1, step: 0.01, homework: true },
      { id: "tSinkK", label: "Sink temperature", unit: "K", min: 80, max: 280, step: 2, homework: true },
    ]},
    { group: "Roll-bonded skins", items: [
      { id: "chWmm", label: "Channel width", unit: "mm", min: 3, max: 16, step: 0.5, homework: true },
      { id: "chHmm", label: "Channel height", unit: "mm", min: 1.5, max: 8, step: 0.1, homework: true },
      { id: "nCh", label: "Channels / panel", unit: "", min: 4, max: 120, step: 1, homework: true },
      { id: "sheetMm", label: "Sheet thickness", unit: "mm", min: 0.2, max: 1.5, step: 0.05, homework: true },
      { id: "kAl", label: "Skin conductivity k", unit: "W/m·K", min: 80, max: 240, step: 5, homework: true },
      { id: "rhoAl", label: "Skin density", unit: "kg/m³", min: 2400, max: 2900, step: 10, homework: true },
    ]},
    { group: "Flex & mass", items: [
      { id: "massCeil", label: "Mass ceiling", unit: "kg", min: 100, max: 1200, step: 10, homework: true },
      { id: "flexIdMm", label: "Flex inner diameter", unit: "mm", min: 4, max: 25, step: 0.5, homework: true },
      { id: "flexLm", label: "Flex length each", unit: "m", min: 0.1, max: 2, step: 0.05, homework: true },
      { id: "flexWallMm", label: "Flex wall", unit: "mm", min: 0.4, max: 3, step: 0.1, homework: true },
    ]},
    { group: "Charge (user Psat, not a table)", items: [
      { id: "psatKpa", label: "Psat at T_out", unit: "kPa", min: 0.05, max: 50, step: 0.05, homework: true },
      { id: "npshKpa", label: "NPSH margin", unit: "kPa", min: 0, max: 40, step: 0.5, homework: true },
    ]},
    { group: "Plate homework stamps", items: [
      { id: "ntuCp", label: "NTU cold plates", unit: "", min: 0.5, max: 6, step: 0.1, homework: true },
      { id: "dtJc", label: "ΔT junction–coolant", unit: "K", min: 2, max: 30, step: 0.5, homework: true },
    ]},
  ];

  const state = { ...DEFAULTS };
  function el(id) { return document.getElementById(id); }
  function fmt(n, digits) {
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e5 || abs < 1e-3)) return n.toExponential(2);
    return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function compute(p) {
    const Q = p.heatKw * 1000;
    const dTfluid = Q / (p.mdot * p.cp);
    const tInC = p.tOutC - dTfluid;
    const tMeanC = (tInC + p.tOutC) / 2;
    const mdotTray = p.mdot / p.nTrays;
    const aGeom = p.nWings * p.nPanels * p.panelW * p.panelL;
    const nPanelsTot = p.nWings * p.nPanels;
    const W = p.chWmm / 1000;
    const H = p.chHmm / 1000;
    const t = p.sheetMm / 1000;
    const L = p.panelL;
    const Dh = (2 * W * H) / (W + H);
    const aCh = W * H;
    const mdotPanel = p.mdot / nPanelsTot;
    const mdotCh = mdotPanel / p.nCh;
    const v = mdotCh / (p.rhoF * aCh);
    const mu = p.muMpas * 1e-3;
    const Re = (p.rhoF * v * Dh) / mu;
    const Pr = (mu * p.cp) / p.kF;
    const regime = Re < 2300 ? "laminar" : Re < 4000 ? "transitional" : "turbulent";
    const Nu = Re < 2300 ? 4.36 : 0.023 * Math.pow(Re, 0.8) * Math.pow(Math.max(Pr, 0.01), 0.3);
    const h = Nu * p.kF / Dh;
    const peri = 2 * (W + H);
    const aInner = nPanelsTot * p.nCh * peri * L;
    const dTconv = Q / (h * aInner);
    const pitch = p.panelW / p.nCh;
    const halfLand = Math.max(pitch - W, 0) / 2;
    const aSpread = nPanelsTot * p.nCh * L * t;
    const dTcond = aSpread > 0 ? (Q * halfLand) / (p.kAl * aSpread) : Infinity;
    const tSkinC = tMeanC - dTconv - dTcond;
    const tSkinK = tSkinC + 273.15;
    const t4net = Math.pow(tSkinK, 4) - Math.pow(p.tSinkK, 4);
    const flux = p.nSides * p.eps * SIGMA * t4net;
    const aNeeded = flux > 0 ? Q / flux : Infinity;
    const qRad = flux * p.aProvided;
    const areaMargin = p.aProvided - aNeeded;
    const nFlex = p.nWings * p.nPanels;
    const rFlex = p.flexIdMm / 2000;
    const tFlex = p.flexWallMm / 1000;
    const vCh = nPanelsTot * p.nCh * aCh * L;
    const vFlex = nFlex * Math.PI * rFlex * rFlex * p.flexLm;
    const mFluid = p.rhoF * (vCh + vFlex);
    const aSheet = aGeom * 2;
    const mSkins = p.rhoAl * aSheet * t;
    const rOut = rFlex + tFlex;
    const mFlex = 1100 * nFlex * Math.PI * (rOut * rOut - rFlex * rFlex) * p.flexLm;
    const mEst = mSkins + mFluid + mFlex;
    const massSlack = p.massCeil - mEst;
    const chargeKpa = p.psatKpa + p.npshKpa;
    const tChipHomework = p.tOutC + p.dtJc;
    const rejectOk = Number.isFinite(aNeeded) && p.aProvided + 1e-9 >= aNeeded;
    const massOk = mEst <= p.massCeil + 1e-9;
    const skinOk = tSkinK > p.tSinkK;
    return { Q, dTfluid, tInC, tMeanC, mdotTray, aGeom, Dh, v, Re, Pr, Nu, h, aInner, dTconv, dTcond, tSkinC, flux, aNeeded, qRad, areaMargin, nFlex, mFluid, mSkins, mFlex, mEst, massSlack, chargeKpa, tChipHomework, regime, rejectOk, massOk, skinOk };
  }

  function pill(ok, good, bad) { return `<span class="pill ${ok ? "ok" : "bad"}">${ok ? good : bad}</span>`; }
  function bar(frac, ok) {
    const w = Math.max(0, Math.min(100, frac * 100));
    return `<div class="bar ${ok ? "ok" : "bad"}"><i style="width:${w}%"></i></div>`;
  }

  function renderResults(p, r) {
    const areaPct = Number.isFinite(r.aNeeded) ? r.aNeeded / p.aProvided : 1.4;
    const massPct = r.mEst / p.massCeil;
    el("hero").innerHTML = `
      <article class="metric"><h3>Radiator area</h3><div class="value">${fmt(r.aNeeded, 1)} <small>m² needed</small></div><p class="sub">provided ${fmt(p.aProvided, 0)} m² · geometry ${fmt(r.aGeom, 0)} m² · slack ${fmt(r.areaMargin, 1)} m²</p>${bar(areaPct, r.rejectOk)}${pill(r.rejectOk, "area holds", "short on area")}</article>
      <article class="metric"><h3>Fluid ΔT</h3><div class="value">${fmt(r.dTfluid, 2)} <small>K</small></div><p class="sub">T_in ${fmt(r.tInC, 1)} °C → T_out ${fmt(p.tOutC, 0)} °C · mean ${fmt(r.tMeanC, 1)} °C</p>${pill(r.dTfluid > 0 && r.dTfluid < 40, "sensible rise", "check ṁ or Q")}</article>
      <article class="metric"><h3>Skin vs sink</h3><div class="value">${fmt(r.tSkinC, 1)} <small>°C</small></div><p class="sub">sink ${fmt(p.tSinkK, 0)} K · Q_rad ${fmt(r.qRad / 1000, 1)} kW on provided area</p>${bar(Math.max(0, (r.tSkinC + 273.15) / 400), r.skinOk && r.rejectOk)}${pill(r.skinOk, "above sink", "skin ≤ sink")}</article>
      <article class="metric"><h3>Mass vs ceiling</h3><div class="value">${fmt(r.mEst, 0)} <small>kg</small></div><p class="sub">skins ${fmt(r.mSkins, 0)} · fluid ${fmt(r.mFluid, 0)} · flex ${fmt(r.mFlex, 0)} · slack ${fmt(r.massSlack, 0)} kg</p>${bar(massPct, r.massOk)}${pill(r.massOk, "under ceiling", "over ceiling")}</article>`;
    el("split").innerHTML = `
      <div class="row"><span>ṁ per tray (equal split)</span><strong>${fmt(r.mdotTray, 3)} kg/s</strong></div>
      <div class="row"><span>Charge = Psat + margin</span><strong>${fmt(r.chargeKpa, 2)} kPa</strong></div>
      <div class="row"><span>Channel Re / Nu / h</span><strong>${fmt(r.Re, 0)} · ${fmt(r.Nu, 1)} · ${fmt(r.h, 0)} W/m²·K</strong></div>
      <div class="row"><span>Regime</span><strong>${r.regime}</strong></div>
      <div class="row"><span>ΔT_conv / ΔT_cond</span><strong>${fmt(r.dTconv, 2)} K / ${fmt(r.dTcond, 2)} K</strong></div>
      <div class="row"><span>Inner channel area</span><strong>${fmt(r.aInner, 1)} m²</strong></div>
      <div class="row"><span>Flex count (between + root)</span><strong>${r.nFlex}</strong></div>
      <div class="row"><span>Chip stamp T_out + ΔT_jc</span><strong>${fmt(r.tChipHomework, 1)} °C</strong></div>`;
    const rows = [
      ["Rejected heat", `${fmt(p.heatKw, 0)} kW`, "homework", ""],
      ["Loop ṁ", `${fmt(p.mdot, 1)} kg/s`, "homework", ""],
      ["T_out", `${fmt(p.tOutC, 0)} °C`, "homework", ""],
      ["Fluid ΔT = Q / (ṁ cp)", `${fmt(r.dTfluid, 2)} K`, "calculated", ""],
      ["T_in", `${fmt(r.tInC, 1)} °C`, "calculated", ""],
      ["Tray legs", `${fmt(p.nTrays, 0)}`, "homework", "equal flow"],
      ["ṁ per tray", `${fmt(r.mdotTray, 3)} kg/s`, "calculated", "ṁ / legs"],
      ["Provided area", `${fmt(p.aProvided, 0)} m²`, "homework", ""],
      ["Geometry area", `${fmt(r.aGeom, 0)} m²`, "calculated", "wings × panels × W × L"],
      ["ε / sides / sink", `${fmt(p.eps, 2)} / ${p.nSides} / ${fmt(p.tSinkK, 0)} K`, "homework", ""],
      ["T_skin", `${fmt(r.tSkinC, 1)} °C`, "calculated", "T_mean − ΔT_conv − ΔT_cond"],
      ["Area needed", `${fmt(r.aNeeded, 1)} m²`, "calculated", "Q / [n ε σ (T⁴ − T_sink⁴)]"],
      ["Q_rad on provided", `${fmt(r.qRad / 1000, 2)} kW`, "calculated", ""],
      ["k skins", `${fmt(p.kAl, 0)} W/m·K`, "homework", "slider, not a mill number"],
      ["Sheet / channel W×H", `${fmt(p.sheetMm, 2)} mm / ${fmt(p.chWmm, 1)}×${fmt(p.chHmm, 1)} mm`, "homework", ""],
      ["ΔT_conv", `${fmt(r.dTconv, 2)} K`, "calculated", "Q / (h A_i)"],
      ["ΔT_cond", `${fmt(r.dTcond, 2)} K`, "calculated", "half-land spread Q L / (k A_t)"],
      ["Mass ceiling", `${fmt(p.massCeil, 0)} kg`, "homework", "ceiling to undershoot"],
      ["Skins + fluid + flex", `${fmt(r.mEst, 1)} kg`, "calculated", `${fmt(r.mSkins, 1)} + ${fmt(r.mFluid, 1)} + ${fmt(r.mFlex, 1)}`],
      ["Psat (user)", `${fmt(p.psatKpa, 2)} kPa`, "homework", "typed, no brand table"],
      ["NPSH margin", `${fmt(p.npshKpa, 1)} kPa`, "homework", ""],
      ["Bellows charge", `${fmt(r.chargeKpa, 2)} kPa`, "calculated", "Psat + margin"],
      ["NTU cold plates", `${fmt(p.ntuCp, 1)}`, "homework", "not closed"],
      ["ΔT_jc", `${fmt(p.dtJc, 1)} K`, "homework", "not closed"],
      ["cp / ρ coolant", `${fmt(p.cp, 0)} / ${fmt(p.rhoF, 0)}`, "homework", "glycol-water, round"],
    ];
    el("ledger").innerHTML = rows.map(([name, val, kind, note]) => `<tr><td>${name}</td><td class="num">${val}</td><td><span class="tag ${kind}">${kind}</span></td><td class="note">${note}</td></tr>`).join("");
  }

  function bindField(item) {
    const range = el("r-" + item.id);
    const num = el("n-" + item.id);
    const apply = (raw) => {
      const v = Number(raw);
      if (!Number.isFinite(v)) return;
      state[item.id] = v;
      if (range) range.value = String(v);
      if (num) num.value = String(v);
      tick();
    };
    range.addEventListener("input", (e) => apply(e.target.value));
    num.addEventListener("input", (e) => apply(e.target.value));
  }

  function buildControls() {
    const host = el("controls");
    host.innerHTML = FIELDS.map((g) => {
      const body = g.items.map((item) => {
        const v = state[item.id];
        return `<label class="ctrl"><div class="ctrl-top"><span>${item.label}${item.homework ? " <em>homework</em>" : ""}</span><span class="ctrl-val"><input id="n-${item.id}" type="number" min="${item.min}" max="${item.max}" step="${item.step}" value="${v}" /><abbr>${item.unit}</abbr></span></div><input id="r-${item.id}" type="range" min="${item.min}" max="${item.max}" step="${item.step}" value="${v}" /></label>`;
      }).join("");
      return `<section class="group"><h2>${g.group}</h2>${body}</section>`;
    }).join("");
    FIELDS.forEach((g) => g.items.forEach(bindField));
    document.querySelectorAll("[data-sides]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.nSides = Number(btn.dataset.sides);
        document.querySelectorAll("[data-sides]").forEach((b) => b.classList.toggle("on", Number(b.dataset.sides) === state.nSides));
        tick();
      });
    });
  }

  function tick() { renderResults(state, compute(state)); }
  function reset() {
    Object.assign(state, DEFAULTS);
    FIELDS.forEach((g) => g.items.forEach((item) => {
      const v = state[item.id];
      const range = el("r-" + item.id);
      const num = el("n-" + item.id);
      if (range) range.value = String(v);
      if (num) num.value = String(v);
    }));
    state.nSides = DEFAULTS.nSides;
    document.querySelectorAll("[data-sides]").forEach((b) => b.classList.toggle("on", Number(b.dataset.sides) === state.nSides));
    tick();
  }

  window.__tcs = { compute, DEFAULTS };
  document.addEventListener("DOMContentLoaded", () => {
    buildControls();
    el("reset").addEventListener("click", reset);
    tick();
  });
})();
