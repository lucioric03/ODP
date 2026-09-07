/* ==========================================================================
   MOTEUR DE RÉPÉTITION ESPACÉE — FSRS 4.5
   (Free Spaced Repetition Scheduler, Ye/Su/Ma 2022 ; modèle DSR à trois
   composantes issu des travaux de Wozniak & Gorzelanczyk 1994.)

   Trois variables par carte :
     S  Stability      — nb de jours au bout desquels la mémoire retombe à 90 %
     D  Difficulty     — 1 à 10, difficulté intrinsèque de l'item POUR TOI
     R  Retrievability — probabilité de te souvenir MAINTENANT

   Courbe d'oubli (Ebbinghaus 1885, forme puissance) :
       R(t,S) = (1 + FACTOR · t/S) ^ DECAY
   Intervalle pour une rétention cible r :
       I(r,S) = S/FACTOR · (r^(1/DECAY) − 1)

   L'intervalle n'est donc PAS un multiplicateur fixe : il est recalculé à
   chaque réponse en fonction de ta performance réelle sur cette carte-là.
   ========================================================================== */

const FSRS_W = [0.4872,1.4003,3.7145,13.8206,5.1618,1.2298,0.8975,0.0310,
                1.6474,0.1367,1.0461,2.1072,0.0793,0.3246,1.5870,0.2272,2.8755];
const DECAY  = -0.5;
const FACTOR = 19 / 81;

const GRADE = { AGAIN:1, HARD:2, GOOD:3, EASY:4 };

const clampD = d => Math.min(Math.max(d, 1), 10);
const clampS = s => Math.min(Math.max(s, 0.01), 36500);

/** Probabilité de rappel après `t` jours avec une stabilité `s`. */
function retrievability(t, s){
  if(s <= 0) return 0;
  return Math.pow(1 + FACTOR * t / s, DECAY);
}

/** Intervalle (jours) pour redescendre exactement à la rétention voulue. */
function intervalFor(stability, desiredRetention){
  const i = (stability / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
  return Math.max(1, Math.round(i));
}

function initDifficulty(g){ return clampD(FSRS_W[4] - (g - 3) * FSRS_W[5]); }
function initStability(g){ return clampS(FSRS_W[g - 1]); }

function nextDifficulty(d, g){
  const delta = d - FSRS_W[6] * (g - 3);          // damping linéaire
  const mean  = FSRS_W[7] * initDifficulty(4) + (1 - FSRS_W[7]) * delta; // retour à la moyenne
  return clampD(mean);
}

function stabilityAfterRecall(d, s, r, g){
  const hard = g === GRADE.HARD ? FSRS_W[15] : 1;
  const easy = g === GRADE.EASY ? FSRS_W[16] : 1;
  return clampS(s * (1 + Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9]) *
    (Math.exp(FSRS_W[10] * (1 - r)) - 1) * hard * easy));
}

function stabilityAfterLapse(d, s, r){
  return clampS(FSRS_W[11] * Math.pow(d, -FSRS_W[12]) *
    (Math.pow(s + 1, FSRS_W[13]) - 1) * Math.exp(FSRS_W[14] * (1 - r)));
}

const DAY = 86400000;
const todayStamp = (ts) => { const d = new Date(ts || Date.now()); d.setHours(0,0,0,0); return d.getTime(); };

/**
 * Carte neuve.
 * state : 0 = nouvelle, 1 = apprentissage, 2 = en révision, 3 = ré-apprentissage
 */
function newCard(id){
  return { id, s:0, d:0, due:0, last:0, reps:0, lapses:0, state:0, ivl:0, seen:0 };
}

/**
 * Applique une réponse à une carte et renvoie la carte mise à jour.
 * @param card  carte
 * @param g     1 = Je ne connais pas · 2 = Difficile · 3 = Je sais (à revoir) · 4 = Appris
 * @param retention  rétention cible (0.80 – 0.97)
 * @param now   timestamp
 */
function review(card, g, retention, now, maxInterval){
  now = now || Date.now();
  maxInterval = maxInterval || 730;
  const c = Object.assign({}, card);
  const elapsedDays = c.last ? Math.max(0, (now - c.last) / DAY) : 0;

  if(c.state === 0){
    // première rencontre
    c.d = initDifficulty(g);
    c.s = initStability(g);
    c.state = g === GRADE.AGAIN ? 1 : 2;
  } else {
    const r = retrievability(elapsedDays, c.s);
    c.lastR = r;
    c.d = nextDifficulty(c.d, g);
    if(g === GRADE.AGAIN){
      c.s = stabilityAfterLapse(c.d, c.s, r);
      c.lapses++;
      c.state = 3;
    } else {
      c.s = stabilityAfterRecall(c.d, c.s, r, g);
      c.state = 2;
    }
  }

  c.reps++;
  c.seen++;
  c.last = now;

  if(c.state === 1 || c.state === 3){
    // étape d'apprentissage : on la remontre dans la même session (~10 min)
    c.ivl = 0;
    c.due = now + 10 * 60000;
    c.learnQueue = true;
  } else {
    c.ivl = intervalFor(c.s, retention);
    // fuzz ±5 % : évite que toutes les cartes d'un même jour reviennent ensemble
    const fuzz = c.ivl > 4 ? Math.round(c.ivl * (Math.random() * 0.1 - 0.05)) : 0;
    c.ivl = Math.min(maxInterval, Math.max(1, c.ivl + fuzz));
    c.due = todayStamp(now) + c.ivl * DAY;
    c.learnQueue = false;
  }
  return c;
}

/** Aperçu des 4 intervalles sans muter la carte (affiché sur les boutons). */
function preview(card, retention, now, maxInterval){
  const out = {};
  [1,2,3,4].forEach(g => {
    const c = review(card, g, retention, now, maxInterval);
    out[g] = c.learnQueue ? 0 : c.ivl;
  });
  return out;
}

/** Rétention actuelle estimée d'une carte (pour le tri et les stats). */
function currentR(card, now){
  if(card.state === 0 || !card.last) return 0;
  return retrievability(Math.max(0, ((now || Date.now()) - card.last) / DAY), card.s);
}

/* ==========================================================================
   DOSAGE : combien de mots par jour, combien de minutes ?
   Modèle de charge en régime permanent. Hypothèses (mesurées sur de grands
   corpus d'utilisateurs de répétition espacée, cohérentes avec les temps de
   réponse rapportés dans la littérature) :
     · une carte NEUVE coûte ~30 s le jour de son introduction
       (présentation + 2-3 reprises intra-session)
     · une RÉVISION coûte ~8 s
     · à 90 % de rétention, une carte demande ~7,5 révisions la 1re année
   → charge quotidienne ≈ N·(30 + 7,5·8)/60 s ≈ 1,5 min par mot neuf/jour.
   Le coût des révisions monte quand on vise une rétention plus élevée :
   viser 97 % double presque la charge pour +7 points de rappel — d'où
   l'optimum autour de 0,85–0,90 (Bjork, « désirables difficultés »).
   ========================================================================== */
const COST_NEW    = 30;   // secondes — valeur par défaut, recalibrée sur tes mesures
const COST_REVIEW = 8;    // secondes

/** Nombre moyen de révisions par carte sur 1 an selon la rétention visée. */
function reviewsPerCardPerYear(retention){
  // Plus la rétention visée est haute, plus les intervalles sont courts.
  // Approximation calibrée sur les simulations FSRS.
  return 7.5 * Math.pow((1 - 0.9) / (1 - retention), 0.55);
}

/**
 * Charge quotidienne en régime établi.
 * `cal` (optionnel) remplace les constantes par TES mesures réelles :
 *   { secsNew, secsRev, ratio }  — ratio = révisions par carte neuve introduite.
 * Sans calibration, on utilise les valeurs par défaut, volontairement
 * conservatrices : mieux vaut annoncer trop de minutes que trop peu.
 */
function dailyLoad(newPerDay, retention, cal){
  cal = cal || {};
  const cNew = cal.secsNew || COST_NEW;
  const cRev = cal.secsRev || COST_REVIEW;
  const rpc  = cal.ratio || reviewsPerCardPerYear(retention);
  const revs = newPerDay * rpc;
  const secs = newPerDay * cNew + revs * cRev;
  return { newPerDay, reviewsPerDay: Math.round(revs), minutes: secs / 60, rpc,
           calibrated: !!(cal.ratio || cal.secsRev) };
}

/** Combien de cartes neuves par jour tiennent dans M minutes ? */
function newPerDayForMinutes(minutes, retention, cal){
  cal = cal || {};
  const cNew = cal.secsNew || COST_NEW;
  const cRev = cal.secsRev || COST_REVIEW;
  const rpc  = cal.ratio || reviewsPerCardPerYear(retention);
  return Math.max(1, Math.round(minutes * 60 / (cNew + rpc * cRev)));
}

if(typeof module !== "undefined") module.exports = {
  FSRS_W, GRADE, retrievability, intervalFor, newCard, review, preview, currentR,
  dailyLoad, newPerDayForMinutes, reviewsPerCardPerYear, todayStamp, DAY
};
