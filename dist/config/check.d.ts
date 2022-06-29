interface Directory {
    match: string;
    outName: string;
    strategy?: "default" | "root";
}
interface Config {
    dirs: Directory[];
    entry: string;
    out: string;
    options?: {
        clear?: boolean;
        moveTopLevelFiles?: boolean;
    };
    watch?: string | boolean;
    ignore?: string[];
}
declare function checkStructure(config: Config): false | Config;
export { checkStructure, Config };
