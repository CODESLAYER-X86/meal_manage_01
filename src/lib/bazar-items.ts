// Predefined bazar item catalog for smart autocomplete + ML normalization
// Each item has: normalized key, display name, Bangla aliases, category, default unit

export interface CatalogItem {
    key: string;           // ML-ready normalized name (english, lowercase)
    name: string;          // Display name in English
    bn: string;            // Bangla name
    aliases: string[];     // All searchable terms (bangla + english + variations)
    category: string;      // ML category
    defaultUnit: string;   // Default unit for this item
}

export const ITEM_CATALOG: CatalogItem[] = [
    // 🥩 Protein
    { key: "chicken", name: "Chicken", bn: "মুরগি", aliases: ["chicken", "murgi", "মুরগি", "broiler"], category: "protein", defaultUnit: "kg" },
    { key: "beef", name: "Beef", bn: "গরুর মাংস", aliases: ["beef", "goru", "গরু", "গরুর মাংস", "mangsho"], category: "protein", defaultUnit: "kg" },
    { key: "mutton", name: "Mutton", bn: "খাসির মাংস", aliases: ["mutton", "khashi", "খাসি", "খাসির মাংস"], category: "protein", defaultUnit: "kg" },
    { key: "egg", name: "Egg", bn: "ডিম", aliases: ["egg", "dim", "ডিম", "eggs"], category: "protein", defaultUnit: "pcs" },
    { key: "fish_rui", name: "Rui Fish", bn: "রুই মাছ", aliases: ["rui", "rohu", "রুই", "রুই মাছ"], category: "protein", defaultUnit: "kg" },
    { key: "fish_pangash", name: "Pangash Fish", bn: "পাঙ্গাশ", aliases: ["pangash", "পাঙ্গাশ", "pangas"], category: "protein", defaultUnit: "kg" },
    { key: "fish_tilapia", name: "Tilapia", bn: "তেলাপিয়া", aliases: ["tilapia", "তেলাপিয়া", "telapia"], category: "protein", defaultUnit: "kg" },
    { key: "fish_ilish", name: "Ilish Fish", bn: "ইলিশ", aliases: ["ilish", "hilsa", "ইলিশ"], category: "protein", defaultUnit: "kg" },
    { key: "fish_katla", name: "Katla Fish", bn: "কাতলা", aliases: ["katla", "কাতলা"], category: "protein", defaultUnit: "kg" },
    { key: "fish_other", name: "Fish (Other)", bn: "মাছ", aliases: ["fish", "mach", "মাছ"], category: "protein", defaultUnit: "kg" },
    { key: "dal_masur", name: "Masur Dal", bn: "মসুর ডাল", aliases: ["masur", "masoor", "মসুর", "মসুর ডাল", "red lentil"], category: "protein", defaultUnit: "kg" },
    { key: "dal_mug", name: "Mug Dal", bn: "মুগ ডাল", aliases: ["mug", "moong", "মুগ", "মুগ ডাল"], category: "protein", defaultUnit: "kg" },
    { key: "dal_motor", name: "Motor Dal", bn: "মটর ডাল", aliases: ["motor", "মটর", "মটর ডাল", "chana"], category: "protein", defaultUnit: "kg" },
    { key: "dal_other", name: "Dal (Other)", bn: "ডাল", aliases: ["dal", "ডাল", "lentil"], category: "protein", defaultUnit: "kg" },

    // 🥬 Vegetables
    { key: "potato", name: "Potato", bn: "আলু", aliases: ["potato", "alu", "আলু", "potatoes"], category: "vegetable", defaultUnit: "kg" },
    { key: "onion", name: "Onion", bn: "পেঁয়াজ", aliases: ["onion", "peyaj", "পেঁয়াজ", "pyaj"], category: "vegetable", defaultUnit: "kg" },
    { key: "garlic", name: "Garlic", bn: "রসুন", aliases: ["garlic", "roshun", "রসুন", "rosun"], category: "vegetable", defaultUnit: "kg" },
    { key: "ginger", name: "Ginger", bn: "আদা", aliases: ["ginger", "ada", "আদা"], category: "vegetable", defaultUnit: "kg" },
    { key: "tomato", name: "Tomato", bn: "টমেটো", aliases: ["tomato", "tometo", "টমেটো"], category: "vegetable", defaultUnit: "kg" },
    { key: "green_chili", name: "Green Chili", bn: "কাঁচা মরিচ", aliases: ["green chili", "kacha morich", "কাঁচা মরিচ", "morich"], category: "vegetable", defaultUnit: "kg" },
    { key: "eggplant", name: "Eggplant", bn: "বেগুন", aliases: ["eggplant", "begun", "বেগুন", "brinjal"], category: "vegetable", defaultUnit: "kg" },
    { key: "pointed_gourd", name: "Pointed Gourd", bn: "পটল", aliases: ["pointed gourd", "potol", "পটল", "parwal"], category: "vegetable", defaultUnit: "kg" },
    { key: "bitter_gourd", name: "Bitter Gourd", bn: "করলা", aliases: ["bitter gourd", "korola", "করলা", "karela"], category: "vegetable", defaultUnit: "kg" },
    { key: "bottle_gourd", name: "Bottle Gourd", bn: "লাউ", aliases: ["bottle gourd", "lau", "লাউ", "lauki"], category: "vegetable", defaultUnit: "pcs" },
    { key: "pumpkin", name: "Pumpkin", bn: "মিষ্টি কুমড়া", aliases: ["pumpkin", "mishti kumra", "মিষ্টি কুমড়া", "kumra"], category: "vegetable", defaultUnit: "kg" },
    { key: "cauliflower", name: "Cauliflower", bn: "ফুলকপি", aliases: ["cauliflower", "fulkopi", "ফুলকপি"], category: "vegetable", defaultUnit: "pcs" },
    { key: "cabbage", name: "Cabbage", bn: "বাঁধাকপি", aliases: ["cabbage", "badhakopi", "বাঁধাকপি"], category: "vegetable", defaultUnit: "pcs" },
    { key: "carrot", name: "Carrot", bn: "গাজর", aliases: ["carrot", "gajor", "গাজর"], category: "vegetable", defaultUnit: "kg" },
    { key: "cucumber", name: "Cucumber", bn: "শশা", aliases: ["cucumber", "shosha", "শশা"], category: "vegetable", defaultUnit: "kg" },
    { key: "spinach", name: "Spinach", bn: "পালং শাক", aliases: ["spinach", "palong", "পালং", "পালং শাক", "shak"], category: "vegetable", defaultUnit: "pcs" },
    { key: "coriander", name: "Coriander Leaves", bn: "ধনেপাতা", aliases: ["coriander", "dhonepata", "ধনেপাতা", "dhania"], category: "vegetable", defaultUnit: "pcs" },
    { key: "bean", name: "Bean", bn: "শিম", aliases: ["bean", "shim", "শিম", "beans"], category: "vegetable", defaultUnit: "kg" },
    { key: "radish", name: "Radish", bn: "মূলা", aliases: ["radish", "mula", "মূলা"], category: "vegetable", defaultUnit: "kg" },
    { key: "okra", name: "Okra", bn: "ঢেঁড়স", aliases: ["okra", "dherosh", "ঢেঁড়স", "ladies finger"], category: "vegetable", defaultUnit: "kg" },
    { key: "vegetable_mixed", name: "Mixed Vegetables", bn: "সবজি", aliases: ["vegetables", "sobji", "সবজি", "mixed veg"], category: "vegetable", defaultUnit: "kg" },

    // 🍚 Staples
    { key: "rice", name: "Rice", bn: "চাল", aliases: ["rice", "chal", "চাল", "miniket", "nazirshail"], category: "staple", defaultUnit: "kg" },
    { key: "soybean_oil", name: "Soybean Oil", bn: "সয়াবিন তেল", aliases: ["soybean oil", "soyabin tel", "সয়াবিন তেল", "tel", "তেল", "oil"], category: "staple", defaultUnit: "litre" },
    { key: "mustard_oil", name: "Mustard Oil", bn: "সরিষার তেল", aliases: ["mustard oil", "sorishar tel", "সরিষার তেল"], category: "staple", defaultUnit: "litre" },
    { key: "flour", name: "Flour (Atta)", bn: "আটা", aliases: ["flour", "atta", "আটা", "maida", "ময়দা"], category: "staple", defaultUnit: "kg" },
    { key: "sugar", name: "Sugar", bn: "চিনি", aliases: ["sugar", "chini", "চিনি"], category: "staple", defaultUnit: "kg" },
    { key: "salt", name: "Salt", bn: "লবণ", aliases: ["salt", "lobon", "লবণ"], category: "staple", defaultUnit: "kg" },
    { key: "bread", name: "Bread", bn: "রুটি/পাউরুটি", aliases: ["bread", "ruti", "pauruti", "রুটি", "পাউরুটি"], category: "staple", defaultUnit: "pcs" },

    // 🌶️ Spices
    { key: "turmeric", name: "Turmeric", bn: "হলুদ", aliases: ["turmeric", "holud", "হলুদ"], category: "spice", defaultUnit: "kg" },
    { key: "chili_powder", name: "Chili Powder", bn: "মরিচের গুঁড়া", aliases: ["chili powder", "morich gura", "মরিচের গুঁড়া", "mirchi"], category: "spice", defaultUnit: "kg" },
    { key: "cumin", name: "Cumin", bn: "জিরা", aliases: ["cumin", "jeera", "jira", "জিরা"], category: "spice", defaultUnit: "kg" },
    { key: "cinnamon", name: "Cinnamon", bn: "দারচিনি", aliases: ["cinnamon", "darchini", "দারচিনি"], category: "spice", defaultUnit: "packet" },
    { key: "bay_leaf", name: "Bay Leaf", bn: "তেজপাতা", aliases: ["bay leaf", "tejpata", "তেজপাতা"], category: "spice", defaultUnit: "packet" },
    { key: "garam_masala", name: "Garam Masala", bn: "গরম মশলা", aliases: ["garam masala", "gorom moshla", "গরম মশলা", "moshla"], category: "spice", defaultUnit: "packet" },
    { key: "spice_mixed", name: "Spices (Mixed)", bn: "মশলা", aliases: ["spice", "moshla", "মশলা", "masala"], category: "spice", defaultUnit: "packet" },

    // 🥛 Dairy
    { key: "milk", name: "Milk", bn: "দুধ", aliases: ["milk", "dudh", "দুধ"], category: "dairy", defaultUnit: "litre" },
    { key: "ghee", name: "Ghee", bn: "ঘি", aliases: ["ghee", "ghi", "ঘি"], category: "dairy", defaultUnit: "kg" },

    // 🧴 Others
    { key: "gas_cylinder", name: "Gas Cylinder", bn: "গ্যাস সিলিন্ডার", aliases: ["gas", "cylinder", "গ্যাস", "সিলিন্ডার"], category: "utility", defaultUnit: "pcs" },
    { key: "water", name: "Water Jar", bn: "পানির জার", aliases: ["water", "pani", "পানি", "jar"], category: "utility", defaultUnit: "pcs" },
    { key: "cleaning", name: "Cleaning Supplies", bn: "পরিষ্কার সামগ্রী", aliases: ["cleaning", "parishkar", "dish wash", "vim", "soap", "সাবান"], category: "utility", defaultUnit: "pcs" },
    { key: "tissue", name: "Tissue/Napkin", bn: "টিস্যু", aliases: ["tissue", "napkin", "টিস্যু"], category: "utility", defaultUnit: "pcs" },
];

// Search the catalog: fuzzy match on all aliases
export function searchCatalog(query: string, limit = 5): CatalogItem[] {
    if (!query || query.trim().length === 0) return [];
    const q = query.toLowerCase().trim();

    // Exact prefix matches first, then contains matches
    const prefixMatches: CatalogItem[] = [];
    const containsMatches: CatalogItem[] = [];

    for (const item of ITEM_CATALOG) {
        const isPrefix = item.aliases.some(a => a.toLowerCase().startsWith(q));
        const isContains = !isPrefix && item.aliases.some(a => a.toLowerCase().includes(q));

        if (isPrefix) prefixMatches.push(item);
        else if (isContains) containsMatches.push(item);
    }

    return [...prefixMatches, ...containsMatches].slice(0, limit);
}

// Normalize an item name to its catalog key (or return the original if not found)
export function normalizeItemName(itemName: string): { normalizedName: string; category: string } | null {
    const q = itemName.toLowerCase().trim();
    for (const item of ITEM_CATALOG) {
        if (item.aliases.some(a => a.toLowerCase() === q) || item.key === q || item.name.toLowerCase() === q) {
            return { normalizedName: item.key, category: item.category };
        }
    }
    return null; // Not in catalog — that's fine, it'll be "custom"
}
