(function () {
    "use strict";

    const LOCALES = [
        { code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" },
        { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
        { code: "zh-CN", label: "简体中文", flag: "🇨🇳", dir: "ltr" },
        { code: "bm", label: "Bamanankan", flag: "🇲🇱", dir: "ltr" },
        { code: "es", label: "Español", flag: "🇪🇸", dir: "ltr" },
        { code: "pt", label: "Português", flag: "🇵🇹", dir: "ltr" },
        { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" }
    ];
    const LOCALE_STORAGE_KEY = "lumesys_marketplace_language_v1";
    const DICTIONARY_STORAGE_PREFIX = "lumesys_i18n_r6_";
    const supportedCodes = new Set(LOCALES.map(function (locale) {
        return locale.code;
    }));
    const knownSubcategories = new Set([
        "panton", "sacdos", "chosse", "chos_se1", "chasuss1", "snads",
        "chem", "lacost", "lacostao", "costumes", "mailltot", "survetus",
        "vesth", "ptissu", "tissus_cousus", "tisbrod", "bazin", "cafpr",
        "ptarfum", "tapfem"
    ]);
    const dictionaries = Object.create(null);
    const loading = new Map();
    const missingReported = new Set();
    const script = document.currentScript;
    const dictionaryBase = script
        ? new URL("i18n/", script.src)
        : new URL("i18n/", document.baseURI);
    let activeLocale = readSavedLocale();
    let selectionVersion = 0;
    let pickerOptions = [];

    function readSavedLocale() {
        try {
            const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
            return supportedCodes.has(saved) ? saved : "fr";
        } catch (error) {
            console.warn("Lumesys i18n: impossible de lire la langue locale.", error);
            return "fr";
        }
    }

    function setDocumentLocale(locale) {
        const definition = LOCALES.find(function (item) {
            return item.code === locale;
        }) || LOCALES[0];
        document.documentElement.lang = definition.code;
        document.documentElement.dir = definition.dir;
    }

    function readCachedDictionary(locale) {
        try {
            const value = localStorage.getItem(DICTIONARY_STORAGE_PREFIX + locale);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.warn("Lumesys i18n: cache de traduction illisible.", error);
            return null;
        }
    }

    function saveCachedDictionary(locale, dictionary) {
        try {
            localStorage.setItem(
                DICTIONARY_STORAGE_PREFIX + locale,
                JSON.stringify(dictionary)
            );
        } catch (error) {
            console.warn("Lumesys i18n: cache de traduction non enregistré.", error);
        }
    }

    function loadLocale(locale) {
        if (dictionaries[locale]) {
            return Promise.resolve(dictionaries[locale]);
        }
        if (loading.has(locale)) {
            return loading.get(locale);
        }

        const cached = readCachedDictionary(locale);
        if (cached && typeof cached === "object") {
            dictionaries[locale] = cached;
            return Promise.resolve(cached);
        }

        const request = fetch(new URL(encodeURIComponent(locale) + ".json?v=20261124-i18n-r6", dictionaryBase), {
            cache: "force-cache"
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("HTTP " + response.status + " pour " + locale);
            }
            return response.json();
        }).then(function (dictionary) {
            if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary)) {
                throw new Error("Dictionnaire invalide pour " + locale);
            }
            dictionaries[locale] = dictionary;
            saveCachedDictionary(locale, dictionary);
            return dictionary;
        }).catch(function (error) {
            console.warn("Lumesys i18n: dictionnaire indisponible pour " + locale + ".", error);
            return null;
        }).finally(function () {
            loading.delete(locale);
        });

        loading.set(locale, request);
        return request;
    }

    function valueAt(dictionary, key) {
        return String(key || "").split(".").reduce(function (value, part) {
            return value && Object.prototype.hasOwnProperty.call(value, part)
                ? value[part]
                : undefined;
        }, dictionary);
    }

    function resolvedValue(key) {
        const activeValue = valueAt(dictionaries[activeLocale], key);
        if (typeof activeValue === "string") {
            return { value: activeValue, locale: activeLocale };
        }
        const frenchValue = valueAt(dictionaries.fr, key);
        if (typeof frenchValue === "string") {
            return { value: frenchValue, locale: "fr" };
        }
        return null;
    }

    function interpolate(value, params) {
        const values = params && typeof params === "object" ? params : {};
        return value.replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, name) {
            if (!Object.prototype.hasOwnProperty.call(values, name)) {
                return "";
            }
            const value = values[name];
            return typeof value === "number" && Number.isFinite(value)
                ? formatNumber(value)
                : String(value);
        });
    }

    function translate(key, params, fallback) {
        const resolved = resolvedValue(key);
        if (resolved) {
            return interpolate(resolved.value, params);
        }
        if (!missingReported.has(key)) {
            missingReported.add(key);
            console.warn("Lumesys i18n: traduction française manquante pour " + key + ".");
        }
        return typeof fallback === "string" ? fallback : "";
    }

    function formatNumber(value) {
        const locale = activeLocale === "bm" ? "fr-FR" : activeLocale;
        try {
            return new Intl.NumberFormat(locale).format(Number(value) || 0);
        } catch (error) {
            return String(Number(value) || 0);
        }
    }

    function readParams(element) {
        const raw = element.getAttribute("data-i18n-params");
        if (!raw) {
            return {};
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.warn("Lumesys i18n: paramètres de traduction invalides.", error);
            return {};
        }
    }

    function setElementText(element, key, fallback, params, useHtml) {
        if (!element) {
            return;
        }
        element.setAttribute(useHtml ? "data-i18n-html" : "data-i18n", key);
        if (params && Object.keys(params).length) {
            element.setAttribute("data-i18n-params", JSON.stringify(params));
        }
        if (typeof fallback === "string") {
            element.dataset.i18nFallback = fallback;
        }
        applyElement(element);
    }

    function setElementAttribute(element, attribute, key, fallback, params) {
        if (!element) {
            return;
        }
        element.setAttribute("data-i18n-" + attribute, key);
        if (params && Object.keys(params).length) {
            element.setAttribute("data-i18n-params", JSON.stringify(params));
        }
        if (typeof fallback === "string") {
            element.setAttribute("data-i18n-fallback-" + attribute, fallback);
        }
        applyElement(element);
    }

    function applyElement(element) {
        const params = readParams(element);
        const textKey = element.getAttribute("data-i18n");
        const htmlKey = element.getAttribute("data-i18n-html");
        const contentKey = textKey || htmlKey;
        if (contentKey) {
            const resolved = resolvedValue(contentKey);
            let fallback = element.dataset.i18nFallback;
            if (typeof fallback !== "string") {
                fallback = htmlKey ? element.innerHTML : element.textContent;
                element.dataset.i18nFallback = fallback;
            }
            const value = resolved
                ? interpolate(resolved.value, params)
                : fallback;
            if (htmlKey) {
                if (element.innerHTML !== value) {
                    element.innerHTML = value;
                }
            } else if (element.textContent !== value) {
                element.textContent = value;
            }
            if (resolved && resolved.locale !== activeLocale) {
                element.lang = resolved.locale;
            } else if (element.hasAttribute("lang") && element.lang !== activeLocale) {
                element.removeAttribute("lang");
            }
        }

        ["aria-label", "aria-description", "title", "placeholder", "alt"].forEach(function (attribute) {
            const key = element.getAttribute("data-i18n-" + attribute);
            if (!key) {
                return;
            }
            const resolved = resolvedValue(key);
            const fallbackAttribute = "data-i18n-fallback-" + attribute;
            let fallback = element.getAttribute(fallbackAttribute);
            if (fallback === null) {
                fallback = element.getAttribute(attribute) || "";
                element.setAttribute(fallbackAttribute, fallback);
            }
            element.setAttribute(
                attribute,
                resolved ? interpolate(resolved.value, params) : fallback
            );
        });

        const priceAmount = element.getAttribute("data-i18n-price-amount");
        if (priceAmount !== null) {
            const amount = Number(priceAmount);
            if (Number.isFinite(amount)) {
                element.textContent = formatNumber(amount) + " FCFA";
            }
        }

        if (
            element.hasAttribute("data-i18n-wa-product")
            || element.hasAttribute("data-i18n-wa-message")
        ) {
            updateWhatsAppLink(element);
        }
    }

    function applyTranslations(root) {
        const scope = root || document;
        if (scope.nodeType === Node.ELEMENT_NODE) {
            applyElement(scope);
        }
        if (typeof scope.querySelectorAll !== "function") {
            return;
        }
        scope.querySelectorAll(
            "[data-i18n], [data-i18n-html], [data-i18n-aria-label], " +
            "[data-i18n-aria-description], [data-i18n-title], " +
            "[data-i18n-placeholder], [data-i18n-alt], " +
            "[data-i18n-price-amount], [data-i18n-wa-product], [data-i18n-wa-message]"
        ).forEach(applyElement);
    }

    function updateWhatsAppLink(link) {
        try {
            const target = new URL(link.href);
            if (target.hostname.toLowerCase() !== "wa.me") {
                return;
            }
            const productName = link.getAttribute("data-i18n-wa-product");
            const messageKey = link.getAttribute("data-i18n-wa-message");
            const message = messageKey
                ? translate(messageKey, {}, "")
                : translate(
                    "product.buyMessage",
                    { name: productName },
                    "Je souhaite acheter " + productName + "."
                );
            target.searchParams.set("text", message);
            link.href = target.href;
        } catch (error) {
            console.warn("Lumesys i18n: lien WhatsApp produit invalide.", error);
        }
    }

    function productText(product, field, fallback) {
        const translations = product && product.translations;
        const localeValues = translations && (
            translations[activeLocale]
            || (activeLocale === "zh-CN" && translations.zh)
        );
        const value = localeValues && localeValues[field];
        return typeof value === "string" && value.trim()
            ? value
            : String(fallback || (product && product[field]) || "");
    }

    function translateProductFragment(root) {
        if (!root || typeof root.querySelectorAll !== "function") {
            return;
        }

        const headings = root.querySelectorAll("h3[id]");
        headings.forEach(function (heading) {
            const id = heading.id.toLowerCase();
            if (!knownSubcategories.has(id)) {
                return;
            }
            const key = "categories.sub." + id;
            setElementText(heading, key, heading.textContent.trim());
        });

        root.querySelectorAll(".bouton").forEach(function (button) {
            setElementText(button, "product.buy", button.textContent.trim() || "Acheter");
            const productHeading = button.closest(".ccard")
                ? button.closest(".ccard").querySelector("h3")
                : null;
            const productName = productHeading ? productHeading.textContent.trim() : "";
            if (productName) {
                button.setAttribute("data-i18n-wa-product", productName);
            }
        });

        root.querySelectorAll("img.product-image").forEach(function (image) {
            const originalAlt = image.getAttribute("alt") || "";
            const productName = originalAlt.replace(/^Produit\s+/i, "").trim();
            if (productName) {
                setElementAttribute(
                    image,
                    "alt",
                    "product.imageAlt",
                    originalAlt,
                    { name: productName }
                );
            }
            if (image.hasAttribute("title")) {
                setElementAttribute(
                    image,
                    "title",
                    "product.imageTitle",
                    image.getAttribute("title")
                );
            }
        });

        root.querySelectorAll(".ccard p span").forEach(function (span) {
            const text = span.textContent.trim();
            const amountMatch = text.match(/^([\d\s.,]+)\s*(?:FCFA|F\s*CFA|CFA)$/i);
            if (amountMatch) {
                const amount = Number(amountMatch[1].replace(/[^\d]/g, ""));
                if (Number.isFinite(amount)) {
                    span.setAttribute("data-i18n-price-amount", String(amount));
                }
                return;
            }
            const discountMatch = text.match(/Réduction de\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|CFA)\s*\((\d+)\s*%\s*de réduction\)/i);
            if (discountMatch) {
                setElementText(
                    span,
                    "product.discount",
                    text,
                    {
                        amount: Number(discountMatch[1].replace(/[^\d]/g, "")),
                        percent: Number(discountMatch[2])
                    }
                );
            }
        });
        applyTranslations(root);
    }

    function updatePicker() {
        pickerOptions.forEach(function (entry) {
            const selected = entry.locale.code === activeLocale;
            entry.button.setAttribute("aria-selected", String(selected));
            entry.button.classList.toggle("is-selected", selected);
            entry.indicator.textContent = selected ? "✓" : "";
        });
        const trigger = document.getElementById("language-picker-trigger");
        if (trigger) {
            setElementAttribute(trigger, "aria-label", "language.button", "Choisir la langue");
            trigger.setAttribute("aria-expanded", String(
                document.getElementById("language-picker-menu")
                    && !document.getElementById("language-picker-menu").hidden
            ));
        }
    }

    function closePicker(returnFocus) {
        const menu = document.getElementById("language-picker-menu");
        const trigger = document.getElementById("language-picker-trigger");
        if (menu) {
            menu.hidden = true;
        }
        if (trigger) {
            trigger.setAttribute("aria-expanded", "false");
            if (returnFocus) {
                trigger.focus();
            }
        }
    }

    function openPicker(focusSelected) {
        const menu = document.getElementById("language-picker-menu");
        const trigger = document.getElementById("language-picker-trigger");
        if (!menu || !trigger) {
            return;
        }
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        if (focusSelected) {
            const selected = pickerOptions.find(function (entry) {
                return entry.locale.code === activeLocale;
            });
            (selected ? selected.button : pickerOptions[0].button).focus();
        }
    }

    function movePickerFocus(current, direction) {
        const index = pickerOptions.findIndex(function (entry) {
            return entry.button === current;
        });
        if (index < 0 || !pickerOptions.length) {
            return;
        }
        const nextIndex = (index + direction + pickerOptions.length) % pickerOptions.length;
        pickerOptions[nextIndex].button.focus();
    }

    function buildPicker() {
        const menu = document.getElementById("language-picker-menu");
        const trigger = document.getElementById("language-picker-trigger");
        if (!menu || !trigger) {
            return;
        }
        menu.replaceChildren();
        setElementAttribute(menu, "aria-label", "language.menu", "Langue de l’interface");
        LOCALES.forEach(function (locale) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "language-picker-option";
            button.setAttribute("role", "option");
            button.setAttribute("lang", locale.code);
            button.dataset.locale = locale.code;
            const label = document.createElement("span");
            label.className = "language-picker-label";
            label.textContent = locale.flag + " " + locale.label;
            const indicator = document.createElement("span");
            indicator.className = "language-picker-indicator";
            indicator.setAttribute("aria-hidden", "true");
            button.append(label, indicator);
            button.addEventListener("click", function () {
                setLanguage(locale.code, "user").finally(function () {
                    closePicker(false);
                    trigger.focus();
                });
            });
            button.addEventListener("keydown", function (event) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    movePickerFocus(button, event.key === "ArrowDown" ? 1 : -1);
                } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    pickerOptions[event.key === "Home" ? 0 : pickerOptions.length - 1].button.focus();
                } else if (event.key === "Escape") {
                    event.preventDefault();
                    closePicker(true);
                }
            });
            pickerOptions.push({ locale: locale, button: button, indicator: indicator });
            menu.appendChild(button);
        });
        trigger.addEventListener("click", function () {
            if (menu.hidden) {
                openPicker(false);
            } else {
                closePicker(false);
            }
        });
        trigger.addEventListener("keydown", function (event) {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPicker(true);
            }
        });
        menu.addEventListener("keydown", function (event) {
            if (event.key === "Tab") {
                closePicker(false);
            }
        });
        document.addEventListener("click", function (event) {
            const picker = document.getElementById("language-picker");
            if (picker && !picker.contains(event.target) && !menu.hidden) {
                closePicker(false);
            }
        });
        updatePicker();
    }

    async function setLanguage(locale, source) {
        if (!supportedCodes.has(locale)) {
            return false;
        }
        const version = ++selectionVersion;
        const previousLocale = activeLocale;
        activeLocale = locale;
        setDocumentLocale(locale);
        updatePicker();
        try {
            localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        } catch (error) {
            console.warn("Lumesys i18n: impossible de mémoriser la langue.", error);
        }
        const dictionariesLoaded = await Promise.all([
            loadLocale("fr"),
            loadLocale(locale)
        ]);
        if (version !== selectionVersion) {
            return false;
        }
        applyTranslations(document);
        updatePicker();
        document.dispatchEvent(new CustomEvent("lumesys-language-changed", {
            detail: {
                locale: locale,
                previousLocale: previousLocale,
                source: source || "user",
                dictionaryAvailable: Boolean(dictionariesLoaded[1] || locale === "fr")
            }
        }));
        return true;
    }

    setDocumentLocale(activeLocale);
    buildPicker();

    const ready = Promise.all([
        loadLocale("fr"),
        loadLocale(activeLocale)
    ]).then(function () {
        applyTranslations(document);
        updatePicker();
        document.dispatchEvent(new CustomEvent("lumesys-language-changed", {
            detail: {
                locale: activeLocale,
                previousLocale: activeLocale,
                source: "initial",
                dictionaryAvailable: Boolean(dictionaries[activeLocale] || activeLocale === "fr")
            }
        }));
        return activeLocale;
    });

    const observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
            record.addedNodes.forEach(function (node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    applyTranslations(node);
                }
            });
        });
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    window.LumesysI18n = {
        locales: LOCALES.slice(),
        ready: ready,
        t: translate,
        setText: setElementText,
        setAttribute: setElementAttribute,
        apply: applyTranslations,
        translateProductFragment: translateProductFragment,
        productText: productText,
        formatNumber: formatNumber,
        formatPrice: function (amount) {
            return formatNumber(amount) + " FCFA";
        },
        setLanguage: setLanguage,
        getLocale: function () {
            return activeLocale;
        },
        getMissingKeys: function () {
            const french = dictionaries.fr || {};
            const localeDictionary = dictionaries[activeLocale] || {};
            const missing = [];
            function visit(value, prefix) {
                Object.keys(value || {}).forEach(function (key) {
                    if (key.charAt(0) === "_") {
                        return;
                    }
                    const path = prefix ? prefix + "." + key : key;
                    if (typeof value[key] === "string") {
                        if (typeof valueAt(localeDictionary, path) !== "string") {
                            missing.push(path);
                        }
                    } else if (value[key] && typeof value[key] === "object") {
                        visit(value[key], path);
                    }
                });
            }
            visit(french, "");
            return missing;
        }
    };
})();
