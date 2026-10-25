/**
 * Descritor do plugin rethink-ad-contatos (usado no astro.config.mjs).
 * Fica separado do plugin.ts porque o astro.config roda em Node e não pode
 * importar módulos do runtime da Cloudflare.
 */
import { fileURLToPath } from "node:url";
import { CAPACIDADES, ID } from "./constantes.mjs";

export { CAPACIDADES, ID };

/** @returns {import("emdash").PluginDescriptor} */
export function contatos() {
	return {
		id: ID,
		version: "1.0.0",
		format: "native",
		entrypoint: fileURLToPath(new URL("./plugin.ts", import.meta.url)),
		options: {},
		capabilities: CAPACIDADES,
		adminPages: [{ path: "/", label: "Contatos", icon: "envelope" }],
		adminWidgets: [{ id: "resumo", title: "Contatos recebidos", size: "third" }],
	};
}
