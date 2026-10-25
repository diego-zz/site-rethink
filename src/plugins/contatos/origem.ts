/**
 * Origem do contato: valida os dados de atribuição enviados pelo navegador
 * e classifica o canal (pago, busca orgânica, IA, social, e-mail,
 * referência/parceiro ou direto).
 */

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"] as const;
const CLIQUES = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "li_fat_id", "ttclid", "twclid"] as const;

export const CANAIS = [
	"Mídia paga",
	"Busca orgânica",
	"Assistente de IA",
	"Social",
	"E-mail",
	"Referência / parceiro",
	"Campanha (UTM)",
	"Direto",
] as const;

export interface ToqueContato {
	em?: string;
	entrada?: string;
	referencia?: string;
	utm: Partial<Record<(typeof UTM)[number], string>>;
	cliques: Partial<Record<(typeof CLIQUES)[number], string>>;
}

export interface OrigemContato {
	canal: string;
	detalhe: string;
	primeiro?: ToqueContato;
	ultimo?: ToqueContato;
	entrada_sessao?: string;
	paginas?: string[];
	ga_client_id?: string;
}

const txt = (v: unknown, max = 200) =>
	typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F<>]/g, "").trim().slice(0, max) : "";

function toque(v: unknown): ToqueContato | undefined {
	if (!v || typeof v !== "object") return undefined;
	const o = v as Record<string, unknown>;
	const utmIn = (o.utm ?? {}) as Record<string, unknown>;
	const clqIn = (o.cliques ?? {}) as Record<string, unknown>;
	const utm: ToqueContato["utm"] = {};
	for (const k of UTM) {
		const s = txt(utmIn[k]);
		if (s) utm[k] = s;
	}
	const cliques: ToqueContato["cliques"] = {};
	for (const k of CLIQUES) {
		const s = txt(clqIn[k], 300);
		if (s) cliques[k] = s;
	}
	const em = txt(o.em, 40);
	const referencia = txt(o.referencia, 300);
	return {
		em: em && !Number.isNaN(Date.parse(em)) ? em : undefined,
		entrada: txt(o.entrada, 300).startsWith("/") ? txt(o.entrada, 300) : undefined,
		referencia: /^https?:\/\//.test(referencia) ? referencia : undefined,
		utm,
		cliques,
	};
}

const BUSCA = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|yandex|baidu|brave|search\.yahoo|startpage)\./i;
const IA = /(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|meta\.ai|deepseek\.com|grok\.com)/i;
const SOCIAL = /(linkedin\.com|lnkd\.in|instagram\.com|facebook\.com|fb\.com|l\.facebook|t\.co$|x\.com|twitter\.com|youtube\.com|youtu\.be|tiktok\.com|threads\.net|whatsapp\.com|wa\.me|pinterest\.)/i;
const MEIO_PAGO = /^(cpc|ppc|paid|paid[-_ ]?(search|social|media)|cpm|display|ads?|banner|retargeting|remarketing|sponsored|patrocinado|midia[-_ ]?paga)$/i;
const MEIO_EMAIL = /^(e-?mail|newsletter|mailing|email[-_ ]?marketing|emkt)$/i;
const MEIO_SOCIAL = /^(social|organic[-_ ]?social|social[-_ ]?organico|rede[-_ ]?social)$/i;
const MEIO_REF = /^(referral|referencia|partner|parceiro|affiliate|afiliado)$/i;

function host(url?: string) {
	try {
		return url ? new URL(url).hostname.replace(/^www\./, "") : "";
	} catch {
		return "";
	}
}

/** Classifica um toque em canal + detalhe legível. */
export function classificar(t?: ToqueContato): { canal: string; detalhe: string } {
	if (!t) return { canal: "Direto", detalhe: "sem informação de origem" };
	const { utm, cliques } = t;
	const fonte = utm.utm_source ?? "";
	const meio = utm.utm_medium ?? "";
	const campanha = utm.utm_campaign ? ` · campanha ${utm.utm_campaign}` : "";
	const h = host(t.referencia);

	if (cliques.gclid || cliques.gbraid || cliques.wbraid) return { canal: "Mídia paga", detalhe: `Google Ads${campanha}` };
	if (cliques.msclkid) return { canal: "Mídia paga", detalhe: `Microsoft Ads${campanha}` };
	if (cliques.li_fat_id) return { canal: "Mídia paga", detalhe: `LinkedIn Ads${campanha}` };
	if (cliques.ttclid) return { canal: "Mídia paga", detalhe: `TikTok Ads${campanha}` };
	if (meio && MEIO_PAGO.test(meio)) return { canal: "Mídia paga", detalhe: `${fonte || "?"} / ${meio}${campanha}` };
	if (cliques.fbclid && !meio) return { canal: "Social", detalhe: `Meta (link com fbclid)${campanha}` };
	if (meio && MEIO_EMAIL.test(meio)) return { canal: "E-mail", detalhe: `${fonte || "?"} / ${meio}${campanha}` };
	if (meio && MEIO_SOCIAL.test(meio)) return { canal: "Social", detalhe: `${fonte || "?"} / ${meio}${campanha}` };
	if (meio && MEIO_REF.test(meio)) return { canal: "Referência / parceiro", detalhe: `${fonte || h || "?"} / ${meio}${campanha}` };
	if (fonte || meio) return { canal: "Campanha (UTM)", detalhe: `${fonte || "?"} / ${meio || "?"}${campanha}` };
	if (h && IA.test(h)) return { canal: "Assistente de IA", detalhe: h };
	if (h && BUSCA.test(`${h}.`)) return { canal: "Busca orgânica", detalhe: h };
	if (h && SOCIAL.test(h)) return { canal: "Social", detalhe: h };
	if (h) return { canal: "Referência / parceiro", detalhe: h };
	return { canal: "Direto", detalhe: "acesso direto ou origem não informada" };
}

/** Valida o objeto enviado pelo formulário e calcula o canal (último toque). */
export function lerOrigem(v: unknown): OrigemContato {
	const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
	const primeiro = toque(o.primeiro);
	const ultimo = toque(o.ultimo) ?? primeiro;
	const { canal, detalhe } = classificar(ultimo);
	const paginas = Array.isArray(o.paginas)
		? o.paginas.map((p) => txt(p, 300)).filter((p) => p.startsWith("/")).slice(-15)
		: undefined;
	const ga = txt(o.ga_client_id, 40);
	return {
		canal,
		detalhe,
		primeiro,
		ultimo,
		entrada_sessao: txt(o.entrada_sessao, 300).startsWith("/") ? txt(o.entrada_sessao, 300) : undefined,
		paginas,
		ga_client_id: /^\d+\.\d+$/.test(ga) ? ga : undefined,
	};
}

/** Resumo de um toque em uma linha (painel, e-mail e CSV). */
export function resumoToque(t?: ToqueContato) {
	if (!t) return "";
	const partes = [
		t.utm.utm_source && `source=${t.utm.utm_source}`,
		t.utm.utm_medium && `medium=${t.utm.utm_medium}`,
		t.utm.utm_campaign && `campaign=${t.utm.utm_campaign}`,
		t.utm.utm_term && `term=${t.utm.utm_term}`,
		t.utm.utm_content && `content=${t.utm.utm_content}`,
		...Object.keys(t.cliques).map((k) => `${k}=sim`),
		t.referencia && `ref=${t.referencia}`,
		t.entrada && `entrada=${t.entrada}`,
	].filter(Boolean);
	return partes.join(" · ");
}
