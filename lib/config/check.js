const DEFAULT_CONFIG = {
    directories: {
        source: "src",
        build: "build",
        docs: "docs",
        assets: "assets"
    },
    entry: "./folders",
    outDir: "./out",
    moveTopLevelFiles: true,
    moveSourceFiles: [".*\\.html", "^.*\\.css$", ".*\\.js", ".*\\.php"],
    options: {
        docsMerge: {
            strategy: "ROOT_FOLDER",
            folder: "docs"
        }
    },
    autoClear: true,
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
    if (typeof config.directories !== "object" ||
        Array.isArray(config.directories)) {
        return false;
    }
    if (typeof config.directories.source !== "string" ||
        typeof config.directories.build !== "string") {
        return false;
    }
    if (typeof config.entry !== "string") {
        return false;
    }
    return config;
}
export { checkStructure };
