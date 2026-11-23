import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
    doc,
    getDoc,
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAClwRQe3g4Cg9CAsn28l_sAihwlMQtGUI",
    authDomain: "lumina-analytics.firebaseapp.com",
    projectId: "lumina-analytics",
    databaseURL: "https://lumina-analytics-default-rtdb.firebaseio.com",
    storageBucket: "lumina-analytics.appspot.com",
    messagingSenderId: "239329398532",
    appId: "1:239329398532:web:2f68b196df0c4e6400ca51",
    measurementId: "G-J7LLPRXLJH"
};

const app = getApps().some(function (existingApp) {
    return existingApp.name === "[DEFAULT]";
})
    ? getApp()
    : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

function initializeMarketplaceFirestore() {
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });
    } catch (error) {
        console.warn("Lumesys : Firestore était déjà initialisé; réutilisation de l’instance active.", error);
        return getFirestore(app);
    }
}

const db = initializeMarketplaceFirestore();

async function loadUserData(user) {
    const email = String(user.email || "").trim().toLowerCase();
    const [privateProfile, publicProfile, legacyProfile, cart, favorites] = await Promise.all([
        getDoc(doc(db, "private_profiles", user.uid)),
        email ? getDoc(doc(db, "public_profiles", email)) : Promise.resolve(null),
        email ? getDoc(doc(db, "utilisateurs", email)) : Promise.resolve(null),
        getDoc(doc(db, "private_profiles", user.uid, "marketplace", "cart")),
        getDoc(doc(db, "private_profiles", user.uid, "marketplace", "favorites"))
    ]);
    let viewHistory = null;
    let viewHistorySyncAvailable = true;
    try {
        viewHistory = await getDoc(
            doc(db, "private_profiles", user.uid, "marketplace", "view_history")
        );
    } catch (error) {
        if (!error || error.code !== "permission-denied") {
            throw error;
        }
        viewHistorySyncAvailable = false;
        console.warn(
            "Lumesys : les règles Firestore de l’historique ne sont pas encore actives; l’historique reste local.",
            error
        );
    }

    return {
        privateProfile: privateProfile.exists() ? privateProfile.data() : {},
        publicProfile: publicProfile && publicProfile.exists() ? publicProfile.data() : {},
        legacyProfile: legacyProfile && legacyProfile.exists() ? legacyProfile.data() : {},
        cart: cart.exists() && Array.isArray(cart.data().items) ? cart.data().items : [],
        favorites: favorites.exists() && Array.isArray(favorites.data().items) ? favorites.data().items : [],
        viewHistorySyncAvailable: viewHistorySyncAvailable,
        viewHistory: viewHistory && viewHistory.exists() && Array.isArray(viewHistory.data().products)
            ? viewHistory.data().products
            : []
    };
}

async function saveUserData(user, state) {
    const writes = [
        setDoc(doc(db, "private_profiles", user.uid, "marketplace", "cart"), {
            items: state.cart,
            updatedAt: serverTimestamp()
        }),
        setDoc(doc(db, "private_profiles", user.uid, "marketplace", "favorites"), {
            items: state.favorites,
            updatedAt: serverTimestamp()
        })
    ];
    await Promise.all(writes);
}

async function saveViewHistory(user, products) {
    const history = Array.isArray(products)
        ? products.slice(0, 500).filter(function (view) {
            return view
                && typeof view.id === "string"
                && view.id.length > 0
                && Number.isFinite(Number(view.viewedAt))
                && Number(view.viewedAt) > 0;
        }).map(function (view) {
            return {
                id: view.id,
                viewedAt: Number(view.viewedAt)
            };
        })
        : [];

    await setDoc(doc(db, "private_profiles", user.uid, "marketplace", "view_history"), {
        products: history,
        updatedAt: serverTimestamp()
    });
}

if (window.LumesysCommerce) {
    window.LumesysCommerce.connectFirebase({
        onAuthStateChanged: function (callback) {
            return onAuthStateChanged(auth, callback);
        },
        signIn: function () {
            return signInWithPopup(auth, provider);
        },
        signOut: function () {
            return signOut(auth);
        },
        load: loadUserData,
        save: saveUserData,
        saveViewHistory: saveViewHistory
    });
} else {
    throw new Error("LumesysCommerce doit être chargé avant marketplace-firebase.js.");
}
