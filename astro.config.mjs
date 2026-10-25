import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, kvCache, r2 } from "@emdash-cms/cloudflare";
import { cloudflareEmail } from "@emdash-cms/cloudflare/plugins";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { contatos } from "./src/plugins/contatos/descriptor.mjs";

export default defineConfig({
	site: "https://www.rethink.ad",
	output: "server",
	adapter: cloudflare(),
	trailingSlash: "never",
	// Idioma do conteúdo no CMS. Para ter versão em inglês no futuro, inclua "en" em locales.
	i18n: {
		defaultLocale: "pt-br",
		locales: ["pt-br"],
		routing: { prefixDefaultLocale: false },
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	security: {
		checkOrigin: true,
	},
	integrations: [
		// O painel do EmDash usa React; o site público não envia React ao navegador.
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto", coalesce: true }),
			storage: r2({ binding: "MEDIA" }),
			objectCache: kvCache({ binding: "CACHE", keyPrefix: "rethink-ad:" }),
			plugins: [
				cloudflareEmail({
					binding: "EMAIL",
					from: { email: "site@rethink.ad", name: "Site Rethink" },
				}),
				// Contatos do formulário: guarda no painel, avisa por e-mail e aplica retenção.
				contatos(),
			],
		}),
	],
	devToolbar: { enabled: false },
});
