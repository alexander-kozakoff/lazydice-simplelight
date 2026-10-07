export function t(key, data) {
    const full = `LAZYDICE.${key}`;
    return data ? game.i18n.format(full, data) : game.i18n.localize(full);
}

// Сообщение в чат; значения подстановок экранируются
export function say(key, data = {}) {
    const safe = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, Handlebars.escapeExpression(String(v))])
    );
    return ChatMessage.create({
        content: `<p>${game.i18n.format(`LAZYDICE.${key}`, safe)}</p>`
    });
}