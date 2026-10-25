/**
 * Middleware do site:
 * - cabeçalhos de segurança em todas as respostas;
 * - homologação (NOINDEX=1) fica fora dos buscadores (X-Robots-Tag);
 * - remove do sitemap as páginas que não devem ser indexadas por endereço
 *   próprio (a "home" é servida em "/" e a "nao-encontrada" é a página 404).
 */
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

const FORA_DO_SITEMAP = ["/home", "/nao-encontrada"];

export const onRequest = defineMiddleware(async (ctx, next) => {
	const res = await next();
	const vars = env as unknown as Record<string, string | undefined>;
	const path = ctx.url.pathname;
	const admin = path.startsWith("/_emdash");

	let resposta = res;
	if (path === "/sitemap-paginas.xml" && res.ok) {
		const xml = await res.text();
		const filtrado = xml.replace(/<url>[\s\S]*?<\/url>/g, (bloco) =>
			FORA_DO_SITEMAP.some((p) => bloco.includes(`${p}</loc>`)) ? "" : bloco,
		);
		const raiz = `${ctx.url.origin.replace("http://", "https://")}/`;
		const comRaiz = filtrado.includes(`<loc>${raiz}</loc>`)
			? filtrado
			: filtrado.replace(/(<urlset[^>]*>)/, `$1<url><loc>${(ctx.site?.origin ?? ctx.url.origin)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`);
		resposta = new Response(comRaiz, res);
	}

	const h = resposta.headers;
	try {
		h.set("X-Content-Type-Options", "nosniff");
		h.set("Referrer-Policy", "strict-origin-when-cross-origin");
		h.set("X-Frame-Options", "SAMEORIGIN");
		h.set("Cross-Origin-Opener-Policy", "same-origin");
		h.set(
			"Permissions-Policy",
			"camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
		);
		if (ctx.url.protocol === "https:" && ctx.url.hostname === "www.rethink.ad") {
			h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
		}
		if (vars.NOINDEX === "1" && !admin) h.set("X-Robots-Tag", "noindex, nofollow");
	} catch {
		// Respostas imutáveis (ex.: redirecionamentos) seguem sem alteração.
	}
	return resposta;
});
