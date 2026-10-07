export const MODULE_ID = "lazydice-simplelight";

const NO_ANIMATION = { type: "none", speed: 1, intensity: 1 };

// burnSeconds: расходуемый предмет (сгорает целиком)
// fuelSeconds: многоразовый предмет, на один заряд масла
// identifiers: идентификаторы предметов dnd5e (проверяются первыми)
// aliases: подстроки названия; порядок важен (потайной раньше обычного)
// hoodedLight: свет с опущенным колпаком
export const LIGHT_PRESETS = {
    torch: {
        aliases: ["факел", "torch"],
        burnSeconds: 3600,
        light: {
            bright: 20, dim: 40, color: "#ff9329", alpha: 0.25, angle: 360,
            animation: { type: "torch", speed: 3, intensity: 3 }
        }
    },
    candle: {
        aliases: ["свеч", "candle"],
        burnSeconds: 3600,
        light: {
            bright: 5, dim: 10, color: "#ffb347", alpha: 0.2, angle: 360,
            animation: { type: "torch", speed: 2, intensity: 2 }
        }
    },
    lamp: {
        aliases: ["ламп", "lamp"],
        fuelSeconds: 21600,
        light: {
            bright: 15, dim: 30, color: "#ffd27f", alpha: 0.2, angle: 360,
            animation: { type: "torch", speed: 2, intensity: 2 }
        }
    },
    bullseye: {
        identifiers: ["bullseye-lantern"],
        aliases: ["потайн", "bullseye"],
        fuelSeconds: 21600,
        light: {
            bright: 60, dim: 120, color: "#ffd27f", alpha: 0.2, angle: 53,
            animation: NO_ANIMATION
        }
    },
    hooded: {
        identifiers: ["hooded-lantern"],
        aliases: ["фонар", "lantern"],
        fuelSeconds: 21600,
        light: {
            bright: 30, dim: 60, color: "#ffd27f", alpha: 0.2, angle: 360,
            animation: { type: "torch", speed: 2, intensity: 2 }
        },
        hoodedLight: {
            bright: 0, dim: 5, color: "#ffd27f", alpha: 0.2, angle: 360,
            animation: NO_ANIMATION
        }
    }
};

export const OIL_ALIASES = ["масло", "oil"];