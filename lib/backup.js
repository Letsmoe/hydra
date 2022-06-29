function executeConfig(config) {
    const START_TIME = new Date().getTime();
    INFO_OBJECT.ignored = 0;
    INFO_OBJECT.failed = [];
    // Get the entry directory from config and the types of directories.
    const ENTRY_DIR = path.resolve(ROOT, PROJECT_DIR, config.entry);
    const OUT_DIR = path.resolve(ROOT, PROJECT_DIR, config.outDir);
    // Check if we're supposed to empty the directory after each run.
    if (config.autoClear) {
        // Check if the directory exists
        if (fs.existsSync(OUT_DIR)) {
            info(`AutoClear enabled. Clearing '${config.outDir}'...`);
            fs.rmSync(OUT_DIR, { recursive: true });
        }
    }
    /**
     * We now have the entry directory for the main project folder.
     * We expect to find several subfolders within this directory.
     * We want to move some items to the `outDir` folder.
     */
    // Let's start by creating the top-level subdirectories in the `outDir`
    // First create the `outDir` directory if it doesn't exist
    checkCreateDir(OUT_DIR);
    (() => {
        let topLevelDirectories = fs.readdirSync(ENTRY_DIR);
        topLevelDirectories.forEach(dir => {
            let dirPath = path.resolve(ENTRY_DIR, dir);
            if (fs.lstatSync(dirPath).isDirectory()) {
                // Create the directory in the `outDir`
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(path.resolve(OUT_DIR, dir));
                }
            }
            else if (config.moveTopLevelFiles === true) {
                // Move the file to the `outDir`, overwrite if necessary
                fs.copyFileSync(dirPath, path.resolve(OUT_DIR, dir));
            }
        });
    })();
    // We now spread the `build` directory into the destination folder.
    (() => {
        fs.readdirSync(ENTRY_DIR).map(x => {
            let buildDir = path.resolve(ENTRY_DIR, x, config.directories.build);
            if (fs.existsSync(buildDir)) {
                // Recurse through all files and folders and copy them over. Overwrite if necessary
                checkCreateDir(path.resolve(OUT_DIR, x));
                recurseCopy(buildDir, path.resolve(OUT_DIR, x));
            }
        });
    })();
    // Spread the `assets` into a separate folder.
    if (config.directories.assets) {
        (() => {
            fs.readdirSync(ENTRY_DIR).map(x => {
                let assetsDir = path.resolve(ENTRY_DIR, x, config.directories.assets);
                if (fs.existsSync(assetsDir)) {
                    // Recurse through all files and folders and copy them over. Overwrite if necessary
                    checkCreateDir(path.resolve(OUT_DIR, x, config.directories.assets));
                    recurseCopy(assetsDir, path.resolve(OUT_DIR, x, config.directories.assets));
                }
            });
        })();
    }
    // Check if the user requested to copy source files into the `dist` folder.
    if (Array.isArray(config.moveSourceFiles) && config.moveSourceFiles.length > 0) {
        (() => {
            fs.readdirSync(ENTRY_DIR).map(x => {
                let sourceDir = path.resolve(ENTRY_DIR, x, config.directories.source);
                if (fs.existsSync(sourceDir)) {
                    // Recurse through all files and folders and copy them over. Overwrite if necessary
                    checkCreateDir(path.resolve(OUT_DIR, x));
                    recurseCopy(sourceDir, path.resolve(OUT_DIR, x), (file) => {
                        return (config.moveSourceFiles.filter(regexp => {
                            return new RegExp(regexp).test(file);
                        }).length > 0) && (config.ignore.filter(regexp => {
                            return new RegExp(regexp).test(file);
                        }).length == 0);
                    });
                }
            });
        })();
    }
    // Now move the documentation into their appropriate folders
    (() => {
        if (config.options.docsMerge.strategy === "ROOT_FOLDER") {
            info("Using root folder for documentation merging.");
            // User wants to create a top-level `docs` folder and copy all subdirectory docs into it.
            let docsDir = path.resolve(PROJECT_DIR, config.options.docsMerge.folder);
            checkCreateDir(docsDir);
            fs.readdirSync(ENTRY_DIR).map(x => {
                if (fs.lstatSync(path.resolve(ENTRY_DIR, x)).isDirectory()) {
                    let subDocsDir = path.resolve(docsDir, x);
                    checkCreateDir(subDocsDir);
                    let dir = path.resolve(ENTRY_DIR, x, config.directories.docs);
                    if (fs.existsSync(dir)) {
                        // Recurse through all files and folders and copy them over. Overwrite if necessary
                        recurseCopy(dir, subDocsDir);
                    }
                }
            });
        }
        else if (config.options.docsMerge.strategy === "SUBDIRECTORY") {
            info("Using subdirectory strategy for merging documentation.");
            // We sort everything in the docs folder into the appropriate subdirectory
            fs.readdirSync(ENTRY_DIR).map(x => {
                let docsDir = path.resolve(ENTRY_DIR, x, config.directories.docs);
                if (fs.existsSync(docsDir)) {
                    // Recurse through all files and folders and copy them over. Overwrite if necessary
                    checkCreateDir(path.resolve(OUT_DIR, x, "docs"));
                    recurseCopy(docsDir, path.resolve(OUT_DIR, x, "docs"));
                }
            });
        }
        else if (config.options.docsMerge.strategy !== "") {
            warn("Unknown documentation merge strategy.");
        }
    })();
    if (INFO_OBJECT.ignored > 0) {
        info(`${INFO_OBJECT.ignored} files were ignored.`);
    }
    if (INFO_OBJECT.failed.length > 0) {
        warn(`Merge failed for ${INFO_OBJECT.failed.length} files, listing:`);
        INFO_OBJECT.failed.forEach(x => {
            warn("-->  " + x);
        });
    }
    info(`Merge finished in ${(new Date().getTime() - START_TIME) / 1000} seconds.`);
}
