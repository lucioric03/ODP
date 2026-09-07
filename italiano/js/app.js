/* ==========================================================================
   IL PONTE — application
   ========================================================================== */
'use strict';

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const DAYMS = 86400000;
const KEY = "ilponte.v1";

/* ---------- état ---------- */
const DEFAULT_CFG = {
  minutes: 30, newPerDay: 20, retention: 0.90, maxIvl: 730,
  hardBtn: false, tts: true, typeSentences: true, typeVerbs: false,
  tenses: ["presente","passato","imperfetto","futuro","condizionale","congiuntivo","imperativo"],
  mix: { w:true, v:true, s:true }, prodUnlock: 7
};
let S = { v:1, cfg:{...DEFAULT_CFG}, cards:{}, log:{}, streak:{last:null,count:0}, createdAt:Date.now() };

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){ const p = JSON.parse(raw); S = {...S, ...p, cfg:{...DEFAULT_CFG, ...(p.cfg||{})}}; }
  }catch(e){ console.warn("état illisible", e); }
}
let saveTimer = null;
function save(){ clearTimeout(saveTimer); saveTimer = setTimeout(()=>{
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ toast("Sauvegarde impossible (stockage plein)"); }
}, 250); }

const dkey = ts => { const d = new Date(ts||Date.now()); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const today = () => dkey();
function logToday(){ const k = today(); if(!S.log[k]) S.log[k] = {rev:0, nw:0, ok:0, ms:0}; return S.log[k]; }

/* ---------- construction du catalogue de cartes ---------- */
const TENSE_ORDER = ["presente","passato","imperfetto","futuro","condizionale","congiuntivo","imperativo","gerundio"];
let CATALOG = [];      // toutes les cartes possibles, dans l'ordre d'introduction
let CATBY = {};        // id -> définition

function buildCatalog(){
  CATALOG = []; CATBY = {};
  // mots : reconnaissance puis production
  WORDS.forEach((w,i)=>{
    CATALOG.push({ id:"w"+i+"R", type:"w", idx:i, dir:"R", order:i });
    CATALOG.push({ id:"w"+i+"P", type:"w", idx:i, dir:"P", order:i + 0.5, needs:"w"+i+"R" });
  });
  // verbes : (verbe × temps), entrelacés par niveau de verbe puis par temps
  VERBS.forEach((v,i)=>{
    S.cfg.tenses.forEach(t=>{
      const tr = TENSE_ORDER.indexOf(t);
      CATALOG.push({ id:"v"+i+"|"+t, type:"v", idx:i, tense:t,
                     order:(v[2]-1)*3 + tr + i/1000 });
    });
  });
  // phrases : par niveau puis ordre du fichier
  SENTENCES.forEach((s,i)=>{
    CATALOG.push({ id:"s"+i, type:"s", idx:i, order:(s[3]-1)*200 + i/10 });
  });
  CATALOG.forEach(c => CATBY[c.id] = c);
}

const getCard = id => S.cards[id] || null;
const typeEnabled = t => S.cfg.mix[t];

/* ---------- file d'étude ---------- */
function dueCards(now){
  now = now || Date.now();
  const out = [];
  for(const id in S.cards){
    const c = S.cards[id], def = CATBY[id];
    if(!def || !typeEnabled(def.type)) continue;
    if(c.state !== 0 && c.due <= now) out.push({card:c, def});
  }
  // le plus à risque d'oubli d'abord
  out.sort((a,b)=> SRS.currentR(a.card, now) - SRS.currentR(b.card, now));
  return out;
}

/** Nouvelles cartes candidates, par type, dans l'ordre d'introduction. */
function newCandidates(type){
  return CATALOG.filter(d => d.type === type && !S.cards[d.id] && typeEnabled(d.type))
    .filter(d => {
      if(!d.needs) return true;
      const parent = S.cards[d.needs];      // la production attend que la reconnaissance tienne
      return parent && parent.state === 2 && parent.s >= S.cfg.prodUnlock;
    })
    .sort((a,b)=> a.order - b.order);
}

const NEW_MIX = { w:0.60, v:0.25, s:0.15 };
function newAllowanceToday(){
  const done = logToday().nw;
  return Math.max(0, S.cfg.newPerDay - done);
}
function pickNew(budget){
  const active = Object.keys(NEW_MIX).filter(typeEnabled);
  const total = active.reduce((a,t)=>a+NEW_MIX[t],0) || 1;
  const out = [];
  active.forEach(t=>{
    const quota = Math.round(budget * NEW_MIX[t]/total);
    newCandidates(t).slice(0, quota).forEach(d => out.push({card:SRS.newCard(d.id), def:d, isNew:true}));
  });
  // si un type est épuisé, on recomplète avec les autres
  if(out.length < budget){
    const have = new Set(out.map(o=>o.def.id));
    for(const t of active){
      for(const d of newCandidates(t)){
        if(out.length >= budget) break;
        if(!have.has(d.id)){ out.push({card:SRS.newCard(d.id), def:d, isNew:true}); have.add(d.id); }
      }
    }
  }
  return out;
}

/** Entrelace les types (interleaving) au lieu de les traiter en blocs. */
function interleave(items){
  const buckets = {w:[],v:[],s:[]};
  items.forEach(i => buckets[i.def.type].push(i));
  const out = []; let any = true;
  while(any){
    any = false;
    for(const t of ["w","v","s"]){ if(buckets[t].length){ out.push(buckets[t].shift()); any = true; } }
  }
  return out;
}

let QUEUE = [], SESSION = { done:0, total:0, start:0, ok:0, seen:0 };

function buildQueue(){
  const now = Date.now();
  const due = dueCards(now).map(x => ({...x, isNew:false}));
  const nw  = pickNew(newAllowanceToday());
  // on entrelace les nouvelles au milieu des révisions plutôt que de les empiler
  const mixed = interleave(due);
  const news  = interleave(nw);
  const q = [];
  const step = news.length ? Math.max(1, Math.floor(mixed.length / (news.length + 1))) : 0;
  let ni = 0;
  mixed.forEach((item,i)=>{
    q.push(item);
    if(news.length && (i+1) % step === 0 && ni < news.length) q.push(news[ni++]);
  });
  while(ni < news.length) q.push(news[ni++]);
  QUEUE = q;
  SESSION = { done:0, total:q.length, start:Date.now(), ok:0, seen:0 };
}

/* ---------- rendu d'une carte ---------- */
const ART = (w, pos) => {
  if(pos !== "nm" && pos !== "nf") return "";
  const f = pos === "nf", v = /^[aeiou]/i.test(w);
  if(v) return "l'";
  if(f) return "la ";
  if(/^(s[^aeiou]|z|gn|ps|pn|x|y)/i.test(w)) return "lo ";
  return "il ";
};
const POSLBL = { prep:"préposition", conj:"conjonction", art:"article", adv:"adverbe", adj:"adjectif",
  v:"verbe", pron:"pronom", nm:"nom masculin", nf:"nom féminin", expr:"expression", num:"nombre" };

function cardContent(def){
  if(def.type === "w"){
    const w = WORDS[def.idx], it = ART(w[0], w[2]) + w[0];
    const recog = def.dir === "R";
    return {
      kind: recog ? "Reconnaître" : "Produire",
      meta: (POSLBL[w[2]]||w[2]) + " · rang " + (def.idx+1),
      prompt: recog ? "Que signifie ?" : "Comment dit-on ?",
      q: recog ? it : w[1],
      a: recog ? w[1] : it,
      speak: it,
      exIt: w[3], exFr: w[4],
      note: null, typed:false
    };
  }
  if(def.type === "v"){
    const v = VERBS[def.idx], t = TENSES.find(x=>x.id===def.tense);
    const forms = conjugate(v[0], def.tense);
    const p = Math.floor(Math.random() * (forms ? forms.length : 1));
    return {
      kind: "Conjuguer", meta: v[1] + " · " + t.fr,
      prompt: t.nom,
      q: v[0],
      q2: (t.pers[p] || "—"),
      a: forms ? forms[p] : "—",
      allForms: forms, persons: t.pers, tense: t, verb: v,
      speak: forms ? forms[p] : v[0],
      note: v[3], typed: S.cfg.typeVerbs
    };
  }
  const s = SENTENCES[def.idx];
  return {
    kind: "Produire une phrase", meta: s[2] + " · niveau " + s[3],
    prompt: "Traduis en italien", q: s[0], a: s[1], speak: s[1],
    note: s[4], typed: S.cfg.typeSentences
  };
}

/* ---------- comparaison de la saisie ---------- */
const norm = s => (s||"").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/['’]/g," ' ").replace(/[.,!?;:«»"]/g,"")
  .replace(/\s+/g," ").trim();

function diffHTML(userStr, goodStr){
  const u = norm(userStr).split(" ").filter(Boolean);
  let html = "";
  goodStr.split(/\s+/).forEach(w=>{
    const clean = norm(w);
    const hit = clean === "" || u.includes(clean);
    html += `<span class="${hit?"ok":"ko"}">${escapeHTML(w)}</span> `;
  });
  return html;
}
const pl = (n, sing, plur) => n + " " + (Math.abs(n) < 2 ? sing : (plur || sing + "s"));
const escapeHTML = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const isCorrect = (a,b) => norm(a) === norm(b);

/* ---------- synthèse vocale ---------- */
let itVoice = null;
function pickVoice(){
  if(!("speechSynthesis" in window)) return;
  const vs = speechSynthesis.getVoices();
  itVoice = vs.find(v=>/^it/i.test(v.lang) && /google|premium|enhanced|siri/i.test(v.name))
         || vs.find(v=>/^it/i.test(v.lang)) || null;
}
if("speechSynthesis" in window){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text, rate){
  if(!S.cfg.tts || !("speechSynthesis" in window) || !text) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/\s*\|\s*/g, ", "));
    u.lang = "it-IT"; u.rate = rate || 0.94; if(itVoice) u.voice = itVoice;
    speechSynthesis.speak(u);
  }catch(e){}
}

/* ---------- boucle d'étude ---------- */
let CUR = null, REVEALED = false, CUR_CONTENT = null, cardShownAt = 0;

function startSession(){
  buildQueue();
  go("study");
  nextCard();
}

function nextCard(){
  REVEALED = false;
  const now = Date.now();
  // remettre en jeu les cartes d'apprentissage arrivées à échéance
  if(!QUEUE.length){ return renderDone(); }
  CUR = QUEUE.shift();
  CUR_CONTENT = cardContent(CUR.def);
  cardShownAt = now;
  renderStudy();
}

function answer(g){
  if(!CUR) return;
  const spent = Date.now() - cardShownAt;
  const wasNew = CUR.card.state === 0;
  const updated = SRS.review(CUR.card, g, S.cfg.retention, Date.now(), S.cfg.maxIvl);
  S.cards[updated.id] = updated;

  const L = logToday();
  L.rev++; L.ms += Math.min(spent, 120000);
  if(wasNew) L.nw++;
  if(g >= 2) L.ok++;
  SESSION.seen++; if(g >= 2) SESSION.ok++;
  SESSION.done++;
  bumpStreak();
  save();

  // réponse « je ne connais pas » → on la remontre dans la même session
  if(g === 1){
    const pos = Math.min(QUEUE.length, 4 + Math.floor(Math.random()*3));
    QUEUE.splice(pos, 0, { card:S.cards[updated.id], def:CUR.def, isNew:false, again:true });
    SESSION.total++;
  }
  nextCard();
}

function bumpStreak(){
  const t = today();
  if(S.streak.last === t) return;
  const y = dkey(Date.now() - DAYMS);
  S.streak.count = (S.streak.last === y) ? S.streak.count + 1 : 1;
  S.streak.last = t;
}

/* ---------- vues ---------- */
function go(v){
  $$(".view").forEach(x=>x.classList.toggle("on", x.id === "v-"+v));
  $$(".nav button").forEach(b=>b.classList.toggle("on", b.dataset.go === v));
  window.scrollTo(0,0);
  if(v === "home") renderHome();
  if(v === "stats") renderStats();
  if(v === "plan") renderPlan();
  if(v === "settings") renderSettings();
  if(v === "browse") renderBrowse();
}

function renderStudy(){
  const c = CUR_CONTENT, def = CUR.def, card = CUR.card;
  const isNew = card.state === 0;
  const relearn = card.state === 3 || CUR.again;
  const pct = SESSION.total ? Math.round(SESSION.done / SESSION.total * 100) : 100;
  const typed = c.typed && !isNew;

  $("#study").innerHTML = `
    <div class="progbar"><i style="width:${pct}%"></i></div>
    <div class="qmeta">
      <span>${escapeHTML(c.kind)} · ${escapeHTML(c.meta)}</span>
      <span>${SESSION.done}/${SESSION.total}
        <span class="chip ${relearn?"relearn":isNew?"new":"due"}">${relearn?"à revoir":isNew?"nouveau":"révision"}</span></span>
    </div>
    <div class="qcard">
      <button class="speak" id="btn-speak" title="Écouter">🔊</button>
      <div class="qprompt">${escapeHTML(c.prompt)}</div>
      <div class="qterm ${c.q.length>26?"small":""}">${escapeHTML(c.q)}</div>
      ${c.q2 ? `<div class="qsub">forme demandée : <b style="color:var(--ciano)">${escapeHTML(c.q2)}</b></div>` : ""}
      ${typed ? `<input class="typed" id="typed" placeholder="écris en italien…" autocomplete="off"
                  autocorrect="off" autocapitalize="off" spellcheck="false">` : ""}
      <div id="rev"></div>
    </div>
    <div id="controls"></div>`;

  $("#btn-speak").onclick = () => speak(def.type === "w" && def.dir === "P" ? c.a : c.speak);
  if(def.type === "w" && def.dir === "R" && S.cfg.tts) speak(c.speak);

  if(typed){
    const inp = $("#typed");
    setTimeout(()=>inp.focus(), 60);
    inp.onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); reveal(inp.value); } };
  }
  renderControls();
}

function renderControls(){
  const typed = CUR_CONTENT.typed && CUR.card.state !== 0;
  $("#controls").innerHTML = REVEALED ? gradeHTML()
    : `<button class="btn primary" id="btn-reveal" style="margin-top:14px">
         ${typed ? "Vérifier" : "Afficher la réponse"} <span style="opacity:.6;font-weight:600">espace</span></button>`;
  if(!REVEALED) $("#btn-reveal").onclick = () => reveal(typed ? $("#typed").value : null);
  else bindGrades();
}

function reveal(userInput){
  if(REVEALED) return;
  REVEALED = true;
  const c = CUR_CONTENT, def = CUR.def;
  let html = `<div class="answer">`;

  if(userInput !== null && userInput !== undefined){
    const ok = isCorrect(userInput, c.a);
    html += `<div class="diff" style="font-size:17px;margin-bottom:10px">${diffHTML(userInput, c.a)}</div>
             <div class="verdict ${ok?"ok":"ko"}">${ok?"✓ exact":"✗ ta réponse : "+escapeHTML(userInput||"(vide)")}</div>
             <div class="hr"></div>`;
    const inp = $("#typed"); if(inp) inp.disabled = true;
  }

  html += `<div class="aterm ${c.a.length>24?"small":""}">${escapeHTML(c.a)}</div>`;

  if(def.type === "v" && c.allForms){
    html += `<div class="scroll" style="margin-top:14px"><table>` +
      c.persons.map((p,i)=>`<tr><td style="color:var(--dim2);width:34%">${escapeHTML(p)}</td>
        <td class="form">${escapeHTML(c.allForms[i]||"—")}</td></tr>`).join("") + `</table></div>`;
    if(c.tense.id === "gerundio") html += `<div class="ex"><b>Progressif</b>sto ${escapeHTML(c.allForms[0])} = je suis en train de…</div>`;
  }
  if(c.exIt) html += `<div class="ex"><b>${escapeHTML(c.exIt)}</b>${escapeHTML(c.exFr||"")}</div>`;
  if(c.note) html += `<div class="note">💡 ${escapeHTML(c.note)}</div>`;
  html += `</div>`;

  $("#rev").innerHTML = html;
  if(def.type !== "w" || def.dir === "P") speak(c.a);
  renderControls();
}

function gradeHTML(){
  const p = SRS.preview(CUR.card, S.cfg.retention, Date.now(), S.cfg.maxIvl);
  const fmt = d => d === 0 ? "dans 10 min" : d === 1 ? "demain" : d < 30 ? d + " j" :
                   d < 365 ? Math.round(d/30) + " mois" : (d/365).toFixed(1).replace(".0","") + " ans";
  const cols = S.cfg.hardBtn ? 4 : 3;
  const hard = S.cfg.hardBtn ? `<button class="grade g2" data-g="2"><b>Difficile</b><span>${fmt(p[2])}</span></button>` : "";
  return `<div class="grades" style="grid-template-columns:repeat(${cols},1fr)">
    <button class="grade g1" data-g="1"><b>Je ne connais pas</b><span>${fmt(p[1])}</span></button>
    ${hard}
    <button class="grade g3" data-g="3"><b>Je sais — à revoir</b><span>${fmt(p[3])}</span></button>
    <button class="grade g4" data-g="4"><b>Appris</b><span>${fmt(p[4])}</span></button>
  </div>
  <div class="sub" style="text-align:center;margin-top:9px;font-size:11.5px">
    Raccourcis : 1 / ${S.cfg.hardBtn?"2 / ":""}3 / 4 · espace = afficher</div>`;
}
function bindGrades(){ $$("#controls .grade").forEach(b => b.onclick = () => answer(+b.dataset.g)); }

function renderDone(){
  const mins = (Date.now() - SESSION.start)/60000;
  const acc = SESSION.seen ? Math.round(SESSION.ok/SESSION.seen*100) : 0;
  const rest = countDue();
  $("#study").innerHTML = `
    <div class="empty">
      <div class="big">🇮🇹</div>
      <h2 style="font-size:20px;margin-bottom:8px">Sessione finita!</h2>
      <p class="sub">${SESSION.done} cartes en ${mins.toFixed(0)} min · ${acc}% de rappel</p>
      <div class="grid g3" style="margin:18px 0">
        <div class="stat v"><b>${SESSION.done}</b><span>cartes</span></div>
        <div class="stat c"><b>${acc}%</b><span>rappel</span></div>
        <div class="stat o"><b>${rest}</b><span>restantes</span></div>
      </div>
      <div class="row" style="justify-content:center">
        ${rest ? `<button class="btn sm primary" id="again">Continuer (${rest})</button>` : ""}
        <button class="btn sm" onclick="go('home')">Retour</button>
      </div>
      <p class="sub" style="margin-top:18px;font-size:12.5px">
        ${rest ? "Il reste des cartes dues aujourd'hui." :
        "Rien d'autre à réviser aujourd'hui. Une deuxième session ce soir consoliderait la trace : le sommeil qui suit fixe ce qui vient d'être encodé (Rasch &amp; Born, 2013)."}
      </p>
    </div>`;
  if(rest) $("#again").onclick = startSession;
  save();
}

/* ---------- tableau de bord ---------- */
function countDue(now){
  now = now || Date.now();
  let n = 0;
  for(const id in S.cards){
    const d = CATBY[id]; if(!d || !typeEnabled(d.type)) continue;
    if(S.cards[id].state !== 0 && S.cards[id].due <= now) n++;
  }
  return n;
}
function counts(){
  let neuf=0, jeune=0, mure=0, appr=0;
  for(const id in S.cards){
    const d = CATBY[id]; if(!d) continue;
    const c = S.cards[id];
    if(c.state === 1 || c.state === 3) appr++;
    else if(c.ivl >= 21) mure++;
    else if(c.state === 2) jeune++;
    else neuf++;
  }
  const totalPossible = CATALOG.filter(d=>typeEnabled(d.type)).length;
  return { jeune, mure, appr, vus:Object.keys(S.cards).length, totalPossible };
}
function wordsKnown(){
  // un mot est « acquis » quand sa carte de reconnaissance tient ≥ 21 jours
  let n = 0;
  WORDS.forEach((w,i)=>{ const c = S.cards["w"+i+"R"]; if(c && c.ivl >= 21) n++; });
  return n;
}
function wordsSeen(){ let n=0; WORDS.forEach((w,i)=>{ if(S.cards["w"+i+"R"]) n++; }); return n; }

function renderHome(){
  const due = countDue(), nw = Math.min(newAllowanceToday(), newCandidates("w").length + newCandidates("v").length + newCandidates("s").length);
  const k = counts(), known = wordsKnown(), seen = wordsSeen();
  const cal = calibration();
  const load = SRS.dailyLoad(S.cfg.newPerDay, S.cfg.retention, cal);
  const estMin = Math.round((due * 8 + nw * 30)/60);
  const L = logToday();
  const acc = L.rev ? Math.round(L.ok/L.rev*100) : null;

  // couverture lexicale estimée (Nation & Waring 1997)
  const cov = coverage(known);

  $("#home").innerHTML = `
    <div class="panel" style="background:linear-gradient(150deg,rgba(18,209,142,.16),rgba(76,201,255,.07));border-color:rgba(18,209,142,.3)">
      <h2>Ta séance d'aujourd'hui <span class="tag">${new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</span></h2>
      <div class="grid g3" style="margin-bottom:14px">
        <div class="stat o"><b>${due}</b><span>à réviser</span></div>
        <div class="stat c"><b>${nw}</b><span>nouvelles</span></div>
        <div class="stat v"><b>≈${estMin}</b><span>minutes</span></div>
      </div>
      <p class="sub" style="font-size:11.5px;margin:-4px 0 12px">
        Estimation pour cette séance-ci (8 s par révision, 30 s par carte neuve).
        En régime établi, ce rythme se stabilise autour de ${load.minutes.toFixed(0)} min/jour${cal.calibrated?" (calibré sur tes "+cal.samples+" derniers jours actifs)":""}.</p>
      <button class="btn primary" id="btn-start">${due+nw ? "Commencer la séance" : "Séance terminée ✓"}</button>
      ${due+nw===0 ? `<p class="sub" style="margin-top:10px;text-align:center">
        Tout est à jour. Tu peux ajouter des mots d'avance dans <a href="#" onclick="go('settings');return false">Réglages</a>,
        mais dépasser ta dose gonfle la charge des jours suivants.</p>` : ""}
    </div>

    <div class="grid g2">
      <div class="panel" style="margin:0">
        <h2>Vocabulaire <span class="tag">800 mots</span></h2>
        <div style="font-size:30px;font-weight:900;letter-spacing:-.03em">${known}<span style="font-size:16px;color:var(--dim2)"> / 800</span></div>
        <div class="progbar" style="margin:10px 0 8px"><i style="width:${known/8}%"></i></div>
        <p class="sub" style="font-size:12px">${pl(seen,"rencontré")} · ${pl(known,"solide")} (≥ 21 jours)</p>
        <p class="sub" style="font-size:12px;margin-top:8px;color:var(--verde)">
          ≈ ${cov.written}% d'un texte écrit · ≈ ${cov.spoken}% d'une conversation</p>
      </div>
      <div class="panel" style="margin:0">
        <h2>Régime <span class="tag">FSRS</span></h2>
        <p class="sub" style="font-size:12.5px">
          <b style="color:var(--txt)">${S.cfg.newPerDay} mots neufs/jour</b><br>
          ≈ ${load.reviewsPerDay} révisions/jour en régime établi<br>
          ≈ ${load.minutes.toFixed(0)} min/jour · rétention visée ${Math.round(S.cfg.retention*100)}%
        </p>
        <div class="hr" style="margin:10px 0"></div>
        <p class="sub" style="font-size:12px">800 mots couverts en <b style="color:var(--txt)">${Math.ceil(800/Math.max(1,S.cfg.newPerDay*NEW_MIX.w))} jours</b> à ce rythme.</p>
      </div>
    </div>

    <div class="panel">
      <h2>Les trois sections</h2>
      <div class="grid" style="gap:8px">
        ${sectionRow("w","📚","Les 800 mots","Les lemmes les plus fréquents, en reconnaissance puis en production.", WORDS.length*2)}
        ${sectionRow("v","🔀","Verbes &amp; temps","108 verbes × 7 temps, conjugués à la volée.", VERBS.length*S.cfg.tenses.length)}
        ${sectionRow("s","✍️","Atelier de phrases","168 phrases à produire, classées par structure.", SENTENCES.length)}
      </div>
      <p class="sub" style="margin-top:12px;font-size:12px">
        Les trois sections sont <b>mélangées</b> dans une même séance : l'alternance des types
        (interleaving) donne une meilleure rétention à long terme que le travail en blocs
        (Rohrer &amp; Taylor, 2007).</p>
    </div>

    ${acc !== null ? `<div class="panel"><h2>Aujourd'hui</h2>
      <div class="grid g4">
        <div class="stat"><b>${L.rev}</b><span>cartes</span></div>
        <div class="stat c"><b>${L.nw}</b><span>nouvelles</span></div>
        <div class="stat v"><b>${acc}%</b><span>rappel</span></div>
        <div class="stat o"><b>${Math.round(L.ms/60000)}</b><span>minutes</span></div>
      </div></div>` : ""}`;

  $("#btn-start").onclick = startSession;
  $$("#home [data-sec]").forEach(el => el.onclick = () => { studyOnly(el.dataset.sec); });
}

function sectionRow(t, ico, title, desc, total){
  const seen = Object.keys(S.cards).filter(id => CATBY[id] && CATBY[id].type === t).length;
  const on = typeEnabled(t);
  return `<div class="li" data-sec="${t}" style="cursor:pointer;opacity:${on?1:.45}">
    <div style="display:flex;gap:11px;align-items:center">
      <div style="font-size:22px">${ico}</div>
      <div><b>${title}</b><div class="sub" style="font-size:11.5px">${desc}</div></div>
    </div>
    <div class="m">${seen}/${total}</div>
  </div>`;
}

/** Séance limitée à une seule section. */
function studyOnly(t){
  const backup = {...S.cfg.mix};
  S.cfg.mix = { w:t==="w", v:t==="v", s:t==="s" };
  buildQueue();
  S.cfg.mix = backup;
  if(!QUEUE.length){ toast("Rien à faire dans cette section aujourd'hui"); return; }
  go("study"); nextCard();
}

/* ==========================================================================
   CALIBRATION — l'app mesure ce que TU fais vraiment et corrige ses prévisions.
   Les constantes par défaut (30 s / carte neuve, 8 s / révision, 7,5 révisions
   par carte et par an) sont des moyennes de population. Au bout de deux
   semaines d'usage, tes propres chiffres sont bien meilleurs.
   ========================================================================== */
function calibration(){
  const keys = Object.keys(S.log).sort().slice(-28);
  let rev = 0, nw = 0, ms = 0, days = 0;
  keys.forEach(k => { const L = S.log[k]; if(!L.rev) return; rev += L.rev; nw += L.nw; ms += L.ms; days++; });
  if(days < 7 || rev < 200) return { samples: days, calibrated: false };

  const secsPerCard = (ms/1000) / rev;
  // une carte neuve coûte ~3× une révision (présentation + reprises intra-séance)
  const secsRev = secsPerCard / (1 + 2*(nw/rev));
  const secsNew = secsRev * 3;
  // ratio observé, ramené à l'échelle annuelle du modèle
  const ratio = nw > 0 ? Math.min(14, Math.max(2, rev/nw)) : null;
  return { samples: days, calibrated: true,
           secsNew: Math.min(60, Math.max(8, secsNew)),
           secsRev: Math.min(25, Math.max(2, secsRev)),
           ratio, avgRev: rev/days, avgNew: nw/days };
}

/* Couverture lexicale : interpolation sur les données de Nation & Waring (1997),
   Nation (2006) et Adolphs & Schmitt (2003) — l'oral est plus répétitif que l'écrit. */
function coverage(n){
  const pts = [[0,0],[100,44],[200,52],[400,60],[800,68],[1000,72],[2000,80],[3000,84],[5000,89]];
  const oral = [[0,0],[100,52],[200,61],[400,70],[800,78],[1000,81],[2000,88],[3000,92],[5000,95]];
  const interp = (tbl) => {
    for(let i=1;i<tbl.length;i++) if(n <= tbl[i][0]){
      const [x0,y0]=tbl[i-1],[x1,y1]=tbl[i];
      return Math.round(y0 + (y1-y0)*(n-x0)/(x1-x0));
    }
    return tbl[tbl.length-1][1];
  };
  return { written: interp(pts), spoken: interp(oral) };
}

/* ==========================================================================
   PROTOCOLE — le calculateur + ce sur quoi il s'appuie
   ========================================================================== */
function renderPlan(){
  const cfg = S.cfg;
  const cal = calibration();
  const load = SRS.dailyLoad(cfg.newPerDay, cfg.retention, cal);
  const wPerDay = Math.max(1, Math.round(cfg.newPerDay * NEW_MIX.w));
  const jours800 = Math.ceil(800 / wPerDay);
  const cov = coverage(800);

  $("#plan").innerHTML = `
  <div class="panel">
    <h2>Ton dosage <span class="tag">calculé</span></h2>
    <p class="sub" style="margin-bottom:14px">Règle le seul curseur qui compte : le temps que tu peux vraiment y consacrer <b>tous les jours</b>. Le reste en découle.</p>

    <div class="field" style="display:block;border:0;padding-bottom:4px">
      <label>Temps disponible par jour : <b style="color:var(--verde)" id="minlbl">${cfg.minutes} min</b></label>
      <input type="range" id="rng-min" min="5" max="120" step="5" value="${cfg.minutes}" style="margin-top:10px">
    </div>
    <div class="field" style="display:block;border:0">
      <label>Rétention visée : <b style="color:var(--verde)" id="retlbl">${Math.round(cfg.retention*100)}%</b>
        <small>Probabilité de te souvenir d'un mot au moment où l'app te le remontre.</small></label>
      <input type="range" id="rng-ret" min="80" max="97" step="1" value="${Math.round(cfg.retention*100)}" style="margin-top:10px">
    </div>

    <div class="grid g4" style="margin-top:14px">
      <div class="stat v"><b id="o-new">${cfg.newPerDay}</b><span>mots neufs/j</span></div>
      <div class="stat o"><b id="o-rev">${load.reviewsPerDay}</b><span>révisions/j</span></div>
      <div class="stat c"><b id="o-min">${load.minutes.toFixed(0)}</b><span>min/j réelles</span></div>
      <div class="stat"><b id="o-800">${jours800}</b><span>jours → 800 mots</span></div>
    </div>
    <p class="sub" style="margin-top:12px;font-size:12.5px" id="o-txt"></p>
    <div class="note" style="margin-top:12px">
      ${cal.calibrated
        ? `📐 <b>Chiffres calibrés sur toi.</b> Sur tes ${cal.samples} derniers jours actifs, tu passes
           ${cal.secsRev.toFixed(1)} s par révision et tu génères ${cal.ratio.toFixed(1)} révisions par carte neuve.
           Les prévisions ci-dessus utilisent ces valeurs, pas des moyennes.`
        : `📐 <b>Estimations par défaut, volontairement pessimistes.</b> Elles supposent 8 s par révision,
           30 s par carte neuve et 7,5 révisions par carte et par an. Au bout d'une semaine d'usage
           (200 réponses), l'app remplace ces moyennes par tes mesures réelles — le plus souvent à
           la baisse de 20 à 40 %.`}
    </div>
    <button class="btn primary sm" id="apply-plan" style="margin-top:12px;width:100%">Appliquer ce régime</button>
  </div>

  <div class="panel">
    <h2>Ce à quoi tu dois t'attendre</h2>
    <p class="sub" style="font-size:13px;line-height:1.7">
      <b style="color:var(--txt)">La charge n'est pas constante.</b> Elle monte pendant deux à trois mois,
      atteint un pic, puis redescend nettement. C'est mécanique : chaque mot introduit aujourd'hui génère
      un train de révisions qui s'étale et s'espace. Tant que tu ajoutes des mots neufs, le flux entrant
      dépasse le flux sortant ; une fois les 800 mots posés, les intervalles s'allongent et la charge
      s'effondre vers une simple maintenance.</p>
    <div class="hr"></div>
    <p class="sub" style="font-size:13px;line-height:1.7">
      <b style="color:var(--rosso)">Le seul vrai piège : sauter des jours.</b> Les révisions dues
      s'accumulent sans disparaître, et une carte révisée trop tard a été oubliée entre-temps — tu paies
      le prix fort deux fois. Vingt minutes tous les jours battent deux heures le dimanche, et l'écart
      n'est pas marginal : c'est tout l'effet d'espacement.</p>
    <div class="hr"></div>
    <p class="sub" style="font-size:13px;line-height:1.7">
      <b style="color:var(--txt)">Si tu prends du retard,</b> ne baisse pas les bras : mets les mots neufs
      à zéro quelques jours dans les réglages et laisse la file de révisions se vider. La progression
      reprend intacte ensuite.</p>
  </div>

  <div class="panel">
    <h2>Le protocole, étape par étape</h2>
    <ol class="sub" style="padding-left:19px;margin:0;line-height:1.85">
      <li><b style="color:var(--txt)">Deux séances plutôt qu'une.</b> Coupe ta dose en deux : une le matin, une le soir.
        Deux expositions séparées de plusieurs heures battent une seule séance de durée égale — c'est l'effet
        d'espacement, l'un des résultats les plus robustes de la psychologie de l'apprentissage.</li>
      <li><b style="color:var(--txt)">La séance du soir juste avant de dormir.</b> Le sommeil qui suit l'encodage
        consolide activement les traces récentes ; ce qui est appris en fin de journée est mieux retenu.</li>
      <li><b style="color:var(--txt)">Ne dépasse jamais ta dose de mots neufs.</b> Chaque mot neuf d'aujourd'hui
        vaut ~7 révisions étalées sur l'année. 40 mots un dimanche d'enthousiasme = +300 révisions à payer plus tard.</li>
      <li><b style="color:var(--txt)">Réponds honnêtement.</b> Le planificateur n'apprend que si tes réponses
        reflètent la réalité. « Appris » sur un mot flou fait exploser l'intervalle et tu le perdras.</li>
      <li><b style="color:var(--txt)">Récupère avant de regarder.</b> Laisse-toi 3 à 5 secondes d'effort de rappel
        avant d'afficher la réponse. C'est l'effort de récupération lui-même qui construit la mémoire, pas la lecture de la réponse.</li>
      <li><b style="color:var(--txt)">Produis, ne te contente pas de reconnaître.</b> Chaque mot revient en
        production (FR → IT) dès que sa reconnaissance tient ${cfg.prodUnlock} jours. C'est le pas coûteux —
        et c'est celui qui fait passer du « je comprends » au « je parle ».</li>
      <li><b style="color:var(--txt)">Dis-le à voix haute.</b> Articuler engage la boucle phonologique et
        l'ancrage moteur ; le bouton 🔊 te donne le modèle à imiter.</li>
      <li><b style="color:var(--txt)">Ajoute de l'input réel dès la 3ᵉ semaine.</b> Vers 300–400 mots, une série
        italienne sous-titrée en italien devient rentable : l'app fournit le socle, l'exposition fournit la vitesse et le naturel.</li>
    </ol>
  </div>

  <div class="panel">
    <h2>Pourquoi ces chiffres</h2>
    <div class="ref"><b>Combien de fois faut-il voir un mot ?</b>
      5 à 7 rappels <i>réussis et espacés</i> suffisent en pratique quand chaque rappel est un effort de
      récupération. En lecture passive, il en faut plutôt 8 à 20 rencontres pour un résultat comparable —
      c'est tout l'écart entre relire une liste et se tester dessus.
      <i>Webb (2007) ; Nation (1990) ; Roediger &amp; Karpicke (2006)</i></div>
    <div class="ref"><b>Quand faut-il revoir un mot ?</b>
      Juste avant de l'oublier. L'intervalle optimal croît avec chaque succès (rappel gradué) et l'écart idéal
      représente environ 10 à 20 % du délai pendant lequel on veut retenir. FSRS calcule ça carte par carte
      au lieu d'appliquer un multiplicateur fixe.
      <i>Ebbinghaus (1885) ; Landauer &amp; Bjork (1978) ; Pimsleur (1967) ; Cepeda et al. (2006, 2008)</i></div>
    <div class="ref"><b>Pourquoi 800 mots d'abord ?</b>
      La fréquence lexicale suit une loi de Zipf : le rendement des premiers mots est écrasant. Les 800 lemmes
      les plus fréquents couvrent déjà ≈ ${cov.written} % d'un texte écrit et ≈ ${cov.spoken} % d'une conversation
      ordinaire. Les 800 suivants n'en ajoutent qu'une fraction. C'est le meilleur ratio effort/compréhension
      qui existe en langue.
      <i>Nation &amp; Waring (1997) ; Nation (2006) ; Adolphs &amp; Schmitt (2003)</i></div>
    <div class="ref"><b>Pourquoi viser 90 % et pas 99 % ?</b>
      Plus tu vises haut, plus les intervalles raccourcissent et plus le nombre de révisions explose, pour un
      gain de rappel marginal. Une difficulté modérée au moment du rappel est en outre <i>bénéfique</i> à la
      mémorisation (« difficultés désirables »). L'optimum en connaissances retenues par minute investie se
      situe autour de 85–90 %.
      <i>Bjork &amp; Bjork (2011) ; simulations FSRS</i></div>
    <div class="ref"><b>Pourquoi mélanger mots, verbes et phrases ?</b>
      Travailler en blocs homogènes donne l'illusion de la maîtrise pendant la séance mais s'effondre au test
      différé. L'alternance des types force à re-sélectionner la bonne procédure à chaque carte.
      <i>Rohrer &amp; Taylor (2007) ; Kornell &amp; Bjork (2008)</i></div>
    <div class="ref"><b>Pourquoi produire des phrases ?</b>
      Générer soi-même une réponse la grave mieux que la lire (effet de génération), et la production force à
      remarquer les trous de sa propre grammaire — ce que la compréhension seule ne fait jamais.
      <i>Slamecka &amp; Graf (1978) ; Swain (1985) ; DeKeyser (2007) sur l'automatisation</i></div>
    <div class="ref"><b>Combien d'heures au total ?</b>
      Le Foreign Service Institute classe l'italien en catégorie I — la plus rapide pour un francophone —
      avec environ 600 à 750 heures d'étude encadrée pour atteindre un niveau professionnel (C1).
      Ton régime actuel représente ≈ ${load.minutes.toFixed(0)} min/jour, soit ${(load.minutes*365/60).toFixed(0)} h par an
      sur cette application seule : le vocabulaire et la grammaire de base. Le reste se joue en écoute,
      lecture et conversation.
      <i>FSI School of Language Studies</i></div>
  </div>

  <div class="panel">
    <h2>Le plan des 6 mois</h2>
    <div class="ref"><b>Semaines 1-4 · le socle</b>
      Mots 1-300 (les outils grammaticaux) + présent et passato prossimo des 20 verbes noyaux + phrases niveau 1.
      Objectif : construire une phrase simple sans réfléchir. C'est la phase la plus ingrate et la plus rentable.</div>
    <div class="ref"><b>Semaines 5-10 · la mise en mouvement</b>
      Mots 300-600, imparfait / futur / conditionnel, phrases niveau 2, production (FR → IT) qui monte en charge.
      Ajoute 20 min d'écoute quotidienne : podcast lent, puis série sous-titrée en italien.</div>
    <div class="ref"><b>Semaines 11-18 · l'aisance</b>
      Mots 600-800, congiuntivo, phrases niveau 3 et longues. Passe à la conversation réelle une fois par semaine :
      c'est là que le stock devient de la parole. Rien ne remplace la contrainte du temps réel.</div>
    <div class="ref"><b>Au-delà · l'entretien</b>
      L'app ne sert plus qu'à maintenir (10 min/jour de révisions) et à absorber le vocabulaire rencontré
      en vrai. La progression se fait alors par l'usage, pas par les cartes.</div>
  </div>`;

  const upd = () => {
    const m = +$("#rng-min").value, r = +$("#rng-ret").value/100;
    const n = SRS.newPerDayForMinutes(m, r, cal);
    const l = SRS.dailyLoad(n, r, cal);
    const w = Math.max(1, Math.round(n * NEW_MIX.w));
    $("#minlbl").textContent = m + " min"; $("#retlbl").textContent = Math.round(r*100) + "%";
    $("#o-new").textContent = n; $("#o-rev").textContent = l.reviewsPerDay;
    $("#o-min").textContent = l.minutes.toFixed(0); $("#o-800").textContent = Math.ceil(800/w);
    $("#o-txt").innerHTML = `Sur ${m} minutes, tu peux absorber <b style="color:var(--txt)">${n} cartes neuves</b> par jour
      (dont ≈ ${w} mots, ${Math.round(n*NEW_MIX.v)} formes verbales, ${Math.round(n*NEW_MIX.s)} phrases)
      tout en encaissant les <b style="color:var(--txt)">${l.reviewsPerDay} révisions</b> qu'elles génèreront.
      Les 800 mots sont couverts en <b style="color:var(--txt)">${Math.ceil(800/w)} jours</b>, soit
      ${(Math.ceil(800/w)/30).toFixed(1)} mois — après quoi la charge redescend fortement.`;
    $("#apply-plan").dataset.n = n; $("#apply-plan").dataset.m = m; $("#apply-plan").dataset.r = r;
  };
  $("#rng-min").oninput = upd; $("#rng-ret").oninput = upd; upd();
  $("#apply-plan").onclick = e => {
    const b = e.currentTarget;
    S.cfg.newPerDay = +b.dataset.n; S.cfg.minutes = +b.dataset.m; S.cfg.retention = +b.dataset.r;
    save(); toast("Régime appliqué : " + S.cfg.newPerDay + " cartes neuves/jour");
  };
}

/* ---------- statistiques ---------- */
function renderStats(){
  const now = Date.now(), k = counts();
  // prévision de charge sur 21 jours
  const fc = new Array(21).fill(0);
  for(const id in S.cards){
    const d = CATBY[id]; if(!d || !typeEnabled(d.type)) continue;
    const c = S.cards[id]; if(c.state === 0) continue;
    const day = Math.floor((SRS.todayStamp(c.due) - SRS.todayStamp(now)) / DAYMS);
    if(day >= 0 && day < 21) fc[day]++; else if(day < 0) fc[0]++;
  }
  const fmax = Math.max(1, ...fc);

  // activité et rappel des 14 derniers jours
  const days = [], accs = [];
  for(let i=13;i>=0;i--){
    const key = dkey(now - i*DAYMS), L = S.log[key];
    days.push({ key, rev: L?L.rev:0, acc: L&&L.rev ? L.ok/L.rev : null });
  }
  const amax = Math.max(1, ...days.map(d=>d.rev));
  const totRev = Object.values(S.log).reduce((a,l)=>a+l.rev,0);
  const totOk  = Object.values(S.log).reduce((a,l)=>a+l.ok,0);
  const totMin = Object.values(S.log).reduce((a,l)=>a+l.ms,0)/60000;
  const realRet = totRev ? Math.round(totOk/totRev*100) : 0;
  const known = wordsKnown(), cov = coverage(known);

  const perType = t => {
    const ids = Object.keys(S.cards).filter(id=>CATBY[id] && CATBY[id].type===t);
    const mure = ids.filter(id=>S.cards[id].ivl>=21).length;
    return { vus:ids.length, mure, total:CATALOG.filter(d=>d.type===t).length };
  };
  const W = perType("w"), V = perType("v"), P = perType("s");

  $("#stats").innerHTML = `
  <div class="panel">
    <h2>Vue d'ensemble</h2>
    <div class="grid g4">
      <div class="stat v"><b>${known}</b><span>mots solides</span></div>
      <div class="stat c"><b>${k.vus}</b><span>cartes vues</span></div>
      <div class="stat o"><b>${realRet}%</b><span>rappel réel</span></div>
      <div class="stat"><b>${Math.round(totMin)}</b><span>min cumulées</span></div>
    </div>
    <p class="sub" style="margin-top:12px;font-size:12.5px">
      Rappel réel mesuré sur ${totRev} réponses. Ta cible est ${Math.round(S.cfg.retention*100)}%.
      ${totRev>60 ? (realRet < S.cfg.retention*100-7
        ? "<b style='color:var(--rosso)'>Tu es en dessous</b> : soit tu introduis trop de mots neufs à la fois, soit tu cliques « Appris » trop vite."
        : realRet > S.cfg.retention*100+7
        ? "<b style='color:var(--oro)'>Tu es au-dessus</b> : tu révises plus souvent que nécessaire. Baisser la rétention visée te ferait gagner du temps à mémoire égale."
        : "<b style='color:var(--verde)'>Bien calibré.</b> Ton régime est cohérent avec ta cible.") : "Il faut une soixantaine de réponses pour que cette mesure soit fiable."}
    </p>
  </div>

  <div class="panel">
    <h2>Charge des 21 prochains jours</h2>
    <div class="bars">${fc.map(v=>`<div style="height:${v/fmax*100}%" title="${v}"></div>`).join("")}</div>
    <div class="barlabels">${fc.map((v,i)=>`<span>${i%5===0?(i===0?"auj.":"+"+i):""}</span>`).join("")}</div>
    <p class="sub" style="margin-top:10px;font-size:12px">
      Pic à ${pl(fmax,"carte")} ≈ ${Math.round(fmax*8/60)} min. Un pic très haut signale une salve de mots
      introduits le même jour : ils reviennent ensemble. La dose quotidienne constante est ce qui lisse la courbe.</p>
  </div>

  <div class="panel">
    <h2>Activité (14 jours)</h2>
    <div class="bars">${days.map(d=>`<div style="height:${d.rev/amax*100}%;${d.acc!==null&&d.acc<0.8?"background:linear-gradient(180deg,#FF4D6A,#FFC24B)":""}" title="${d.rev} cartes"></div>`).join("")}</div>
    <div class="barlabels">${days.map((d,i)=>`<span>${i%3===0?d.key.slice(8):""}</span>`).join("")}</div>
    <p class="sub" style="margin-top:10px;font-size:12px">Série en cours : <b style="color:var(--verde)">${S.streak.count} jour${S.streak.count>1?"s":""}</b>.
      Les barres rouges marquent les jours où le rappel est tombé sous 80 %.</p>
  </div>

  <div class="panel">
    <h2>Par section</h2>
    <table>
      <tr><th>Section</th><th>Vues</th><th>Solides</th><th>Total</th></tr>
      <tr><td>Mots (recon. + prod.)</td><td>${W.vus}</td><td class="form">${W.mure}</td><td>${W.total}</td></tr>
      <tr><td>Verbes × temps</td><td>${V.vus}</td><td class="form">${V.mure}</td><td>${V.total}</td></tr>
      <tr><td>Phrases</td><td>${P.vus}</td><td class="form">${P.mure}</td><td>${P.total}</td></tr>
    </table>
    <div class="hr"></div>
    <p class="sub" style="font-size:12.5px">Couverture lexicale estimée avec ${pl(known,"mot solide")} :
      <b style="color:var(--verde)">${cov.written}%</b> d'un texte écrit,
      <b style="color:var(--verde)">${cov.spoken}%</b> d'une conversation courante.
      Le seuil de compréhension autonome d'un texte se situe vers 98 % (≈ 8 000 familles de mots) :
      les 800 premiers t'amènent au point où le contexte et les sous-titres prennent le relais.</p>
  </div>

  <div class="panel">
    <h2>Mots les plus coûteux <span class="tag">tes pièges</span></h2>
    <div class="list">${leeches()}</div>
  </div>`;
}

function leeches(){
  const arr = Object.keys(S.cards).map(id=>({id, c:S.cards[id], d:CATBY[id]}))
    .filter(x=>x.d && x.c.lapses >= 2)
    .sort((a,b)=> b.c.lapses - a.c.lapses).slice(0,15);
  if(!arr.length) return `<p class="sub">Aucun mot problématique pour l'instant. Un item oublié 3 fois ou plus
    apparaîtra ici : c'est le signal qu'il faut lui fabriquer un contexte (une phrase, une image mentale)
    plutôt que de le réviser encore.</p>`;
  return arr.map(x=>{
    const c = cardContent(x.d);
    return `<div class="li"><div><b>${escapeHTML(c.q)}</b>
      <div class="sub" style="font-size:11.5px">${escapeHTML(c.a)}</div></div>
      <div class="m" style="color:var(--rosso)">${x.c.lapses} oublis</div></div>`;
  }).join("");
}

/* ---------- explorer les listes ---------- */
let browseTab = "w", browseQ = "";
function renderBrowse(){
  $("#browse").innerHTML = `
    <div class="panel">
      <h2>Explorer</h2>
      <div style="margin-bottom:10px">
        ${["w","v","s"].map(t=>`<button class="pill ${browseTab===t?"on":""}" data-tab="${t}">
          ${t==="w"?"800 mots":t==="v"?"108 verbes":"168 phrases"}</button>`).join("")}
      </div>
      <input class="typed" id="q" style="margin:0 0 12px" placeholder="rechercher…" value="${escapeHTML(browseQ)}">
      <div class="list" id="blist"></div>
    </div>`;
  $$("#browse [data-tab]").forEach(b=>b.onclick=()=>{browseTab=b.dataset.tab;renderBrowse();});
  const inp = $("#q");
  inp.oninput = () => { browseQ = inp.value; fillBrowse(); };
  fillBrowse();
}
function fillBrowse(){
  const q = norm(browseQ);
  let rows = [];
  if(browseTab === "w"){
    rows = WORDS.map((w,i)=>({i,w})).filter(({w})=>!q||norm(w[0]).includes(q)||norm(w[1]).includes(q))
      .slice(0,300).map(({i,w})=>{
        const c = S.cards["w"+i+"R"];
        const st = !c ? "" : c.ivl>=21 ? "solide" : c.state===2 ? c.ivl+" j" : "en cours";
        return `<div class="li"><div><b>${escapeHTML(ART(w[0],w[2])+w[0])}</b>
          <div class="sub" style="font-size:11.5px">${escapeHTML(w[1])} · ${POSLBL[w[2]]||w[2]}</div></div>
          <div class="m" style="${c&&c.ivl>=21?"color:var(--verde)":""}">${st||"#"+(i+1)}</div></div>`;
      });
  } else if(browseTab === "v"){
    rows = VERBS.map((v,i)=>({i,v})).filter(({v})=>!q||norm(v[0]).includes(q)||norm(v[1]).includes(q))
      .map(({i,v})=>`<div class="li" data-v="${i}" style="cursor:pointer"><div><b>${escapeHTML(v[0])}</b>
        <div class="sub" style="font-size:11.5px">${escapeHTML(v[1])}${v[3]?" · "+escapeHTML(v[3]):""}</div></div>
        <div class="m">niv. ${v[2]}</div></div>`);
  } else {
    rows = SENTENCES.map((s,i)=>({i,s})).filter(({s})=>!q||norm(s[0]).includes(q)||norm(s[1]).includes(q))
      .map(({s})=>`<div class="li"><div><b>${escapeHTML(s[1])}</b>
        <div class="sub" style="font-size:11.5px">${escapeHTML(s[0])}</div></div>
        <div class="m">${escapeHTML(s[2])}</div></div>`);
  }
  $("#blist").innerHTML = rows.join("") || `<p class="sub">Aucun résultat.</p>`;
  $$("#blist [data-v]").forEach(el=>el.onclick=()=>showVerb(+el.dataset.v));
}

function showVerb(i){
  const v = VERBS[i];
  const tables = TENSES.map(t=>{
    const f = conjugate(v[0], t.id);
    if(!f) return `<h3 style="font-size:13px;margin:14px 0 4px;color:var(--dim2)">${t.nom}</h3>
      <p class="sub" style="font-size:12px">— (ce verbe n'a pas d'impératif)</p>`;
    return `<h3 style="font-size:13px;margin:16px 0 5px;color:var(--verde)">${t.nom} <span style="color:var(--dim2);font-weight:600">· ${t.fr}</span></h3>
      <table>${t.pers.map((p,j)=>`<tr><td style="color:var(--dim2);width:36%">${p}</td>
        <td class="form">${escapeHTML(f[j]||"—")}</td></tr>`).join("")}</table>`;
  }).join("");
  $("#browse").innerHTML = `<div class="panel">
    <button class="btn sm ghost" onclick="renderBrowse()" style="margin-bottom:12px">← Retour</button>
    <h2 style="font-size:22px">${escapeHTML(v[0])} <span class="tag">${escapeHTML(v[1])}</span></h2>
    <p class="sub">Auxiliaire : <b style="color:var(--txt)">${auxOf(v[0])}</b> · participe passé :
      <b style="color:var(--txt)">${participio(v[0])}</b></p>
    ${v[3]?`<div class="note" style="margin-top:10px">💡 ${escapeHTML(v[3])}</div>`:""}
    <button class="btn sm" style="margin-top:12px" onclick="speak('${escapeHTML(v[0])}')">🔊 Écouter</button>
    ${tables}</div>`;
  window.scrollTo(0,0);
}

/* ---------- réglages ---------- */
function renderSettings(){
  const c = S.cfg;
  const sw = (id, on) => `<div class="switch ${on?"on":""}" data-sw="${id}"></div>`;
  $("#settings").innerHTML = `
  <div class="panel">
    <h2>Régime quotidien</h2>
    <div class="field"><label>Cartes neuves par jour
      <small>Le seul réglage qui détermine vraiment ta charge future.</small></label>
      <input type="number" id="s-new" min="1" max="200" value="${c.newPerDay}"></div>
    <div class="field"><label>Rétention visée
      <small>85–90 % est l'optimum connaissances/minute. Au-delà, tu paies cher un gain marginal.</small></label>
      <select id="s-ret">${[0.80,0.85,0.87,0.90,0.92,0.95,0.97].map(r=>
        `<option value="${r}" ${Math.abs(r-c.retention)<0.001?"selected":""}>${Math.round(r*100)} %</option>`).join("")}</select></div>
    <div class="field"><label>Intervalle maximum
      <small>Plafond au-delà duquel on ne repousse plus, même si la mémoire tient.</small></label>
      <select id="s-max">${[180,365,730,1825].map(d=>
        `<option value="${d}" ${d===c.maxIvl?"selected":""}>${d<365?d+" jours":Math.round(d/365)+" an"+(d>365?"s":"")}</option>`).join("")}</select></div>
    <div class="field"><label>Production débloquée à
      <small>Un mot passe en FR → IT quand sa reconnaissance tient ce nombre de jours.</small></label>
      <input type="number" id="s-unlock" min="1" max="60" value="${c.prodUnlock}"></div>
  </div>

  <div class="panel">
    <h2>Sections actives</h2>
    <div class="field"><label>Les 800 mots</label>${sw("mix.w", c.mix.w)}</div>
    <div class="field"><label>Verbes et temps</label>${sw("mix.v", c.mix.v)}</div>
    <div class="field"><label>Atelier de phrases</label>${sw("mix.s", c.mix.s)}</div>
    <div class="hr"></div>
    <h2>Temps travaillés</h2>
    <div id="tenses">${TENSES.filter(t=>t.id!=="gerundio").map(t=>
      `<button class="pill ${c.tenses.includes(t.id)?"on":""}" data-t="${t.id}">${t.nom}</button>`).join("")}</div>
    <p class="sub" style="font-size:12px;margin-top:8px">Présent et passato prossimo couvrent à eux seuls
      environ 70 % des verbes d'une conversation. Ajoute les autres au fur et à mesure.</p>
  </div>

  <div class="panel">
    <h2>Interface</h2>
    <div class="field"><label>Prononciation automatique<small>Voix italienne du système.</small></label>${sw("tts", c.tts)}</div>
    <div class="field"><label>Écrire les phrases<small>Taper la réponse ancre mieux que se contenter de la penser.</small></label>${sw("typeSentences", c.typeSentences)}</div>
    <div class="field"><label>Écrire les conjugaisons</label>${sw("typeVerbs", c.typeVerbs)}</div>
    <div class="field"><label>Bouton « Difficile »<small>Une 4ᵉ nuance : tu as retrouvé, mais péniblement. Affine le modèle.</small></label>${sw("hardBtn", c.hardBtn)}</div>
  </div>

  <div class="panel">
    <h2>Données</h2>
    <p class="sub" style="font-size:12.5px">Toute ta progression vit dans ce navigateur, sur cet appareil.
      Exporte-la régulièrement — vider les données du site l'effacerait.</p>
    <div class="row" style="margin-top:12px">
      <button class="btn sm" id="exp">Exporter</button>
      <button class="btn sm" id="imp">Importer</button>
      <button class="btn sm" id="rst" style="color:var(--rosso)">Tout effacer</button>
    </div>
    <input type="file" id="file" accept="application/json" hidden>
    <p class="sub" style="margin-top:14px;font-size:11.5px;color:var(--dim2)">
      ${Object.keys(S.cards).length} cartes en mémoire · première session le
      ${new Date(S.createdAt).toLocaleDateString("fr-FR")}</p>
  </div>`;

  const setPath = (path, val) => {
    const p = path.split("."); let o = S.cfg;
    for(let i=0;i<p.length-1;i++) o = o[p[i]];
    o[p[p.length-1]] = val;
  };
  $$("#settings [data-sw]").forEach(el => el.onclick = () => {
    const on = !el.classList.contains("on");
    el.classList.toggle("on", on); setPath(el.dataset.sw, on); save();
    if(el.dataset.sw.startsWith("mix")) buildCatalog();
  });
  $("#s-new").onchange = e => { S.cfg.newPerDay = Math.max(1,+e.target.value||1); save(); };
  $("#s-ret").onchange = e => { S.cfg.retention = +e.target.value; save(); };
  $("#s-max").onchange = e => { S.cfg.maxIvl = +e.target.value; save(); };
  $("#s-unlock").onchange = e => { S.cfg.prodUnlock = Math.max(1,+e.target.value||7); save(); };
  $$("#tenses [data-t]").forEach(b => b.onclick = () => {
    const t = b.dataset.t, i = S.cfg.tenses.indexOf(t);
    if(i >= 0){ if(S.cfg.tenses.length === 1) return toast("Garde au moins un temps"); S.cfg.tenses.splice(i,1); }
    else S.cfg.tenses.push(t);
    b.classList.toggle("on"); buildCatalog(); save();
  });

  $("#exp").onclick = () => {
    const blob = new Blob([JSON.stringify(S)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ilponte-" + today() + ".json"; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
    toast("Sauvegarde téléchargée");
  };
  $("#imp").onclick = () => $("#file").click();
  $("#file").onchange = e => {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => {
      try{
        const p = JSON.parse(r.result);
        if(!p.cards) throw new Error("format");
        S = {...S, ...p, cfg:{...DEFAULT_CFG, ...(p.cfg||{})}};
        buildCatalog(); save(); toast("Progression restaurée"); go("home");
      }catch(err){ toast("Fichier illisible"); }
    };
    r.readAsText(f);
  };
  $("#rst").onclick = () => {
    if(!confirm("Effacer définitivement toute ta progression ?")) return;
    localStorage.removeItem(KEY);
    S = { v:1, cfg:{...DEFAULT_CFG}, cards:{}, log:{}, streak:{last:null,count:0}, createdAt:Date.now() };
    buildCatalog(); save(); go("home"); toast("Remis à zéro");
  };
}

/* ---------- utilitaires ---------- */
let toastTimer;
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove("on"), 2200);
}

document.addEventListener("keydown", e => {
  if($("#v-study").classList.contains("on")){
    if(e.target.tagName === "INPUT" && e.key !== "Escape") return;
    if(e.code === "Space" && !REVEALED){ e.preventDefault(); $("#btn-reveal") && $("#btn-reveal").click(); }
    else if(REVEALED && ["1","2","3","4"].includes(e.key)){
      const g = +e.key;
      if(g === 2 && !S.cfg.hardBtn) return;
      e.preventDefault(); answer(g);
    }
    else if(e.key.toLowerCase() === "r"){ e.preventDefault(); CUR_CONTENT && speak(CUR_CONTENT.speak); }
  }
});

/* ---------- démarrage ---------- */
function init(){
  load();
  buildCatalog();
  $$(".nav button").forEach(b => b.onclick = () => go(b.dataset.go));
  // streak rompue ?
  if(S.streak.last && S.streak.last !== today() && S.streak.last !== dkey(Date.now()-DAYMS)) S.streak.count = 0;
  $("#streak").textContent = "🔥 " + S.streak.count;
  go("home");
  save();
}
window.go = go; window.speak = speak; window.renderBrowse = renderBrowse;
document.addEventListener("DOMContentLoaded", init);
