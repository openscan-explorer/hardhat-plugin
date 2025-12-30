import type { HardhatPlugin } from "hardhat/types/plugins";

import "./type-extensions.js";

const plugin: HardhatPlugin = {
	id: "openscan-links",
	hookHandlers: {
		network: () => import("./hooks/network.js"),
		config: () => import("./hooks/config.js"),
	},
};

export default plugin;
