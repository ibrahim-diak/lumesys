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

    const CLE_HISTORIQUE_VUES =
        "lumesys_historique_vues_v1";

    const NOMBRE_MAXIMUM_VUES =
        500;

    const DUREE_EXPOSITION_MINIMALE =
        1200;


    const INTERVALLE_SAUVEGARDE =
        10000;


    let statistiques = {};

    let preferences = chargerPreferences();

    let carteActuelle = null;

    let debutCarte = 0;

    let produitsVusSession = new Set();
    let porteeHistorique = "guest";
    let historiqueVues = chargerHistoriqueVues(porteeHistorique);
    let observateurCartes = null;
    let observateurSansIntersection = false;
    const cartesObservees = new WeakSet();
    const expositionsEnCours = new Map();
    const cartesVisibles = new Set();


    /* ========================================================
       NORMALISATION
       ======================================================== */

    function normaliser(produit) {

        return String(produit || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "");
    }

    function cleStockageHistorique(portee) {
        return CLE_HISTORIQUE_VUES + "_" + encodeURIComponent(portee);
    }


    function normaliserHistoriqueVues(valeur) {
        const entrees = Array.isArray(valeur)
            ? valeur.map(function (vue) {
                return [vue && vue.id, vue && vue.viewedAt];
            })
            : Object.entries(valeur || {});
        const vues = new Map();

        entrees.forEach(function (entree) {
            const id = String(entree[0] || "").trim();
            const date = Number(entree[1]);
            if (id && Number.isFinite(date) && date > 0) {
                vues.set(id, Math.max(date, vues.get(id) || 0));
            }
        });

        return Object.fromEntries(
            Array.from(vues.entries())
                .sort(function (a, b) { return b[1] - a[1]; })
                .slice(0, NOMBRE_MAXIMUM_VUES)
        );
    }


    function chargerHistoriqueVues(portee) {
        try {
            const texte = localStorage.getItem(cleStockageHistorique(portee));
            return texte
                ? normaliserHistoriqueVues(JSON.parse(texte))
                : {};
        } catch (erreur) {
            console.warn("Lumesys : historique local des consultations illisible.", erreur);
            return {};
        }
    }


    function sauvegarderHistoriqueVues() {
        try {
            localStorage.setItem(
                cleStockageHistorique(porteeHistorique),
                JSON.stringify(historiqueVues)
            );
            return true;
        } catch (erreur) {
            console.error("Lumesys : impossible de sauvegarder l’historique des consultations.", erreur);
            return false;
        }
    }


    function notifierHistoriqueVues(source) {
        document.dispatchEvent(new CustomEvent("lumesys-view-history-updated", {
            detail: {
                scope: porteeHistorique,
                source: source
            }
        }));
    }


    function definirPorteeHistorique(uid) {
        const nouvellePortee = uid
            ? "user:" + String(uid).trim()
            : "guest";

        if (nouvellePortee === porteeHistorique) {
            return false;
        }

        porteeHistorique = nouvellePortee;
        historiqueVues = chargerHistoriqueVues(porteeHistorique);
        produitsVusSession = new Set();
        document.dispatchEvent(new CustomEvent("lumesys-view-history-scope-changed", {
            detail: { scope: porteeHistorique }
        }));
        return true;
    }


    function obtenirHistoriqueVues() {
        return Object.entries(historiqueVues).map(function (entree) {
            return { id: entree[0], viewedAt: entree[1] };
        });
    }


    function fusionnerHistoriqueVues(vuesDistantes) {
        const distant = normaliserHistoriqueVues(vuesDistantes);
        const fusion = { ...historiqueVues };
        let modifie = false;

        Object.entries(distant).forEach(function (entree) {
            if ((fusion[entree[0]] || 0) < entree[1]) {
                fusion[entree[0]] = entree[1];
                modifie = true;
            }
        });

        if (modifie) {
            historiqueVues = normaliserHistoriqueVues(fusion);
            sauvegarderHistoriqueVues();
            notifierHistoriqueVues("cloud-merge");
        }

        return modifie;
    }


    function enregistrerProduitVu(id, categorie, nom) {
        const identifiant = String(id || "").trim();
        if (!identifiant) {
            return false;
        }

        historiqueVues[identifiant] = Date.now();
        historiqueVues = normaliserHistoriqueVues(historiqueVues);
        sauvegarderHistoriqueVues();
        notifierHistoriqueVues("local");

        if (!produitsVusSession.has(identifiant)) {
            produitsVusSession.add(identifiant);
            enregistrerVue(nom || identifiant, categorie || "");
            commencerTemps(nom || identifiant);
        }

        return true;
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

    function ratioVisible(carte) {
        const rectangle = carte.getBoundingClientRect();
        const largeur = Math.max(
            0,
            Math.min(rectangle.right, window.innerWidth) - Math.max(rectangle.left, 0)
        );
        const hauteur = Math.max(
            0,
            Math.min(rectangle.bottom, window.innerHeight) - Math.max(rectangle.top, 0)
        );
        const aire = rectangle.width * rectangle.height;
        return aire > 0 ? (largeur * hauteur) / aire : 0;
    }


    function annulerExposition(carte) {
        const minuterie = expositionsEnCours.get(carte);
        if (minuterie) {
            clearTimeout(minuterie);
            expositionsEnCours.delete(carte);
        }
        cartesVisibles.delete(carte);
    }


    function demarrerExposition(carte) {
        cartesVisibles.add(carte);
        if (expositionsEnCours.has(carte)) {
            return;
        }

        const minuterie = setTimeout(function () {
            expositionsEnCours.delete(carte);
            if (
                !carte.isConnected ||
                !cartesVisibles.has(carte) ||
                document.visibilityState === "hidden"
            ) {
                return;
            }

            const nom = carte.dataset.produit;
            const id = carte.dataset.produitId || nom;
            if (nom && id) {
                enregistrerProduitVu(
                    id,
                    carte.dataset.categorie || "",
                    nom
                );
            }
        }, DUREE_EXPOSITION_MINIMALE);

        expositionsEnCours.set(carte, minuterie);
    }


    function verifierCartesVisibles() {
        const conteneur = document.getElementById("recommandations-container");
        if (!conteneur) {
            return;
        }

        conteneur.querySelectorAll("[data-produit]").forEach(function (carte) {
            if (ratioVisible(carte) >= 0.55) {
                demarrerExposition(carte);
            } else {
                annulerExposition(carte);
            }
        });
    }


    function observerCartes() {

        const conteneur =
            document.getElementById(
                "recommandations-container"
            );


        if (!conteneur) {

            return;
        }

        if (typeof window.IntersectionObserver === "function") {
            if (!observateurCartes) {
                observateurCartes = new IntersectionObserver(
                    function (entries) {
                        entries.forEach(function (entry) {
                            if (
                                entry.isIntersecting &&
                                entry.intersectionRatio >= 0.55
                            ) {
                                demarrerExposition(entry.target);
                            } else {
                                annulerExposition(entry.target);
                            }
                        });
                    },
                    { threshold: [0, 0.55] }
                );
            }

            conteneur.querySelectorAll("[data-produit]").forEach(function (carte) {
                if (!cartesObservees.has(carte)) {
                    cartesObservees.add(carte);
                    observateurCartes.observe(carte);
                }
            });

            return observateurCartes;
        }

        if (!observateurSansIntersection) {
            window.addEventListener("scroll", verifierCartesVisibles, { passive: true });
            window.addEventListener("resize", verifierCartesVisibles);
            observateurSansIntersection = true;
        }
        verifierCartesVisibles();
        return null;
    }


    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
            Array.from(expositionsEnCours.keys()).forEach(annulerExposition);
            return;
        }

        verifierCartesVisibles();
    });


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
                if (window.LumesysCommerce) {
                    window.LumesysCommerce.toggleFavorite(
                        window.LumesysCommerce.productFromCard(carteFavori)
                    );
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

        obtenirHistoriqueVues: obtenirHistoriqueVues,

        definirPorteeHistorique: definirPorteeHistorique,

        fusionnerHistoriqueVues: fusionnerHistoriqueVues,

        enregistrerProduitVu: enregistrerProduitVu,

        basculerFavori: basculerFavori,

        estFavori: estFavori,


        enregistrerClic: enregistrerClic,


        commencerTemps: commencerTemps,


        terminerTemps: terminerTemps,


        observerCartes: observerCartes

    };

})();
