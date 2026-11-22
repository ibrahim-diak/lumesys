/* ============================================================
   LUMESYS
   VARIATION HORAIRE DES RECOMMANDATIONS
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       OBTENIR LE CRÉNEAU HORAIRE
       ======================================================== */

    function obtenirCreneauHoraire() {

        const maintenant =
            new Date();


        return [

            maintenant.getFullYear(),

            maintenant.getMonth() + 1,

            maintenant.getDate(),

            maintenant.getHours()

        ].join("-");
    }


    /* ========================================================
       IDENTIFIANT VISITEUR
       ======================================================== */

    function obtenirIdentifiantVisiteur() {

        const CLE =
            "lumesys_visitor_id";


        let id =
            localStorage.getItem(
                CLE
            );


        if (!id) {

            id =
                crypto.randomUUID
                    ? crypto.randomUUID()
                    : (
                        Date.now() +
                        "-" +
                        Math.random()
                    );


            localStorage.setItem(
                CLE,
                id
            );
        }


        return id;
    }


    /* ========================================================
       HASH
       ======================================================== */

    function hash(texte) {

        let h = 2166136261;


        for (
            let i = 0;
            i < texte.length;
            i++
        ) {

            h ^= texte.charCodeAt(i);

            h +=
                (h << 1) +
                (h << 4) +
                (h << 7) +
                (h << 8) +
                (h << 24);
        }


        return Math.abs(h >>> 0);
    }


    /* ========================================================
       GÉNÉRATEUR PSEUDO-ALÉATOIRE
       ======================================================== */

    function aleatoireGraine(graine) {

        let valeur =
            hash(graine);


        return function () {

            valeur +=
                0x6D2B79F5;


            let t =
                valeur;


            t =
                Math.imul(
                    t ^ (t >>> 15),
                    t | 1
                );


            t ^=
                t +
                Math.imul(
                    t ^ (t >>> 7),
                    t | 61
                );


            return (
                (
                    (
                        t ^
                        (t >>> 14)
                    ) >>> 0
                ) /
                4294967296
            );
        };
    }


    /* ========================================================
       MÉLANGER
       ======================================================== */

    function melanger(
        tableau,
        graine
    ) {

        const resultat =
            tableau.slice();


        const random =
            aleatoireGraine(
                graine
            );


        for (
            let i =
                resultat.length - 1;
            i > 0;
            i--
        ) {

            const j =
                Math.floor(
                    random() *
                    (i + 1)
                );


            [
                resultat[i],
                resultat[j]
            ] =
            [
                resultat[j],
                resultat[i]
            ];
        }


        return resultat;
    }


    /* ========================================================
       VARIATION HORAIRE
       ======================================================== */

    function appliquerVariation(
        produits
    ) {

        const heure =
            obtenirCreneauHoraire();


        const visiteur =
            obtenirIdentifiantVisiteur();


        const graine =
            visiteur +
            "|" +
            heure;


        return melanger(
            produits,
            graine
        );
    }


    /* ========================================================
       CLÉ HORAIRE
       ======================================================== */

    function obtenirCleHoraire() {

        return (
            obtenirCreneauHoraire()
        );
    }


    /* ========================================================
       API
       ======================================================== */

    window.LumesysVariation = {

        appliquerVariation,

        obtenirCleHoraire,

        obtenirIdentifiantVisiteur

    };

})();