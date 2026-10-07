import { MODULE_ID } from "./config.mjs";
import { t } from "./i18n.mjs";

const DEFAULTS = {
    bright: 10, dim: 20, color: "#ff9329", alpha: 0.25, angle: 360,
    animation: { type: "torch", speed: 3, intensity: 3 }
};

export function addItemHeaderControl(app, controls) {
    const item = app.document;
    if (!(item instanceof Item) || !item.isOwner) return;

    controls.push({
        icon: "fa-solid fa-fire",
        label: "LAZYDICE.ItemDialog.Control",
        action: "lazydiceLight",
        visible: true,
        onClick: () => openLightDialog(item)
    });
}

async function openLightDialog(item) {
    const stored = item.getFlag(MODULE_ID, "light");
    const cur = foundry.utils.mergeObject(DEFAULTS, stored ?? {}, { inplace: false });

    const animations = Object.entries(CONFIG.Canvas.lightAnimations).map(([key, a]) =>
        `<option value="${key}" ${key === cur.animation.type ? "selected" : ""}>${game.i18n.localize(a.label)}</option>`);
    const animOptions = [
        `<option value="none" ${cur.animation.type === "none" ? "selected" : ""}>${t("ItemDialog.None")}</option>`,
        ...animations
    ].join("");

    const content = `
    <div class="lazydice-light-form">
      <p class="hint">${t("ItemDialog.Hint")}</p>
      <div class="form-group"><label>${t("ItemDialog.Enabled")}</label>
        <input type="checkbox" name="enabled" ${stored ? "checked" : ""}></div>
      <div class="form-group"><label>${t("ItemDialog.Bright")}</label>
        <input type="number" name="bright" value="${cur.bright}" min="0" step="any"></div>
      <div class="form-group"><label>${t("ItemDialog.Dim")}</label>
        <input type="number" name="dim" value="${cur.dim}" min="0" step="any"></div>
      <div class="form-group"><label>${t("ItemDialog.Color")}</label>
        <input type="color" name="color" value="${cur.color}"></div>
      <div class="form-group"><label>${t("ItemDialog.Alpha")}</label>
        <input type="number" name="alpha" value="${cur.alpha}" min="0" max="1" step="0.05"></div>
      <div class="form-group"><label>${t("ItemDialog.Animation")}</label>
        <select name="animation">${animOptions}</select></div>
    </div>`;

    const data = await foundry.applications.api.DialogV2.prompt({
        window: { title: t("ItemDialog.Title", { item: item.name }), icon: "fa-solid fa-fire" },
        content,
        ok: {
            label: t("ItemDialog.Save"),
            callback: (event, button) =>
                new foundry.applications.ux.FormDataExtended(button.form).object
        },
        rejectClose: false
    });
    if (!data) return;

    if (!data.enabled) return item.unsetFlag(MODULE_ID, "light");

    return item.setFlag(MODULE_ID, "light", {
        bright: Number(data.bright) || 0,
        dim: Number(data.dim) || 0,
        color: data.color,
        alpha: Number(data.alpha),
        angle: 360,
        animation: { type: data.animation, speed: 3, intensity: 3 }
    });
}