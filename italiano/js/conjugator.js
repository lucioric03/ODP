/* ==========================================================================
   CONJUGATEUR ITALIEN
   Génère les 7 formes qui couvrent l'immense majorité de l'usage réel :
   presente, passato prossimo, imperfetto, futuro semplice,
   condizionale presente, congiuntivo presente, imperativo (+ gerundio).
   Réguliers calculés, irréguliers stockés dans IRR.
   ========================================================================== */

const PERSONS   = ["io","tu","lui/lei","noi","voi","loro"];
const PERSONS_FR= ["je","tu","il/elle","nous","vous","ils/elles"];

/* --- désinences régulières --- */
const END = {
  are:{ pres:["o","i","a","iamo","ate","ano"],      imperf:["avo","avi","ava","avamo","avate","avano"], cong:["i","i","i","iamo","iate","ino"],   pp:"ato", ger:"ando" },
  ere:{ pres:["o","i","e","iamo","ete","ono"],      imperf:["evo","evi","eva","evamo","evate","evano"], cong:["a","a","a","iamo","iate","ano"],   pp:"uto", ger:"endo" },
  ire:{ pres:["o","i","e","iamo","ite","ono"],      imperf:["ivo","ivi","iva","ivamo","ivate","ivano"], cong:["a","a","a","iamo","iate","ano"],   pp:"ito", ger:"endo" },
  isc:{ pres:["isco","isci","isce","iamo","ite","iscono"], imperf:["ivo","ivi","iva","ivamo","ivate","ivano"], cong:["isca","isca","isca","iamo","iate","iscano"], pp:"ito", ger:"endo" }
};
const FUT_END  = ["ò","ai","à","emo","ete","anno"];
const COND_END = ["ei","esti","ebbe","emmo","este","ebbero"];

/* --- ajustements orthographiques (dureté c/g) --- */
function ortho(stem, ending){
  // cercare -> cerchi / cercherò ; pagare -> paghi / pagherò
  if(/(c|g)$/.test(stem) && /^(i|e)/.test(ending) && /(c|g)$/.test(stem)){
    return stem + "h" + ending;
  }
  return stem + ending;
}
function orthoAre(stem, ending){
  // -ciare / -giare : mangiare -> mangi (pas "mangii"), mangerò
  if(/(ci|gi)$/.test(stem) && /^i/.test(ending)) return stem + ending.slice(1);
  if(/(ci|gi)$/.test(stem) && /^e/.test(ending)) return stem.slice(0,-1) + ending;
  // -care / -gare
  if(/(c|g)$/.test(stem) && /^(i|e)/.test(ending)) return stem + "h" + ending;
  return stem + ending;
}

/* --- irréguliers : formes stockées telles quelles --- */
/* clés : pres[6], imperf[6] (optionnel), futStem, cong[6] (optionnel), impTu, impLei, impVoi, pp, ger, pr (passato remoto non couvert) */
const IRR = {
  essere:{ pres:["sono","sei","è","siamo","siete","sono"], imperf:["ero","eri","era","eravamo","eravate","erano"], futStem:"sar", cong:["sia","sia","sia","siamo","siate","siano"], impTu:"sii", impLei:"sia", impVoi:"siate", pp:"stato" },
  avere:{ pres:["ho","hai","ha","abbiamo","avete","hanno"], futStem:"avr", cong:["abbia","abbia","abbia","abbiamo","abbiate","abbiano"], impTu:"abbi", impLei:"abbia", impVoi:"abbiate", pp:"avuto" },
  andare:{ pres:["vado","vai","va","andiamo","andate","vanno"], futStem:"andr", cong:["vada","vada","vada","andiamo","andiate","vadano"], impTu:"va'", impLei:"vada", pp:"andato" },
  fare:{ pres:["faccio","fai","fa","facciamo","fate","fanno"], imperf:["facevo","facevi","faceva","facevamo","facevate","facevano"], futStem:"far", cong:["faccia","faccia","faccia","facciamo","facciate","facciano"], impTu:"fa'", impLei:"faccia", impVoi:"fate", pp:"fatto", ger:"facendo" },
  dare:{ pres:["do","dai","dà","diamo","date","danno"], futStem:"dar", cong:["dia","dia","dia","diamo","diate","diano"], impTu:"da'", impLei:"dia", pp:"dato" },
  stare:{ pres:["sto","stai","sta","stiamo","state","stanno"], futStem:"star", cong:["stia","stia","stia","stiamo","stiate","stiano"], impTu:"sta'", impLei:"stia", pp:"stato" },
  dire:{ pres:["dico","dici","dice","diciamo","dite","dicono"], imperf:["dicevo","dicevi","diceva","dicevamo","dicevate","dicevano"], futStem:"dir", cong:["dica","dica","dica","diciamo","diciate","dicano"], impTu:"di'", impLei:"dica", impVoi:"dite", pp:"detto", ger:"dicendo" },
  potere:{ pres:["posso","puoi","può","possiamo","potete","possono"], futStem:"potr", cong:["possa","possa","possa","possiamo","possiate","possano"], noImp:true, pp:"potuto" },
  volere:{ pres:["voglio","vuoi","vuole","vogliamo","volete","vogliono"], futStem:"vorr", cong:["voglia","voglia","voglia","vogliamo","vogliate","vogliano"], noImp:true, pp:"voluto" },
  dovere:{ pres:["devo","devi","deve","dobbiamo","dovete","devono"], futStem:"dovr", cong:["debba","debba","debba","dobbiamo","dobbiate","debbano"], noImp:true, pp:"dovuto" },
  sapere:{ pres:["so","sai","sa","sappiamo","sapete","sanno"], futStem:"sapr", cong:["sappia","sappia","sappia","sappiamo","sappiate","sappiano"], impTu:"sappi", impLei:"sappia", impVoi:"sappiate", pp:"saputo" },
  venire:{ pres:["vengo","vieni","viene","veniamo","venite","vengono"], futStem:"verr", cong:["venga","venga","venga","veniamo","veniate","vengano"], impTu:"vieni", impLei:"venga", pp:"venuto" },
  uscire:{ pres:["esco","esci","esce","usciamo","uscite","escono"], futStem:"uscir", cong:["esca","esca","esca","usciamo","usciate","escano"], impTu:"esci", impLei:"esca", pp:"uscito" },
  bere:{ pres:["bevo","bevi","beve","beviamo","bevete","bevono"], imperf:["bevevo","bevevi","beveva","bevevamo","bevevate","bevevano"], futStem:"berr", cong:["beva","beva","beva","beviamo","beviate","bevano"], impTu:"bevi", impLei:"beva", impVoi:"bevete", pp:"bevuto", ger:"bevendo" },
  tenere:{ pres:["tengo","tieni","tiene","teniamo","tenete","tengono"], futStem:"terr", cong:["tenga","tenga","tenga","teniamo","teniate","tengano"], impTu:"tieni", impLei:"tenga", pp:"tenuto" },
  rimanere:{ pres:["rimango","rimani","rimane","rimaniamo","rimanete","rimangono"], futStem:"rimarr", cong:["rimanga","rimanga","rimanga","rimaniamo","rimaniate","rimangano"], impTu:"rimani", impLei:"rimanga", pp:"rimasto" },
  salire:{ pres:["salgo","sali","sale","saliamo","salite","salgono"], futStem:"salir", cong:["salga","salga","salga","saliamo","saliate","salgano"], impTu:"sali", impLei:"salga", pp:"salito" },
  scegliere:{ pres:["scelgo","scegli","sceglie","scegliamo","scegliete","scelgono"], futStem:"sceglier", cong:["scelga","scelga","scelga","scegliamo","scegliate","scelgano"], impTu:"scegli", impLei:"scelga", pp:"scelto" },
  togliere:{ pres:["tolgo","togli","toglie","togliamo","togliete","tolgono"], futStem:"toglier", cong:["tolga","tolga","tolga","togliamo","togliate","tolgano"], impTu:"togli", impLei:"tolga", pp:"tolto" },
  morire:{ pres:["muoio","muori","muore","moriamo","morite","muoiono"], futStem:"morir", cong:["muoia","muoia","muoia","moriamo","moriate","muoiano"], impTu:"muori", impLei:"muoia", pp:"morto" },
  piacere:{ pres:["piaccio","piaci","piace","piacciamo","piacete","piacciono"], futStem:"piacer", cong:["piaccia","piaccia","piaccia","piacciamo","piacciate","piacciano"], noImp:true, pp:"piaciuto" },
  sedersi:{ pres:["mi siedo","ti siedi","si siede","ci sediamo","vi sedete","si siedono"], futStem:"sieder", cong:["mi sieda","ti sieda","si sieda","ci sediamo","vi sediate","si siedano"], impTu:"siediti", impLei:"si sieda", impNoi:"sediamoci", impVoi:"sedetevi", pp:"seduto", refl:true },
  tradurre:{ pres:["traduco","traduci","traduce","traduciamo","traducete","traducono"], imperf:["traducevo","traducevi","traduceva","traducevamo","traducevate","traducevano"], futStem:"tradurr", cong:["traduca","traduca","traduca","traduciamo","traduciate","traducano"], impTu:"traduci", impLei:"traduca", pp:"tradotto", ger:"traducendo" },
  produrre:{ pres:["produco","produci","produce","produciamo","producete","producono"], imperf:["producevo","producevi","produceva","producevamo","producevate","producevano"], futStem:"produrr", cong:["produca","produca","produca","produciamo","produciate","producano"], impTu:"produci", impLei:"produca", pp:"prodotto", ger:"producendo" },
  proporre:{ pres:["propongo","proponi","propone","proponiamo","proponete","propongono"], imperf:["proponevo","proponevi","proponeva","proponevamo","proponevate","proponevano"], futStem:"proporr", cong:["proponga","proponga","proponga","proponiamo","proponiate","propongano"], impTu:"proponi", impLei:"proponga", pp:"proposto", ger:"proponendo" },
  cogliere:{ pres:["colgo","cogli","coglie","cogliamo","cogliete","colgono"], futStem:"coglier", cong:["colga","colga","colga","cogliamo","cogliate","colgano"], impTu:"cogli", impLei:"colga", pp:"colto" },
  apparire:{ pres:["appaio","appari","appare","appariamo","apparite","appaiono"], futStem:"apparir", cong:["appaia","appaia","appaia","appariamo","appariate","appaiano"], impTu:"appari", impLei:"appaia", pp:"apparso" },
  spegnere:{ pres:["spengo","spegni","spegne","spegniamo","spegnete","spengono"], futStem:"spegner", cong:["spenga","spenga","spenga","spegniamo","spegniate","spengano"], impTu:"spegni", impLei:"spenga", pp:"spento" },
  sedere:{ pres:["siedo","siedi","siede","sediamo","sedete","siedono"], futStem:"sieder", cong:["sieda","sieda","sieda","sediamo","sediate","siedano"], impTu:"siedi", impLei:"sieda", pp:"seduto" },
  udire:{ pres:["odo","odi","ode","udiamo","udite","odono"], futStem:"udir", cong:["oda","oda","oda","udiamo","udiate","odano"], impTu:"odi", impLei:"oda", pp:"udito" }
};

/* Participes passés irréguliers pour les verbes autrement réguliers */
const PP_IRR = {
  vedere:"visto", prendere:"preso", mettere:"messo", leggere:"letto", scrivere:"scritto",
  chiudere:"chiuso", aprire:"aperto", offrire:"offerto", rispondere:"risposto", chiedere:"chiesto",
  perdere:"perso", vincere:"vinto", decidere:"deciso", succedere:"successo", correre:"corso",
  scendere:"sceso", nascere:"nato", vivere:"vissuto", rompere:"rotto", muovere:"mosso",
  ridere:"riso", sorridere:"sorriso", piangere:"pianto", conoscere:"conosciuto", crescere:"cresciuto",
  ridurre:"ridotto", accorgersi:"accorto", esistere:"esistito", permettere:"permesso",
  promettere:"promesso", raggiungere:"raggiunto", spendere:"speso", vendere:"venduto",
  correggere:"corretto", esprimere:"espresso", dividere:"diviso", uccidere:"ucciso",
  difendere:"difeso", offendere:"offeso", accendere:"acceso", ottenere:"ottenuto",
  soffrire:"sofferto", coprire:"coperto", scoprire:"scoperto", concludere:"concluso",
  discutere:"discusso", distruggere:"distrutto", stringere:"stretto", giungere:"giunto",
  dipingere:"dipinto", spingere:"spinto", assumere:"assunto", risolvere:"risolto",
  scommettere:"scommesso", trascorrere:"trascorso", convincere:"convinto", nascondere:"nascosto"
};

/* Radicaux de futur/conditionnel syncopés (verbes sinon réguliers) */
const FUT_IRR = {
  vedere:"vedr", vivere:"vivr", cadere:"cadr", parere:"parr", valere:"varr",
  godere:"godr", tacere:"tacer", condurre:"condurr", ridurre:"ridurr",
  dispiacere:"dispiacer", rivedere:"rivedr", prevedere:"prevedr", convivere:"convivr"
};

/* Verbes qui prennent ESSERE au passato prossimo */
const AUX_ESSERE = new Set([
  "essere","stare","andare","venire","arrivare","partire","uscire","entrare","tornare","ritornare",
  "restare","rimanere","nascere","morire","salire","scendere","cadere","diventare","piacere",
  "succedere","costare","bastare","mancare","sembrare","riuscire","esistere","apparire","crescere",
  "dipendere","capitare","durare","scappare","fuggire","giungere"
]);

function isReflexive(inf){ return /(rsi|si)$/.test(inf) && /(arsi|ersi|irsi)$/.test(inf); }
const REFL_PRON = ["mi","ti","si","ci","vi","si"];

/* Analyse : renvoie {stem, group} */
function analyse(inf){
  let base = inf, refl = isReflexive(inf);
  if(refl) base = inf.replace(/rsi$/, "re");           // alzarsi -> alzare
  const g = base.slice(-3);
  const stem = base.slice(0,-3);
  return { base, stem, group:g, refl };
}

/* verbes -ire à infixe -isc- */
const ISC = new Set(["capire","finire","preferire","pulire","spedire","costruire","unire","gestire",
  "colpire","punire","chiarire","stabilire","suggerire","garantire","fornire","ubbidire","tradire",
  "guarire","sparire","reagire","agire","impedire","obbedire","diminuire","contribuire","restituire",
  "distribuire","proibire","definire","esaurire","riunire","ferire","arrossire","dimagrire","preferire"]);

function participio(inf){
  const {base, stem, group} = analyse(inf);
  if(IRR[inf] && IRR[inf].pp) return IRR[inf].pp;
  if(IRR[base] && IRR[base].pp) return IRR[base].pp;
  if(PP_IRR[inf]) return PP_IRR[inf];
  if(PP_IRR[base]) return PP_IRR[base];
  return stem + END[group === "are" ? "are" : group === "ere" ? "ere" : "ire"].pp;
}

function auxOf(inf){
  const {base, refl} = analyse(inf);
  if(refl) return "essere";
  return AUX_ESSERE.has(base) ? "essere" : "avere";
}

/* Accord du participe avec essere : index 0..5 -> o / o / o / i / i / i (masc. par défaut) */
function accord(pp, i, fem){
  if(!/o$/.test(pp)) return pp;
  const plural = i >= 3;
  if(fem) return pp.slice(0,-1) + (plural ? "e" : "a");
  return pp.slice(0,-1) + (plural ? "i" : "o");
}

function futStem(inf, a, irr){
  if(irr && irr.futStem) return irr.futStem;
  if(FUT_IRR[a.base]) return FUT_IRR[a.base];
  if(a.group === "are") return orthoAre(a.stem, "er");
  if(a.group === "ere") return a.stem + "er";
  return a.stem + "ir";
}

/* ---------- moteur principal ---------- */
function conjugate(inf, tense, opts){
  opts = opts || {};
  const a = analyse(inf);
  const key = a.refl ? a.base : inf;                    // clé pour IRR
  const irr = IRR[inf] || IRR[key] || null;
  const gk  = ISC.has(a.base) ? "isc" : (a.group === "are" ? "are" : a.group === "ere" ? "ere" : "ire");
  const E   = END[gk];
  const pron = a.refl ? REFL_PRON : null;

  const join = (i, form) => pron ? pron[i] + " " + form : form;
  const stemJoin = (ending) => a.group === "are" ? orthoAre(a.stem, ending) : a.stem + ending;

  switch(tense){
    case "presente": {
      if(irr && irr.pres) return irr.pres.map((f,i)=> irr.refl ? f : join(i,f));
      return E.pres.map((e,i)=> join(i, stemJoin(e)));
    }
    case "imperfetto": {
      if(irr && irr.imperf) return irr.imperf.map((f,i)=> irr.refl ? f : join(i,f));
      return E.imperf.map((e,i)=> join(i, a.stem + e));
    }
    case "futuro": {
      const fs = futStem(inf, a, irr);
      return FUT_END.map((e,i)=> join(i, fs + e));
    }
    case "condizionale": {
      const fs = futStem(inf, a, irr);
      return COND_END.map((e,i)=> join(i, fs + e));
    }
    case "congiuntivo": {
      if(irr && irr.cong) return irr.cong.map((f,i)=> irr.refl ? f : join(i,f));
      return E.cong.map((e,i)=> join(i, stemJoin(e)));
    }
    case "passato": {
      const aux = auxOf(inf);
      const pp  = participio(inf);
      const auxF = conjugate(aux === "essere" ? "essere" : "avere", "presente");
      return auxF.map((h,i)=>{
        const part = aux === "essere" ? accord(pp, i, opts.fem) : pp;
        if(a.refl) return REFL_PRON[i] + " " + h + " " + accord(pp, i, opts.fem);
        return h + " " + part;
      });
    }
    case "imperativo": {
      // tu, Lei (formel), noi, voi
      if(irr && irr.noImp) return null;
      let tu, lei, noi, voi;
      if(irr){
        tu  = irr.impTu  || (gk === "are" ? stemJoin("a") : stemJoin("i"));
        lei = irr.impLei || (irr.cong ? irr.cong[2] : null);
        noi = irr.impNoi || (irr.pres ? irr.pres[3] : stemJoin("iamo"));
        voi = irr.impVoi || (irr.pres ? irr.pres[4] : null);
      } else {
        tu  = gk === "are" ? stemJoin("a") : gk === "isc" ? a.stem + "isci" : stemJoin("i");
        lei = E.cong[2] ? stemJoin(E.cong[2]) : null;
        noi = stemJoin("iamo");
        voi = gk === "are" ? a.stem + "ate" : gk === "ere" ? a.stem + "ete" : a.stem + "ite";
      }
      if(a.refl && !(irr && irr.refl)){
        const attach = (f, p) => f.replace(/'$/,"") + p;
        return [ attach(tu, "ti"), "si " + lei, noi.replace(/^ci /,"") + "ci", voi + "vi" ];
      }
      return [tu, lei, noi, voi];
    }
    case "gerundio": {
      const g = (irr && irr.ger) ? irr.ger : a.stem + E.ger;
      return [a.refl ? g + "si" : g];
    }
    default: return null;
  }
}

const TENSES = [
  { id:"presente",     nom:"Presente",              fr:"Présent",              ex:"parlo, parli, parla",       usage:"~45 % des verbes d'une conversation. Sert aussi de futur proche.", pers:PERSONS },
  { id:"passato",      nom:"Passato prossimo",      fr:"Passé composé",        ex:"ho parlato",                usage:"~25 %. LE passé de l'oral italien (le passé simple est littéraire/régional).", pers:PERSONS },
  { id:"imperfetto",   nom:"Imperfetto",            fr:"Imparfait",            ex:"parlavo",                   usage:"~12 %. Description, habitude, décor du passé.", pers:PERSONS },
  { id:"futuro",       nom:"Futuro semplice",       fr:"Futur simple",         ex:"parlerò",                   usage:"~5 %. Souvent remplacé par le présent ; sert aussi à exprimer la probabilité.", pers:PERSONS },
  { id:"condizionale", nom:"Condizionale presente", fr:"Conditionnel présent", ex:"parlerei",                  usage:"~5 %. Politesse (vorrei), hypothèse, désir. Indispensable pour être poli.", pers:PERSONS },
  { id:"congiuntivo",  nom:"Congiuntivo presente",  fr:"Subjonctif présent",   ex:"che io parli",              usage:"~4 %. Après penso che, credo che, voglio che, benché… Marqueur clé du bon italien.", pers:PERSONS },
  { id:"imperativo",   nom:"Imperativo",            fr:"Impératif",            ex:"parla! parli! parliamo!",   usage:"~3 %. Ordres, conseils, recettes, indications.", pers:["tu","Lei","noi","voi"] },
  { id:"gerundio",     nom:"Gerundio",              fr:"Gérondif (stare + …)", ex:"sto parlando",              usage:"Action en cours : sto mangiando = je suis en train de manger.", pers:["—"] }
];

if(typeof module !== "undefined") module.exports = { conjugate, participio, auxOf, TENSES, PERSONS, IRR, ISC };
