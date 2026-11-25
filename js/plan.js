// El plan real vive cifrado en plan.enc.json y se carga al desbloquear (ver lock.js).
// La copia editable sin cifrar está en private/plan.json, solo en la Mac.
// Estas variables se llenan con setPlan() y los módulos que las importan ven el valor nuevo.

export let SLOTS = [];
export let WEEKS = [];
export let STORIES = [];
export let DAYS = [];
export let RULES = [];
export let CATEGORIES = [];
export let CATEGORY_HINTS = {};
export let ASSET_STATUS = [];
export let METRICS = [];

export function setPlan(p) {
  ({ SLOTS, WEEKS, STORIES, DAYS, RULES, CATEGORIES, CATEGORY_HINTS, ASSET_STATUS, METRICS } = p);
}
