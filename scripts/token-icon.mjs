import { MODULE_ID } from "./config.mjs";

function layout(token) {
    const c = token.lazydiceLight;
    if (!c || c.destroyed) return;

    const doc = token.document;
    const w = doc.width * canvas.grid.sizeX;
    const h = doc.height * canvas.grid.sizeY;
    const size = Math.max(16, Math.min(w, h) * 0.3);

    const [bg, sprite] = c.children;

    const tw = sprite.texture.orig?.width || sprite.texture.width || 1;
    const th = sprite.texture.orig?.height || sprite.texture.height || 1;
    const scale = (size - 4) / Math.max(tw, th);
    sprite.scale.set(scale, scale);
    sprite.position.set(2, 2);

    bg.clear();
    bg.beginFill(0x000000, 0.5);
    const hooded = token.document.getFlag(MODULE_ID, "hooded");
    bg.lineStyle(2, hooded ? 0x8a8a8a : 0xff9329, 1);
    bg.drawRoundedRect(sprite.x, sprite.y, sprite.width, sprite.height, 3);
    bg.endFill();

    c.position.set(w - size, h - size);
}

export async function refreshLightIcon(token) {
    const src = token.document.getFlag(MODULE_ID, "activeIcon");
    const current = token.lazydiceLight;

    if (!src) {
        if (current && !current.destroyed) current.destroy({ children: true });
        token.lazydiceLight = null;
        return;
    }

    if (current && !current.destroyed && current.iconSrc === src) {
        return layout(token);
    }

    if (token.lazydicePending) return;
    token.lazydicePending = true;

    try {
        if (current && !current.destroyed) current.destroy({ children: true });
        token.lazydiceLight = null;

        const texture = await foundry.canvas.loadTexture(src);
        if (token.destroyed) return;

        const container = new PIXI.Container();
        container.iconSrc = src;
        container.addChild(new PIXI.Graphics(), new PIXI.Sprite(texture));
        token.addChild(container);
        token.lazydiceLight = container;

        layout(token);
    } catch (err) {
        console.error(`${MODULE_ID} | ошибка иконки на токене`, err);
    } finally {
        token.lazydicePending = false;
    }
}

export function refreshLightBar(token) {
    const doc = token.document;
    const endsAt = doc.getFlag(MODULE_ID, "endsAt");
    const total = doc.getFlag(MODULE_ID, "total");
    let bar = token.lazydiceBar;

    if (endsAt == null || !total) {
        if (bar && !bar.destroyed) bar.destroy();
        token.lazydiceBar = null;
        return;
    }

    if (!bar || bar.destroyed) {
        bar = new PIXI.Graphics();
        token.addChild(bar);
        token.lazydiceBar = bar;
    }

    const w = doc.width * canvas.grid.sizeX;
    const h = doc.height * canvas.grid.sizeY;
    const frac = Math.min(1, Math.max(0, (endsAt - game.time.worldTime) / total));

    const bw = 3;
    const x = w + 3;
    const color = frac > 0.5 ? 0xffb347 : frac > 0.25 ? 0xff7a1a : 0xe03a1a;
    const fillH = h * frac;

    bar.clear();
    bar.beginFill(0x000000, 0.2);
    bar.drawRoundedRect(x - 1, -1, bw + 2, h + 2, 2);
    bar.endFill();

    if (fillH > 0) {
        bar.beginFill(color, 1);
        bar.drawRect(x, h - fillH, bw, fillH);
        bar.endFill();
    }
}