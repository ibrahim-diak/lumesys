/* ============================================================
   LUMESYS - CATALOGUE / RECOMMANDATIONS
   ============================================================

   VERSION AUTONOME
   ------------------------------------------------------------
   Aucun Firebase.
   Les données de comportement sont conservées localement.

   ARCHITECTURE :

       Lume1_1.html
       Lume1_2.html
       ...
       Lume13_1.html
       ...

                    ↓

              catalogue.js

                    ↓

          recherche des produits

                    ↓

          moteur de recommandation

                    ↓

          préparation jusqu'à 500

                    ↓

          affichage progressif

   ============================================================ */


/* ============================================================
   1. CONFIGURATION GÉNÉRALE
   ============================================================ */


/*
 * Nombre de groupes Lume.
 *
 * Exemple :
 *
 * Lume1_1
 * Lume2_1
 * ...
 * Lume13_1
 */
const NOMBRE_GROUPES_LUME = 13;


/*
 * Nombre maximum de parties recherchées
 * dans chaque groupe.
 *
 * Exemple :
 *
 * Lume7_1
 * Lume7_2
 * Lume7_3
 * ...
 */
const MAX_PARTIES_PAR_GROUPE = 30;


/*
 * Nombre maximum de cartes que le système
 * peut préparer pour la session.
 */
const MAX_RECOMMANDATIONS = 500;


/*
 * Nombre de cartes affichées immédiatement.
 */
const AFFICHAGE_INITIAL = 20;


/*
 * Nombre de cartes ajoutées progressivement.
 */
const CARTES_PAR_AJOUT = 20;


/*
 * Distance avant le bas de page.
 *
 * Lorsque le visiteur s'approche de cette distance,
 * les prochaines cartes sont ajoutées.
 */
const DISTANCE_PRECHARGEMENT = 1800;


/*
 * Nombre de fichiers que le système peut examiner
 * en parallèle lorsqu'il prépare le catalogue.
 *
 * Une valeur trop élevée peut surcharger le navigateur.
 */
const FICHIERS_EN_PARALLELE = 4;


/*
 * Durée minimale de consultation considérée
 * comme un véritable intérêt.
 */
const TEMPS_INTERET_MINIMUM = 3;


/*
 * Intervalle de vérification du comportement.
 */
const INTERVALLE_ANALYSE = 3000;


/*
 * Durée de vie du cache des emplacements.
 *
 * Ici : 7 jours.
 */
const DUREE_CACHE_EMPLACEMENTS =
    7 * 24 * 60 * 60 * 1000;


/*
 * Clé utilisée dans localStorage.
 */
const CLE_STATS =
    "lumesys_catalogue_stats_v2";


/*
 * Clé utilisée pour les emplacements.
 */
const CLE_EMPLACEMENTS =
    "lumesys_catalogue_emplacements_v2";


/*
 * Clé utilisée pour la rotation horaire.
 */
const CLE_ROTATION =
    "lumesys_catalogue_rotation_v2";


/* ============================================================
   2. ÉLÉMENTS HTML
   ============================================================ */

const recommandationsContainer =
    document.getElementById(
        "recommandations-container"
    );


const recommandationsLoading =
    document.getElementById(
        "recommandations-loading"
    );


const recommandationsFin =
    document.getElementById(
        "recommandations-fin"
    );


/*
 * Si le conteneur n'existe pas,
 * le script s'arrête proprement.
 */
if (!recommandationsContainer) {

    console.error(
        "LUMESYS : #recommandations-container est introuvable."
    );

}


/* ============================================================
   3. MÉMOIRES INTERNES
   ============================================================ */


/*
 * Cache des textes HTML téléchargés.
 */
const cacheFichiers =
    new Map();


/*
 * Cache des documents DOM créés à partir
 * des fichiers HTML.
 */
const cacheDocuments =
    new Map();


/*
 * Emplacement connu des produits.
 *
 * Exemple :
 *
 * v025 → Lume1_1.html
 */
const emplacementProduits =
    new Map();


/*
 * Produits impossibles à trouver.
 */
const produitsIntrouvables =
    new Set();


/*
 * Produits déjà affichés.
 */
const produitsDejaAffiches =
    new Set();


/*
 * Produits déjà préparés.
 */
const produitsDejaPrepares =
    new Set();


/*
 * Cartes préparées mais pas encore affichées.
 *
 * C'est très important :
 *
 * le système peut préparer 500 cartes
 * sans forcément les afficher immédiatement.
 */
const fileCartesPreparees =
    [];


/*
 * Produits actuellement utilisés
 * pour préparer les recommandations.
 */
let recommandationsPreparees =
    [];


/*
 * Position dans la file d'affichage.
 */
let positionAffichage =
    0;


/*
 * Indique si une opération de préparation
 * est actuellement en cours.
 */
let preparationEnCours =
    false;


/*
 * Indique si un affichage est en cours.
 */
let affichageEnCours =
    false;


/*
 * Indique si le système est initialisé.
 */
let catalogueInitialise =
    false;


/* ============================================================
   4. CATÉGORIES
   ============================================================ */

const categoriesConnues = {

    panton: "pantalons",

    Sacdos: "sacs",

    Chosse: "chaussures",

    cafpr: "presse café",

    ptarfum: "parfums",

    ptissu: "tissus",

    tapfem: "tappettes",

    survetus: "survetements",

    bazin: "bazin",

    tisbrod: "tissus brodés",

    chem: "chemises",

    lacost: "lacoste",

    mailltot: "maillots",

    vesth: "vestes"

};


/* ============================================================
   5. LISTE DE PRODUITS
   ============================================================

   IMPORTANT :

   Cette liste peut être remplacée plus tard par
   ton véritable moteur de recommandation.

   Pour l'instant elle constitue une base de produits
   que le système va rechercher dans les fichiers Lume.

   Tu peux mettre beaucoup plus de produits ici.

   Le système éliminera automatiquement les doublons.

   ============================================================ */


/*
 * Première source.
 */
const sourceProduitsPrincipale = [

    "V25",
    "V26",
    "V28",

    "MAL72",
    "MAL73",
    "MAL74",
    "MAL75",
    "MAL76",
    "MAL77",
    "MAL78",
    "MAL79",
    "MAL80",
    "MAL81",
    "MAL82",
    "MAL85",
    "MAL87",
    "MAL88",
    "MAL89",
    "MAL90",

    "LLA92"

];


/*
 * Tu peux ajouter d'autres listes ici.
 *
 * Cela permettra plus tard de faire varier
 * les recommandations sans modifier les fichiers.
 */
const sourcesProduits = [

    sourceProduitsPrincipale

];


/* ============================================================
   6. NORMALISATION
   ============================================================ */

function normaliserProduit(texte) {

    return String(texte || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

}


/* ============================================================
   7. NOM DES FICHIERS
   ============================================================ */

function construireNomFichier(
    groupe,
    partie
) {

    return `Lume${groupe}_${partie}.html`;

}


/* ============================================================
   8. CHARGEMENT D'UN FICHIER
   ============================================================ */

async function chargerFichier(
    nomFichier
) {

    /*
     * Déjà téléchargé.
     */
    if (cacheFichiers.has(nomFichier)) {

        return cacheFichiers.get(
            nomFichier
        );

    }


    try {

        const reponse =
            await fetch(
                nomFichier,
                {
                    cache: "force-cache"
                }
            );


        if (!reponse.ok) {

            return null;

        }


        const texte =
            await reponse.text();


        cacheFichiers.set(
            nomFichier,
            texte
        );


        return texte;


    } catch (erreur) {

        console.error(
            "Erreur fichier :",
            nomFichier,
            erreur
        );


        return null;

    }

}


/* ============================================================
   9. DOCUMENT HTML
   ============================================================ */

function creerDocumentHTML(
    texte
) {

    const parser =
        new DOMParser();


    return parser.parseFromString(
        texte,
        "text/html"
    );

}


/* ============================================================
   10. RÉCUPÉRER LE DOCUMENT
   ============================================================ */

async function obtenirDocument(
    nomFichier
) {

    if (
        cacheDocuments.has(
            nomFichier
        )
    ) {

        return cacheDocuments.get(
            nomFichier
        );

    }


    const texte =
        await chargerFichier(
            nomFichier
        );


    if (!texte) {

        return null;

    }


    const documentHTML =
        creerDocumentHTML(
            texte
        );


    cacheDocuments.set(
        nomFichier,
        documentHTML
    );


    return documentHTML;

}


/* ============================================================
   11. RECHERCHE D'UNE CARTE
   ============================================================ */

function trouverCarteProduit(
    documentHTML,
    produitRecherche
) {

    const recherche =
        normaliserProduit(
            produitRecherche
        );


    const titres =
        documentHTML.querySelectorAll(
            "h3"
        );


    for (const titre of titres) {

        const nom =
            normaliserProduit(
                titre.textContent
            );


        if (
            nom !== recherche
        ) {

            continue;

        }


        const carte =
            titre.closest(
                ".bcard"
            );


        if (carte) {

            return carte;

        }


        const carteInterne =
            titre.closest(
                ".ccard"
            );


        if (carteInterne) {

            return carteInterne;

        }

    }


    return null;

}


/* ============================================================
   12. SAUVEGARDE DES EMPLACEMENTS
   ============================================================ */

function chargerEmplacementsLocalement() {

    try {

        const donnees =
            JSON.parse(
                localStorage.getItem(
                    CLE_EMPLACEMENTS
                )
            );


        if (!donnees) {

            return;

        }


        const maintenant =
            Date.now();


        Object.entries(
            donnees
        ).forEach(
            ([produit, information]) => {

                if (
                    !information ||
                    !information.fichier ||
                    !information.date
                ) {

                    return;

                }


                if (
                    maintenant -
                    information.date
                    >
                    DUREE_CACHE_EMPLACEMENTS
                ) {

                    return;

                }


                emplacementProduits.set(
                    produit,
                    information.fichier
                );

            }
        );

    } catch (erreur) {

        console.warn(
            "Impossible de charger le cache des emplacements.",
            erreur
        );

    }

}


/* ============================================================
   13. SAUVEGARDE D'UN EMPLACEMENT
   ============================================================ */

function sauvegarderEmplacement(
    produit,
    fichier
) {

    const cle =
        normaliserProduit(
            produit
        );


    emplacementProduits.set(
        cle,
        fichier
    );


    try {

        const donnees =
            JSON.parse(
                localStorage.getItem(
                    CLE_EMPLACEMENTS
                )
            ) || {};


        donnees[cle] = {

            fichier: fichier,

            date: Date.now()

        };


        localStorage.setItem(
            CLE_EMPLACEMENTS,
            JSON.stringify(
                donnees
            )
        );

    } catch (erreur) {

        console.warn(
            "Impossible de sauvegarder l'emplacement.",
            erreur
        );

    }

}


/* ============================================================
   14. RECHERCHE D'UN PRODUIT
   ============================================================ */

async function chercherProduit(
    produitRecherche
) {

    const produit =
        normaliserProduit(
            produitRecherche
        );


    /*
     * --------------------------------------------------------
     * 1. CACHE
     * --------------------------------------------------------
     */

    if (
        emplacementProduits.has(
            produit
        )
    ) {

        const fichier =
            emplacementProduits.get(
                produit
            );


        const documentHTML =
            await obtenirDocument(
                fichier
            );


        if (documentHTML) {

            const carte =
                trouverCarteProduit(
                    documentHTML,
                    produitRecherche
                );


            if (carte) {

                return {

                    carte,

                    fichier

                };

            }

        }

    }


    /*
     * --------------------------------------------------------
     * 2. DÉJÀ INTRouvable
     * --------------------------------------------------------
     */

    if (
        produitsIntrouvables.has(
            produit
        )
    ) {

        return null;

    }


    /*
     * --------------------------------------------------------
     * 3. RECHERCHE PROGRESSIVE
     * --------------------------------------------------------
     */

    for (
        let groupe = 1;
        groupe <= NOMBRE_GROUPES_LUME;
        groupe++
    ) {

        for (
            let partie = 1;
            partie <= MAX_PARTIES_PAR_GROUPE;
            partie++
        ) {

            const fichier =
                construireNomFichier(
                    groupe,
                    partie
                );


            const documentHTML =
                await obtenirDocument(
                    fichier
                );


            if (!documentHTML) {

                continue;

            }


            const carte =
                trouverCarteProduit(
                    documentHTML,
                    produitRecherche
                );


            if (carte) {

                sauvegarderEmplacement(
                    produit,
                    fichier
                );


                return {

                    carte,

                    fichier

                };

            }

        }

    }


    /*
     * --------------------------------------------------------
     * 4. INTRouvable
     * --------------------------------------------------------
     */

    produitsIntrouvables.add(
        produit
    );


    return null;

}


/* ============================================================
   15. CLONAGE D'UNE CARTE
   ============================================================ */

function clonerCarte(
    carte
) {

    const clone =
        carte.cloneNode(
            true
        );


    /*
     * Suppression des IDs.
     *
     * Une carte peut contenir :
     *
     * <h3 id="v025">
     *
     * On ne veut pas dupliquer cet ID dans
     * la page principale.
     */
    clone.querySelectorAll(
        "[id]"
    ).forEach(
        element => {

            element.removeAttribute(
                "id"
            );

        }
    );


    clone.dataset.recommandation =
        "true";


    return clone;

}


/* ============================================================
   16. STATISTIQUES LOCALES
   ============================================================ */

function obtenirStatistiques() {

    try {

        return JSON.parse(
            localStorage.getItem(
                CLE_STATS
            )
        ) || {};

    } catch {

        return {};

    }

}


/* ============================================================
   17. SAUVEGARDE STATISTIQUES
   ============================================================ */

function sauvegarderStatistiques(
    statistiques
) {

    try {

        localStorage.setItem(
            CLE_STATS,
            JSON.stringify(
                statistiques
            )
        );

    } catch (erreur) {

        console.warn(
            "Impossible de sauvegarder les statistiques.",
            erreur
        );

    }

}


/* ============================================================
   18. CRÉER STATISTIQUE PRODUIT
   ============================================================ */

function obtenirStatProduit(
    produit
) {

    const cle =
        normaliserProduit(
            produit
        );


    const statistiques =
        obtenirStatistiques();


    if (!statistiques[cle]) {

        statistiques[cle] = {

            consultations: 0,

            clics: 0,

            tempsTotal: 0,

            derniereConsultation: 0,

            categorie: "",

            score: 0

        };

    }


    return {

        statistiques,

        produit: statistiques[cle],

        cle

    };

}


/* ============================================================
   19. CONSULTATION
   ============================================================ */

function enregistrerConsultation(
    produit
) {

    const resultat =
        obtenirStatProduit(
            produit
        );


    resultat.produit.consultations++;

    resultat.produit.derniereConsultation =
        Date.now();


    sauvegarderStatistiques(
        resultat.statistiques
    );

}


/* ============================================================
   20. CLIC
   ============================================================ */

function enregistrerClic(
    produit
) {

    const resultat =
        obtenirStatProduit(
            produit
        );


    resultat.produit.clics++;


    sauvegarderStatistiques(
        resultat.statistiques
    );

}


/* ============================================================
   21. TEMPS PASSÉ
   ============================================================ */

function enregistrerTemps(
    produit,
    secondes
) {

    if (
        !secondes ||
        secondes <= 0
    ) {

        return;

    }


    const resultat =
        obtenirStatProduit(
            produit
        );


    resultat.produit.tempsTotal +=
        secondes;


    sauvegarderStatistiques(
        resultat.statistiques
    );

}


/* ============================================================
   22. DÉTERMINER LA CATÉGORIE
   ============================================================ */

function determinerCategorieCarte(
    carte
) {

    /*
     * On cherche le produit dans la carte.
     */

    const texte =
        carte.textContent
            .toLowerCase();


    for (
        const [id, categorie]
        of Object.entries(
            categoriesConnues
        )
    ) {

        if (
            texte.includes(
                categorie
            )
        ) {

            return categorie;

        }

    }


    return "";

}


/* ============================================================
   23. SUIVI DU TEMPS
   ============================================================ */

function activerSuiviTemps(
    carte,
    produit
) {

    let debut =
        Date.now();


    let actif =
        true;


    /*
     * Lorsque l'utilisateur quitte la page,
     * on enregistre le temps.
     */
    const enregistrer =
        () => {

            if (!actif) {

                return;

            }


            actif = false;


            const secondes =
                Math.round(
                    (
                        Date.now() -
                        debut
                    ) / 1000
                );


            if (
                secondes >=
                TEMPS_INTERET_MINIMUM
            ) {

                enregistrerTemps(
                    produit,
                    secondes
                );

            }

        };


    window.addEventListener(
        "pagehide",
        enregistrer,
        {
            once: true
        }
    );


    /*
     * Si la carte sort de la zone visible
     * pendant suffisamment longtemps,
     * on arrête son chronomètre.
     */
    if (
        "IntersectionObserver"
        in window
    ) {

        const observer =
            new IntersectionObserver(
                entries => {

                    entries.forEach(
                        entry => {

                            if (
                                !entry.isIntersecting &&
                                actif
                            ) {

                                enregistrer();

                                observer.disconnect();

                            }

                        }
                    );

                },
                {
                    threshold: 0.25
                }
            );


        observer.observe(
            carte
        );

    }

}


/* ============================================================
   24. SUIVI DES CLICS
   ============================================================ */

function activerSuiviCarte(
    carte,
    produit
) {

    const liens =
        carte.querySelectorAll(
            "a"
        );


    liens.forEach(
        lien => {

            lien.addEventListener(
                "click",
                () => {

                    enregistrerClic(
                        produit
                    );

                }
            );

        }
    );

}


/* ============================================================
   25. SCORE D'UN PRODUIT
   ============================================================ */

function calculerScoreProduit(
    produit
) {

    const cle =
        normaliserProduit(
            produit
        );


    const statistiques =
        obtenirStatistiques();


    const stat =
        statistiques[cle];


    if (!stat) {

        return 0;

    }


    /*
     * Consultation.
     */
    let score =
        stat.consultations * 1;


    /*
     * Clic beaucoup plus important.
     */
    score +=
        stat.clics * 5;


    /*
     * Temps passé.
     */
    score +=
        Math.min(
            stat.tempsTotal / 10,
            50
        );


    /*
     * Récence.
     */
    if (
        stat.derniereConsultation
    ) {

        const age =
            Date.now() -
            stat.derniereConsultation;


        const ageHeures =
            age /
            (
                60 *
                60 *
                1000
            );


        /*
         * Un intérêt récent compte davantage.
         */
        score +=
            Math.max(
                0,
                30 - ageHeures
            );

    }


    return score;

}


/* ============================================================
   26. ROTATION HORAIRE
   ============================================================ */

function obtenirHeureRotation() {

    const maintenant =
        new Date();


    return maintenant.getFullYear()
        + "-"
        + (maintenant.getMonth() + 1)
        + "-"
        + maintenant.getDate()
        + "-"
        + maintenant.getHours();

}


/* ============================================================
   27. SCORE DE VARIATION HORAIRE
   ============================================================ */

function scoreVariationHoraire(
    produit
) {

    const cle =
        normaliserProduit(
            produit
        );


    /*
     * Création d'une valeur pseudo-aléatoire
     * stable pendant l'heure actuelle.
     *
     * Ainsi :
     *
     * 12h → ordre A
     * 13h → ordre B
     *
     * mais l'ordre ne change pas à chaque
     * seconde.
     */

    const heure =
        obtenirHeureRotation();


    let hash = 0;


    const texte =
        cle + heure;


    for (
        let i = 0;
        i < texte.length;
        i++
    ) {

        hash =
            (
                (
                    hash << 5
                ) -
                hash
            ) +
            texte.charCodeAt(i);


        hash |= 0;

    }


    hash =
        Math.abs(
            hash
        );


    return (
        hash %
        1000
    ) / 1000;

}


/* ============================================================
   28. CONSTRUIRE LA LISTE BRUTE
   ============================================================ */

function construireListeBrute() {

    const resultat =
        [];


    const deja =
        new Set();


    /*
     * Parcourt toutes les sources.
     */
    for (
        const source
        of sourcesProduits
    ) {

        if (
            !Array.isArray(
                source
            )
        ) {

            continue;

        }


        for (
            const produit
            of source
        ) {

            const cle =
                normaliserProduit(
                    produit
                );


            if (
                !cle ||
                deja.has(
                    cle
                )
            ) {

                continue;

            }


            deja.add(
                cle
            );


            resultat.push(
                produit
            );

        }

    }


    return resultat;

}


/* ============================================================
   29. CALCUL DES RECOMMANDATIONS
   ============================================================ */

function calculerRecommandations() {

    const produits =
        construireListeBrute();


    const statistiques =
        obtenirStatistiques();


    /*
     * On calcule un score pour chaque produit.
     */
    const scores =
        produits.map(
            produit => {

                const cle =
                    normaliserProduit(
                        produit
                    );


                const stat =
                    statistiques[cle];


                /*
                 * Produit déjà apprécié.
                 */
                let score =
                    calculerScoreProduit(
                        produit
                    );


                /*
                 * Variation horaire.
                 *
                 * L'objectif n'est pas de remplacer
                 * le score utilisateur mais de varier
                 * légèrement l'ordre.
                 */
                const variation =
                    scoreVariationHoraire(
                        produit
                    );


                score +=
                    variation * 20;


                /*
                 * Produit jamais consulté :
                 * on lui donne une chance d'apparaître.
                 */
                if (!stat) {

                    score +=
                        15;

                }


                /*
                 * Léger bonus aux produits récents
                 * dans l'ordre de la liste source.
                 */
                const position =
                    produits.indexOf(
                        produit
                    );


                score +=
                    Math.max(
                        0,
                        10 -
                        position / 100
                    );


                return {

                    produit,

                    score

                };

            }
        );


    /*
     * Tri par score.
     */
    scores.sort(
        (a, b) =>
            b.score -
            a.score
    );


    /*
     * On limite à 500.
     */
    return scores
        .slice(
            0,
            MAX_RECOMMANDATIONS
        )
        .map(
            element =>
                element.produit
        );

}


/* ============================================================
   30. PRÉPARATION D'UNE CARTE
   ============================================================ */

async function preparerCarte(
    produit
) {

    const cle =
        normaliserProduit(
            produit
        );


    if (
        produitsDejaPrepares.has(
            cle
        )
    ) {

        return null;

    }


    produitsDejaPrepares.add(
        cle
    );


    const resultat =
        await chercherProduit(
            produit
        );


    if (!resultat) {

        return null;

    }


    const carte =
        clonerCarte(
            resultat.carte
        );


    return {

        produit,

        carte,

        fichier:
            resultat.fichier

    };

}


/* ============================================================
   31. PRÉPARATION DE 500 CARTES
   ============================================================ */

async function preparerCatalogue() {

    if (
        preparationEnCours
    ) {

        return;

    }


    preparationEnCours =
        true;


    recommandationsPreparees =
        calculerRecommandations();


    /*
     * Nous préparons les cartes
     * en arrière-plan.
     */
    let index =
        0;


    while (
        index <
        recommandationsPreparees.length
        &&
        fileCartesPreparees.length <
        MAX_RECOMMANDATIONS
    ) {

        /*
         * Petit groupe parallèle.
         */
        const groupe =
            recommandationsPreparees.slice(
                index,
                index +
                FICHIERS_EN_PARALLELE
            );


        const resultats =
            await Promise.all(
                groupe.map(
                    produit =>
                        preparerCarte(
                            produit
                        )
                )
            );


        resultats.forEach(
            resultat => {

                if (
                    resultat
                ) {

                    fileCartesPreparees.push(
                        resultat
                    );

                }

            }
        );


        index +=
            FICHIERS_EN_PARALLELE;


        /*
         * Permet au navigateur de respirer.
         */
        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    0
                )
        );

    }


    preparationEnCours =
        false;


    console.log(
        "LUMESYS : catalogue préparé :",
        fileCartesPreparees.length,
        "cartes."
    );

}


/* ============================================================
   32. AFFICHER UNE CARTE PRÉPARÉE
   ============================================================ */

function afficherCartePreparee(
    element
) {

    if (!element) {

        return false;

    }


    const cle =
        normaliserProduit(
            element.produit
        );


    /*
     * Zéro doublon.
     */
    if (
        produitsDejaAffiches.has(
            cle
        )
    ) {

        return false;

    }


    recommandationsContainer.appendChild(
        element.carte
    );


    produitsDejaAffiches.add(
        cle
    );


    enregistrerConsultation(
        element.produit
    );


    activerSuiviCarte(
        element.carte,
        element.produit
    );


    activerSuiviTemps(
        element.carte,
        element.produit
    );


    return true;

}


/* ============================================================
   33. AFFICHER LES PREMIÈRES CARTES
   ============================================================ */

async function afficherPremieresCartes() {

    if (
        affichageEnCours
    ) {

        return;

    }


    affichageEnCours =
        true;


    let compteur =
        0;


    while (
        compteur <
        AFFICHAGE_INITIAL
        &&
        fileCartesPreparees.length
    ) {

        const element =
            fileCartesPreparees.shift();


        if (
            afficherCartePreparee(
                element
            )
        ) {

            compteur++;

        }

    }


    affichageEnCours =
        false;

}


/* ============================================================
   34. AJOUTER LES CARTES SUIVANTES
   ============================================================ */

async function ajouterProchainesCartes() {

    if (
        affichageEnCours
    ) {

        return;

    }


    affichageEnCours =
        true;


    let compteur =
        0;


    while (
        compteur <
        CARTES_PAR_AJOUT
        &&
        fileCartesPreparees.length
    ) {

        const element =
            fileCartesPreparees.shift();


        if (
            afficherCartePreparee(
                element
            )
        ) {

            compteur++;

        }

    }


    affichageEnCours =
        false;


    /*
     * S'il n'y a plus rien,
     * on peut relancer une préparation.
     */
    if (
        fileCartesPreparees.length <
        CARTES_PAR_AJOUT
    ) {

        preparerCatalogue();

    }

}


/* ============================================================
   35. SURVEILLANCE DU DÉFILEMENT
   ============================================================ */

function surveillerDefilement() {

    /*
     * IntersectionObserver est plus efficace
     * qu'un gros calcul permanent avec scroll.
     */


    const sentinelle =
        document.createElement(
            "div"
        );


    sentinelle.id =
        "lumesys-catalogue-sentinelle";


    sentinelle.style.height =
        "1px";


    recommandationsContainer.parentNode
        .appendChild(
            sentinelle
        );


    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        if (
                            entry.isIntersecting
                        ) {

                            ajouterProchainesCartes();

                        }

                    }
                );

            },
            {

                root: null,

                rootMargin:
                    `${DISTANCE_PRECHARGEMENT}px`,

                threshold: 0

            }
        );


    observer.observe(
        sentinelle
    );

}


/* ============================================================
   36. ANALYSE CONTINUE
   ============================================================ */

function lancerAnalyseContinue() {

    setInterval(
        () => {

            /*
             * Le visiteur a peut-être montré
             * un nouvel intérêt.
             *
             * On recalcule seulement si nécessaire.
             */

            if (
                fileCartesPreparees.length <
                CARTES_PAR_AJOUT * 2
            ) {

                const anciennes =
                    new Set(
                        recommandationsPreparees.map(
                            normaliserProduit
                        )
                    );


                const nouvelles =
                    calculerRecommandations();


                /*
                 * Vérifie si l'ordre a changé.
                 */
                let changement =
                    false;


                for (
                    let i = 0;
                    i <
                    Math.min(
                        nouvelles.length,
                        recommandationsPreparees.length
                    );
                    i++
                ) {

                    if (
                        normaliserProduit(
                            nouvelles[i]
                        ) !==
                        normaliserProduit(
                            recommandationsPreparees[i]
                        )
                    ) {

                        changement =
                            true;

                        break;

                    }

                }


                if (
                    changement
                ) {

                    /*
                     * On prépare les nouveaux produits
                     * sans supprimer les cartes déjà affichées.
                     */
                    nouvelles.forEach(
                        produit => {

                            const cle =
                                normaliserProduit(
                                    produit
                                );


                            if (
                                !produitsDejaAffiches.has(
                                    cle
                                ) &&
                                !produitsDejaPrepares.has(
                                    cle
                                )
                            ) {

                                preparerCarte(
                                    produit
                                )
                                .then(
                                    element => {

                                        if (
                                            element
                                        ) {

                                            fileCartesPreparees.push(
                                                element
                                            );

                                        }

                                    }
                                );

                            }

                        }
                    );


                    recommandationsPreparees =
                        nouvelles;

                }

            }

        },
        INTERVALLE_ANALYSE
    );

}


/* ============================================================
   37. ROTATION HORAIRE
   ============================================================ */

function surveillerChangementHeure() {

    let heureActuelle =
        obtenirHeureRotation();


    setInterval(
        () => {

            const nouvelleHeure =
                obtenirHeureRotation();


            if (
                nouvelleHeure ===
                heureActuelle
            ) {

                return;

            }


            heureActuelle =
                nouvelleHeure;


            /*
             * Nouvelle heure :
             *
             * on recalcule les recommandations.
             */
            const nouvelles =
                calculerRecommandations();


            recommandationsPreparees =
                nouvelles;


            /*
             * On prépare les nouveaux produits
             * en arrière-plan.
             */
            nouvelles.forEach(
                produit => {

                    const cle =
                        normaliserProduit(
                            produit
                        );


                    if (
                        produitsDejaAffiches.has(
                            cle
                        )
                    ) {

                        return;

                    }


                    if (
                        produitsDejaPrepares.has(
                            cle
                        )
                    ) {

                        return;

                    }


                    preparerCarte(
                        produit
                    )
                    .then(
                        element => {

                            if (
                                element
                            ) {

                                fileCartesPreparees.push(
                                    element
                                );

                            }

                        }
                    );

                }
            );


            console.log(
                "LUMESYS : nouvelle rotation horaire."
            );

        },
        30000
    );

}


/* ============================================================
   38. RECHERCHE D'UNE ANCRE
   ============================================================ */

async function chercherAncre(
    ancre
) {

    const idRecherche =
        ancre.replace(
            /^#/,
            ""
        );


    /*
     * --------------------------------------------------------
     * Recherche progressive.
     * --------------------------------------------------------
     */

    for (
        let groupe = 1;
        groupe <= NOMBRE_GROUPES_LUME;
        groupe++
    ) {

        for (
            let partie = 1;
            partie <= MAX_PARTIES_PAR_GROUPE;
            partie++
        ) {

            const fichier =
                construireNomFichier(
                    groupe,
                    partie
                );


            const documentHTML =
                await obtenirDocument(
                    fichier
                );


            if (!documentHTML) {

                continue;

            }


            const element =
                documentHTML.getElementById(
                    idRecherche
                );


            if (element) {

                return {

                    fichier,

                    documentHTML,

                    element

                };

            }

        }

    }


    return null;

}


/* ============================================================
   39. SECTIONS DÉJÀ CHARGÉES
   ============================================================ */

const sectionsDejaChargees =
    new Set();


/* ============================================================
   40. CHARGEMENT D'UNE CATÉGORIE
   ============================================================ */

async function chargerCategorie(
    ancre
) {

    const id =
        ancre.replace(
            /^#/,
            ""
        );


    const resultat =
        await chercherAncre(
            ancre
        );


    if (!resultat) {

        console.error(
            "LUMESYS : catégorie introuvable :",
            ancre
        );

        return;

    }


    const fichier =
        resultat.fichier;


    /*
     * Si le fichier est déjà chargé,
     * on va simplement à l'ancre.
     */
    if (
        sectionsDejaChargees.has(
            fichier
        )
    ) {

        allerVersAncre(
            id
        );

        return;

    }


    const element =
        resultat.element;


    const section =
        element.closest(
            "section"
        );


    if (!section) {

        console.error(
            "LUMESYS : section introuvable."
        );

        return;

    }


    const achatv =
        document.getElementById(
            "achatv"
        );


    if (!achatv) {

        console.error(
            "LUMESYS : #achatv introuvable."
        );

        return;

    }


    /*
     * Clone de la section.
     */
    const contenu =
        section.cloneNode(
            true
        );


    /*
     * On retire l'ID de section
     * pour éviter un doublon.
     */
    if (
        contenu.id
    ) {

        contenu.removeAttribute(
            "id"
        );

    }


    achatv.appendChild(
        contenu
    );


    sectionsDejaChargees.add(
        fichier
    );


    /*
     * Maintenant l'ancre existe dans
     * le DOM principal.
     */
    setTimeout(
        () => {

            allerVersAncre(
                id
            );

        },
        50
    );

}


/* ============================================================
   41. ALLER À UNE ANCRE
   ============================================================ */

function allerVersAncre(
    id
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;

    }


    element.scrollIntoView({

        behavior: "smooth",

        block: "start"

    });

}


/* ============================================================
   42. INTERCEPTION DES CATÉGORIES
   ============================================================ */

document.addEventListener(
    "click",
    async event => {

        const lien =
            event.target.closest(
                'a[href^="#"]'
            );


        if (!lien) {

            return;

        }


        const href =
            lien.getAttribute(
                "href"
            );


        if (!href) {

            return;

        }


        const id =
            href.replace(
                /^#/,
                ""
            );


        if (
            !Object.prototype.hasOwnProperty.call(
                categoriesConnues,
                id
            )
        ) {

            return;

        }


        /*
         * Empêche le navigateur de chercher
         * une ancre qui n'est pas encore chargée.
         */
        event.preventDefault();


        await chargerCategorie(
            href
        );

    }
);


/* ============================================================
   43. INITIALISATION
   ============================================================ */

async function initialiserCatalogue() {

    if (
        catalogueInitialise
    ) {

        return;

    }


    catalogueInitialise =
        true;


    if (
        !recommandationsContainer
    ) {

        return;

    }


    /*
     * Chargement du cache des emplacements.
     */
    chargerEmplacementsLocalement();


    /*
     * État visuel.
     */
    if (
        recommandationsLoading
    ) {

        recommandationsLoading.style.display =
            "none";

    }


    if (
        recommandationsFin
    ) {

        recommandationsFin.style.display =
            "none";

    }


    /*
     * --------------------------------------------------------
     * IMPORTANT
     * --------------------------------------------------------
     *
     * On prépare le catalogue immédiatement
     * en arrière-plan.
     */
    preparerCatalogue();


    /*
     * On attend uniquement les premières cartes
     * nécessaires à l'affichage initial.
     */
    let tentatives =
        0;


    while (
        fileCartesPreparees.length <
        AFFICHAGE_INITIAL
        &&
        preparationEnCours
        &&
        tentatives <
        200
    ) {

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    30
                )
        );


        tentatives++;

    }


    /*
     * Affichage initial.
     */
    await afficherPremieresCartes();


    /*
     * Surveillance du défilement.
     */
    surveillerDefilement();


    /*
     * Analyse permanente.
     */
    lancerAnalyseContinue();


    /*
     * Rotation horaire.
     */
    surveillerChangementHeure();


    console.log(
        "LUMESYS : catalogue initialisé."
    );

}


/* ============================================================
   44. LANCEMENT
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initialiserCatalogue
    );

} else {

    initialiserCatalogue();

}


/* ============================================================
   FIN DU CATALOGUE.JS
   ============================================================ */