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


    let produitsAffiches =
        new Set();


    let reserve = [];

    let filtreCategorie =
        null;

    let filtreSousCategorie =
        null;

    let filtreRecherche =
        "";

    let nombreProduitsCategorie =
        0;

    let messageSuggestionsAffiche =
        false;


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
        const section = carte.closest("section");
        let titre = null;
        if (section) {
            section.querySelectorAll("h3").forEach(function (heading) {
                if (!heading.closest(".bcard, .ccard") &&
                    (heading.compareDocumentPosition(carte) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                    titre = heading;
                }
            });
        }

        const texte = titre ? titre.textContent.trim() : "";
        const id = titre ? titre.id.toLowerCase() : "";
        const image = carte.querySelector("img");
        const src = image ? image.getAttribute("src") || "" : "";
        const dossier = src.split("/").slice(-2, -1)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        const heading = (texte + " " + id).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const sousCategories = {
            chosse: ["chaussures", "Chosse"],
            chos_se1: ["chaussures", "chos_se1"],
            chasuss1: ["chaussures", "chasuss1"],
            snads: ["chaussures", "snads"],
            panton: ["pantalons", "panton"],
            sacdos: ["sacs", "Sacdos"],
            cafpr: ["accessoires", "cafpr"],
            ptarfum: ["accessoires", "ptarfum"],
            ptissu: ["tissus", "ptissu"],
            tissus_cousus: ["tissus", "Tissus_Cousus"],
            tisbrod: ["tissus", "tisbrod"],
            bazin: ["tissus", "bazin"],
            chem: ["vetements", "chem"],
            chemco: ["vetements", "chem"],
            lacost: ["vetements", "lacost"],
            lacostao: ["vetements", "lacostao"],
            mailltot: ["vetements", "mailltot"],
            survetus: ["vetements", "survetus"],
            vesth: ["vetements", "vesth"]
        };
        let categorieEtSousCategorie = sousCategories[id];

        if (!categorieEtSousCategorie) {
            if (/chaussures[1-4]|chaussures01/.test(dossier)) {
                categorieEtSousCategorie = ["chaussures", dossier.indexOf("02") >= 0 ? "chasuss1" : "Chosse"];
            } else if (dossier === "sandales") {
                categorieEtSousCategorie = ["chaussures", "snads"];
            } else if (dossier.indexOf("chaussures") === 0) {
                categorieEtSousCategorie = ["chaussures", "Chosse"];
            } else if (dossier === "pantalons") {
                categorieEtSousCategorie = ["pantalons", "panton"];
            } else if (dossier === "sac") {
                categorieEtSousCategorie = ["sacs", "Sacdos"];
            } else if (dossier === "cafepresse") {
                categorieEtSousCategorie = ["accessoires", "cafpr"];
            } else if (dossier === "parfum") {
                categorieEtSousCategorie = ["accessoires", "ptarfum"];
            } else if (dossier === "tissu_brode".replace(/[^a-z0-9]/g, "")) {
                categorieEtSousCategorie = ["tissus", "tisbrod"];
            } else if (dossier === "tissu01" || dossier === "articleza") {
                categorieEtSousCategorie = ["tissus", "Tissus_Cousus"];
            } else if (dossier === "bazin") {
                categorieEtSousCategorie = ["tissus", "bazin"];
            } else if (dossier === "tissu") {
                categorieEtSousCategorie = ["tissus", "ptissu"];
            } else if (dossier === "maillot") {
                categorieEtSousCategorie = ["vetements", "mailltot"];
            } else if (dossier.indexOf("survet") === 0) {
                categorieEtSousCategorie = ["vetements", "survetus"];
            } else if (dossier === "veste") {
                categorieEtSousCategorie = ["vetements", "vesth"];
            } else if (dossier.indexOf("chemise") === 0) {
                categorieEtSousCategorie = ["vetements", "chem"];
            } else if (dossier.indexOf("lacoste") === 0) {
                categorieEtSousCategorie = ["vetements", dossier === "lacoste01" ? "lacostao" : "lacost"];
            }
        }

        if (!categorieEtSousCategorie) {
            if (/chaussures|sandales/.test(heading)) {
                categorieEtSousCategorie = ["chaussures", /sandales/.test(heading) ? "snads" : /02/.test(heading) ? "chasuss1" : /01/.test(heading) ? "chos_se1" : "Chosse"];
            } else if (/pantalons/.test(heading)) {
                categorieEtSousCategorie = ["pantalons", "panton"];
            } else if (/sacs/.test(heading)) {
                categorieEtSousCategorie = ["sacs", "Sacdos"];
            } else if (/presse cafe/.test(heading)) {
                categorieEtSousCategorie = ["accessoires", "cafpr"];
            } else if (/parfums/.test(heading)) {
                categorieEtSousCategorie = ["accessoires", "ptarfum"];
            } else if (/tissus brodes/.test(heading)) {
                categorieEtSousCategorie = ["tissus", "tisbrod"];
            } else if (/tissus cousus/.test(heading)) {
                categorieEtSousCategorie = ["tissus", "Tissus_Cousus"];
            } else if (/bazin/.test(heading)) {
                categorieEtSousCategorie = ["tissus", "bazin"];
            } else if (/tissus/.test(heading)) {
                categorieEtSousCategorie = ["tissus", "ptissu"];
            } else if (/lacoste/.test(heading)) {
                categorieEtSousCategorie = ["vetements", /lacoste1/.test(heading) ? "lacostao" : "lacost"];
            } else if (/chemise/.test(heading)) {
                categorieEtSousCategorie = ["vetements", "chem"];
            } else if (/maillots/.test(heading)) {
                categorieEtSousCategorie = ["vetements", "mailltot"];
            } else if (/survetements/.test(heading)) {
                categorieEtSousCategorie = ["vetements", "survetus"];
            } else if (/veste/.test(heading)) {
                categorieEtSousCategorie = ["vetements", "vesth"];
            }
        }

        const categorie = categorieEtSousCategorie ? categorieEtSousCategorie[0] : "";
        const sousCategorie = categorieEtSousCategorie ? categorieEtSousCategorie[1] : "";

        carte.dataset.categoriePrincipale = categorie;
        carte.dataset.sousCategorie = sousCategorie;
        return categorie;
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

                    sousCategorie:
                        carte.dataset.sousCategorie ||
                        "",

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

        let produits =
            [...catalogue.values()];

        if (filtreCategorie) {
            produits = produits.filter(function (produit) {
                if (filtreSousCategorie) {
                    return produit.sousCategorie === filtreSousCategorie;
                }
                return produit.categorie === filtreCategorie;
            });
        }

        if (filtreRecherche) {
            produits = produits.filter(function (produit) {
                return texteRechercheProduit(produit).includes(filtreRecherche);
            });
        }


        const statistiques =
            LumesysComportement
                .obtenirStatistiques();

        const preferences =
            LumesysComportement.obtenirPreferences();

        let classes =
            LumesysScore.classerProduits(
                produits,
                statistiques
            );

        classes = classes.map(function (produit) {
            const texte = texteRechercheProduit(produit);
            const clesCategories = [
                produit.categorie,
                produit.sousCategorie
            ].map(function (value) {
                return String(value || "").toLowerCase().replace(/\s+/g, "");
            });
            let bonus = 0;

            clesCategories.forEach(function (cle) {
                bonus += Math.min((preferences.categories[cle] || 0) * 8, 24);
            });
            preferences.favoris.forEach(function (favori) {
                if (favori.produit === produit.cle) {
                    bonus += 30;
                } else if (favori.categorie && clesCategories.indexOf(favori.categorie) >= 0) {
                    bonus += 10;
                }
            });
            preferences.recherches.forEach(function (recherche) {
                if (recherche.terme && texte.indexOf(recherche.terme) >= 0) {
                    bonus += Math.min(recherche.nombre * 3, 9);
                }
            });

            return { ...produit, score: produit.score + bonus };
        });


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

        nombreProduitsCategorie =
            filtreCategorie || filtreRecherche
                ? dejaPris.size
                : 0;

        if (filtreCategorie) {
            [...catalogue.values()]
                .filter(function (produit) {
                    return produit.categorie !== filtreCategorie;
                })
                .sort(function (a, b) {
                    return (b.score || 0) - (a.score || 0);
                })
                .forEach(function (produit) {
                    if (resultat.length >= CONFIG.nombreProduitsMaximum) {
                        return;
                    }
                    if (!dejaPris.has(produit.cle)) {
                        resultat.push(produit);
                        dejaPris.add(produit.cle);
                    }
                });
        }

        /*
         * Limite absolue.
         */

        reserve =
            resultat.slice(
                0,
                CONFIG.nombreProduitsMaximum
            );
    }


    function texteRechercheProduit(produit) {
        const categories = window.CATEGORIES_LUMESYS || [];
        const categorie = categories.find(function (item) {
            return item.id === produit.categorie;
        });
        const sousCategorie = categorie && categorie.subs.find(function (item) {
            return item.id === produit.sousCategorie;
        });
        return [
            produit.nom,
            produit.carte.textContent,
            categorie ? categorie.label : "",
            sousCategorie ? sousCategorie.label : ""
        ].join(" ").toLowerCase();
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

        carte.dataset.sousCategorie =
            produit.sousCategorie ||
            "";


        carte.dataset.fichier =
            produit.fichier;


        carte.dataset.score =
            String(
                produit.score || 0
            );


        carte.dataset.recommandation =
            "true";

        const favori = document.createElement("button");
        const estFavori = LumesysComportement.estFavori(produit.nom);
        favori.type = "button";
        favori.className = "lumesys-favorite";
        favori.setAttribute("aria-pressed", String(estFavori));
        favori.setAttribute(
            "aria-label",
            estFavori ? "Retirer des favoris" : "Ajouter aux favoris"
        );
        favori.textContent = estFavori ? "♥" : "♡";
        (carte.querySelector(".ccard") || carte).appendChild(favori);

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

    function reinitialiserAffichage() {
        container.replaceChildren();
        produitsAffiches =
            new Set();
        positionAffichage =
            0;
        reserve =
            [];
        messageSuggestionsAffiche =
            false;
        fin.style.display =
            "none";
        construireReserve();
        afficherProchainesCartes();
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
            if (
                filtreCategorie &&
                positionAffichage >= nombreProduitsCategorie &&
                !messageSuggestionsAffiche
            ) {
                const message = document.createElement("div");
                message.className = "lumesys-category-exhausted";
                message.textContent = nombreProduitsCategorie
                    ? "Vous avez découvert tous les produits de cette catégorie. Découvrez maintenant d'autres articles qui pourraient vous intéresser."
                    : "Aucun produit de cette catégorie n'a été trouvé. Découvrez ces autres articles qui pourraient vous intéresser.";
                container.appendChild(message);
                messageSuggestionsAffiche = true;
            }

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

        const sousCategoriesDisponibles = new Set(
            [...catalogue.values()].map(function (produit) {
                return produit.sousCategorie;
            }).filter(Boolean)
        );
        const categoriesDisponibles = (window.CATEGORIES_LUMESYS || [])
            .map(function (categorie) {
                const sousCategories = categorie.subs.filter(function (sousCategorie) {
                    return sousCategoriesDisponibles.has(sousCategorie.id);
                });
                return sousCategories.length
                    ? { id: categorie.id, label: categorie.label, subs: sousCategories }
                    : null;
            })
            .filter(Boolean);
        document.dispatchEvent(new CustomEvent("lumesys-categories-disponibles", {
            detail: { categories: categoriesDisponibles }
        }));

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


    document.addEventListener(
        "lumesys-category",
        function (event) {
            filtreCategorie =
                event.detail.category || null;
            filtreSousCategorie =
                event.detail.subcategory || null;
            filtreRecherche =
                "";
            if (event.detail.category) {
                LumesysComportement.enregistrerCategorie(event.detail.category);
            }
            if (event.detail.subcategory) {
                LumesysComportement.enregistrerCategorie(event.detail.subcategory);
            }
            reinitialiserAffichage();
        }
    );


    document.addEventListener(
        "lumesys-search",
        function (event) {
            filtreRecherche =
                event.detail.query || "";
            filtreCategorie =
                null;
            filtreSousCategorie =
                null;
            if (event.detail.commit && filtreRecherche) {
                LumesysComportement.enregistrerRecherche(filtreRecherche);
            }
            reinitialiserAffichage();
        }
    );


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


        construireReserve();

        reserve = reserve.filter(function (produit) {
            return !produitsAffiches.has(produit.cle);
        });
        nombreProduitsCategorie = filtreCategorie
            ? reserve.filter(function (produit) {
                if (filtreSousCategorie) {
                    return produit.sousCategorie === filtreSousCategorie;
                }
                return produit.categorie === filtreCategorie;
            }).length
            : 0;
        positionAffichage = 0;
        messageSuggestionsAffiche = Boolean(
            container.querySelector(".lumesys-category-exhausted")
        );
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
        },

        filtrerCategorie: function (categorie, sousCategorie) {
            filtreCategorie = categorie || null;
            filtreSousCategorie = sousCategorie || null;
            filtreRecherche = "";
            reinitialiserAffichage();
        },

        rechercher: function (requete) {
            filtreRecherche = String(requete || "").trim().toLowerCase();
            filtreCategorie = null;
            filtreSousCategorie = null;
            reinitialiserAffichage();
        }

    };

})();
