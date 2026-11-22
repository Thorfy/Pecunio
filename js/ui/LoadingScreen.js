import { BankinPage } from '../bankin/BankinPage.js';
import { Config } from '../core/Config.js';

/**
 * LoadingScreen - Composant d'écran de chargement
 * Affiche un indicateur de chargement pendant le traitement des données
 */
export class LoadingScreen {
    /**
     * Affiche l'écran de chargement
     */
    static show(bankin = new BankinPage(document)) {
        const slot = bankin.loadingSlot();
        if (!slot) return;
        const img = document.createElement('img');
        img.src = Config.getAssetURL("LOADING_GIF");
        img.style.textAlign = "center";
        slot.innerHTML = "";
        slot.appendChild(img);
    }
}
