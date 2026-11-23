function toggleMenu() {
    var sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.toggle("active");
    }
}

var CATEGORIES_LUMESYS = [
    { id: "pantalons", label: "Pantalons", subs: [{ id: "panton", label: "Pantalons" }] },
    { id: "sacs", label: "Sacs", subs: [{ id: "Sacdos", label: "Sacs à dos" }] },
    {
        id: "chaussures", label: "Chaussures", subs: [
            { id: "Chosse", label: "Chaussures" },
            { id: "chos_se1", label: "Chaussures 01" },
            { id: "chasuss1", label: "Chaussures 02" },
            { id: "snads", label: "Sandales" }
        ]
    },
    {
        id: "vetements", label: "Mode et habillement", subs: [
            { id: "chem", label: "Chemises" },
            { id: "lacost", label: "Lacoste" },
            { id: "lacostao", label: "Lacoste 01" },
        { id: "costumes", label: "Costumes" },
            { id: "mailltot", label: "Maillots" },
            { id: "survetus", label: "Survetements" },
            { id: "vesth", label: "Vestes" }
        ]
    },
    {
        id: "tissus", label: "Tissus et textiles", subs: [
            { id: "ptissu", label: "Tissus" },
            { id: "Tissus_Cousus", label: "Tissus cousus" },
            { id: "tisbrod", label: "Tissus brodés" },
            { id: "bazin", label: "Bazin" }
        ]
    },
    {
        id: "accessoires", label: "Autres produits", subs: [
            { id: "cafpr", label: "Presse café" },
            { id: "ptarfum", label: "Parfums" },
            { id: "tapfem", label: "Tappettes" }
        ]
    }
];

function construireMenuCategories(categoriesDisponibles) {
    var sidebar = document.getElementById("sidebar");
    var liste = sidebar && sidebar.querySelector("ul");
    if (!liste) {
        return;
    }

    var old = sidebar.querySelector(".menu-item-categories");
    if (old) {
        old.remove();
    }
    var oldLegacy = sidebar.querySelector("a[href='#categorie']");
    if (oldLegacy && oldLegacy.parentElement) {
        oldLegacy.parentElement.remove();
    }

    var item = document.createElement("li");
    item.className = "menu-item menu-item-categories";

    var titre = document.createElement("a");
    titre.href = "#categorie";
    titre.textContent = "Catégories";
    titre.setAttribute("role", "button");
    titre.setAttribute("aria-expanded", "false");

    var menu = document.createElement("ul");
    menu.className = "sub-menu category-main-menu";
    menu.id = "category-main-menu";
    titre.setAttribute("aria-controls", menu.id);

    (categoriesDisponibles || []).forEach(function (category) {
        var row = document.createElement("li");
        row.className = "category-main-item";

        var select = document.createElement("a");
        select.href = "#recommandations";
        select.textContent = category.label;
        select.setAttribute("role", "button");
        select.setAttribute("aria-expanded", "false");
        row.appendChild(select);

        var expand = document.createElement("button");
        expand.type = "button";
        expand.className = "category-toggle";
        expand.textContent = "+";
        expand.setAttribute("aria-label", "Afficher les sous-catégories de " + category.label);
        expand.setAttribute("aria-expanded", "false");
        row.appendChild(expand);

        var children = document.createElement("ul");
        children.className = "sub-menu category-sub-menu";
        children.id = "category-submenu-" + category.id;
        select.setAttribute("aria-controls", children.id);
        expand.setAttribute("aria-controls", children.id);
        category.subs.forEach(function (sub) {
            var subRow = document.createElement("li");
            var subLink = document.createElement("a");
            subLink.href = "#recommandations";
            subLink.textContent = sub.label;
            subLink.dataset.category = category.id;
            subLink.dataset.subcategory = sub.id;
            subLink.setAttribute("role", "button");
            subRow.appendChild(subLink);
            children.appendChild(subRow);
        });
        row.appendChild(children);

        function basculerSousCategories() {
            var expanded = row.classList.toggle("open");
            select.setAttribute("aria-expanded", String(expanded));
            expand.setAttribute("aria-expanded", String(expanded));
            expand.textContent = expanded ? "-" : "+";
            expand.setAttribute(
                "aria-label",
                (expanded ? "Masquer" : "Afficher") + " les sous-catégories de " + category.label
            );
        }

        select.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            basculerSousCategories();
        });
        expand.addEventListener("click", basculerSousCategories);
        menu.appendChild(row);
    });

    item.appendChild(titre);
    item.appendChild(menu);
    var first = liste.children[0];
    liste.insertBefore(item, first ? first.nextSibling : null);

    titre.addEventListener("click", function (event) {
        event.preventDefault();
        var expanded = menu.classList.toggle("open");
        titre.setAttribute("aria-expanded", String(expanded));
        if (!expanded) {
            menu.querySelectorAll(".category-main-item.open").forEach(function (row) {
                row.classList.remove("open");
                var parent = row.querySelector(":scope > a");
                var toggle = row.querySelector(":scope > .category-toggle");
                if (parent) {
                    parent.setAttribute("aria-expanded", "false");
                }
                if (toggle) {
                    toggle.setAttribute("aria-expanded", "false");
                    toggle.setAttribute("aria-label", "Afficher les sous-catégories de " + parent.textContent);
                    toggle.textContent = "+";
                }
            });
        }
    });

    menu.addEventListener("click", function (event) {
        var link = event.target.closest("a[data-category]");
        if (!link) {
            return;
        }
        event.preventDefault();
        effacerRecherche();
        document.dispatchEvent(new CustomEvent("lumesys-category", {
            detail: {
                category: link.dataset.category,
                subcategory: link.dataset.subcategory || null,
                label: link.textContent.trim()
            }
        }));
        menu.classList.remove("open");
        titre.setAttribute("aria-expanded", "false");
        menu.querySelectorAll(".category-main-item.open").forEach(function (row) {
            row.classList.remove("open");
            row.querySelector(":scope > a").setAttribute("aria-expanded", "false");
            var toggle = row.querySelector(":scope > .category-toggle");
            toggle.setAttribute("aria-expanded", "false");
            toggle.textContent = "+";
        });
        if (window.innerWidth <= 900) {
            toggleMenu();
        }
    });
}

function effacerRecherche() {
    var input = document.getElementById("market-search-input");
    var recommendations = document.getElementById("recommandations");
    if (input) {
        input.value = "";
    }
    if (recommendations) {
        recommendations.classList.remove("search-active");
    }
}

document.addEventListener("click", function (event) {
    var sidebar = document.getElementById("sidebar");
    var menuIcon = document.querySelector(".menu-icon");
    if (sidebar && sidebar.classList.contains("active") &&
        !sidebar.contains(event.target) && menuIcon && !menuIcon.contains(event.target)) {
        toggleMenu();
    }
});

document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href^='#']");
    if (!link || link.dataset.category) {
        return;
    }

    var target = decodeURIComponent(link.getAttribute("href").slice(1)).toLowerCase();
    var match = null;
    CATEGORIES_LUMESYS.some(function (category) {
        return category.subs.some(function (subcategory) {
            if (subcategory.id.toLowerCase() === target) {
                match = { category: category, subcategory: subcategory };
                return true;
            }
            return false;
        });
    });

    if (!match) {
        return;
    }

    event.preventDefault();
    effacerRecherche();
    document.dispatchEvent(new CustomEvent("lumesys-category", {
        detail: {
            category: match.category.id,
            subcategory: match.subcategory.id,
            label: match.subcategory.label
        }
    }));
});

document.addEventListener("DOMContentLoaded", function () {
    construireMenuCategories([]);

    document.addEventListener("lumesys-categories-disponibles", function (event) {
        construireMenuCategories(event.detail.categories);
    });

    var accueil = document.querySelector("#sidebar a[href='#accueil']");
    if (accueil) {
        accueil.addEventListener("click", function (event) {
            effacerRecherche();
            if (window.innerWidth <= 900) {
                toggleMenu();
            }
        });
    }

    var form = document.getElementById("market-search");
    var input = document.getElementById("market-search-input");
    if (!form || !input) {
        return;
    }

    function rechercher(commit) {
        var query = input.value.trim().toLowerCase();
        var recommendations = document.getElementById("recommandations");
        if (recommendations) {
            recommendations.classList.toggle("search-active", Boolean(query));
        }
        document.dispatchEvent(new CustomEvent("lumesys-search", {
            detail: { query: query, commit: Boolean(commit) }
        }));
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        rechercher(true);
    });
    input.addEventListener("input", function () {
        rechercher(false);
    });
});
