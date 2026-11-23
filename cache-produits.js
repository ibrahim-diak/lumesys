/* ============================================================
   LUMESYS
   CACHE DES PRODUITS ET DES FICHIERS
   ============================================================ */

(function () {

    "use strict";

    const CONFIG = {

        dureeCacheFichier: 1000 * 60 * 60 * 6,

        cleCacheLocal: "lumesys_fichiers_cache_v2",

        cleEmplacements: "lumesys_emplacements_v2",

        baseCatalogue: "lumesys_catalogue_public",

        versionBaseCatalogue: 1,

        magasinCatalogue: "snapshots",

        cleCatalogue: "pages"
    };

    const FICHIERS_CATALOGUE = [
        "Lume1_1.html",
        "Lume2_1.html",
        "Lume3_1.html",
        "Lume3_2.html",
        "Lume4_1.html",
        "Lume5_1.html",
        "Lume6_1.html",
        "Lume6_2.html",
        "Lume7_1.html",
        "Lume7_2.html",
        "Lume7_3.html",
        "Lume8_1.html",
        "Lume8_2.html",
        "Lume9_1.html",
        "Lume10_1.html",
        "Lume11_1.html",
        "Lume11_2.html",
        "Lume12_1.html",
        "Lume13_1.html",
        "Lume14_1.html"
    ];


    /* ========================================================
       CACHE MÉMOIRE
       ======================================================== */

    const fichiersMemoire = new Map();

    const emplacementsMemoire = new Map();

    let ouvertureBaseCatalogue = null;


    /* ========================================================
       NORMALISATION
       ======================================================== */

    function normaliserProduit(texte) {

        return String(texte || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "");
    }


    /* ========================================================
       NOM DE FICHIER
       ======================================================== */

    function construireNomFichier(groupe, partie) {

        return `Lume${groupe}_${partie}.html`;
    }


    /* ========================================================
       CHARGEMENT D'UN FICHIER
       ======================================================== */

    async function chargerFichier(nomFichier, options) {

        options = options || {};

        if (!options.revalider && fichiersMemoire.has(nomFichier)) {

            return fichiersMemoire.get(nomFichier);
        }

        try {

            const reponse = await fetch(
                nomFichier,
                {
                    cache: options.revalider
                        ? "no-cache"
                        : "default"
                }
            );


            if (!reponse.ok) {

                throw new Error(
                    "Réponse HTTP " + reponse.status + " pour " + nomFichier
                );
            }


            const texte = await reponse.text();


            fichiersMemoire.set(
                nomFichier,
                texte
            );


            return texte;

        } catch (erreur) {

            console.warn(
                "Lumesys : impossible de charger le fichier du catalogue " +
                    nomFichier + ".",
                erreur
            );

            if (options.revalider) {
                throw erreur;
            }

            return null;
        }
    }


    function ouvrirBaseCatalogue() {

        if (!window.indexedDB) {
            return Promise.reject(
                new Error("IndexedDB n’est pas disponible dans ce navigateur.")
            );
        }

        if (ouvertureBaseCatalogue) {
            return ouvertureBaseCatalogue;
        }

        ouvertureBaseCatalogue = new Promise(function (resolve, reject) {
            const requete = window.indexedDB.open(
                CONFIG.baseCatalogue,
                CONFIG.versionBaseCatalogue
            );

            requete.onupgradeneeded = function () {
                const base = requete.result;
                if (!base.objectStoreNames.contains(CONFIG.magasinCatalogue)) {
                    base.createObjectStore(
                        CONFIG.magasinCatalogue,
                        { keyPath: "cle" }
                    );
                }
            };

            requete.onsuccess = function () {
                resolve(requete.result);
            };

            requete.onerror = function () {
                reject(
                    requete.error ||
                    new Error("Impossible d’ouvrir le cache IndexedDB du catalogue.")
                );
            };

            requete.onblocked = function () {
                reject(
                    new Error("L’ouverture du cache IndexedDB est bloquée.")
                );
            };
        }).catch(function (erreur) {
            ouvertureBaseCatalogue = null;
            throw erreur;
        });

        return ouvertureBaseCatalogue;
    }


    function lireCataloguePersistant() {

        return ouvrirBaseCatalogue().then(function (base) {
            return new Promise(function (resolve, reject) {
                const transaction = base.transaction(
                    CONFIG.magasinCatalogue,
                    "readonly"
                );
                const requete = transaction
                    .objectStore(CONFIG.magasinCatalogue)
                    .get(CONFIG.cleCatalogue);

                requete.onsuccess = function () {
                    const resultat = requete.result;
                    resolve(
                        resultat &&
                        resultat.version === CONFIG.versionBaseCatalogue &&
                        resultat.pages &&
                        typeof resultat.pages === "object"
                            ? resultat
                            : null
                    );
                };

                requete.onerror = function () {
                    reject(
                        requete.error ||
                        new Error("Impossible de lire le cache du catalogue.")
                    );
                };

                transaction.onabort = function () {
                    reject(
                        transaction.error ||
                        new Error("Lecture du cache du catalogue interrompue.")
                    );
                };
            });
        });
    }


    function sauvegarderCataloguePersistant(pages) {

        const contenu = {};
        Object.keys(pages || {}).forEach(function (nomFichier) {
            if (typeof pages[nomFichier] === "string") {
                contenu[nomFichier] = pages[nomFichier];
            }
        });

        return ouvrirBaseCatalogue().then(function (base) {
            return new Promise(function (resolve, reject) {
                const transaction = base.transaction(
                    CONFIG.magasinCatalogue,
                    "readwrite"
                );

                transaction.objectStore(CONFIG.magasinCatalogue).put({
                    cle: CONFIG.cleCatalogue,
                    version: CONFIG.versionBaseCatalogue,
                    enregistreLe: Date.now(),
                    pages: contenu
                });

                transaction.oncomplete = function () {
                    resolve({
                        enregistreLe: Date.now(),
                        nombreFichiers: Object.keys(contenu).length
                    });
                };

                transaction.onerror = function () {
                    reject(
                        transaction.error ||
                        new Error("Impossible d’enregistrer le cache du catalogue.")
                    );
                };

                transaction.onabort = function () {
                    reject(
                        transaction.error ||
                        new Error("Enregistrement du cache du catalogue interrompu.")
                    );
                };
            });
        });
    }


    function chargerCatalogueEnMemoire(pages, fichiers) {

        fichiersMemoire.clear();

        (fichiers || Object.keys(pages || {})).forEach(function (nomFichier) {
            if (pages && typeof pages[nomFichier] === "string") {
                fichiersMemoire.set(nomFichier, pages[nomFichier]);
            }
        });
    }


    function obtenirPagesEnMemoire(fichiers) {

        const pages = {};
        let complet = true;

        fichiers.forEach(function (nomFichier) {
            if (!fichiersMemoire.has(nomFichier)) {
                complet = false;
                return;
            }
            pages[nomFichier] = fichiersMemoire.get(nomFichier);
        });

        return complet ? pages : null;
    }

    async function revaliderCatalogue(fichiers) {

        const pages = {};

        for (let index = 0; index < fichiers.length; index += 4) {
            const lot = fichiers.slice(index, index + 4);
            const resultats = await Promise.all(
                lot.map(function (nomFichier) {
                    return chargerFichier(nomFichier, { revalider: true }).then(
                        function (texte) {
                            return { texte: texte };
                        },
                        function (erreur) {
                            return { erreur: erreur };
                        }
                    );
                })
            );

            const fichierEnErreur = resultats.find(function (resultat) {
                return Boolean(resultat.erreur);
            });
            if (fichierEnErreur) {
                throw fichierEnErreur.erreur;
            }

            resultats.forEach(function (resultat, position) {
                pages[lot[position]] = resultat.texte;
            });

            if (index + 4 < fichiers.length) {
                await new Promise(function (resolve) {
                    window.setTimeout(resolve, 20);
                });
            }
        }

        return pages;
    }


    /* ========================================================
       CHARGEMENT EN ARRIÈRE-PLAN
       ======================================================== */

    function prechargerFichier(nomFichier) {

        if (fichiersMemoire.has(nomFichier)) {

            return;
        }


        chargerFichier(
            nomFichier
        );
    }


    /* ========================================================
       OBTENIR LES FICHIERS POSSIBLES
       ======================================================== */

    function obtenirListeFichiers() {
        return FICHIERS_CATALOGUE.slice();
    }


    /* ========================================================
       SAUVEGARDE DES EMPLACEMENTS
       ======================================================== */

    function sauvegarderEmplacements() {

        try {

            const objet = {};

            emplacementsMemoire.forEach(
                (fichier, produit) => {

                    objet[produit] = fichier;
                }
            );


            localStorage.setItem(
                CONFIG.cleEmplacements,
                JSON.stringify(objet)
            );

        } catch (erreur) {

            console.warn(
                "Impossible de sauvegarder le cache."
            );
        }
    }


    /* ========================================================
       CHARGEMENT DES EMPLACEMENTS
       ======================================================== */

    function chargerEmplacements() {

        try {

            const texte =
                localStorage.getItem(
                    CONFIG.cleEmplacements
                );


            if (!texte) {

                return;
            }


            const objet =
                JSON.parse(texte);


            Object.entries(objet).forEach(
                ([produit, fichier]) => {

                    emplacementsMemoire.set(
                        produit,
                        fichier
                    );
                }
            );

        } catch (erreur) {

            console.warn(
                "Cache des emplacements invalide."
            );
        }
    }


    /* ========================================================
       ENREGISTRER EMPLACEMENT
       ======================================================== */

    function enregistrerEmplacement(
        produit,
        fichier
    ) {

        enregistrerEmplacements([[produit, fichier]]);
    }


    function enregistrerEmplacements(emplacements) {

        emplacements.forEach(function (entree) {
            emplacementsMemoire.set(
                normaliserProduit(entree[0]),
                entree[1]
            );
        });

        sauvegarderEmplacements();
    }


    /* ========================================================
       OBTENIR EMPLACEMENT
       ======================================================== */

    function obtenirEmplacement(produit) {

        return emplacementsMemoire.get(
            normaliserProduit(produit)
        ) || null;
    }


    /* ========================================================
       INITIALISATION
       ======================================================== */

    chargerEmplacements();


    /* ========================================================
       API PUBLIQUE
       ======================================================== */

    window.LumesysCache = {

        chargerFichier,

        prechargerFichier,

        obtenirListeFichiers,

        construireNomFichier,

        normaliserProduit,

        enregistrerEmplacement,

        obtenirEmplacement,

        fichiersMemoire,

        emplacementsMemoire,

        lireCataloguePersistant,

        sauvegarderCataloguePersistant,

        chargerCatalogueEnMemoire,

        obtenirPagesEnMemoire,

        revaliderCatalogue,

        enregistrerEmplacements,

        dureeCacheFichier: CONFIG.dureeCacheFichier

    };

})();
