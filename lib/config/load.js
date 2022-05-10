import { checkStructure } from "./check.js";
import * as fs from "fs";
import { error } from "../console/message.js";
function loadConfig(configFilePath) {
    // Check if the project file exists
    if (!fs.existsSync(configFilePath)) {
        error(`Could not find config in current working directory.`);
    }
    // Check if the project file is a valid JSON file
    var config;
    try {
        config = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    }
    catch (e) {
        error("While validating project file: " + e.message);
    }
    // Check if the project file has a valid structure
    if (!(config = checkStructure(config))) {
        error("The project file has an invalid structure.");
    }
    return config;
}
export { loadConfig };
