/**
 * /llms.txt — resumo do site em Markdown para assistentes de IA
 * (proposta llmstxt.org). Gerado a partir do CMS a cada publicação.
 */
import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettings } from "emdash";
import { getCases, getEmpresa, getInsights, getSolucoes, umaLinha } from "../lib/site";

export const GET: APIRoute = async ({ site, url, cache }) => {
	const origin = site?.origin ?? url.origin;
	const [settings, { empresa, cacheHint }, so, ca, ins, pg] = await Promise.all([
		getSiteSettings(),
		getEmpresa(),
		getSolucoes(),
		getCases(),
		getInsights({ limite: 50 }),
		getEmDashCollection("paginas", { limit: 50 }),
	]);
	if (cache?.enabled) for (const h of [cacheHint, so.cacheHint, ca.cacheHint, ins.cacheHint, pg.cacheHint]) cache.set(h);

	const nome = empresa.title || settings.title || "Rethink Consultoria";
	const linhas: string[] = [
		`# ${nome}`,
		"",
		`> ${umaLinha(empresa.descricao_organizacao || settings.tagline || "")}`,
		"",
		`Site oficial: ${origin}/. Sede: ${[empresa.cidade, empresa.uf].filter(Boolean).join("/") || "Brasil"}. Idioma: português (Brasil).`,
		"",
		"## Páginas",
		"",
	];
	const ignorar = new Set(["home", "nao-encontrada"]);
	for (const p of pg.entries) {
		if (ignorar.has(p.id)) continue;
		linhas.push(`- [${p.data.title}](${origin}/${p.id})`);
	}
	linhas.push("", "## Soluções", "");
	for (const s of so.solucoes) {
		linhas.push(`- [${s.data.title}](${origin}/solucoes/${s.id}): ${umaLinha(s.data.excerpt)}`);
	}
	if (ca.cases.length) {
		linhas.push("", "## Cases", "");
		for (const c of ca.cases) linhas.push(`- [${c.data.title}](${origin}/cases/${c.id}): ${umaLinha(c.data.excerpt || c.data.frase_titulo || "")}`);
	}
	if (ins.insights.length) {
		linhas.push("", "## Insights", "");
		for (const a of ins.insights) linhas.push(`- [${a.data.title}](${origin}/insights/${a.id}): ${umaLinha(a.data.excerpt)}`);
	}
	linhas.push("", "## Contato", "", `- [Formulário de contato](${origin}/contato)`);
	if (empresa.email && !/^\[/.test(empresa.email)) linhas.push(`- E-mail: ${empresa.email}`);
	linhas.push("", "## Opcional", "", `- [Política de Privacidade](${origin}/privacidade)`, `- [Mapa do site](${origin}/sitemap.xml)`, "");

	return new Response(linhas.join("\n"), {
		headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
	});
};
