import { MODULE_ID } from "./config.mjs";
import { t, say } from "./i18n.mjs";
import {
    baseNameOf, getBurnSeconds, getFuelSeconds, resolveLight, tokensOf
} from "./light.mjs";

const processing = new Set();
const flag = key => `flags.${MODULE_ID}.${key}`;

const isPileToken = tokenDoc => !!tokenDoc?.getFlag(MODULE_ID, "pile");

export function pilesAvailable() {
    return typeof game.itempiles?.API?.createItemPile === "function";
}

export function isBurning(item) {
    if (!item.actor) return false;
    if (getBurnSeconds(item) == null && getFuelSeconds(item) == null) return false;
    return tokensOf(item.actor).some(tk => tk.getFlag(MODULE_ID, "activeItem") === item.id);
}

// Данные о горении предмета, пока он лежит на земле
function groundInfo(item) {
    const burn = item.getFlag(MODULE_ID, "burn");
    if (burn?.groundEndsAt) return { kind: "burn", ...burn };

    const fuel = item.getFlag(MODULE_ID, "fuel");
    if (fuel?.groundEndsAt) return { kind: "fuel", ...fuel };

    return null;
}

/* ---------- Выброс горящего предмета ---------- */

export async function dropLitItem(item, x, y) {
    const tokenDoc = tokensOf(item.actor)
        .find(tk => tk.getFlag(MODULE_ID, "activeItem") === item.id);
    const endsAt = tokenDoc?.getFlag(MODULE_ID, "endsAt");
    const total = tokenDoc?.getFlag(MODULE_ID, "total");
    if (!tokenDoc || endsAt == null) return;

    const remaining = endsAt - game.time.worldTime;
    if (remaining <= 0) return;

    const isFuel = getFuelSeconds(item) != null;

    // Остаток масла хранится на предмете, у стопки он был бы общим
    if (isFuel && (item.system?.quantity ?? 1) > 1) {
        ui.notifications.warn(t("Notify.SplitStack", { item: item.name }));
        return;
    }

    const hooded = !!tokenDoc.getFlag(MODULE_ID, "hooded");
    const itemData = item.toObject();
    delete itemData._id;
    itemData.system.quantity = 1;

    if (isFuel) {
        foundry.utils.setProperty(itemData, flag("fuel"), {
            remaining,
            groundEndsAt: endsAt
        });
    } else {
        const baseName = baseNameOf(item);
        itemData.name = `${baseName} (${t("Suffix.Partial")})`;
        foundry.utils.setProperty(itemData, flag("burn"), {
            remaining,
            baseName,
            groundEndsAt: endsAt // абсолютный момент окончания, пока предмет лежит
        });
    }

    await game.itempiles.API.createItemPile({
        sceneId: canvas.scene.id,
        position: { x, y },
        items: [itemData],
        tokenOverrides: {
            light: foundry.utils.deepClone(resolveLight(item, hooded)),
            flags: { [MODULE_ID]: { pile: true, endsAt, total } }
        }
    });

    // Удаление предмета погасит свет на токене персонажа (хук deleteItem)
    await item.delete();
}

/* ---------- Предмет попал к актёру (подбор) ---------- */

export async function onItemArrived(item) {
    if (game.users.activeGM?.id !== game.user.id) return;

    const actor = item.parent;
    if (!actor || isPileToken(actor.token)) return; // не подбор, а создание в куче

    const info = groundInfo(item);
    if (!info) return;

    const remaining = info.groundEndsAt - game.time.worldTime;

    if (info.kind === "burn") {
        if (remaining <= 0) {
            await item.delete();
            await say("Chat.LiedBurned", { item: info.baseName ?? item.name });
            return;
        }

        await item.update({
            [flag("burn.remaining")]: remaining,
            [flag("burn.-=groundEndsAt")]: null
        });
        return;
    }

    // Лампа или фонарь: предмет остаётся, пересчитываем масло
    await item.update({
        [flag("fuel.remaining")]: Math.max(0, remaining),
        [flag("fuel.-=groundEndsAt")]: null
    });

    if (remaining <= 0) await say("Chat.LiedOutOfOil", { item: item.name });
}

/* ---------- Куча: предмет убран или прогорел ---------- */

async function releasePile(tokenDoc) {
    if (!tokenDoc?.parent?.tokens.has(tokenDoc.id)) return;
    if (!isPileToken(tokenDoc)) return;

    try {
        if ((tokenDoc.actor?.items.size ?? 0) === 0) return await tokenDoc.delete();

        await tokenDoc.update({
            light: { bright: 0, dim: 0 },
            [flag("pile")]: null,
            [flag("endsAt")]: null,
            [flag("total")]: null
        });
    } catch (err) {
        console.warn(`${MODULE_ID} | не удалось обновить кучу`, err);
    }
}

export async function onPileItemRemoved(item) {
    if (game.users.activeGM?.id !== game.user.id) return;
    if (!groundInfo(item)) return;

    const tokenDoc = item.parent?.token;
    if (isPileToken(tokenDoc)) await releasePile(tokenDoc);
}

/* ---------- Прогорание на земле ---------- */

export async function expirePiles() {
    if (game.users.activeGM?.id !== game.user.id) return;

    const now = game.time.worldTime;

    for (const scene of game.scenes) {
        for (const tokenDoc of scene.tokens) {
            if (!isPileToken(tokenDoc)) continue;

            const endsAt = tokenDoc.getFlag(MODULE_ID, "endsAt");
            if (endsAt == null || endsAt > now) continue;
            if (processing.has(tokenDoc.uuid)) continue;

            processing.add(tokenDoc.uuid);
            try {
                const lit = (tokenDoc.actor?.items ?? []).filter(i => groundInfo(i));

                for (const i of lit) {
                    const info = groundInfo(i);

                    if (info.kind === "burn") {
                        const name = info.baseName ?? i.name;
                        await i.delete();
                        await say("Chat.PileBurned", { item: name });
                    } else {
                        await i.update({
                            [flag("fuel.remaining")]: 0,
                            [flag("fuel.-=groundEndsAt")]: null
                        });
                        await say("Chat.PileOutOfOil", { item: i.name });
                    }
                }

                await releasePile(tokenDoc);
            } finally {
                processing.delete(tokenDoc.uuid);
            }
        }
    }
}