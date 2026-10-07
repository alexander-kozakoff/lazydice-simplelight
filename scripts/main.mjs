import { addItemHeaderControl } from "./item-light.mjs";
import { injectLightButton } from "./ui.mjs";
import { refreshLightIcon, refreshLightBar } from "./token-icon.mjs";
import { expireBurnedOut, releaseDeletedItem } from "./light.mjs";
import {
    pilesAvailable, isBurning, dropLitItem,
    onItemArrived, onPileItemRemoved, expirePiles
} from "./piles.mjs";

function expireAll() {
    expireBurnedOut();
    expirePiles();
}

Hooks.once("ready", expireAll);

Hooks.on("updateWorldTime", () => {
    expireAll();
    for (const token of canvas.tokens?.placeables ?? []) refreshLightBar(token);
});

Hooks.on("renderTokenHUD", injectLightButton);
Hooks.on("getHeaderControlsApplicationV2", addItemHeaderControl);

Hooks.on("refreshToken", token => {
    refreshLightIcon(token);
    refreshLightBar(token);
});

Hooks.on("createItem", onItemArrived);

Hooks.on("deleteItem", (item, options, userId) => {
    onPileItemRemoved(item);

    if (game.user.id !== userId || !item.parent) return;
    releaseDeletedItem(item.parent, item.id);
});

// Горящий предмет, брошенный из инвентаря на сцену, становится кучей Item Piles
Hooks.on("dropCanvasData", (canvas, data) => {
    if (data.type !== "Item" || !data.uuid || !pilesAvailable()) return;

    const item = fromUuidSync(data.uuid);
    if (!item?.actor || !item.isOwner || !isBurning(item)) return;

    dropLitItem(item, data.x, data.y);
    return false;
});