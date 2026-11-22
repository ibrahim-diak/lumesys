/* ============================================================
   LUMESYS
   MOTEUR PRINCIPAL DES RECOMMANDATIONS
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       CONFIGURATION
       ======================================================== */

    const CONFIG = {

        nombreProduitsMaximum: 500,

        produitsParAffichage: 20,

        seuilPrechargement: 1200,

        nombreFichiersSimultanes: 4,

        delaiEntreLots: 20,

        intervalleRecalcul: 15000,

        nombreFichiersInteret: 3

    };


    /* ========================================================
       HTML
       ======================================================== */

    const container =
        document.getElementById(
            "recommandations-container"
        );


    const loading =
        document.getElementById(
            "recommandations-loading"
        );


    const fin =
        document.getElementById(
            "recommandations-fin"
        );


    if (!container) {

        console.error(
            "Lumesys : #recommandations-container introuvable."
        );

        return;
    }


    /* ========================================================
       MÉMOIRES
       ======================================================== */

    const catalogue =
        new Map();


    const fichiersAnalyses =
        new Set();


    const fichiersExistants =
        new Set();


    const produitsAffiches =
        new Set();


    let reserve = [];


    let positionAffichage = 0;


    let analyseEnCours = false;


    let chargementEnCours = false;


    let recalculNecessaire = false;


    let dernierRecalcul = 0;


    let cleHoraireActuelle =
        LumesysVariation.obtenirCleHoraire();


    /* ========================================================
       PARSER HTML
       ======================================================== */

    function parserHTML(
        texte
    ) {

        const parser =
            new DOMParser();


        return parser.parseFromString(
            texte,
            "text/html"
        );
    }


    /* ========================================================
       TROUVER CATÉGORIE
       ======================================================== */

    function trouverCategorie(
        carte
    ) {

        const section =
            carte.closest(
                "section"
            );


        if (!section) {

            return "";
        }


        const titre =
            section.querySelector(
                "h3"
            );


        if (!titre) {

            return "";
        }


        return titre.textContent
            .trim();
    }


    /* ========================================================
       EXTRAIRE LES CARTES
       ======================================================== */

    function extraireCartes(
        documentHTML,
        fichier
    ) {

        const cartes =
            documentHTML.querySelectorAll(
                ".bcard"
            );


        cartes.forEach(
            function (
                carte
            ) {

                const titre =
                    carte.querySelector(
                        "h3"
                    );


                if (!titre) {

                    return;
                }


                const nom =
                    titre.textContent.trim();


                if (!nom) {

                    return;
                }


                const cle =
                    LumesysCache.normaliserProduit(
                        nom
                    );


                /*
                 * ZÉRO DOUBLON.
                 */

                if (
                    catalogue.has(cle)
                ) {

                    return;
                }


                /*
                 * Identification du produit.
                 */

                const produit = {

                    cle,

                    nom,

                    fichier,

                    categorie:
                        trouverCategorie(
                            carte
                        ),

                    carte,

                    nouveau:
                        false,

                    score: 0

                };


                catalogue.set(
                    cle,
                    produit
                );


                LumesysCache
                    .enregistrerEmplacement(
                        nom,
                        fichier
                    );
            }
        );
    }


    /* ========================================================
       CHARGER UN FICHIER
       ======================================================== */

    async function analyserFichier(
        fichier
    ) {

        if (
            fichiersAnalyses.has(
                fichier
            )
        ) {

            return;
        }


        fichiersAnalyses.add(
            fichier
        );


        const texte =
            await LumesysCache
                .chargerFichier(
                    fichier
                );


        if (!texte) {

            return;
        }


        fichiersExistants.add(
            fichier
        );


        const documentHTML =
            parserHTML(
                texte
            );


        extraireCartes(
            documentHTML,
            fichier
        );
    }


    /* ========================================================
       ANALYSE DES FICHIERS PAR LOTS
       ======================================================== */

    async function analyserCatalogue(
        fichiers
    ) {

        if (analyseEnCours) {

            return;
        }


        analyseEnCours =
            true;


        try {

            for (
                let i = 0;
                i < fichiers.length;
                i +=
                    CONFIG.nombreFichiersSimultanes
            ) {

                const lot =
                    fichiers.slice(
                        i,
                        i +
                        CONFIG.nombreFichiersSimultanes
                    );


                await Promise.all(
                    lot.map(
                        fichier =>
                            analyserFichier(
                                fichier
                            )
                    )
                );


                /*
                 * Laisser le navigateur
                 * respirer entre les lots.
                 */

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            CONFIG.delaiEntreLots
                        )
                );
            }

        } finally {

            analyseEnCours =
                false;
        }
    }


    /* ========================================================
       CRÉER LA RÉSERVE
       ======================================================== */

    function construireReserve() {

        const produits =
            [...catalogue.values()];


        const statistiques =
            LumesysComportement
                .obtenirStatistiques();


        let classes =
            LumesysScore.classerProduits(
                produits,
                statistiques
            );


        /*
         * Mélange horaire.
         */

        classes =
            LumesysVariation
                .appliquerVariation(
                    classes
                );


        /*
         * Recalcul du score après variation
         * et mélange contrôlé.
         *
         * On garde toutefois une partie
         * des produits fortement pertinents
         * au début.
         */

        const pertinents =
            classes
                .slice()
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.score -
                        a.score
                );


        const aleatoires =
            classes
                .slice();


        const resultat = [];


        /*
         * 60 % pertinence
         * 40 % variation
         */

        const nombrePertinents =
            Math.min(
                300,
                pertinents.length
            );


        const dejaPris =
            new Set();


        pertinents
            .slice(
                0,
                nombrePertinents
            )
            .forEach(
                produit => {

                    if (
                        resultat.length >=
                        CONFIG.nombreProduitsMaximum
                    ) {

                        return;
                    }


                    if (
                        dejaPris.has(
                            produit.cle
                        )
                    ) {

                        return;
                    }


                    resultat.push(
                        produit
                    );


                    dejaPris.add(
                        produit.cle
                    );
                }
            );


        aleatoires.forEach(
            produit => {

                if (
                    resultat.length >=
                    CONFIG.nombreProduitsMaximum
                ) {

                    return;
                }


                if (
                    dejaPris.has(
                        produit.cle
                    )
                ) {

                    return;
                }


                resultat.push(
                    produit
                );


                dejaPris.add(
                    produit.cle
                );
            }
        );


        /*
         * Limite absolue.
         */

        reserve =
            resultat.slice(
                0,
                CONFIG.nombreProduitsMaximum
            );
    }


    /* ========================================================
       CLONER UNE CARTE
       ======================================================== */

    function clonerCarte(
        produit
    ) {

        const carte =
            produit.carte.cloneNode(
                true
            );


        /*
         * Supprimer les IDs internes.
         */

        carte
            .querySelectorAll(
                "[id]"
            )
            .forEach(
                element =>
                    element.removeAttribute(
                        "id"
                    )
            );


        /*
         * Identification Lumesys.
         */

        carte.dataset.produit =
            produit.nom;


        carte.dataset.categorie =
            produit.categorie ||
            "";


        carte.dataset.fichier =
            produit.fichier;


        carte.dataset.score =
            String(
                produit.score || 0
            );


        carte.dataset.recommandation =
            "true";


        return carte;
    }


    /* ========================================================
       AFFICHER UN PRODUIT
       ======================================================== */

    function afficherProduit(
        produit
    ) {

        if (!produit) {

            return false;
        }


        if (
            produitsAffiches.has(
                produit.cle
            )
        ) {

            return false;
        }


        const carte =
            clonerCarte(
                produit
            );


        container.appendChild(
            carte
        );


        produitsAffiches.add(
            produit.cle
        );


        return true;
    }


    /* ========================================================
       AFFICHER LES 20 SUIVANTES
       ======================================================== */

    function afficherProchainesCartes() {

        if (
            chargementEnCours
        ) {

            return;
        }


        if (
            positionAffichage >=
            reserve.length
        ) {

            return;
        }


        chargementEnCours =
            true;


        let compteur =
            0;


        while (
            compteur <
            CONFIG.produitsParAffichage &&
            positionAffichage <
            reserve.length
        ) {

            const produit =
                reserve[
                    positionAffichage
                ];


            positionAffichage++;


            if (
                afficherProduit(
                    produit
                )
            ) {

                compteur++;
            }
        }


        chargementEnCours =
            false;


        /*
         * Mettre à jour l'observation
         * des nouvelles cartes.
         */

        if (
            window.LumesysComportement
                .observerCartes
        ) {

            window.LumesysComportement
                .observerCartes();
        }


        if (
            positionAffichage >=
            reserve.length &&
            reserve.length >=
            CONFIG.nombreProduitsMaximum
        ) {

            fin.style.display =
                "block";
        }
    }


    /* ========================================================
       PRÉPARATION DES 500
       ======================================================== */

    async function preparer500() {

        loading.style.display =
            "block";


        const fichiers =
            LumesysCache
                .obtenirListeFichiers();


        /*
         * Analyse en arrière-plan.
         */

        await analyserCatalogue(
            fichiers
        );


        construireReserve();


        loading.style.display =
            "none";


        /*
         * Les 20 premières.
         */

        afficherProchainesCartes();


        /*
         * Continuer le travail après
         * l'affichage initial.
         */

        setTimeout(
            function () {

                recalculerSiNecessaire();

            },
            100
        );
    }


    /* ========================================================
       PRÉCHARGEMENT
       ======================================================== */

    function prechargerSuite() {

        /*
         * Ici les fichiers sont déjà analysés
         * autant que possible.
         *
         * On peut néanmoins demander au navigateur
         * de garder certains fichiers en cache.
         */

        const fichiers =
            LumesysCache
                .obtenirListeFichiers();


        fichiers.forEach(
            function (
                fichier
            ) {

                if (
                    !fichiersAnalyses.has(
                        fichier
                    )
                ) {

                    LumesysCache
                        .prechargerFichier(
                            fichier
                        );
                }
            }
        );
    }


    /* ========================================================
       DÉTECTION DE L'INTÉRÊT
       ======================================================== */

    document.addEventListener(
        "lumesys-interet",
        function (
            event
        ) {

            console.log(
                "Lumesys : nouvel intérêt détecté",
                event.detail
            );


            recalculNecessaire =
                true;


            recalculerSiNecessaire();
        }
    );


    /* ========================================================
       RECALCUL
       ======================================================== */

    function recalculerSiNecessaire() {

        const maintenant =
            Date.now();


        if (
            maintenant -
            dernierRecalcul <
            CONFIG.intervalleRecalcul
        ) {

            return;
        }


        dernierRecalcul =
            maintenant;


        /*
         * Vérifier si l'heure a changé.
         */

        const nouvelleCle =
            LumesysVariation
                .obtenirCleHoraire();


        if (
            nouvelleCle !==
            cleHoraireActuelle
        ) {

            cleHoraireActuelle =
                nouvelleCle;


            recalculNecessaire =
                true;
        }


        if (
            !recalculNecessaire &&
            positionAffichage < 20
        ) {

            return;
        }


        recalculNecessaire =
            false;


        const anciennes =
            new Set(
                reserve
                    .slice(
                        positionAffichage
                    )
                    .map(
                        produit =>
                            produit.cle
                    )
            );


        construireReserve();


        /*
         * Ne jamais remettre devant le visiteur
         * les produits déjà vus.
         */

        reserve =
            reserve.filter(
                produit => {

                    if (
                        produitsAffiches.has(
                            produit.cle
                        )
                    ) {

                        return false;
                    }


                    return true;
                }
            );


        /*
         * Si le visiteur est déjà proche
         * de la fin de sa réserve actuelle,
         * on lui prépare immédiatement la suite.
         */

        if (
            reserve.length -
            positionAffichage <
            40
        ) {

            construireReserve();
        }
    }


    /* ========================================================
       DÉFILEMENT
       ======================================================== */

    let dernierScroll =
        0;


    window.addEventListener(
        "scroll",
        function () {

            const maintenant =
                Date.now();


            if (
                maintenant -
                dernierScroll <
                150
            ) {

                return;
            }


            dernierScroll =
                maintenant;


            const bas =
                window.scrollY +
                window.innerHeight;


            const hauteur =
                document.documentElement
                    .scrollHeight;


            /*
             * On commence à préparer
             * avant que le visiteur arrive
             * à la fin.
             */

            if (
                hauteur -
                bas <
                CONFIG.seuilPrechargement
            ) {

                afficherProchainesCartes();


                /*
                 * Le moteur continue son travail
                 * en arrière-plan.
                 */

                setTimeout(
                    recalculerSiNecessaire,
                    0
                );
            }


            /*
             * Même sans arriver près de la fin,
             * le système peut détecter le changement
             * d'heure.
             */

            if (
                maintenant -
                dernierRecalcul >
                CONFIG.intervalleRecalcul
            ) {

                recalculerSiNecessaire();
            }
        }
    );


    /* ========================================================
       VÉRIFICATION HORAIRE
       ======================================================== */

    setInterval(
        function () {

            const nouvelleCle =
                LumesysVariation
                    .obtenirCleHoraire();


            if (
                nouvelleCle !==
                cleHoraireActuelle
            ) {

                console.log(
                    "Lumesys : nouvelle heure, nouvelles recommandations."
                );


                cleHoraireActuelle =
                    nouvelleCle;


                recalculNecessaire =
                    true;


                recalculerSiNecessaire();
            }

        },
        30000
    );


    /* ========================================================
       INITIALISATION
       ======================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            fin.style.display =
                "none";


            loading.style.display =
                "block";


            /*
             * Lancer immédiatement.
             */

            preparer500();


            /*
             * Préchargement supplémentaire
             * sans bloquer l'affichage.
             */

            setTimeout(
                prechargerSuite,
                2000
            );
        }
    );


    /* ========================================================
       API
       ======================================================== */

    window.LumesysRecommandations = {

        obtenirCatalogue: function () {

            return catalogue;
        },


        obtenirReserve: function () {

            return reserve;
        },


        obtenirNombreAffiches: function () {

            return produitsAffiches.size;
        },


        recalculer: function () {

            recalculNecessaire =
                true;

            recalculerSiNecessaire();
        }

    };

})();