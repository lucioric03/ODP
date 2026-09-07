# Il Ponte — italien par répétition espacée

Application web autonome (aucun serveur, aucun compte) pour passer du zéro à
une base solide d'italien le plus vite possible, avec un planificateur qui
décide *pour toi* quoi revoir et quand.

Ouvre `index.html`, ou publie le dossier sur GitHub Pages.

## Les trois sections

| Section | Contenu | Ce qu'on y travaille |
|---|---|---|
| **800 mots** | Les 800 lemmes les plus fréquents, rangés par fréquence, avec catégorie grammaticale et 312 exemples en contexte | Reconnaissance (IT → FR) puis production (FR → IT), débloquée quand la reconnaissance tient |
| **Verbes & temps** | 108 verbes × 7 temps, conjugués à la volée par un moteur (réguliers calculés, irréguliers tabulés) | Produire la bonne forme, avec le tableau complet à la révélation |
| **Atelier de phrases** | 168 phrases classées par structure (négation, piacere, congiuntivo, hypothèse…) | Traduction active FR → IT, au clavier, avec correction mot à mot |

Les trois sont **mélangées** dans une même séance : l'alternance des types donne
une meilleure rétention à long terme que le travail en blocs.

## Les trois réponses

- **Je ne connais pas** — la carte revient dans la séance, sa stabilité s'effondre
- **Je sais, mais je dois continuer à le voir** — intervalle allongé prudemment
- **Appris** — intervalle allongé fortement

Un quatrième bouton *Difficile* est activable dans les réglages : il affine le
modèle sans changer la logique.

## Le planificateur

FSRS 4.5 (*Free Spaced Repetition Scheduler*), modèle DSR à trois variables par
carte — stabilité, difficulté, récupérabilité. L'intervalle n'est pas un
multiplicateur fixe : il est recalculé à chaque réponse pour retomber
exactement sur la rétention visée.

    R(t,S) = (1 + 19/81 · t/S) ^ −0,5
    I(r,S) = S/(19/81) · (r^(1/−0,5) − 1)

Le dosage quotidien (mots neufs, minutes, durée jusqu'aux 800 mots) est calculé
à partir d'un modèle de charge explicite, puis **recalibré sur tes mesures
réelles** après une semaine d'usage : temps par carte et ratio
révisions/nouvelles observés remplacent les moyennes de population.

La page **Protocole** détaille chaque nombre et ce sur quoi il s'appuie.

## Fichiers

    index.html              interface
    css/style.css
    js/srs.js               FSRS 4.5 + modèle de charge quotidienne
    js/conjugator.js        moteur de conjugaison italienne
    js/app.js               état, files d'étude, vues
    data/words.js           800 mots
    data/verbs.js           108 verbes
    data/sentences.js       168 phrases

## Données

Tout vit dans le `localStorage` du navigateur, sur l'appareil. Les réglages
offrent un export/import JSON — vider les données du site effacerait la
progression.
