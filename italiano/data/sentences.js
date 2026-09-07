/* ==========================================================================
   ATELIER DE PHRASES — production active FR → IT
   Rappel actif de production (Swain 1985 ; De Bot 1996) : produire une phrase
   entière ancre le vocabulaire ET la syntaxe bien plus profondément que
   reconnaître un mot isolé. On avance par PATTERNS réutilisables.
   Format : [français, italien, pattern, niveau(1-3), note?]
   ========================================================================== */
const SENTENCES = [
/* ---- P1 · Présent & phrase de base ---- */
["Je m'appelle Marc et j'ai trente ans.","Mi chiamo Marc e ho trent'anni.","présent",1,"L'âge se dit avec AVERE, pas essere."],
["Je suis français, j'habite à Lyon.","Sono francese, abito a Lione.","présent",1,"Pas de pronom sujet : « sono » suffit."],
["Elle travaille dans un restaurant.","Lavora in un ristorante.","présent",1],
["Nous parlons un peu italien.","Parliamo un po' d'italiano.","présent",1],
["Ils habitent près de la gare.","Abitano vicino alla stazione.","présent",1,"vicino a + article contracté."],
["Tu bois un café le matin ?","Bevi un caffè la mattina?","présent",1],
["Je comprends, mais je ne parle pas bien.","Capisco, ma non parlo bene.","présent",1],
["Le train part à huit heures.","Il treno parte alle otto.","présent",1],
["Qu'est-ce que tu fais aujourd'hui ?","Che cosa fai oggi?","présent",1],
["Il y a un problème.","C'è un problema.","présent",1,"C'è (sing.) / Ci sono (plur.)."],
["Il y a beaucoup de gens ici.","C'è molta gente qui.","présent",1,"« gente » est singulier en italien."],
["Il y a deux chambres libres.","Ci sono due camere libere.","présent",1],

/* ---- P2 · Négation ---- */
["Je ne sais pas.","Non lo so.","négation",1,"« lo » reprend l'idée : très idiomatique."],
["Je ne comprends rien.","Non capisco niente.","négation",1,"Double négation obligatoire."],
["Il n'y a personne.","Non c'è nessuno.","négation",1],
["Je n'y suis jamais allé.","Non ci sono mai stato.","négation",1],
["Ce n'est pas ma faute.","Non è colpa mia.","négation",1],
["Je n'ai pas le temps aujourd'hui.","Oggi non ho tempo.","négation",1],
["Ni moi ni lui ne le savons.","Né io né lui lo sappiamo.","négation",2],
["Je ne veux plus en parler.","Non voglio più parlarne.","négation",2,"ne = en, collé à l'infinitif."],

/* ---- P3 · Questions ---- */
["Comment tu t'appelles ?","Come ti chiami?","question",1],
["D'où viens-tu ?","Di dove sei?","question",1,"Formule figée : littéralement « de où es-tu »."],
["Où est la gare, s'il vous plaît ?","Dov'è la stazione, per favore?","question",1],
["Combien ça coûte ?","Quanto costa?","question",1],
["À quelle heure on se voit ?","A che ora ci vediamo?","question",1],
["Pourquoi tu ne viens pas ?","Perché non vieni?","question",1],
["Qu'est-ce que ça veut dire ?","Che cosa significa?","question",1],
["Tu peux répéter, s'il te plaît ?","Puoi ripetere, per favore?","question",1],
["Est-ce que tu as déjà mangé ?","Hai già mangiato?","question",1,"Pas d'équivalent de « est-ce que » : l'intonation suffit."],
["Qui a dit ça ?","Chi l'ha detto?","question",2],

/* ---- P4 · Passato prossimo ---- */
["Hier j'ai travaillé toute la journée.","Ieri ho lavorato tutto il giorno.","passé",1],
["Nous sommes allés au cinéma.","Siamo andati al cinema.","passé",1,"andare = essere → accord du participe."],
["Elle est arrivée en retard.","È arrivata in ritardo.","passé",1,"arrivata : accord au féminin."],
["J'ai perdu mes clés.","Ho perso le chiavi.","passé",1],
["Tu as vu ce film ?","Hai visto questo film?","passé",1],
["Ils sont partis ce matin.","Sono partiti stamattina.","passé",1],
["Je me suis levé à six heures.","Mi sono alzato alle sei.","passé",2,"Réfléchi → toujours essere."],
["Qu'est-ce qui s'est passé ?","Che cosa è successo?","passé",2],
["Je n'ai rien compris.","Non ho capito niente.","passé",2],
["On s'est bien amusés.","Ci siamo divertiti molto.","passé",2],
["Elle m'a dit qu'elle venait.","Mi ha detto che veniva.","passé",2],
["Je suis né en France.","Sono nato in Francia.","passé",2],

/* ---- P5 · Imperfetto ---- */
["Quand j'étais petit, j'habitais à Rome.","Quando ero piccolo, abitavo a Roma.","imparfait",2,"Habitude passée → imperfetto."],
["Il faisait froid et il pleuvait.","Faceva freddo e pioveva.","imparfait",2],
["Pendant que je mangeais, le téléphone a sonné.","Mentre mangiavo, ha squillato il telefono.","imparfait",2,"Décor à l'imparfait, événement au passé composé."],
["Je voulais te demander quelque chose.","Volevo chiederti una cosa.","imparfait",2,"Imperfetto de politesse."],
["Avant, on se voyait tous les jours.","Prima ci vedevamo tutti i giorni.","imparfait",2],
["Je ne savais pas que tu étais là.","Non sapevo che eri qui.","imparfait",2],

/* ---- P6 · Futur ---- */
["Demain je t'appellerai.","Domani ti chiamerò.","futur",2],
["Nous partirons la semaine prochaine.","Partiremo la settimana prossima.","futur",2],
["Il sera content de te voir.","Sarà contento di vederti.","futur",2],
["Tu verras, ce sera facile.","Vedrai, sarà facile.","futur",2],
["Il doit être huit heures.","Saranno le otto.","futur",3,"Futur de probabilité : très fréquent à l'oral."],
["Demain je pars à Milan.","Domani parto per Milano.","futur",1,"À l'oral, le présent remplace souvent le futur."],

/* ---- P7 · Conditionnel & politesse ---- */
["Je voudrais un café, s'il vous plaît.","Vorrei un caffè, per favore.","conditionnel",1,"LA formule polie n°1."],
["Tu pourrais m'aider ?","Potresti aiutarmi?","conditionnel",1],
["J'aimerais réserver une table pour deux.","Vorrei prenotare un tavolo per due.","conditionnel",2],
["Ce serait mieux de partir tôt.","Sarebbe meglio partire presto.","conditionnel",2],
["Je devrais y aller.","Dovrei andare.","conditionnel",2],
["Est-ce que vous auriez une chambre libre ?","Avrebbe una camera libera?","conditionnel",2,"Vouvoiement = 3e personne du singulier."],

/* ---- P8 · Modaux + infinitif ---- */
["Je peux entrer ?","Posso entrare?","modaux",1,"Modal + infinitif nu, sans préposition."],
["Je dois partir maintenant.","Devo andare adesso.","modaux",1],
["Tu veux venir avec nous ?","Vuoi venire con noi?","modaux",1],
["Je ne peux pas venir ce soir.","Non posso venire stasera.","modaux",1],
["On doit réserver à l'avance.","Bisogna prenotare in anticipo.","modaux",2,"bisogna = il faut (impersonnel)."],
["Il faut deux heures pour y aller.","Ci vogliono due ore per andarci.","modaux",3,"ci vuole / ci vogliono = il faut (durée, quantité)."],
["Je mets dix minutes à pied.","Ci metto dieci minuti a piedi.","modaux",3],

/* ---- P9 · Piacere & verbes à structure inversée ---- */
["J'aime le café.","Mi piace il caffè.","piacere",1,"Littéralement : le café me plaît."],
["Je n'aime pas les films d'horreur.","Non mi piacciono i film horror.","piacere",1,"Pluriel → piacciono."],
["Ça t'a plu ?","Ti è piaciuto?","piacere",2,"Passato avec essere."],
["Tu me manques.","Mi manchi.","piacere",2,"Inversé : c'est TOI qui manques à moi."],
["Il me faut de l'aide.","Mi serve aiuto.","piacere",2],
["Ça m'intéresse beaucoup.","Mi interessa molto.","piacere",2],
["J'ai envie d'une glace.","Ho voglia di un gelato.","piacere",2],

/* ---- P10 · Pronoms compléments ---- */
["Je l'ai vu hier.","L'ho visto ieri.","pronoms",2,"Accord du participe avec le COD antéposé."],
["Je te la donne.","Te la do.","pronoms",3,"mi/ti/ci/vi + lo/la → me la, te la…"],
["Appelle-moi ce soir.","Chiamami stasera.","pronoms",2,"Pronom collé à l'impératif."],
["Je lui ai téléphoné.","Gli ho telefonato.","pronoms",2,"gli = à lui ; le = à elle."],
["Je leur ai tout expliqué.","Ho spiegato tutto a loro.","pronoms",2],
["Ne me le dis pas !","Non me lo dire!","pronoms",3],
["J'y vais tout de suite.","Ci vado subito.","ci/ne",2,"ci = y."],
["J'en ai deux.","Ne ho due.","ci/ne",2,"ne = en."],
["Je n'en peux plus.","Non ne posso più.","ci/ne",3],
["On y pense.","Ci pensiamo.","ci/ne",3],

/* ---- P11 · Réfléchis & quotidien ---- */
["Je me réveille à sept heures.","Mi sveglio alle sette.","réfléchis",1],
["Il se lave les mains.","Si lava le mani.","réfléchis",2,"Pas de possessif : « le mani » suffit."],
["Ne t'inquiète pas.","Non ti preoccupare.","réfléchis",2],
["On se voit demain.","Ci vediamo domani.","réfléchis",1],
["Ils se sont mariés l'année dernière.","Si sono sposati l'anno scorso.","réfléchis",2],
["Assieds-toi, s'il te plaît.","Siediti, per favore.","réfléchis",2],

/* ---- P12 · Impératif & consignes ---- */
["Viens ici !","Vieni qui!","impératif",1],
["Écoute-moi bien.","Ascoltami bene.","impératif",2],
["Ne parle pas si vite.","Non parlare così veloce.","impératif",2,"Impératif négatif 2e sing. = non + infinitif."],
["Tournez à droite, puis allez tout droit.","Giri a destra, poi vada sempre dritto.","impératif",2,"Vouvoiement : subjonctif."],
["Faisons une pause.","Facciamo una pausa.","impératif",2],
["Excusez-moi, je cherche cette adresse.","Mi scusi, cerco questo indirizzo.","impératif",1],

/* ---- P13 · Congiuntivo ---- */
["Je pense que c'est une bonne idée.","Penso che sia una buona idea.","subjonctif",2,"pensare che → congiuntivo."],
["Je crois qu'il a raison.","Credo che abbia ragione.","subjonctif",2],
["J'espère que tu vas bien.","Spero che tu stia bene.","subjonctif",2],
["Je veux que tu viennes.","Voglio che tu venga.","subjonctif",2],
["Bien que ce soit cher, je le prends.","Benché sia caro, lo prendo.","subjonctif",3],
["Il faut que je parte.","Bisogna che io parta.","subjonctif",3],
["Avant qu'il arrive, on prépare tout.","Prima che arrivi, prepariamo tutto.","subjonctif",3],
["C'est le meilleur restaurant que je connaisse.","È il miglior ristorante che io conosca.","subjonctif",3],

/* ---- P14 · Hypothèse ---- */
["Si tu veux, on y va.","Se vuoi, andiamo.","hypothèse",1,"Hypothèse réelle : présent + présent."],
["Si j'ai le temps, je passerai.","Se ho tempo, passerò.","hypothèse",2],
["Si j'avais de l'argent, j'achèterais cette maison.","Se avessi soldi, comprerei questa casa.","hypothèse",3,"Congiuntivo imperfetto + condizionale."],
["Si j'étais toi, je n'irais pas.","Se fossi in te, non andrei.","hypothèse",3],

/* ---- P15 · Comparatif & superlatif ---- */
["C'est plus cher qu'à Paris.","È più caro che a Parigi.","comparatif",2],
["Elle est plus grande que moi.","È più alta di me.","comparatif",2,"di devant un nom/pronom, che devant autre chose."],
["C'est le meilleur restaurant de la ville.","È il miglior ristorante della città.","comparatif",2],
["Aujourd'hui il fait moins froid qu'hier.","Oggi fa meno freddo di ieri.","comparatif",2],
["C'est vraiment très bon.","È buonissimo.","comparatif",2,"Superlatif absolu en -issimo : plus naturel que « molto buono »."],

/* ---- P16 · Prépositions & articles contractés ---- */
["Je vais au marché.","Vado al mercato.","prépositions",1,"a + il = al."],
["Je viens des États-Unis.","Vengo dagli Stati Uniti.","prépositions",2,"da + gli = dagli."],
["Le livre est sur la table.","Il libro è sul tavolo.","prépositions",1,"su + il = sul."],
["Je pars en Italie en août.","Parto per l'Italia ad agosto.","prépositions",2,"« ad » devant voyelle."],
["Je suis chez un ami.","Sono da un amico.","prépositions",2,"da = chez."],
["J'habite ici depuis trois ans.","Abito qui da tre anni.","prépositions",2,"da + présent = depuis."],
["Je reviens dans une heure.","Torno tra un'ora.","prépositions",2,"tra/fra = dans (futur)."],
["Un verre d'eau, s'il vous plaît.","Un bicchiere d'acqua, per favore.","prépositions",1],
["Je voudrais du pain et de l'eau.","Vorrei del pane e dell'acqua.","prépositions",2,"Partitif : di + article."],

/* ---- P17 · Connecteurs — parler en paragraphes ---- */
["D'abord je mange, ensuite je sors.","Prima mangio, poi esco.","connecteurs",1],
["Il pleut, donc je reste à la maison.","Piove, quindi resto a casa.","connecteurs",1],
["C'est cher, mais ça en vaut la peine.","È caro, però ne vale la pena.","connecteurs",2],
["De toute façon, merci beaucoup.","Comunque, grazie mille.","connecteurs",2],
["À mon avis, tu as raison.","Secondo me, hai ragione.","connecteurs",2],
["En fait, je ne suis pas d'accord.","In realtà, non sono d'accordo.","connecteurs",2],
["Par exemple, hier j'ai essayé.","Per esempio, ieri ho provato.","connecteurs",2],
["Bref, ça n'a pas marché.","Insomma, non ha funzionato.","connecteurs",2],
["Non seulement c'est bon, mais en plus c'est rapide.","Non solo è buono, ma è anche veloce.","connecteurs",3],
["Plus j'étudie, plus je comprends.","Più studio, più capisco.","connecteurs",3],
["D'un côté oui, de l'autre non.","Da una parte sì, dall'altra no.","connecteurs",3],
["Malgré la pluie, on est sortis.","Nonostante la pioggia, siamo usciti.","connecteurs",3],

/* ---- P18 · Survie : restaurant, hôtel, boutique ---- */
["Une table pour deux, s'il vous plaît.","Un tavolo per due, per favore.","survie",1],
["L'addition, s'il vous plaît.","Il conto, per favore.","survie",1],
["Qu'est-ce que vous me conseillez ?","Che cosa mi consiglia?","survie",2],
["Je suis allergique aux fruits de mer.","Sono allergico ai frutti di mare.","survie",2],
["Est-ce que je peux payer par carte ?","Posso pagare con la carta?","survie",1],
["J'ai réservé au nom de Martin.","Ho prenotato a nome Martin.","survie",2],
["À quelle heure est le petit-déjeuner ?","A che ora è la colazione?","survie",1],
["Le wifi ne marche pas.","Il wi-fi non funziona.","survie",1],
["Je cherche quelque chose de moins cher.","Cerco qualcosa di meno caro.","survie",2],
["Je regarde seulement, merci.","Sto solo guardando, grazie.","survie",2,"Progressif : stare + gerundio."],
["Vous avez la même en bleu ?","Ce l'ha uguale in blu?","survie",3],
["Excusez-moi, je ne parle pas bien italien.","Mi scusi, non parlo bene l'italiano.","survie",1],
["Pouvez-vous parler plus lentement ?","Può parlare più lentamente?","survie",1],
["Comment on dit ça en italien ?","Come si dice questo in italiano?","survie",1,"si impersonnel."],

/* ---- P19 · Vie sociale & opinion ---- */
["Ça me ferait très plaisir.","Mi farebbe molto piacere.","opinion",2],
["Je suis complètement d'accord avec toi.","Sono completamente d'accordo con te.","opinion",2],
["Je ne suis pas sûr, ça dépend.","Non sono sicuro, dipende.","opinion",2],
["Honnêtement, je ne pense pas.","Onestamente, non credo.","opinion",2],
["Ça n'a aucun sens.","Non ha alcun senso.","opinion",3],
["Tu as tout à fait raison.","Hai proprio ragione.","opinion",2],
["Je m'en fiche complètement.","Non me ne frega niente.","opinion",3,"Familier."],
["Heureusement que tu es là.","Meno male che ci sei.","opinion",2],
["Ça ne me dérange pas du tout.","Non mi dà affatto fastidio.","opinion",3],
["Je suis en train de l'apprendre.","Lo sto imparando.","opinion",2],

/* ---- P20 · Phrases longues (charnière B1) ---- */
["Je pense que si on part tôt, on arrivera avant midi.","Penso che se partiamo presto, arriveremo prima di mezzogiorno.","longues",3],
["Bien que je sois fatigué, je préfère continuer.","Benché sia stanco, preferisco continuare.","longues",3],
["Quand je suis arrivé, ils avaient déjà commencé.","Quando sono arrivato, avevano già cominciato.","longues",3,"Trapassato prossimo : avevo + participe."],
["C'est la meilleure décision que j'aie prise cette année.","È la miglior decisione che abbia preso quest'anno.","longues",3],
["Je te le dirais si j'étais sûr.","Te lo direi se fossi sicuro.","longues",3],
["Ce que je ne comprends pas, c'est pourquoi il n'a rien dit.","Quello che non capisco è perché non ha detto niente.","longues",3],
["Plus je le connais, moins je le comprends.","Più lo conosco, meno lo capisco.","longues",3],
["Il m'a demandé si je pouvais l'aider.","Mi ha chiesto se potevo aiutarlo.","longues",3],
["Après avoir mangé, on est allés se promener.","Dopo aver mangiato, siamo andati a fare una passeggiata.","longues",3,"dopo + infinitif passé."],
["Avant de partir, n'oublie pas de fermer la fenêtre.","Prima di partire, non dimenticare di chiudere la finestra.","longues",3]
];
