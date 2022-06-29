interface Directory {
	match: string;
	outName: string;
	strategy?: "default" | "root";
}

interface Config {
	dirs: Directory[]
	entry: string;
	out: string;
	options?: {
		clear?: boolean;
		moveTopLevelFiles?: boolean;
	},
	watch?: string | boolean;
	ignore?: string[],
}

const DEFAULT_CONFIG: Config = {
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

function deepMerge(target : {}, source : {}) {
	for (let key of Object.keys(source)) {
		if (!target.hasOwnProperty(key) || typeof source[key] !== 'object') target[key] = source[key];
		else deepMerge(target[key], source[key]);
	}
	return (target as Config);
}

function checkStructure(config: Config) {
	config = deepMerge(DEFAULT_CONFIG, config);

	if (!(typeof config === "object")) {
		return false;
	}
	if (typeof config.entry !== "string") {
		return false;
	}

	return config;
}

export { checkStructure, Config };
