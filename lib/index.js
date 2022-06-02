#!/usr/bin/env node
import { colarg } from "colarg";
import * as fs from "fs";
import * as path from "path";
import { error, info, warn } from "./console/message.js";
import { execSync } from "child_process";
import { loadConfig } from "./config/load.js";
import * as chokidar from "chokidar";
const PROJECT_OPTION = {
    name: "project",
    alias: "p",
    description: "The file to the configuration settings of your project.",
    defaults: "./hydra.config.json",
    required: false,
    type: "string"
};
const RECURSIVE_OPTION = {
    name: "recursive",
    alias: "r",
    description: "Whether to apply the current operation in every package.",
    defaults: false,
    required: false,
    type: "boolean"
};
/**
 * A function to loop through all the directories inside a folder and calls a callback on each of them containing their names/paths as argument.
 * @param dir A given directory containing subdirectories to which a callback function shall be applied.
 * @param callback The callback that gets called on every found directory.
 */
function applyToDirs(dir, callback = () => { }) {
    fs.readdirSync(dir).forEach(subDir => {
        let dirPath = path.resolve(dir, subDir);
        if (fs.lstatSync(dirPath).isDirectory()) {
            callback(dirPath, subDir);
        }
    });
}
const args = colarg(process.argv.slice(2))
    .option(PROJECT_OPTION)
    .command("add", "Add a dependency to every package in your project.", (parser) => {
    const args = parser.option(RECURSIVE_OPTION).option(PROJECT_OPTION).help().args;
    const pkg = args._defaults[0];
    if (!pkg) {
        error("You must specify a package to add.");
    }
    // Check if the package exists with npm view
    try {
        execSync(`npm view ${pkg}`, { stdio: "pipe" });
        info(`Found '${pkg}' in registry.`);
    }
    catch (e) {
        error("The requested package does not exist:\n\n" + e.message);
    }
    if (args.recursive === false) {
        // Apply operation in root;
        info(`Adding '${pkg}' to root.`);
        execSync(`npm install --save ${pkg}`);
    }
    else {
        // Apply operation in each package;
        const config = loadConfig(args.project);
        applyToDirs(config.entry, (dirPath, dir) => {
            try {
                info(`Adding '${pkg}' to '${dir}'.`);
                execSync(`cd "${dirPath}" && npm install --save ${pkg}`);
            }
            catch (e) {
                error(`Failed to add package to '${dirPath}':\n\n${e.message}`);
            }
        });
    }
    process.exit();
})
    .command("remove", "Remove a dependency from your project.", (parser) => {
    const args = parser.option(RECURSIVE_OPTION).option(PROJECT_OPTION).help().args;
    const pkg = args._defaults[0];
    if (!pkg) {
        error("You must specify a package to remove.");
    }
    if (args.recursive === false) {
        // Apply operation in root;
        info(`Removing '${pkg}'...`);
        execSync(`npm remove ${pkg}`);
    }
    else {
        // Apply operation in each package;
        const config = loadConfig(args.project);
        applyToDirs(config.entry, (dirPath, dir) => {
            try {
                info(`Removing '${pkg}' from '${dir}'...`);
                execSync(`cd "${dirPath}" && npm remove ${pkg}`);
            }
            catch (e) {
                error(`Failed to remove package from '${dirPath}':\n\n${e.message}`);
            }
        });
    }
    process.exit();
})
    .command("update", "Executes the 'npm update' command.", (parser) => {
    const args = parser.option(RECURSIVE_OPTION).option(PROJECT_OPTION).help().args;
    if (args.recursive === false) {
        // Apply operation in root;
        info(`Updating root...`);
        execSync(`npm update`, { stdio: "inherit" });
    }
    else {
        // Apply operation in each package;
        const config = loadConfig(args.project);
        applyToDirs(config.entry, (dirPath, dir) => {
            try {
                console.clear();
                info(`Updating '${dir}'...`);
                execSync(`cd "${dirPath}" && npm update`, { stdio: "inherit" });
            }
            catch (e) {
                error(`Failed to update '${dir}':\n\n${e.message}`);
            }
        });
    }
    process.exit();
})
    .command("exec", "Executes the following command, may be applied to all subdirectories.", (parser) => {
    console.clear();
    const args = parser.option(RECURSIVE_OPTION).option(PROJECT_OPTION).help().args;
    const command = args._defaults[0];
    if (args.recursive === false) {
        // Apply operation in root;
        info(`Executing command in root...`);
        execSync(command, { stdio: "inherit" });
    }
    else {
        // Apply operation in each package;
        const config = loadConfig(args.project);
        applyToDirs(config.entry, (dirPath, dir) => {
            try {
                info(`Executing command in '${dir}'...`);
                execSync(`cd "${dirPath}" && ${command}`, { stdio: "inherit" });
            }
            catch (e) {
                error(`Failed to execute command in '${dir}':\n\n${e.message}`);
            }
        });
    }
    process.exit();
}).help().args;
const ROOT = process.cwd();
const PROJECT_FILE = path.resolve(ROOT, args.project);
const PROJECT_DIR = path.dirname(PROJECT_FILE);
const INFO_OBJECT = {
    ignored: 0,
    failed: []
};
function checkCreateDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}
/**
 * A function that reads an input directory and returns the number of found files that match the checkBack function.
 * @date 4/26/2022 - 7:32:17 PM
 */
function controlCheck(dir, checkBack = () => false) {
    let files = fs.readdirSync(dir);
    let count = 0;
    files.forEach(file => {
        if (checkBack(file) === false) {
            INFO_OBJECT.ignored++;
            return;
        }
        count++;
    });
    return count;
}
/**
 * A function that clears the console logging an info message of which folder is being watched right now.
 * @param watch The folder that is being watched for changes.
 */
function clear(watch) {
    console.clear();
    info(`Watching '${watch}' for changes.`);
}
/**
 * A function that recursively copies all files from a given input directory to a target directory checking through each file against an optional filter parameter.
 * @param inDir The directory to copy the files from.
 * @param outDir The directory to copy the files to.
 * @param checkBack An optional function that checks whether a file shall be copied or not.
 */
function recurseCopy(inDir, outDir, checkBack = () => true) {
    let files = fs.readdirSync(inDir);
    files.forEach(file => {
        let inPath = path.resolve(inDir, file);
        let outPath = path.resolve(outDir, file);
        if (fs.lstatSync(inPath).isDirectory()) {
            // Check if there are any files that match the checkBack function.
            if (controlCheck(inPath, checkBack) === 0) {
                return;
            }
            // Create the directory in the `outDir`
            if (!fs.existsSync(outPath)) {
                fs.mkdirSync(outPath);
            }
            recurseCopy(inPath, outPath, checkBack);
        }
        else {
            if (checkBack(file) === false) {
                INFO_OBJECT.ignored++;
                return;
            }
            // Move the file to the `outDir`, overwrite if necessary
            fs.copyFileSync(inPath, outPath);
        }
    });
}
(() => {
    const config = loadConfig(PROJECT_FILE);
    if (config.watch !== false && (typeof config.watch === "string")) {
        clear(config.watch);
        executeConfig(config);
        const WATCH_DIR = path.resolve(ROOT, PROJECT_DIR, config.watch);
        chokidar.watch(WATCH_DIR).on("all", (type, path) => {
            if (config.ignore.filter(regexp => new RegExp(regexp).test(path)).length == 0) {
                clear(config.watch);
                info(`'${path}' has been changed.`);
                executeConfig(config);
            }
        });
    }
    else {
        executeConfig(config);
    }
})();
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
    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR);
    }
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
