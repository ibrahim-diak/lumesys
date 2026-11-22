/* ============================================================
   LUMESYS
   ANALYSE DU COMPORTEMENT VISITEUR
   ============================================================ */

(function () {

    "use strict";


    const CLE =
        "lumesys_comportement_v2";


    const INTERVALLE_SAUVEGARDE =
        10000;


    let statistiques = {};


    let carteActuelle = null;

    let debutCarte = 0;


    /* ========================================================
       NORMALISATION
       ======================================================== */

    function normaliser(produit) {

        return String(produit || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "");
    }


    /* ========================================================
       CHARGER LES STATISTIQUES
       ======================================================== */

    function charger() {

        try {

            const texte =
                localStorage.getItem(
                    CLE
                );


            if (!texte) {

                return {};
            }


            return JSON.parse(
                texte
            );

        } catch {

            return {};
        }
    }


    statistiques = charger();


    /* ========================================================
       SAUVEGARDER
       ======================================================== */

    function sauvegarder() {

        try {

            localStorage.setItem(
                CLE,
                JSON.stringify(statistiques)
            );

        } catch {}
    }


    /* ========================================================
       OBTENIR UN PRODUIT
       ======================================================== */

    function obtenirProduit(produit) {

        const cle =
            normaliser(produit);


        if (!statistiques[cle]) {

            statistiques[cle] = {

                clics: 0,

                temps: 0,

                vues: 0,

                derniereInteraction: Date.now(),

                categories: {}

            };
        }


        return statistiques[cle];
    }


    /* ========================================================
       VUE
       ======================================================== */

    function enregistrerVue(
        produit,
        categorie
    ) {

        const data =
            obtenirProduit(
                produit
            );


        data.vues++;

        data.derniereInteraction =
            Date.now();


        if (categorie) {

            if (!data.categories[categorie]) {

                data.categories[categorie] = 0;
            }


            data.categories[categorie]++;
        }


        sauvegarder();
    }


    /* ========================================================
       CLIC
       ======================================================== */

    function enregistrerClic(
        produit,
        categorie
    ) {

        const data =
            obtenirProduit(
                produit
            );


        data.clics++;

        data.derniereInteraction =
            Date.now();


        if (categorie) {

            if (!data.categories[categorie]) {

                data.categories[categorie] = 0;
            }


            data.categories[categorie]++;
        }


        sauvegarder();


        document.dispatchEvent(
            new CustomEvent(
                "lumesys-interet",
                {
                    detail: {
                        produit,
                        categorie,
                        type: "clic"
                    }
                }
            )
        );
    }


    /* ========================================================
       COMMENCER À MESURER UNE CARTE
       ======================================================== */

    function commencerTemps(
        produit
    ) {

        if (!produit) {

            return;
        }


        if (
            carteActuelle &&
            debutCarte
        ) {

            terminerTemps();
        }


        carteActuelle =
            produit;


        debutCarte =
            Date.now();
    }


    /* ========================================================
       TERMINER LE TEMPS
       ======================================================== */

    function terminerTemps() {

        if (
            !carteActuelle ||
            !debutCarte
        ) {

            return;
        }


        const duree =
            Date.now() -
            debutCarte;


        const secondes =
            Math.round(
                duree / 1000
            );


        if (secondes > 0) {

            const data =
                obtenirProduit(
                    carteActuelle
                );


            data.temps +=
                secondes;


            data.derniereInteraction =
                Date.now();
        }


        carteActuelle =
            null;


        debutCarte =
            0;
    }


    /* ========================================================
       OBSERVATION DU TEMPS
       ======================================================== */

    setInterval(
        function () {

            if (
                carteActuelle &&
                debutCarte
            ) {

                const maintenant =
                    Date.now();


                const secondes =
                    Math.floor(
                        (
                            maintenant -
                            debutCarte
                        ) / 1000
                    );


                if (
                    secondes >= 10
                ) {

                    sauvegarder();
                }
            }

        },
        INTERVALLE_SAUVEGARDE
    );


    /* ========================================================
       DÉTECTION DES CARTES VISIBLES
       ======================================================== */

    function observerCartes() {

        const conteneur =
            document.getElementById(
                "recommandations-container"
            );


        if (!conteneur) {

            return;
        }


        const observer =
            new IntersectionObserver(
                function (entries) {

                    entries.forEach(
                        function (entry) {

                            if (
                                !entry.isIntersecting
                            ) {

                                return;
                            }


                            const carte =
                                entry.target;


                            const produit =
                                carte.dataset.produit;


                            if (!produit) {

                                return;
                            }


                            const categorie =
                                carte.dataset.categorie ||
                                "";


                            enregistrerVue(
                                produit,
                                categorie
                            );


                            commencerTemps(
                                produit
                            );

                        },
                        {
                            threshold: 0.55
                        }
                    );

                }
            );


        const cartes =
            conteneur.querySelectorAll(
                "[data-produit]"
            );


        cartes.forEach(
            carte => observer.observe(carte)
        );


        return observer;
    }


    /* ========================================================
       CLICS
       ======================================================== */

    document.addEventListener(
        "click",
        function (event) {

            const carte =
                event.target.closest(
                    "[data-produit]"
                );


            if (!carte) {

                return;
            }


            const produit =
                carte.dataset.produit;


            const categorie =
                carte.dataset.categorie ||
                "";


            enregistrerClic(
                produit,
                categorie
            );
        }
    );


    /* ========================================================
       QUITTER LA PAGE
       ======================================================== */

    window.addEventListener(
        "beforeunload",
        function () {

            terminerTemps();

            sauvegarder();
        }
    );


    /* ========================================================
       API
       ======================================================== */

    window.LumesysComportement = {

        obtenirStatistiques: function () {

            return statistiques;
        },


        obtenirProduit: obtenirProduit,


        enregistrerVue: enregistrerVue,


        enregistrerClic: enregistrerClic,


        commencerTemps: commencerTemps,


        terminerTemps: terminerTemps,


        observerCartes: observerCartes

    };

})();