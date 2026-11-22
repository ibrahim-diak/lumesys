/* ============================================================
   LUMESYS
   CACHE DES PRODUITS ET DES FICHIERS
   ============================================================ */

(function () {

    "use strict";

    const CONFIG = {

        nombreGroupes: 13,

        maximumPartiesParGroupe: 30,

        dureeCacheFichier: 1000 * 60 * 60 * 6,

        cleCacheLocal: "lumesys_fichiers_cache_v2",

        cleEmplacements: "lumesys_emplacements_v2"
    };


    /* ========================================================
       CACHE MÉMOIRE
       ======================================================== */

    const fichiersMemoire = new Map();

    const emplacementsMemoire = new Map();


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

    async function chargerFichier(nomFichier) {

        if (fichiersMemoire.has(nomFichier)) {

            return fichiersMemoire.get(nomFichier);
        }


        try {

            const reponse = await fetch(
                nomFichier,
                {
                    cache: "default"
                }
            );


            if (!reponse.ok) {

                return null;
            }


            const texte = await reponse.text();


            fichiersMemoire.set(
                nomFichier,
                texte
            );


            return texte;

        } catch (erreur) {

            console.warn(
                "Impossible de charger :",
                nomFichier
            );

            return null;
        }
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

        const fichiers = [];


        for (
            let groupe = 1;
            groupe <= CONFIG.nombreGroupes;
            groupe++
        ) {

            for (
                let partie = 1;
                partie <= CONFIG.maximumPartiesParGroupe;
                partie++
            ) {

                fichiers.push(
                    construireNomFichier(
                        groupe,
                        partie
                    )
                );
            }
        }


        return fichiers;
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

        const cle =
            normaliserProduit(produit);


        emplacementsMemoire.set(
            cle,
            fichier
        );


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

        emplacementsMemoire

    };

})();