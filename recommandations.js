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

    const statutCatalogue =
        document.getElementById(
            "recommandations-status"
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

    let catalogue =
        new Map();

    const emplacementsEnAttente = new Map();

    const fichiersAnalyses =
        new Set();


    const fichiersExistants =
        new Set();


    let produitsAffiches =
        new Set();


    let reserve = [];

    let reserveHistorique = [];

    let positionHistorique = 0;

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

    let actualisationEnCours = null;

    let fichiersCatalogueCourants = [];

    let catalogueInitialise = false;

    let tentativeCatalogueAReprendre = false;


    let chargementEnCours = false;


    let recalculNecessaire = false;


    let dernierRecalcul = 0;


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
            tapfem: ["accessoires", "tapfem"],
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
            } else if (dossier === "tapfem" || dossier === "tappettes") {
                categorieEtSousCategorie = ["accessoires", "tapfem"];
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
            } else if (/tappettes/.test(heading)) {
                categorieEtSousCategorie = ["accessoires", "tapfem"];
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


    function extrairePrix(carte) {
        const candidats = Array.from(carte.querySelectorAll("p span, p.pprix"))
            .filter(function (element) {
                const texte = element.textContent.trim();
                const style = element.getAttribute("style") || "";
                return /(?:FCFA|F\s*CFA|CFA)/i.test(texte)
                    && !/r[eé]duction/i.test(texte)
                    && !/line-through/i.test(style);
            });
        const texte = candidats.length
            ? candidats[candidats.length - 1].textContent
            : "";
        const correspondance = texte.match(/(\d[\d\s.,]*)\s*(?:FCFA|F\s*CFA|CFA)/i);
        if (!correspondance) {
            return null;
        }
        const montant = Number(correspondance[1].replace(/[^\d]/g, ""));
        return Number.isSafeInteger(montant) && montant > 0 ? montant : null;
    }

    /* ========================================================
       EXTRAIRE LES CARTES
       ======================================================== */

    function extraireCartes(
        documentHTML,
        fichier,
        catalogueCible
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

                if (catalogueCible.has(cle)) {

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

                    prix:
                        extrairePrix(carte),

                    sousCategorie:
                        carte.dataset.sousCategorie ||
                        "",

                    carte,

                    nouveau:
                        false,

                    score: 0

                };


                catalogueCible.set(
                    cle,
                    produit
                );

                emplacementsEnAttente.set(nom, fichier);
            }
        );
    }


    /* ========================================================
       CHARGER UN FICHIER
       ======================================================== */

    async function analyserFichier(
        fichier,
        catalogueCible,
        analysesCible,
        fichiersValidesCible
    ) {

        if (analysesCible.has(fichier)) {
            return fichiersValidesCible.has(fichier);
        }

        analysesCible.add(fichier);


        const texte = await LumesysCache.chargerFichier(fichier);


        if (!texte) {
            analysesCible.delete(fichier);
            return false;
        }


        fichiersValidesCible.add(fichier);


        const documentHTML =
            parserHTML(
                texte
            );


        extraireCartes(
            documentHTML,
            fichier,
            catalogueCible
        );

        return true;
    }


    /* ========================================================
       ANALYSE DES FICHIERS PAR LOTS
       ======================================================== */

    async function analyserCatalogue(
        fichiers,
        catalogueCible
    ) {

        if (analyseEnCours) {

            return false;
        }

        const cible = catalogueCible || catalogue;
        const analyses = cible === catalogue
            ? fichiersAnalyses
            : new Set();
        const fichiersValides = cible === catalogue
            ? fichiersExistants
            : new Set();
        let analyseComplete = true;

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


                const resultats = await Promise.all(
                    lot.map(
                        fichier =>
                            analyserFichier(
                                fichier,
                                cible,
                                analyses,
                                fichiersValides
                            )
                    )
                );

                if (resultats.some(function (resultat) {
                    return !resultat;
                })) {
                    analyseComplete = false;
                }


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

            if (emplacementsEnAttente.size) {
                LumesysCache.enregistrerEmplacements(
                    Array.from(emplacementsEnAttente.entries())
                );
                emplacementsEnAttente.clear();
            }

            analyseEnCours =
                false;
        }

        return analyseComplete;
    }


    function identifiantProduit(produit) {
        return String(produit.id || produit.cle || "");
    }


    function diversifierParCategorie(produits, prioriserAnciennete) {
        const restants = produits.slice();
        const resultat = [];
        const comptes = new Map();
        const positions = new Map(produits.map(function (produit, index) {
            return [produit, index];
        }));

        while (restants.length) {
            let meilleurIndex = 0;
            let meilleurScore = -Infinity;

            restants.forEach(function (produit, index) {
                const categorie = String(
                    produit.categorie || produit.sousCategorie || "autres"
                ).toLowerCase();
                const nombreDejaChoisi = comptes.get(categorie) || 0;
                const score = prioriserAnciennete
                    ? -positions.get(produit) - nombreDejaChoisi * 2
                    : (Number(produit.score) || 0) - nombreDejaChoisi * 12;

                if (score > meilleurScore) {
                    meilleurScore = score;
                    meilleurIndex = index;
                }
            });

            const produit = restants.splice(meilleurIndex, 1)[0];
            const categorie = String(
                produit.categorie || produit.sousCategorie || "autres"
            ).toLowerCase();
            comptes.set(categorie, (comptes.get(categorie) || 0) + 1);
            resultat.push(produit);
        }

        return resultat;
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
         * Variation déterministe selon le visiteur.
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

        const produitsClasses =
            resultat.slice(0, CONFIG.nombreProduitsMaximum);

        if (filtreCategorie || filtreRecherche) {
            reserve = produitsClasses;
            return;
        }

        const historique = window.LumesysComportement &&
            typeof window.LumesysComportement.obtenirHistoriqueVues === "function"
            ? window.LumesysComportement.obtenirHistoriqueVues()
            : [];
        const datesVues = new Map(
            historique.map(function (vue) {
                return [String(vue.id), Number(vue.viewedAt) || 0];
            })
        );
        const produitsNonVus = [];
        const produitsVus = [];

        produitsClasses.forEach(function (produit) {
            if (datesVues.has(identifiantProduit(produit))) {
                produitsVus.push(produit);
            } else {
                produitsNonVus.push(produit);
            }
        });

        produitsVus.sort(function (a, b) {
            return datesVues.get(identifiantProduit(a)) -
                datesVues.get(identifiantProduit(b));
        });

        reserve = diversifierParCategorie(produitsNonVus).concat(
            diversifierParCategorie(produitsVus, true)
        ).slice(0, CONFIG.nombreProduitsMaximum);
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

    function creerIconeAction(type) {
        const espaceSVG = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(espaceSVG, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("class", "market-action-icon");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");

        const forme = document.createElementNS(espaceSVG, "path");
        forme.setAttribute(
            "d",
            type === "eye"
                ? "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                : type === "phone"
                    ? "M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"
                    : "M3 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.9-1.4L22 7H6"
        );
        svg.appendChild(forme);

        if (type === "eye") {
            const pupil = document.createElementNS(espaceSVG, "circle");
            pupil.setAttribute("cx", "12");
            pupil.setAttribute("cy", "12");
            pupil.setAttribute("r", "3");
            svg.appendChild(pupil);
        } else if (type === "cart") {
            ["10", "18"].forEach(function (x) {
                const roue = document.createElementNS(espaceSVG, "circle");
                roue.setAttribute("cx", x);
                roue.setAttribute("cy", "20");
                roue.setAttribute("r", "1.5");
                svg.appendChild(roue);
            });
        }

        svg.querySelectorAll("path, circle").forEach(function (element) {
            element.setAttribute("fill", "none");
            element.setAttribute("stroke", "currentColor");
            element.setAttribute("stroke-width", "1.8");
            element.setAttribute("stroke-linecap", "round");
            element.setAttribute("stroke-linejoin", "round");
        });

        return svg;
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

        carte.querySelectorAll('a[href*="wa.me/"]').forEach(function (lien) {
            const destination = new URL(lien.href, window.location.href);
            if (destination.hostname.toLowerCase() === "wa.me") {
                destination.pathname = "/22362002473";
                lien.href = destination.href;
            }
        });


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

        carte.dataset.produitId =
            produit.id ||
            produit.cle;

        carte.dataset.prix =
            String(produit.prix || extrairePrix(carte) || "");

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

        const image = carte.querySelector("img");
        carte.querySelectorAll("img").forEach(function (imageProduit) {
            imageProduit.loading = "lazy";
            imageProduit.decoding = "async";
        });
        if (image) {
            carte.dataset.image = image.getAttribute("src") || "";
            carte.dataset.imageDetail = produit.imageDetail ||
                (image.getAttribute("src") || "").replace(/(^|\/)tn_/, "$1");
        }

        const actions = document.createElement("div");
        actions.className = "market-card-actions";

        const acheter = carte.querySelector(".bouton");
        if (acheter) {
            actions.appendChild(acheter);
        }

        const favori = document.createElement("button");
        const estFavori = window.LumesysCommerce
            ? window.LumesysCommerce.isFavorite(produit.id || produit.cle)
            : LumesysComportement.estFavori(produit.nom);
        favori.type = "button";
        favori.className = "lumesys-favorite";
        favori.dataset.productId = produit.id || produit.cle;
        favori.setAttribute("aria-pressed", String(estFavori));
        favori.setAttribute(
            "aria-label",
            estFavori ? "Retirer des favoris" : "Ajouter aux favoris"
        );
        favori.textContent = estFavori ? "♥" : "♡";

        const details = document.createElement("button");
        details.type = "button";
        details.className = "market-card-icon-button lumesys-product-details";
        details.dataset.productId = produit.id || produit.cle;
        details.setAttribute("aria-label", "Voir les détails de " + produit.nom);
        details.dataset.tooltip = "Voir les détails";
        details.title = "Voir les détails du produit";
        details.appendChild(creerIconeAction("eye"));

        const panier = document.createElement("button");
        panier.type = "button";
        panier.className = "market-card-icon-button lumesys-cart-add";
        panier.dataset.productId = produit.id || produit.cle;
        panier.setAttribute("aria-label", "Ajouter " + produit.nom + " au panier");
        panier.dataset.tooltip = "Ajouter au panier";
        panier.title = "Ajouter au panier";
        panier.appendChild(creerIconeAction("cart"));
        if (!carte.dataset.prix) {
            panier.disabled = true;
            panier.title = "Prix indisponible pour cet article";
            panier.dataset.tooltip = "Prix indisponible";
        }

        const appel = document.createElement("a");
        appel.href = "tel:+22376856631";
        appel.className = "market-card-icon-button market-phone-action";
        appel.setAttribute("aria-label", "Appeler le vendeur au +223 76 85 66 31");
        appel.dataset.tooltip = "Appeler le vendeur";
        appel.title = "Appeler le vendeur";
        appel.appendChild(creerIconeAction("phone"));

        actions.appendChild(details);
        actions.appendChild(panier);
        actions.appendChild(appel);
        actions.appendChild(favori);
        (carte.querySelector(".ccard") || carte).appendChild(actions);

        return carte;
    }

    function rendreHistoriqueVues(reinitialiser) {
        const route = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
        if (route !== "historique") {
            return;
        }

        const conteneur = document.getElementById("history-products");
        const vide = document.getElementById("history-empty");
        const statut = document.getElementById("history-status");
        const boutonPlus = document.getElementById("history-more");
        if (!conteneur || !vide || !statut || !boutonPlus) {
            return;
        }

        if (!catalogue.size) {
            conteneur.replaceChildren();
            vide.hidden = false;
            vide.textContent = "Le catalogue est en cours de chargement.";
            statut.textContent = "";
            boutonPlus.hidden = true;
            return;
        }

        const historique = window.LumesysComportement &&
            typeof window.LumesysComportement.obtenirHistoriqueVues === "function"
            ? window.LumesysComportement.obtenirHistoriqueVues()
            : [];
        const produitsParId = new Map();
        catalogue.forEach(function (produit) {
            produitsParId.set(identifiantProduit(produit), produit);
        });

        if (reinitialiser) {
            reserveHistorique = historique
                .slice()
                .sort(function (a, b) {
                    return Number(b.viewedAt) - Number(a.viewedAt);
                })
                .map(function (vue) {
                    return produitsParId.get(String(vue.id));
                })
                .filter(Boolean);
            positionHistorique = 0;
            conteneur.replaceChildren();
        }

        const prochainIndex = Math.min(
            positionHistorique + CONFIG.produitsParAffichage,
            reserveHistorique.length
        );
        const fragment = document.createDocumentFragment();
        reserveHistorique.slice(positionHistorique, prochainIndex).forEach(function (produit) {
            fragment.appendChild(clonerCarte(produit));
        });
        conteneur.appendChild(fragment);
        positionHistorique = prochainIndex;

        const indisponibles = historique.length - reserveHistorique.length;
        statut.textContent = reserveHistorique.length
            ? reserveHistorique.length + " produit(s) consulté(s) disponible(s)." +
                (indisponibles ? " " + indisponibles + " produit(s) ne figurent plus au catalogue." : "")
            : "";
        vide.hidden = reserveHistorique.length > 0;
        vide.textContent = historique.length
            ? "Aucun des produits consultés n’est actuellement disponible dans le catalogue."
            : "Aucun produit consulté n’est enregistré sur cet appareil.";
        boutonPlus.hidden = positionHistorique >= reserveHistorique.length;
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


    function ajouterNouveauxProduits() {
        const articles = [
            {
                titre: "Chaussure",
                prix: 25000,
                categorie: "chaussures",
                sousCategorie: "Chosse",
                dossier: "Articles/chaussure1",
                images: [
                    "tn_IMG-20261123-WA0000.jpg",
                    "tn_IMG-20261123-WA0001.jpg",
                    "tn_IMG-20261123-WA0002.jpg",
                    "tn_IMG-20261123-WA0003.jpg",
                    "tn_IMG-20261123-WA0004.jpg",
                    "tn_IMG-20261123-WA0005.jpg",
                    "tn_IMG-20261123-WA0006.jpg",
                    "tn_IMG-20261123-WA0018.jpg",
                    "tn_IMG-20261123-WA0019.jpg",
                    "tn_IMG-20261123-WA0020.jpg",
                    "tn_IMG-20261123-WA0021.jpg",
                    "tn_IMG-20261123-WA0022.jpg",
                    "tn_IMG-20261123-WA0023.jpg",
                    "tn_IMG-20261123-WA0024.jpg",
                    "tn_IMG-20261123-WA0025.jpg"
                ]
            },
            {
                titre: "Costume",
                prix: 45000,
                categorie: "vetements",
                sousCategorie: "costumes",
                dossier: "Articles/costume",
                images: [
                    "tn_IMG-20261123-WA0007.jpg",
                    "tn_IMG-20261123-WA0008.jpg",
                    "tn_IMG-20261123-WA0009.jpg",
                    "tn_IMG-20261123-WA0010.jpg",
                    "tn_IMG-20261123-WA0011.jpg",
                    "tn_IMG-20261123-WA0012.jpg",
                    "tn_IMG-20261123-WA0013.jpg",
                    "tn_IMG-20261123-WA0014.jpg",
                    "tn_IMG-20261123-WA0015.jpg",
                    "tn_IMG-20261123-WA0016.jpg",
                    "tn_IMG-20261123-WA0017.jpg"
                ]
            }
        ];

        articles.forEach(function (article) {
            article.images.forEach(function (fichier, index) {
                const nom = article.titre + " " + String(index + 1).padStart(2, "0");
                const cle = LumesysCache.normaliserProduit(nom);
                if (catalogue.has(cle)) {
                    return;
                }

                const image = article.dossier + "/" + fichier;
                const imageDetail = image.replace(/(^|\/)tn_/, "$1");
                const carte = document.createElement("div");
                carte.className = "bcard";
                const contenu = document.createElement("div");
                contenu.className = "ccard";
                contenu.classList.add(
                    index % 3 === 0
                        ? "lumesys-large-image-card"
                        : index % 3 === 1
                            ? "lumesys-square-card"
                            : "lumesys-classic-card"
                );
                const lienImage = document.createElement("a");
                lienImage.href = "#product-details";
                lienImage.dataset.productDetail = "true";
                const photo = document.createElement("img");
                photo.className = "product-image";
                photo.src = image;
                photo.alt = nom;
                photo.loading = "lazy";
                lienImage.appendChild(photo);
                const titre = document.createElement("h3");
                titre.textContent = nom;
                const prix = document.createElement("p");
                prix.className = "pprix";
                prix.textContent = article.prix.toLocaleString("fr-FR") + " FCFA";
                const acheter = document.createElement("a");
                acheter.className = "bouton";
                acheter.href = "https://wa.me/22362002473?text=" + encodeURIComponent("Je souhaite acheter " + nom);
                acheter.target = "_blank";
                acheter.rel = "noopener noreferrer";
                acheter.textContent = "Acheter";
                contenu.appendChild(lienImage);
                contenu.appendChild(titre);
                contenu.appendChild(prix);
                contenu.appendChild(acheter);
                carte.appendChild(contenu);
                carte.dataset.prix = String(article.prix);
                carte.dataset.imageDetail = imageDetail;

                catalogue.set(cle, {
                    cle: cle,
                    id: article.dossier + "/" + fichier.replace(/^tn_/, ""),
                    nom: nom,
                    fichier: article.dossier,
                    categorie: article.categorie,
                    sousCategorie: article.sousCategorie,
                    prix: article.prix,
                    imageDetail: imageDetail,
                    carte: carte,
                    nouveau: true,
                    score: 0
                });
            });
        });
    }

    function publierCategoriesDisponibles() {
        const sousCategoriesDisponibles = new Set(
            Array.from(catalogue.values()).map(function (produit) {
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
    }


    function afficherStatutCatalogue(message, estPerime) {
        if (!statutCatalogue) {
            return;
        }

        statutCatalogue.textContent = message || "";
        statutCatalogue.hidden = !message;
        statutCatalogue.classList.toggle("is-stale", Boolean(estPerime));
    }


    function creerSignatureCatalogue(produits) {
        return Array.from(produits.values()).filter(function (produit) {
            return !produit.nouveau;
        }).map(function (produit) {
            return JSON.stringify([
                produit.id || produit.cle,
                produit.nom,
                produit.prix,
                produit.categorie,
                produit.sousCategorie,
                produit.fichier,
                produit.imageDetail || "",
                produit.carte ? produit.carte.outerHTML : ""
            ]);
        }).sort().join("\n");
    }


    async function actualiserCatalogue(fichiers) {
        if (actualisationEnCours) {
            return actualisationEnCours;
        }

        const memoireAvantActualisation = new Map(LumesysCache.fichiersMemoire);
        const catalogueAvantActualisation = catalogue;
        const signatureAvantActualisation =
            creerSignatureCatalogue(catalogueAvantActualisation);

        actualisationEnCours = (async function () {
            afficherStatutCatalogue("Vérification des mises à jour du catalogue…", true);

            try {
                const pages = await LumesysCache.revaliderCatalogue(fichiers);
                const catalogueActualise = new Map();
                LumesysCache.chargerCatalogueEnMemoire(pages, fichiers);

                const analyseComplete = await analyserCatalogue(
                    fichiers,
                    catalogueActualise
                );

                if (!analyseComplete || catalogueActualise.size === 0) {
                    throw new Error("Le catalogue téléchargé n’a pas pu être analysé intégralement.");
                }

                const catalogueModifie =
                    signatureAvantActualisation !==
                    creerSignatureCatalogue(catalogueActualise);

                if (catalogueModifie) {
                    catalogue = catalogueActualise;
                    fichiersAnalyses.clear();
                    fichiersExistants.clear();
                    fichiers.forEach(function (fichier) {
                        fichiersAnalyses.add(fichier);
                        fichiersExistants.add(fichier);
                    });
                    ajouterNouveauxProduits();
                    publierCategoriesDisponibles();
                    reinitialiserAffichage();
                }

                tentativeCatalogueAReprendre = false;

                try {
                    await LumesysCache.sauvegarderCataloguePersistant(pages);
                    afficherStatutCatalogue(
                        catalogueModifie
                            ? "Catalogue mis à jour."
                            : "Catalogue à jour.",
                        false
                    );
                } catch (erreurCache) {
                    console.warn("Lumesys : impossible de mettre à jour le cache local du catalogue.", erreurCache);
                    afficherStatutCatalogue(
                        "Catalogue à jour, mais le cache local n’a pas pu être actualisé.",
                        true
                    );
                }

                rendreHistoriqueVues(true);
                return true;
            } catch (erreur) {
                LumesysCache.fichiersMemoire.clear();
                memoireAvantActualisation.forEach(function (texte, fichier) {
                    LumesysCache.fichiersMemoire.set(fichier, texte);
                });

                tentativeCatalogueAReprendre = true;
                console.warn("Lumesys : la synchronisation du catalogue a échoué.", erreur);
                afficherStatutCatalogue(
                    navigator.onLine
                        ? "Synchronisation impossible; le catalogue affiché est conservé."
                        : "Hors connexion; le dernier catalogue disponible est conservé.",
                    true
                );
                return false;
            }
        })();

        try {
            return await actualisationEnCours;
        } finally {
            actualisationEnCours = null;
        }
    }


    /* ========================================================
       PRÉPARATION DU CATALOGUE
       ======================================================== */

    async function preparer500() {
        loading.style.display = "block";

        const fichiers = LumesysCache.obtenirListeFichiers();
        fichiersCatalogueCourants = fichiers;

        let catalogueEnregistre = null;
        try {
            catalogueEnregistre = await LumesysCache.lireCataloguePersistant();
        } catch (erreurCache) {
            console.warn("Lumesys : impossible de lire le cache local du catalogue.", erreurCache);
        }

        const pagesEnregistrees =
            catalogueEnregistre && catalogueEnregistre.pages
                ? catalogueEnregistre.pages
                : null;
        const fichiersEnregistres = pagesEnregistrees
            ? fichiers.filter(function (fichier) {
                return typeof pagesEnregistrees[fichier] === "string";
            })
            : [];

        if (fichiersEnregistres.length) {
            LumesysCache.chargerCatalogueEnMemoire(
                pagesEnregistrees,
                fichiersEnregistres
            );
            await analyserCatalogue(fichiersEnregistres);
            ajouterNouveauxProduits();
            publierCategoriesDisponibles();
            construireReserve();
            loading.style.display = "none";
            afficherProchainesCartes();
            catalogueInitialise = true;
            rendreHistoriqueVues(true);
            afficherStatutCatalogue(
                "Catalogue local affiché; vérification des mises à jour en cours.",
                true
            );
            setTimeout(recalculerSiNecessaire, 100);
            actualiserCatalogue(fichiers);
            return;
        }

        const analyseComplete = await analyserCatalogue(fichiers);
        ajouterNouveauxProduits();
        publierCategoriesDisponibles();
        construireReserve();
        loading.style.display = "none";
        afficherProchainesCartes();
        catalogueInitialise = true;
        rendreHistoriqueVues(true);

        const pagesChargees = analyseComplete
            ? LumesysCache.obtenirPagesEnMemoire(fichiers)
            : null;

        if (pagesChargees) {
            try {
                await LumesysCache.sauvegarderCataloguePersistant(pagesChargees);
                afficherStatutCatalogue("Catalogue chargé et enregistré pour la prochaine visite.", false);
            } catch (erreurCache) {
                console.warn("Lumesys : impossible d’enregistrer le cache local du catalogue.", erreurCache);
                afficherStatutCatalogue("Catalogue chargé; le cache local n’a pas pu être enregistré.", true);
            }
        } else {
            tentativeCatalogueAReprendre = true;
            afficherStatutCatalogue(
                navigator.onLine
                    ? "Catalogue partiellement chargé; les produits disponibles sont affichés."
                    : "Hors connexion; aucun catalogue local complet n’est disponible.",
                true
            );
        }

        setTimeout(recalculerSiNecessaire, 100);
    }


    window.addEventListener("online", function () {
        if (catalogueInitialise && tentativeCatalogueAReprendre && fichiersCatalogueCourants.length) {
            actualiserCatalogue(fichiersCatalogueCourants);
        }
    });


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

    function actualiserRecommandationsApresSynchronisation() {
        if (
            catalogueInitialise &&
            !filtreCategorie &&
            !filtreRecherche
        ) {
            reinitialiserAffichage();
        }
        rendreHistoriqueVues(true);
    }

    document.addEventListener(
        "lumesys-view-history-scope-changed",
        actualiserRecommandationsApresSynchronisation
    );

    document.addEventListener(
        "lumesys-view-history-synced",
        actualiserRecommandationsApresSynchronisation
    );

    document.addEventListener(
        "lumesys-view-history-requested",
        function () {
            rendreHistoriqueVues(true);
        }
    );

    document.addEventListener(
        "lumesys-view-history-updated",
        function () {
            rendreHistoriqueVues(true);
        }
    );

    const boutonHistoriquePlus = document.getElementById("history-more");
    if (boutonHistoriquePlus) {
        boutonHistoriquePlus.addEventListener("click", function () {
            rendreHistoriqueVues(false);
        });
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

            preparer500().catch(function (erreur) {
                console.error("Lumesys : impossible de préparer le catalogue.", erreur);
                loading.style.display = "none";
                afficherStatutCatalogue(
                    "Le catalogue n’a pas pu être préparé. Réessayez après avoir vérifié votre connexion.",
                    true
                );
            });
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
