/* ============================================================
   LUMESYS
   MOTEUR DE SCORE
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       CALCUL DU SCORE
       ======================================================== */

    function calculerScore(
        produit,
        statistiques,
        options = {}
    ) {

        const nom =
            String(produit.nom || "")
                .toLowerCase();


        const cle =
            String(
                produit.cle ||
                nom
            )
            .toLowerCase();


        const data =
            statistiques[cle] || {

                clics: 0,

                temps: 0,

                vues: 0,

                categories: {}
            };


        /* ====================================================
           1. CLICS
           ==================================================== */

        const scoreClics =
            data.clics *
            12;


        /* ====================================================
           2. TEMPS PASSÉ
           ==================================================== */

        /*
         * Le temps est plafonné.
         *
         * Cela évite qu'un visiteur laisse une page
         * ouverte pendant plusieurs heures et donne
         * un score gigantesque à un seul produit.
         */

        const temps =
            Math.min(
                data.temps,
                300
            );


        const scoreTemps =
            temps *
            0.35;


        /* ====================================================
           3. VUES
           ==================================================== */

        const scoreVues =
            Math.min(
                data.vues,
                20
            ) *
            1.5;


        /* ====================================================
           4. CATÉGORIE FAVORITE
           ==================================================== */

        let scoreCategorie = 0;


        if (
            options.categorieFavorite &&
            produit.categorie
        ) {

            if (
                produit.categorie ===
                options.categorieFavorite
            ) {

                scoreCategorie =
                    20;
            }
        }


        /* ====================================================
           5. PROXIMITÉ
           ==================================================== */

        let scoreProximite = 0;


        if (
            options.produitsApprecies &&
            options.produitsApprecies.length
        ) {

            const produits =
                options.produitsApprecies;


            if (
                produits.includes(
                    produit.cle
                )
            ) {

                scoreProximite =
                    30;
            }


            /*
             * Même catégorie qu'un produit apprécié.
             */

            if (
                produit.categorie &&
                options.categoriesAppreciees &&
                options.categoriesAppreciees.has(
                    produit.categorie
                )
            ) {

                scoreProximite +=
                    15;
            }
        }


        /* ====================================================
           6. NOUVEAUTÉ
           ==================================================== */

        let scoreNouveaute = 0;


        if (
            produit.nouveau
        ) {

            scoreNouveaute =
                8;
        }


        /* ====================================================
           SCORE FINAL
           ==================================================== */

        return (

            scoreClics +

            scoreTemps +

            scoreVues +

            scoreCategorie +

            scoreProximite +

            scoreNouveaute

        );
    }


    /* ========================================================
       CATÉGORIE FAVORITE
       ======================================================== */

    function trouverCategorieFavorite(
        statistiques
    ) {

        const categories = {};


        Object.values(
            statistiques
        ).forEach(
            function (produit) {

                if (
                    !produit.categories
                ) {

                    return;
                }


                Object.entries(
                    produit.categories
                ).forEach(
                    function (
                        [
                            categorie,
                            valeur
                        ]
                    ) {

                        categories[categorie] =
                            (
                                categories[categorie] ||
                                0
                            ) +
                            valeur;
                    }
                );
            }
        );


        let meilleure =
            null;


        let score =
            0;


        Object.entries(
            categories
        ).forEach(
            function (
                [
                    categorie,
                    valeur
                ]
            ) {

                if (
                    valeur > score
                ) {

                    score =
                        valeur;


                    meilleure =
                        categorie;
                }
            }
        );


        return meilleure;
    }


    /* ========================================================
       PRODUITS APPRÉCIÉS
       ======================================================== */

    function obtenirProduitsApprecies(
        statistiques
    ) {

        return Object.entries(
            statistiques
        )
        .filter(
            function (
                [
                    ,
                    data
                ]
            ) {

                return (
                    data.clics >= 1 ||
                    data.temps >= 10
                );
            }
        )
        .sort(
            function (
                a,
                b
            ) {

                const scoreA =
                    a[1].clics * 12 +
                    a[1].temps * 0.35;


                const scoreB =
                    b[1].clics * 12 +
                    b[1].temps * 0.35;


                return scoreB - scoreA;
            }
        )
        .slice(
            0,
            30
        )
        .map(
            function (
                item
            ) {

                return item[0];
            }
        );
    }


    /* ========================================================
       CATÉGORIES APPRÉCIÉES
       ======================================================== */

    function obtenirCategoriesAppreciees(
        statistiques
    ) {

        const categories =
            new Map();


        Object.values(
            statistiques
        ).forEach(
            function (
                data
            ) {

                if (
                    !data.categories
                ) {

                    return;
                }


                Object.entries(
                    data.categories
                ).forEach(
                    function (
                        [
                            categorie,
                            valeur
                        ]
                    ) {

                        categories.set(
                            categorie,
                            (
                                categories.get(
                                    categorie
                                ) || 0
                            ) +
                            valeur
                        );
                    }
                );
            }
        );


        return new Set(
            [...categories.entries()]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b[1] -
                        a[1]
                )
                .slice(
                    0,
                    5
                )
                .map(
                    item =>
                        item[0]
                )
        );
    }


    /* ========================================================
       CLASSER LES PRODUITS
       ======================================================== */

    function classerProduits(
        produits,
        statistiques
    ) {

        const produitsApprecies =
            obtenirProduitsApprecies(
                statistiques
            );

        const produitsScores =
            produits.map(
                function (
                    produit
                ) {

                    const score =
                        calculerScore(
                            produit,
                            statistiques,
                            {
                                produitsApprecies
                            }
                        );


                    return {

                        ...produit,

                        score
                    };
                }
            );


        produitsScores.sort(
            function (
                a,
                b
            ) {

                return b.score -
                       a.score;
            }
        );


        return produitsScores;
    }


    /* ========================================================
       API
       ======================================================== */

    window.LumesysScore = {

        calculerScore,

        classerProduits,

        trouverCategorieFavorite,

        obtenirProduitsApprecies,

        obtenirCategoriesAppreciees

    };

})();
