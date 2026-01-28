import { defineConfig } from "prisma/config";

export default defineConfig({
	migrate: {
		datasource: {
			url: process.env.DIRECT_URL,
		},
	},
});

