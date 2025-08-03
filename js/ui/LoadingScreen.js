/**
 * LoadingScreen - Composant d'écran de chargement
 * Affiche un indicateur de chargement pendant le traitement des données
 */
class LoadingScreen {
    /**
     * Affiche l'écran de chargement
     */
    static show() {
        const rightBlock = document.getElementsByClassName("rightColumn");
        if (rightBlock && rightBlock[0]) {
            const childBlock = rightBlock[0].children;

            const imgdiv = document.createElement('img');
            imgdiv.src = chrome.runtime.getURL("asset/Loading.gif");
            imgdiv.style.textAlign = "center";

            if (childBlock && childBlock[0]) {
                childBlock[0].innerHTML = "";
                childBlock[0].appendChild(imgdiv);
            } else {
                console.error("childBlock[0] not found in loadingScreen");
            }
        }
        
        // Dispatch l'événement de chargement
        if (typeof evt !== 'undefined') {
            evt.dispatch('loading_screen_display');
        }
    }
} 