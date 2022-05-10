interface Config {
    directories: {
        source?: string;
        build?: string;
        docs?: string;
        assets?: string;
    };
    entry: string;
    outDir: string;
    moveTopLevelFiles?: boolean;
    moveSourceFiles?: string[];
    options?: {
        docsMerge: {
            strategy: "ROOT_FOLDER" | "SUBDIRECTORY";
            folder: string;
        };
    };
    autoClear: boolean;
    watch?: string | boolean;
    ignore?: string[];
}
declare function checkStructure(config: Config): false | Config;
export { checkStructure, Config };
