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
/**
 * A function that clears the console logging an info message of which folder is being watched right now.
 * @param watch The folder that is being watched for changes.
 */
function clear(watch) {
    console.clear();
    info(`Watching '${watch}' for changes.`);
}
(() => {
    var config = loadConfig(PROJECT_FILE);
    if (config.watch !== false && (typeof config.watch === "string")) {
        clear(config.watch);
        runFromConfig(config);
        const WATCH_DIR = path.resolve(ROOT, PROJECT_DIR, config.watch);
        const openWatcher = (dir, callback) => {
            return chokidar.watch(dir).on("all", callback);
        };
        const folderWatcher = openWatcher(WATCH_DIR, (type, path) => {
            if (config.ignore.filter(regexp => new RegExp(regexp).test(path)).length == 0) {
                clear(config.watch);
                info(`'${path}' has been changed.`);
                runFromConfig(config);
            }
        });
        const configWatcher = openWatcher(PROJECT_FILE, (type) => {
            if (type === "change") {
                clear(config.watch);
                info(`The config has changed. Reloading...`);
                config = loadConfig(PROJECT_FILE);
                runFromConfig(config);
            }
            else if (type === "unlink") {
                warn("The config has been deleted, continuing with previously loaded config.");
            }
        });
    }
    else {
        runFromConfig(config);
    }
})();
function isDir(p) {
    return fs.lstatSync(p).isDirectory();
}
function move(oldPath, newPath) {
    if (fs.existsSync(oldPath)) {
        let dir = isDir(oldPath);
        if (dir) {
            fs.mkdirSync(newPath, { recursive: true });
            // Recursively copy the directory
            let files = fs.readdirSync(oldPath);
            for (const file of files) {
                let curr = path.join(oldPath, file);
                move(curr, path.join(newPath, file));
            }
        }
        else {
            fs.copyFileSync(oldPath, newPath);
        }
    }
}
function runFromConfig(config) {
    const entry = path.join(process.cwd(), config.entry);
    const out = path.join(process.cwd(), config.out);
    // Check if we're supposed to clear the output directory.
    if (config.options.clear) {
        fs.readdirSync(out).forEach(file => {
            let p = path.join(out, file);
            if (isDir(p)) {
                fs.rmdirSync(p, { recursive: true });
            }
            else {
                fs.unlinkSync(p);
            }
        });
    }
    // Iterate over all the folders in the entry directory.
    for (const pkg of fs.readdirSync(entry)) {
        const entryPath = path.join(entry, pkg);
        const outPath = path.join(out, pkg);
        /**
         * We're inside the top level directory, all folders inside here are packages and all files are topLevelFiles
         */
        if (isDir(entryPath)) {
            /**
             * All folders in the package are part of the package, meaning we want to check if we're supposed to move them.
             */
            for (const sub of fs.readdirSync(entryPath)) {
                // "sub" is the specific subdirectory, e.g. : "docs", "src", "dist"...
                // Check if we match the folder name somewhere.
                for (const dir of config.dirs) {
                    // Check if the dir matches
                    if ((new RegExp(dir.match)).test(sub)) {
                        // It did match, move it where it's supposed to.
                        // Check if the folder should be moved in the output root. e.g. : "out/docs/{first/...}"
                        let currPath = path.join(entryPath, sub);
                        if (dir.strategy === "root") {
                            let outputDir = path.join(out, dir.outName, pkg);
                            move(currPath, outputDir);
                            info(`Successfully moved "${pkg}/${sub}" into a root folder: "${dir.outName}/${pkg}"`);
                        }
                        else if (dir.strategy === "default") {
                            let outputDir = path.join(outPath, dir.outName);
                            move(currPath, outputDir);
                            info(`Successfully moved "${sub}" into destination "${dir.outName}"`);
                        }
                    }
                }
            }
        }
        else if (config.options.moveTopLevelFiles) {
            // The path corresponds to a file, let's move it to it's target
            move(entryPath, outPath);
        }
        else {
            warn(`Skipping file: "${pkg}" since "options.moveTopLevelFiles" is turned off.`);
        }
    }
}
