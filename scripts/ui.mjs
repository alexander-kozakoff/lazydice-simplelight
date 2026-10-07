import { MODULE_ID } from "./config.mjs";
import { t } from "./i18n.mjs";
import { getLightItems, getRemaining, toggleLight, toggleHood, hasHood } from "./light.mjs";

function formatTime(seconds) {
    const m = Math.ceil(seconds / 60);
    if (m < 60) return t("Time.Minutes", { m });

    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? t("Time.HoursMinutes", { h, m: rest }) : t("Time.Hours", { h });
}

function tooltipFor(item, tokenDoc, isActive, hooded) {
    const remaining = getRemaining(item, tokenDoc);
    let tip;

    if (remaining == null) tip = item.name;
    else if (remaining <= 0) tip = t("Palette.NoFuel", { item: item.name });
    else tip = t("Palette.Remaining", { item: item.name, time: formatTime(remaining) });

    if (isActive && hasHood(item)) {
        tip += ` · ${t(hooded ? "Palette.HoodLowered" : "Palette.HoodHint")}`;
    }
    return tip;
}

export function injectLightButton(hud, html) {
    const token = hud.object;
    const actor = token?.actor;
    if (!actor) return;

    const left = html.querySelector(".col.left");
    if (!left) return;

    const items = getLightItems(actor);
    const activeId = token.document.getFlag(MODULE_ID, "activeItem");
    const hooded = token.document.getFlag(MODULE_ID, "hooded");

    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("control-icon", "lazydice-light-toggle");
    button.dataset.tooltip = t("Palette.Title");
    button.innerHTML = '<i class="fa-solid fa-fire"></i>';

    const palette = document.createElement("div");
    palette.classList.add("palette", "lazydice-light-palette");

    if (!items.length) {
        const empty = document.createElement("div");
        empty.classList.add("lazydice-empty");
        empty.textContent = t("Palette.NoSources");
        palette.append(empty);
    }

    for (const item of items) {
        const isActive = item.id === activeId;

        const entry = document.createElement("div");
        entry.classList.add("palette-item", "lazydice-light-item");
        if (isActive) entry.classList.add("active");
        entry.dataset.tooltip = tooltipFor(item, token.document, isActive, hooded);

        const qty = item.system?.quantity ?? 1;
        if (qty > 1) entry.dataset.qty = qty;

        const img = document.createElement("img");
        img.src = item.img;
        img.alt = item.name;
        entry.append(img);

        entry.addEventListener("click", async () => {
            await toggleLight(token.document, item);
            hud.render({ force: true });
        });

        entry.addEventListener("contextmenu", async ev => {
            ev.preventDefault();
            ev.stopPropagation();

            if (!isActive) return ui.notifications.info(t("Notify.HoodNeedsLit"));
            if (!hasHood(item)) return ui.notifications.info(t("Notify.NoHood", { item: item.name }));

            await toggleHood(token.document);
            hud.render({ force: true });
        });

        palette.append(entry);
    }

    button.addEventListener("click", ev => {
        ev.preventDefault();
        palette.classList.toggle("active");
    });

    left.append(button, palette);
}