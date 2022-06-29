const DEFAULT_CONFIG = {
    dirs: [],
    entry: null,
    out: null,
    options: {
        clear: false,
        moveTopLevelFiles: true
    },
    watch: false,
    ignore: [".*node_modules.*", "\\.gitignore"]
};
function deepMerge(target, source) {
    for (let key of Object.keys(source)) {
        if (!target.hasOwnProperty(key) || typeof source[key] !== 'object')
            target[key] = source[key];
        else
            deepMerge(target[key], source[key]);
    }
    return target;
}
function checkStructure(config) {
    config = deepMerge(DEFAULT_CONFIG, config);
    if (!(typeof config === "object")) {
        return false;
    }
    if (typeof config.entry !== "string") {
        return false;
    }
    return config;
}
export { checkStructure };
