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

        dragSlot;
        dropTarget;

        static DEFAULT_OPTIONS = {
            id: "hotbar",
            actions: {
                togglePage: MonksHotbarExpansion.onTogglePage,
                selectPage: MonksHotbarExpansion.onSelectPage,
                clearMacros: MonksHotbarExpansion.onClearMacros
            }
        }

        static PARTS = {
            hotbar: {
                root: true,
                template: "./modules/monks-hotbar-expansion/templates/hotbar.html"
            }
        };

        async _prepareContext(options) {
            const context = await super._prepareContext(options);

            const numberOfRows = setting('number-rows');
            this.macrolist = [];

            for (let i = 1; i <= numberOfRows; i++) {
                let macros = game.user.getHotbarMacros(i).map((m, i) => {
                    return Object.assign(m, {
                        key: i < 9 ? i + 1 : 0,
                        img: m.macro?.img ?? null,
                        cssClass: m.macro ? "full" : "open",
                        tooltip: m.macro?.name ?? null,
                        ariaLabel: m.macro?.name ?? game.i18n.localize("HOTBAR.EMPTY")
                    });
                });

                this.macrolist.push({ page: i, macros: macros, selected: i == this.page });
            }

            context.showArrows = !setting("hide-page-arrows");
            context.barClass = [
                (setting('hide-page-arrows') ? 'no-arrows' : '')
            ].filter(c => c).join(' ');

            context.macrolist = this.macrolist;
            context.pageClass = [
                (setting('reverse-row-order') ? 'reverse' : ''),
                (setting('hide-first-row') ? 'hidefirst' : ''),
                (setting('hide-page-arrows') ? 'no-arrows' : ''),
                (game.modules.get("custom-hotbar")?.active === true ? 'custom-hotbar' : ''),
                //(game.modules.get("rpg-styled-ui")?.active === true ? 'rpg-ui' : ''),
                (this._pagecollapsed ? 'collapsed' : '')
            ].filter(c => c).join(' ');

            return context;
        }

        async _onRender(context, options) {
            this._updateToggles();

            // Drag and Drop
            new foundry.applications.ux.DragDrop.implementation({
                dragSelector: ".slot.full",
                dropSelector: ".slot",
                callbacks: {
                    dragstart: this.onDragStart.bind(this),
                    dragend: this.onDragEnd.bind(this),
                    dragover: this.onDragOver.bind(this),
                    drop: this.onDragDrop.bind(this)
                }
            }).bind(this.element);

            new foundry.applications.ux.DragDrop.implementation({
                dragSelector: ".slot.full",
                dropSelector: ".macro-list",
                callbacks: {
                    dragstart: this.onDragStart.bind(this),
                    dragend: this.onDragEnd.bind(this),
                    dragover: this.onDragOver.bind(this),
                    drop: this.onDragDrop.bind(this)
                }
            }).bind(this.element);
        };

        static async onTogglePage(event, target) {
            if (this._pagecollapsed) return this.expandPage();
            else return this.collapsePage();
        }

        async collapsePage() {
            $(this.element).removeClass("expanded");
            if (this._pagecollapsed) return true;
            const page = $("#hotbar-page", this.element);
            return new Promise(resolve => {
                page.slideUp(200, () => {
                    page.addClass("collapsed");
                    this._pagecollapsed = true;
                    resolve(true);
                });
            });
        }

        async expandPage() {
            $(this.element).addClass("expanded");
            if (!this._pagecollapsed) return true;
            const page = $("#hotbar-page", this.element);
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
            $("#hotbar-controls-right", this.element).css("display", "none");
        }

        async expand() {
            super.expand();
            $("#hotbar-controls-right", this.element).css("display", "");
        }

        static onSelectPage(event, target) {
            let page = target.closest('.hotbar-page-row').dataset.page;
            this.changePage(parseInt(page));
            if (setting("collapse-on-select")) {
                window.setTimeout(this.collapsePage.bind(this), 100);
            }
        }

        changePage(page) {
            super.changePage(page);
        }

        static async onClearMacros(event, target) {
            const confirm = await foundry.applications.api.DialogV2.confirm({
                window: {
                    title: `Clearing Macro Row`,
                },
                content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>You are about to remove all macros from this row</p>`,
            });

            if (confirm) {
                let page = target.closest('.hotbar-page-row').dataset.page;
                for (let i = 1; i <= 10; i++) {
                    await game.user.assignHotbarMacro(null, ((page - 1) * 10) + i);
                }
            }
        }

        getMacroForSlot(element) {
            const slot = element.dataset.slot;
            const macroId = game.user.hotbar[slot];
            if (!macroId) return null;
            return game.macros.get(macroId) ?? null;
        }

        onDragStart(event) {
            const li = event.target.closest(".slot");
            const macro = this.getMacroForSlot(li);
            if (!macro || this.locked) {
                event.preventDefault();
                return;
            }
            this.dragSlot = li.dataset.slot;
            const dragData = foundry.utils.mergeObject(macro.toDragData(), { slot: this.dragSlot });
            event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        }

        onDragEnd() {
            this.dragSlot = undefined;
        }

        onDragOver(event) {
            const target = event.target.closest(".slot");
            if (target === this.dropTarget) return;
            if (this.dropTarget) this.dropTarget.classList.remove("drop-target");
            this.dropTarget = target;
            if (!target || (target.dataset.slot === this.dragSlot)) return;
            target.classList.add("drop-target");
        }

        async onDragDrop(event) {
            if (this.dropTarget) {
                this.dropTarget.classList.remove("drop-target");
                this.dropTarget = undefined;
            }

            // Get the dropped slot
            const li = event.target.closest(".slot");
            const dropSlot = li.dataset.slot;
            if (this.dragSlot === dropSlot) return;
            this.dragSlot = undefined;

            // Get the Macro to add
            const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
            if (Hooks.call("hotbarDrop", this, data, dropSlot) === false) return;
            if (this.locked) return;  // Do nothing if the bar is locked

            // Get the dropped Document
            const cls = getDocumentClass(data.type);
            const doc = await cls?.fromDropData(data);
            if (!doc) return;

            // Get or create a Macro to add to the bar
            let macro;
            if (data.type === "Macro") macro = game.macros.has(doc.id) ? doc : await cls.create(doc.toObject());
            else if (data.type === "RollTable") macro = await this._createRollTableRollMacro(doc);
            else macro = await this._createDocumentSheetToggle(doc);

            // Assign the macro to the hotbar
            if (!macro) return;
            return game.user.assignHotbarMacro(macro, dropSlot, { fromSlot: data.slot });
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
        editable: [{ key: '`', modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar._onTogglePage(data.event); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-1', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key1', modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(1); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-2', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key2', modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(2); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-3', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key3', modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(3); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-4', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key4', modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(4); },
    });
    game.keybindings.register('monks-hotbar-expansion', 'switch-5', {
        name: 'MonksHotbarExpansion.switch-row.name',
        editable: [{ key: 'Key5', modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS?.SHIFT] }],
        onDown: (data) => { ui.hotbar.changePage(5); },
    });
});