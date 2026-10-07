import { MODULE_ID, LIGHT_PRESETS, OIL_ALIASES } from "./config.mjs";
import { t, say } from "./i18n.mjs";

const processing = new Set();
const flag = key => `flags.${MODULE_ID}.${key}`;

/* ---------- Данные предмета ---------- */

function getPreset(item) {
    const presets = Object.values(LIGHT_PRESETS);

    const id = item.system?.identifier;
    if (id) {
        const byId = presets.find(p => p.identifiers?.includes(id));
        if (byId) return byId;
    }

    const name = item.name.toLowerCase();
    return presets.find(p => p.aliases.some(a => name.includes(a))) ?? null;
}

// Параметры света предмета; hooded: свет с опущенным колпаком
export function resolveLight(item, hooded = false) {
    const flagged = item.getFlag(MODULE_ID, "light");
    if (flagged) return flagged;

    const preset = getPreset(item);
    if (hooded && preset?.hoodedLight) return preset.hoodedLight;
    return preset?.light ?? null;
}

export function hasHood(item) {
    // Свои настройки через диалог «Свет» колпак отключают
    if (item.getFlag(MODULE_ID, "light")) return false;
    return !!getPreset(item)?.hoodedLight;
}

export const getBurnSeconds = item => getPreset(item)?.burnSeconds ?? null;
export const getFuelSeconds = item => getPreset(item)?.fuelSeconds ?? null;

export const baseNameOf = item =>
    item.getFlag(MODULE_ID, "burn")?.baseName ?? item.name;

export const getLightItems = actor => actor.items.filter(i => resolveLight(i));

// Сколько осталось гореть (null, если предмет горит бесконечно)
export function getRemaining(item, tokenDoc) {
    if (tokenDoc?.getFlag(MODULE_ID, "activeItem") === item.id) {
        const endsAt = tokenDoc.getFlag(MODULE_ID, "endsAt");
        if (endsAt != null) return Math.max(0, endsAt - game.time.worldTime);
    }

    if (getFuelSeconds(item) != null) {
        return item.getFlag(MODULE_ID, "fuel")?.remaining ?? 0;
    }
    const burn = item.getFlag(MODULE_ID, "burn");
    return burn ? burn.remaining : getBurnSeconds(item);
}

/* ---------- Масло ---------- */

function findOilFlask(actor) {
    return actor.items.find(i => {
        if (getPreset(i)) return false; // «Масляная лампа» — не фляга
        const name = i.name.toLowerCase();
        return OIL_ALIASES.some(a => name.includes(a)) && (i.system?.quantity ?? 1) > 0;
    });
}

async function consumeOne(item) {
    const qty = item.system?.quantity ?? 1;
    if (qty > 1) return item.update({ "system.quantity": qty - 1 });
    return item.delete();
}

/* ---------- Токены ---------- */

export function tokensOf(actor) {
    const tokens = [];

    if (actor.isToken) {
        if (actor.token) tokens.push(actor.token);
    } else {
        for (const scene of game.scenes) {
            for (const tokenDoc of scene.tokens) {
                if (tokenDoc.actorLink && tokenDoc.actorId === actor.id) tokens.push(tokenDoc);
            }
        }
    }
    return tokens;
}

function setTokenLight(tokenDoc, item, { endsAt = null, total = null, hooded = false } = {}) {
    return tokenDoc.update({
        light: resolveLight(item, hooded),
        [flag("activeItem")]: item.id,
        [flag("activeIcon")]: item.img,
        [flag("endsAt")]: endsAt,
        [flag("total")]: total,
        [flag("hooded")]: hooded
    });
}

export function clearTokenLight(tokenDoc) {
    return tokenDoc.update({
        light: { bright: 0, dim: 0 },
        [flag("activeItem")]: null,
        [flag("activeIcon")]: null,
        [flag("endsAt")]: null,
        [flag("total")]: null,
        [flag("hooded")]: null
    });
}

/* ---------- Зажигание и тушение ---------- */

async function extinguish(tokenDoc) {
    const item = tokenDoc.actor?.items.get(tokenDoc.getFlag(MODULE_ID, "activeItem"));
    const endsAt = tokenDoc.getFlag(MODULE_ID, "endsAt");

    if (item && endsAt != null) {
        const remaining = Math.max(0, endsAt - game.time.worldTime);

        if (getFuelSeconds(item) != null) {
            await item.setFlag(MODULE_ID, "fuel", { remaining });
        } else if (remaining <= 0) {
            await item.delete();
        } else {
            await item.update({
                name: `${baseNameOf(item)} (${t("Suffix.Partial")})`,
                [flag("burn.remaining")]: remaining
            });
        }
    }

    await clearTokenLight(tokenDoc);
}

async function igniteFuel(tokenDoc, item) {
    let remaining = item.getFlag(MODULE_ID, "fuel")?.remaining ?? 0;

    if (remaining <= 0) {
        const flask = findOilFlask(item.actor);
        if (!flask) {
            ui.notifications.warn(t("Notify.NoOil", { item: item.name }));
            return;
        }
        const flaskName = flask.name;
        await consumeOne(flask);
        remaining = getFuelSeconds(item);
        await item.setFlag(MODULE_ID, "fuel", { remaining });
        ui.notifications.info(t("Notify.Refueled", { item: item.name, flask: flaskName }));
    }

    // Фонарь всегда зажигается открытым
    return setTokenLight(tokenDoc, item, {
        endsAt: game.time.worldTime + remaining,
        total: getFuelSeconds(item)
    });
}

async function igniteBurning(tokenDoc, item, seconds) {
    const burningName = name => `${name} (${t("Suffix.Burning")})`;
    const burn = item.getFlag(MODULE_ID, "burn");
    let target = item;
    let remaining = seconds;

    if (burn) {
        // Уже начатый предмет: продолжаем с остатка
        remaining = burn.remaining;
        await item.update({ name: burningName(burn.baseName) });
    } else {
        const baseName = item.name;
        const burnData = { remaining, baseName };
        const qty = item.system?.quantity ?? 1;

        if (qty > 1) {
            // Отделяем один предмет от стопки
            await item.update({ "system.quantity": qty - 1 });

            const copy = item.toObject();
            delete copy._id;
            copy.name = burningName(baseName);
            copy.system.quantity = 1;
            foundry.utils.setProperty(copy, flag("burn"), burnData);

            [target] = await item.actor.createEmbeddedDocuments("Item", [copy]);
        } else {
            await item.update({ name: burningName(baseName), [flag("burn")]: burnData });
        }
    }

    return setTokenLight(tokenDoc, target, {
        endsAt: game.time.worldTime + remaining,
        total: seconds
    });
}

async function ignite(tokenDoc, item) {
    if (getFuelSeconds(item) != null) return igniteFuel(tokenDoc, item);

    const seconds = getBurnSeconds(item);
    if (seconds == null) return setTokenLight(tokenDoc, item); // горит бесконечно

    return igniteBurning(tokenDoc, item, seconds);
}

export async function toggleLight(tokenDoc, item) {
    const activeId = tokenDoc.getFlag(MODULE_ID, "activeItem");

    if (activeId) await extinguish(tokenDoc);
    if (activeId === item.id) return;

    await ignite(tokenDoc, item);
}

/* ---------- Колпак ---------- */

export async function toggleHood(tokenDoc) {
    const item = tokenDoc.actor?.items.get(tokenDoc.getFlag(MODULE_ID, "activeItem"));
    if (!item || !hasHood(item)) return;

    const hooded = !tokenDoc.getFlag(MODULE_ID, "hooded");

    await tokenDoc.update({
        light: resolveLight(item, hooded),
        [flag("hooded")]: hooded
    });

    await say(hooded ? "Chat.HoodDown" : "Chat.HoodUp", {
        name: tokenDoc.name,
        item: item.name
    });
}

/* ---------- Прогорание и удаление (выполняет ГМ) ---------- */

async function burnOut(tokenDoc) {
    const item = tokenDoc.actor?.items.get(tokenDoc.getFlag(MODULE_ID, "activeItem"));

    await clearTokenLight(tokenDoc);

    if (item && getFuelSeconds(item) != null) {
        await item.setFlag(MODULE_ID, "fuel", { remaining: 0 });
        await say("Chat.OutOfOil", { name: tokenDoc.name, item: item.name });
        return;
    }

    const name = item ? baseNameOf(item) : t("LightSource");
    if (item) await item.delete();
    await say("Chat.BurnedOut", { name: tokenDoc.name, item: name });
}

export async function expireBurnedOut() {
    if (game.users.activeGM?.id !== game.user.id) return;

    const now = game.time.worldTime;

    for (const scene of game.scenes) {
        for (const tokenDoc of scene.tokens) {
            // Кучи Item Piles обрабатываются в piles.mjs
            if (tokenDoc.getFlag(MODULE_ID, "pile")) continue;

            const endsAt = tokenDoc.getFlag(MODULE_ID, "endsAt");
            if (endsAt == null || endsAt > now) continue;
            if (processing.has(tokenDoc.uuid)) continue;

            processing.add(tokenDoc.uuid);
            try {
                await burnOut(tokenDoc);
            } finally {
                processing.delete(tokenDoc.uuid);
            }
        }
    }
}

export async function releaseDeletedItem(actor, itemId) {
    for (const tokenDoc of tokensOf(actor)) {
        if (tokenDoc.getFlag(MODULE_ID, "activeItem") === itemId) {
            await clearTokenLight(tokenDoc);
        }
    }
}