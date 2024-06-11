import { registerSettings } from "./settings.js";

export let debugEnabled = 0;

export let debug = (...args) => {
    if (debugEnabled > 1) console.log("DEBUG: combatdetails | ", ...args);
};
export let log = (...args) => console.log("monks-hotbar-expansion | ", ...args);
export let warn = (...args) => {
    if (debugEnabled > 0) console.warn("monks-hotbar-expansion | ", ...args);
};
export let error = (...args) => console.error("monks-hotbar-expansion | ", ...args);

export const setDebugLevel = (debugText) => {
    debugEnabled = { none: 0, warn: 1, debug: 2, all: 3 }[debugText] || 0;
    // 0 = none, warnings = 1, debug = 2, all = 3
    if (debugEnabled >= 3)
        CONFIG.debug.hooks = true;
};

export let i18n = key => {
    return game.i18n.localize(key);
};
export let setting = key => {
    return game.settings.get("monks-hotbar-expansion", key);
};

const WithMonksHotbarExpansion = (Hotbar) => {
    class MonksHotbarExpansion extends Hotbar {
        constructor(...args) {
            super(...args);

            this.macrolist = [];
            this._pagecollapsed = setting("collapse-on-open");
        }

        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                id: "hotbar",
                template: "./modules/monks-hotbar-expansion/templates/hotbar.html",
                popOut: false,
                dragDrop: [{ dragSelector: ".macro-icon", dropSelector: ".macro-list" }]
            });
        }

        async getData() {
            const data = await super.getData();

            const numberOfRows = setting('number-rows');
            this.macrolist = [];

            for (let i = 1; i <= numberOfRows; i++) {
                let macros = this._getMacrosByPage(i);

                this.macrolist.push({ page: i, macros: macros, selected: i == this.page });
            }

            data.showArrows = !setting("hide-page-arrows");
            data.barClass = [
                (setting('hide-page-arrows') ? 'no-arrows' : ''),
                (this._collapsed ? 'collapsed' : '')
            ].filter(c => c).join(' ');

            data.macrolist = this.macrolist;
            data.pageClass = [
                (setting('reverse-row-order') ? 'reverse' : ''),
                (setting('hide-first-row') ? 'hidefirst' : ''),
                (game.modules.get("custom-hotbar")?.active === true ? 'custom-hotbar' : ''),
                //(game.modules.get("rpg-styled-ui")?.active === true ? 'rpg-ui' : ''),
                (this._pagecollapsed ? 'collapsed' : '')
            ].filter(c => c).join(' ');

            return data;
        }

        activateListeners(html) {
            super.activateListeners(html);

            html.find('#hotbar-page-controls .page-number').click(this._onTogglePage.bind(this));

            html.find('#hotbar-page .page-number').click(this.selectPage.bind(this));
            html.find('#hotbar-page .clear-row').click(this.clearMacroRow.bind(this));
        }

        async _onTogglePage(event) {
            event.preventDefault();
            if (this._pagecollapsed) return this.expandPage();
            else return this.collapsePage();
        }

        async collapsePage() {
            if (this._pagecollapsed) return true;
            const page = this.element.find("#hotbar-page");
            return new Promise(resolve => {
                page.slideUp(200, () => {
                    page.addClass("collapsed");
                    this._pagecollapsed = true;
                    resolve(true);
                });
            });
        }

        async expandPage() {
            if (!this._pagecollapsed) return true;
            const page = this.element.find("#hotbar-page");
            return new Promise(resolve => {
                page.slideDown(200, () => {
                    page.removeClass("collapsed");
                    page.css({"display":""});
                    this._pagecollapsed = false;
                    resolve(true);
                });
            });
        }

        async collapse() {
            super.collapse();
            this.element.find("#hotbar-page-controls").css("display", "none");
        }

        async expand() {
            super.expand();
            this.element.find("#hotbar-page-controls").css("display", "");
        }

        selectPage(event) {
            let page = $(event.currentTarget).closest('.hotbar-page-row').data('page');
            this.changePage(page);
            if (setting("collapse-on-select")) {
                window.setTimeout(this.collapsePage.bind(this), 100);
            }
        }

        changePage(page) {
            super.changePage(page);
        }

        async clearMacroRow(event) {
            return Dialog.confirm({
                title: `Clearing Macro Row`,
                content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>You are about to remove all macros from this row</p>`,
                yes: async () => {
                    let page = $(event.currentTarget).closest('.hotbar-page-row').data('page');
                    for (let i = 1; i <= 10; i++) {
                        await game.user.assignHotbarMacro(null, ((page - 1) * 10) + i);
                    }
                }
            });
        }
    }

    const constructorName = "MonksHotbarExpansion";
    Object.defineProperty(MonksHotbarExpansion.prototype.constructor, "name", { value: constructorName });
    return MonksHotbarExpansion;
}

Hooks.on('init', () => {
    registerSettings();
    CONFIG.ui.hotbar = WithMonksHotbarExpansion(CONFIG.ui.hotbar);

    game.keybindings.register('monks-hotbar-expansion', 'toggle-key', {
        name: 'MonksHotbarExpansion.toggle-key.name',
        hint: 'MonksHotbarExpansion.toggle-key.hint',
        editable: [{ key: '`', modifiers: [KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar._onTogglePage(data.event); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-1', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key1', modifiers: [KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(1); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-2', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key2', modifiers: [KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(2); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-3', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key3', modifiers: [KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(3); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-4', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key4', modifiers: [KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(4); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-5', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key5', modifiers: [KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(5); },
    });
});