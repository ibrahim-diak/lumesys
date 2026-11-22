/* ============================================================
   LUMESYS
   ANALYSE DU COMPORTEMENT VISITEUR
   ============================================================ */

(function () {

    "use strict";


    const CLE =
        "lumesys_comportement_v2";

    const CLE_PREFERENCES =
        "lumesys_preferences_navigation_v1";


    const INTERVALLE_SAUVEGARDE =
        10000;


    let statistiques = {};

    let preferences = chargerPreferences();

    let carteActuelle = null;

    let debutCarte = 0;

    let produitsVusSession = new Set();


    /* ========================================================
       NORMALISATION
       ======================================================== */

    function normaliser(produit) {

        return String(produit || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "");
    }


    function chargerPreferences() {
        try {
            const texte = localStorage.getItem(CLE_PREFERENCES);
            if (!texte) {
                return { categories: {}, recherches: [], favoris: [] };
            }
            const valeur = JSON.parse(texte);
            return {
                categories: valeur.categories || {},
                recherches: Array.isArray(valeur.recherches) ? valeur.recherches : [],
                favoris: Array.isArray(valeur.favoris) ? valeur.favoris : []
            };
        } catch (erreur) {
            console.warn("Lumesys : préférences de navigation illisibles.", erreur);
            return { categories: {}, recherches: [], favoris: [] };
        }
    }


    function sauvegarderPreferences() {
        try {
            localStorage.setItem(CLE_PREFERENCES, JSON.stringify(preferences));
        } catch (erreur) {
            console.warn("Lumesys : préférences de navigation non sauvegardées.", erreur);
        }
    }


    function enregistrerCategorie(categorie) {
        const cle = normaliser(categorie);
        if (!cle) {
            return;
        }
        preferences.categories[cle] = (preferences.categories[cle] || 0) + 1;
        sauvegarderPreferences();
    }


    function enregistrerRecherche(recherche) {
        const cle = String(recherche || "").trim().toLowerCase();
        if (cle.length < 2) {
            return;
        }
        const existante = preferences.recherches.find(function (item) {
            return item.terme === cle;
        });
        if (existante) {
            existante.nombre++;
            existante.date = Date.now();
        } else {
            preferences.recherches.push({ terme: cle, nombre: 1, date: Date.now() });
        }
        preferences.recherches.sort(function (a, b) { return b.date - a.date; });
        preferences.recherches = preferences.recherches.slice(0, 20);
        sauvegarderPreferences();
    }


    function basculerFavori(produit, categorie) {
        const cle = normaliser(produit);
        if (!cle) {
            return false;
        }
        const index = preferences.favoris.findIndex(function (item) {
            return item.produit === cle;
        });
        if (index >= 0) {
            preferences.favoris.splice(index, 1);
            sauvegarderPreferences();
            return false;
        }
        preferences.favoris.push({
            produit: cle,
            categorie: normaliser(categorie),
            date: Date.now()
        });
        sauvegarderPreferences();
        return true;
    }


    function estFavori(produit) {
        const cle = normaliser(produit);
        return preferences.favoris.some(function (item) {
            return item.produit === cle;
        });
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
            enregistrerCategorie(categorie);
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

                            if (produitsVusSession.has(produit)) {
                                return;
                            }
                            produitsVusSession.add(produit);


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

            const boutonFavori =
                event.target.closest(".lumesys-favorite");

            if (boutonFavori) {
                event.preventDefault();
                event.stopPropagation();
                const carteFavori = boutonFavori.closest("[data-produit]");
                if (!carteFavori) {
                    return;
                }
                const actif = basculerFavori(
                    carteFavori.dataset.produit,
                    carteFavori.dataset.categorie || ""
                );
                boutonFavori.setAttribute("aria-pressed", String(actif));
                boutonFavori.setAttribute(
                    "aria-label",
                    actif ? "Retirer des favoris" : "Ajouter aux favoris"
                );
                boutonFavori.textContent = actif ? "♥" : "♡";
                return;
            }

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

        enregistrerCategorie: enregistrerCategorie,

        enregistrerRecherche: enregistrerRecherche,

        obtenirPreferences: function () {
            return preferences;
        },

        basculerFavori: basculerFavori,

        estFavori: estFavori,


        enregistrerClic: enregistrerClic,


        commencerTemps: commencerTemps,


        terminerTemps: terminerTemps,


        observerCartes: observerCartes

    };

})();
