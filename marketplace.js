(function () {
    "use strict";

    const STORAGE_KEY = "lumesys_marketplace_state_v1";
    const ROUTE_IDS = ["accueil", "categorie", "achatv", "ventev", "annonces", "aide", "compte", "panier", "favoris", "historique"];
    const CART_LIMIT = 99;
    let firebaseClient = null;
    let currentUser = null;
    let cloudReady = false;
    let cloudViewHistoryReady = false;
    let currentDetailsItem = null;
    let viewHistorySaveTimer = null;
    let state = loadState();
    const cartFeedbackTimers = new WeakMap();

    function normalize(value) {
        return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    }

    function validItem(item) {
        return item && typeof item.id === "string" && item.id
            && typeof item.name === "string" && item.name
            && Number.isSafeInteger(Number(item.price)) && Number(item.price) > 0;
    }

    function validFavorite(item) {
        return item && typeof item.id === "string" && item.id
            && typeof item.name === "string" && item.name
            && Number.isSafeInteger(Number(item.price)) && Number(item.price) >= 0;
    }

    function cleanItem(item) {
        return {
            id: String(item.id),
            name: String(item.name),
            price: Number(item.price),
            image: String(item.image || ""),
            imageDetail: String(item.imageDetail || item.image || ""),
            category: String(item.category || ""),
            quantity: Math.max(1, Math.min(CART_LIMIT, Number(item.quantity) || 1))
        };
    }

    function readLegacyFavorites() {
        const preferences = window.LumesysComportement
            && window.LumesysComportement.obtenirPreferences();
        return preferences && Array.isArray(preferences.favoris)
            ? preferences.favoris.map(function (item) {
                return {
                    id: String(item.produit || ""),
                    name: String(item.produit || ""),
                        price: 0,
                    image: "",
                    imageDetail: "",
                    category: String(item.categorie || "")
                };
                }).filter(validFavorite)
            : [];
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return { cart: [], favorites: readLegacyFavorites() };
            }
            const parsed = JSON.parse(raw);
            return {
                cart: Array.isArray(parsed.cart)
                    ? parsed.cart.filter(validItem).map(cleanItem)
                    : [],
                favorites: Array.isArray(parsed.favorites)
                    ? parsed.favorites.filter(validFavorite).map(function (item) {
                        return { ...cleanItem({ ...item, price: Number(item.price) || 1 }), price: Number(item.price) || 0 };
                    })
                    : readLegacyFavorites()
            };
        } catch (error) {
            console.warn("Lumesys : panier local illisible.", error);
            setStatus("cart-status", "Le panier local n’a pas pu être lu. Les nouvelles modifications restent disponibles.");
            return { cart: [], favorites: readLegacyFavorites() };
        }
    }

    function setStatus(id, message) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = message;
        }
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (error) {
            console.error("Lumesys : sauvegarde locale du panier impossible.", error);
            setStatus("cart-status", "Le stockage local est indisponible. Vérifiez les paramètres de votre navigateur.");
            return false;
        }
    }

    function productFromCard(card) {
        if (!card) {
            return null;
        }
        const image = card.querySelector("img");
        const name = card.dataset.produit || "";
        const price = Number(card.dataset.prix);
        const item = {
            id: card.dataset.produitId || normalize(name),
            name: name,
            price: price,
            image: card.dataset.image || (image ? image.getAttribute("src") : "") || "",
            imageDetail: card.dataset.imageDetail || (image ? image.getAttribute("src") : "") || "",
            category: card.dataset.sousCategorie || card.dataset.categorie || "",
            quantity: 1
        };
        return validItem(item) ? cleanItem(item) : item;
    }

    function isFavorite(id) {
        const key = normalize(id);
        return state.favorites.some(function (item) {
            return normalize(item.id) === key || normalize(item.name) === key;
        });
    }

    function updateFavoriteControls(item, active) {
        document.querySelectorAll(".lumesys-favorite").forEach(function (button) {
            const card = button.closest("[data-produit]");
            const current = productFromCard(card);
            if (current && (current.id === item.id || normalize(current.name) === normalize(item.name))) {
                button.setAttribute("aria-pressed", String(active));
                button.setAttribute("aria-label", active ? "Retirer des favoris" : "Ajouter aux favoris");
                button.textContent = active ? "♥" : "♡";
            }
        });
        const detailButton = document.getElementById("product-details-favorite");
        const dialog = document.getElementById("product-details");
        if (detailButton && dialog && dialog.dataset.productId === item.id) {
            detailButton.textContent = active ? "Retirer des favoris" : "Ajouter aux favoris";
        }
    }

    function mirrorFavorite(item, active) {
        const behavior = window.LumesysComportement;
        if (!behavior || !behavior.estFavori) {
            return;
        }
        const alreadyFavorite = behavior.estFavori(item.name);
        if (alreadyFavorite !== active) {
            behavior.basculerFavori(item.name, item.category);
        }
    }

    function toggleFavorite(item) {
        if (!item || !item.id) {
            return false;
        }
        const index = state.favorites.findIndex(function (favorite) {
            return favorite.id === item.id || normalize(favorite.name) === normalize(item.name);
        });
        const active = index < 0;
        if (active) {
            state.favorites.push(cleanItem(item));
        } else {
            state.favorites.splice(index, 1);
        }
        mirrorFavorite(item, active);
        persist();
        render();
        updateFavoriteControls(item, active);
        scheduleCloudSave();
        setStatus("favorites-status", active ? "Article ajouté aux favoris." : "Article retiré des favoris.");
        return active;
    }

    function addToCart(item) {
        if (!validItem(item)) {
            setStatus("cart-status", "Le prix de cet article n’est pas disponible; il ne peut pas être ajouté au panier.");
            return false;
        }
        const existing = state.cart.find(function (entry) {
            return entry.id === item.id;
        });
        if (existing) {
            existing.quantity = Math.min(CART_LIMIT, existing.quantity + 1);
        } else {
            state.cart.push(cleanItem(item));
        }
        persist();
        render();
        setStatus("cart-status", "Panier mis à jour.");
        scheduleCloudSave();
        return true;
    }

    function showCartFeedback(button) {
        if (!button.hasAttribute("data-default-label")) {
            button.dataset.defaultLabel = button.getAttribute("aria-label") || "Ajouter au panier";
            button.dataset.defaultTitle = button.title;
        }

        const previousTimer = cartFeedbackTimers.get(button);
        if (previousTimer) {
            window.clearTimeout(previousTimer);
        }

        button.classList.add("is-added");
        button.setAttribute("aria-label", "Article ajouté au panier");
        button.title = "Article ajouté au panier";

        const timer = window.setTimeout(function () {
            button.classList.remove("is-added");
            button.setAttribute("aria-label", button.dataset.defaultLabel);
            if (button.dataset.defaultTitle) {
                button.title = button.dataset.defaultTitle;
            } else {
                button.removeAttribute("title");
            }
            cartFeedbackTimers.delete(button);
        }, 1200);
        cartFeedbackTimers.set(button, timer);
    }

    function changeQuantity(id, amount) {
        const item = state.cart.find(function (entry) {
            return entry.id === id;
        });
        if (!item) {
            return;
        }
        item.quantity = Math.max(1, Math.min(CART_LIMIT, item.quantity + amount));
        persist();
        render();
        scheduleCloudSave();
    }

    function removeFromCart(id) {
        state.cart = state.cart.filter(function (item) {
            return item.id !== id;
        });
        persist();
        render();
        setStatus("cart-status", "Article retiré du panier.");
        scheduleCloudSave();
    }

    function removeFavorite(id) {
        const item = state.favorites.find(function (favorite) {
            return favorite.id === id;
        });
        if (item) {
            const active = false;
            state.favorites = state.favorites.filter(function (favorite) {
                return favorite.id !== id;
            });
            mirrorFavorite(item, active);
            updateFavoriteControls(item, active);
            persist();
            render();
            setStatus("favorites-status", "Article retiré des favoris.");
            scheduleCloudSave();
        }
    }

    function makeButton(text, className, action, id, label) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.dataset[action] = id;
        button.textContent = text;
        if (label) {
            button.setAttribute("aria-label", label);
        }
        return button;
    }

    function renderLine(item, isCart) {
        const row = document.createElement("article");
        row.className = "market-list-item";
        const image = document.createElement("img");
        if (item.image) {
            image.src = item.image;
            image.alt = item.name;
            image.loading = "lazy";
        } else {
            image.hidden = true;
        }
        const info = document.createElement("div");
        const name = document.createElement("h3");
        name.textContent = item.name;
        const price = document.createElement("p");
        price.textContent = item.price > 0
            ? Number(item.price).toLocaleString("fr-FR") + " FCFA" + (isCart ? " l’unité" : "")
            : "Prix à confirmer";
        info.appendChild(name);
        info.appendChild(price);
        if (isCart) {
            const quantity = document.createElement("p");
            quantity.textContent = "Quantité : " + item.quantity;
            info.appendChild(quantity);
        }
        const controls = document.createElement("div");
        controls.className = "market-list-controls";
        if (isCart) {
            controls.appendChild(makeButton("−", "", "cartDecrease", item.id, "Diminuer la quantité"));
            controls.appendChild(makeButton("+", "", "cartIncrease", item.id, "Augmenter la quantité"));
        } else {
            controls.appendChild(makeButton("Ajouter au panier", "market-button", "favoriteAddCart", item.id));
        }
        controls.appendChild(makeButton("Retirer", "market-remove", isCart ? "cartRemove" : "favoriteRemove", item.id));
        row.appendChild(image);
        row.appendChild(info);
        row.appendChild(controls);
        return row;
    }

    function updateCheckout() {
        const link = document.getElementById("cart-checkout");
        if (!link) {
            return;
        }
        if (!state.cart.length) {
            link.hidden = true;
            return;
        }
        link.href = "tel:+22376856631";
        link.hidden = false;
    }

    function render() {
        const cartContainer = document.getElementById("cart-items");
        const favoriteContainer = document.getElementById("favorite-items");
        if (!cartContainer || !favoriteContainer) {
            return;
        }
        cartContainer.replaceChildren(...state.cart.map(function (item) {
            return renderLine(item, true);
        }));
        favoriteContainer.replaceChildren(...state.favorites.map(function (item) {
            return renderLine(item, false);
        }));
        const cartCount = state.cart.reduce(function (count, item) {
            return count + item.quantity;
        }, 0);
        const countLabel = document.getElementById("cart-count");
        const favoriteLabel = document.getElementById("favorite-count");
        if (countLabel) {
            countLabel.textContent = String(cartCount);
        }
        if (favoriteLabel) {
            favoriteLabel.textContent = String(state.favorites.length);
        }
        const total = state.cart.reduce(function (sum, item) {
            return sum + item.price * item.quantity;
        }, 0);
        const totalElement = document.getElementById("cart-total");
        if (totalElement) {
            totalElement.textContent = total.toLocaleString("fr-FR") + " FCFA";
        }
        const emptyCart = document.getElementById("cart-empty");
        const emptyFavorites = document.getElementById("favorites-empty");
        if (emptyCart) {
            emptyCart.hidden = state.cart.length > 0;
        }
        if (emptyFavorites) {
            emptyFavorites.hidden = state.favorites.length > 0;
        }
        updateCheckout();
    }

    function mergeById(localItems, remoteItems, isCart) {
        const result = new Map();
        [...localItems, ...(Array.isArray(remoteItems) ? remoteItems : [])]
            .filter(isCart ? validItem : validFavorite)
            .map(function (item) {
                if (isCart) {
                    return cleanItem(item);
                }
                const price = Number(item.price) || 0;
                return { ...cleanItem({ ...item, price: price || 1 }), price: price };
            })
            .forEach(function (item) {
                const current = result.get(item.id);
                if (!current) {
                    result.set(item.id, item);
                } else {
                    result.set(item.id, {
                        ...current,
                        ...item,
                        quantity: isCart ? Math.max(current.quantity, item.quantity) : 1
                    });
                }
            });
        return Array.from(result.values());
    }

    function displayProfile(user, data) {
        const wrapper = document.getElementById("account-profile");
        const signIn = document.getElementById("account-signin");
        const avatar = document.getElementById("account-avatar");
        const publicProfile = data && data.publicProfile || {};
        const legacyProfile = data && data.legacyProfile || {};
        if (!user) {
            if (wrapper) wrapper.hidden = true;
            if (signIn) signIn.hidden = false;
            return;
        }
        const name = user.displayName
            || [publicProfile.prenom, publicProfile.nom].filter(Boolean).join(" ")
            || legacyProfile.nom
            || "Membre Lumesys";
        document.getElementById("account-name").textContent = name;
        document.getElementById("account-email").textContent = user.email || "";
        const location = [publicProfile.ville, publicProfile.region, publicProfile.pays].filter(Boolean).join(", ");
        document.getElementById("account-location").textContent = location;
        const photo = publicProfile.photo || user.photoURL || "";
        if (photo) {
            avatar.src = photo;
            avatar.hidden = false;
        } else {
            avatar.removeAttribute("src");
            avatar.hidden = true;
        }
        if (wrapper) wrapper.hidden = false;
        if (signIn) signIn.hidden = true;
    }

    async function handleAuthState(user) {
        if (viewHistorySaveTimer) {
            window.clearTimeout(viewHistorySaveTimer);
            viewHistorySaveTimer = null;
        }
        currentUser = user;
        cloudReady = false;
        cloudViewHistoryReady = false;
        if (
            window.LumesysComportement &&
            typeof window.LumesysComportement.definirPorteeHistorique === "function"
        ) {
            window.LumesysComportement.definirPorteeHistorique(user ? user.uid : null);
        }
        displayProfile(user, null);
        if (!user) {
            setStatus("account-status", "Firebase Auth est prêt. Connectez-vous pour synchroniser votre compte, votre panier, vos favoris et votre historique. Les données invité restent sur cet appareil.");
            return;
        }
        setStatus("account-status", "Compte Firebase connecté. Chargement du profil et des données…");
        try {
            const remote = await firebaseClient.load(user);
            displayProfile(user, remote);
            cloudViewHistoryReady = remote.viewHistorySyncAvailable !== false;
            if (
                cloudViewHistoryReady &&
                window.LumesysComportement &&
                typeof window.LumesysComportement.fusionnerHistoriqueVues === "function"
            ) {
                window.LumesysComportement.fusionnerHistoriqueVues(
                    remote.viewHistory || []
                );
            }
            state.cart = mergeById(state.cart, remote.cart, true);
            state.favorites = mergeById(state.favorites, remote.favorites, false);
            persist();
            render();
            await firebaseClient.save(user, state);
            cloudReady = true;
            setStatus(
                "account-status",
                cloudViewHistoryReady
                    ? "Profil chargé. Panier, favoris et historique synchronisés avec votre compte."
                    : "Profil chargé. Panier et favoris synchronisés; l’historique reste local jusqu’à l’activation des règles dédiées."
            );
            updateFavoriteButtons();
            if (cloudViewHistoryReady) {
                scheduleViewHistorySave(0);
                document.dispatchEvent(new CustomEvent("lumesys-view-history-synced"));
            }
        } catch (error) {
            console.error("Lumesys : synchronisation Firebase impossible.", error);
            setStatus("account-status", "La synchronisation du compte est temporairement indisponible. Vos données locales sont conservées.");
            setStatus("cart-status", "Synchronisation cloud indisponible; le panier local reste utilisable.");
            cloudReady = false;
        }
    }

    function updateFavoriteButtons() {
        document.querySelectorAll(".lumesys-favorite").forEach(function (button) {
            const card = button.closest("[data-produit]");
            const item = productFromCard(card);
            if (!item) {
                return;
            }
            const active = isFavorite(item.id) || isFavorite(item.name);
            button.setAttribute("aria-pressed", String(active));
            button.setAttribute("aria-label", active ? "Retirer des favoris" : "Ajouter aux favoris");
            button.textContent = active ? "♥" : "♡";
        });
    }

    function scheduleCloudSave() {
        if (!currentUser || !firebaseClient || !cloudReady) {
            return;
        }
        firebaseClient.save(currentUser, state).catch(function (error) {
            console.error("Lumesys : sauvegarde Firebase impossible.", error);
            setStatus("account-status", "La session reste active, mais la sauvegarde Firestore a échoué. Les données locales sont conservées.");
            setStatus("cart-status", "Échec de synchronisation cloud; les changements sont conservés sur cet appareil.");
        });
    }

    function scheduleViewHistorySave(delay) {
        if (
            !currentUser ||
            !firebaseClient ||
            !cloudReady ||
            !cloudViewHistoryReady ||
            typeof firebaseClient.saveViewHistory !== "function"
        ) {
            return;
        }

        if (viewHistorySaveTimer) {
            window.clearTimeout(viewHistorySaveTimer);
        }
        viewHistorySaveTimer = window.setTimeout(function () {
            viewHistorySaveTimer = null;
            const user = currentUser;
            const behavior = window.LumesysComportement;
            const history = behavior &&
                typeof behavior.obtenirHistoriqueVues === "function"
                ? behavior.obtenirHistoriqueVues()
                : [];

            firebaseClient.saveViewHistory(user, history).catch(function (error) {
                console.error("Lumesys : synchronisation de l’historique Firestore impossible.", error);
                if (currentUser && currentUser.uid === user.uid) {
                    if (error && error.code === "permission-denied") {
                        cloudViewHistoryReady = false;
                    }
                    setStatus("account-status", "Panier et favoris synchronisés, mais l’historique reste uniquement sur cet appareil pour le moment.");
                }
            });
        }, Number.isFinite(delay) ? delay : 1500);
    }

    document.addEventListener("lumesys-view-history-updated", function (event) {
        if (
            currentUser &&
            event.detail &&
            event.detail.scope === "user:" + currentUser.uid
        ) {
            scheduleViewHistorySave();
        }
    });

    function openDetails(item) {
        if (!item) {
            return;
        }
        if (
            window.LumesysComportement &&
            typeof window.LumesysComportement.enregistrerProduitVu === "function"
        ) {
            window.LumesysComportement.enregistrerProduitVu(
                item.id,
                item.category,
                item.name
            );
        }
        currentDetailsItem = item;
        const dialog = document.getElementById("product-details");
        const image = document.getElementById("product-details-image");
        dialog.dataset.productId = item.id;
        image.src = item.imageDetail || item.image;
        image.alt = item.name;
        document.getElementById("product-details-name").textContent = item.name;
        document.getElementById("product-details-price").textContent = item.price.toLocaleString("fr-FR") + " FCFA";
        const favorite = document.getElementById("product-details-favorite");
        favorite.textContent = isFavorite(item.id) || isFavorite(item.name)
            ? "Retirer des favoris"
            : "Ajouter aux favoris";
        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
    }

    function showCatalogue() {
        ROUTE_IDS.forEach(function (id) {
            const section = document.getElementById(id);
            if (section) {
                section.classList.remove("is-active");
            }
        });
        const accueilDescription = document.getElementById("accueil-description");
        if (accueilDescription) {
            accueilDescription.classList.remove("is-active");
        }
        const recommendations = document.getElementById("recommandations");
        if (recommendations) {
            recommendations.hidden = false;
        }
    }

    function showRoute() {
        const id = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
        const sidebar = document.getElementById("sidebar");
        if (window.innerWidth <= 700 && sidebar) {
            sidebar.classList.remove("active");
        }
        const section = ROUTE_IDS.indexOf(id) >= 0 ? document.getElementById(id) : null;
        ROUTE_IDS.forEach(function (routeId) {
            const route = document.getElementById(routeId);
            if (route) {
                route.classList.toggle("is-active", route === section);
            }
        });
        const recommendations = document.getElementById("recommandations");
        const showHome = id === "accueil" && Boolean(section);
        const accueilDescription = document.getElementById("accueil-description");
        if (accueilDescription) {
            accueilDescription.classList.toggle("is-active", showHome);
        }
        if (recommendations) {
            recommendations.hidden = Boolean(section && !showHome);
        }
        if (section) {
            if (showHome) {
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                const header = document.querySelector("header");
                const headerHeight = header ? header.getBoundingClientRect().height : 0;
                const top = section.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
                window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            }
        }
        if (id === "historique") {
            document.dispatchEvent(new CustomEvent("lumesys-view-history-requested"));
        }
    }

    document.addEventListener("click", function (event) {
        const addButton = event.target.closest(".lumesys-cart-add");
        const detailsButton = event.target.closest(".lumesys-product-details");
        const detailLink = event.target.closest("a[data-product-detail]");
        const card = event.target.closest("[data-produit]");
        if (addButton && card) {
            event.preventDefault();
            if (addToCart(productFromCard(card))) {
                showCartFeedback(addButton);
            }
            return;
        }
        if ((detailsButton && card) || (detailLink && card)) {
            event.preventDefault();
            openDetails(productFromCard(card));
            return;
        }
        const increase = event.target.closest("[data-cart-increase]");
        const decrease = event.target.closest("[data-cart-decrease]");
        const removeCart = event.target.closest("[data-cart-remove]");
        const removeFav = event.target.closest("[data-favorite-remove]");
        const favAddCart = event.target.closest("[data-favorite-add-cart]");
        if (increase) changeQuantity(increase.dataset.cartIncrease, 1);
        if (decrease) changeQuantity(decrease.dataset.cartDecrease, -1);
        if (removeCart) removeFromCart(removeCart.dataset.cartRemove);
        if (removeFav) removeFavorite(removeFav.dataset.favoriteRemove);
        if (favAddCart) {
            const item = state.favorites.find(function (favorite) {
                return favorite.id === favAddCart.dataset.favoriteAddCart;
            });
            if (item) addToCart(item);
        }
    });

    document.getElementById("product-details-close").addEventListener("click", function () {
        document.getElementById("product-details").close();
    });
    document.getElementById("product-details-cart").addEventListener("click", function () {
        const dialog = document.getElementById("product-details");
        if (currentDetailsItem) addToCart(currentDetailsItem);
        dialog.close();
    });
    document.getElementById("product-details-favorite").addEventListener("click", function () {
        if (currentDetailsItem) {
            toggleFavorite(currentDetailsItem);
        }
        this.textContent = currentDetailsItem
            && (isFavorite(currentDetailsItem.id) || isFavorite(currentDetailsItem.name))
            ? "Retirer des favoris"
            : "Ajouter aux favoris";
    });
    document.getElementById("account-signin").addEventListener("click", function () {
        if (!firebaseClient) {
            setStatus("account-status", "Le service Firebase n’a pas pu être initialisé. Les fonctions locales restent disponibles.");
            return;
        }
        firebaseClient.signIn().catch(function (error) {
            console.error("Lumesys : connexion Firebase impossible.", error);
            setStatus("account-status", "Connexion impossible : " + (error.message || error.code || "erreur Firebase"));
        });
    });
    document.getElementById("account-signout").addEventListener("click", function () {
        if (firebaseClient) {
            firebaseClient.signOut().catch(function (error) {
                console.error("Lumesys : déconnexion Firebase impossible.", error);
                setStatus("account-status", "Déconnexion impossible : " + (error.message || error.code || "erreur Firebase"));
            });
        }
    });

    window.addEventListener("hashchange", showRoute);
    window.addEventListener("load", function () {
        const id = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
        if (id === "accueil") {
            window.requestAnimationFrame(function () {
                if (decodeURIComponent(window.location.hash.slice(1)).toLowerCase() === "accueil") {
                    window.scrollTo({ top: 0, behavior: "auto" });
                }
            });
        }
    });
    document.addEventListener("lumesys-category", showCatalogue);
    document.addEventListener("lumesys-search", showCatalogue);

    window.LumesysCommerce = {
        productFromCard: productFromCard,
        isFavorite: isFavorite,
        toggleFavorite: toggleFavorite,
        connectFirebase: function (client) {
            firebaseClient = client;
            client.onAuthStateChanged(handleAuthState);
        }
    };

    render();
    showRoute();
    setStatus("account-status", "Connectez-vous pour synchroniser votre compte, votre panier, vos favoris et votre historique. Les données invité sont conservées sur cet appareil.");
    window.setTimeout(function () {
        if (!firebaseClient) {
            setStatus("account-status", "Firebase ne s’est pas initialisé. Le panier, les favoris et l’historique locaux restent disponibles; vérifiez la connexion réseau et la console.");
        }
    }, 10000);
})();
