/**
 * Utilitários compartilhados pelo site público.
 * Os dados vêm todos do EmDash; nada aqui contém conteúdo fixo.
 */
import {
	getEmDashCollection,
	getEmDashEntry,
	getTaxonomyTermsWithCacheHint,
	getTermsForEntries,
	sanitizeHref,
} from "emdash";

// Os tipos gerados pelo EmDash (emdash-env.d.ts) mudam conforme o esquema
// editado no painel. Os componentes leem os campos de forma defensiva.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Dados = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Entrada = { id: string; data: Dados; edit?: any };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstroLike = { cache?: { enabled?: boolean; set: (hint: any) => void } };

/** Registra as dicas de cache de várias consultas (invalida ao publicar). */
export function cachear(astro: AstroLike, ...hints: unknown[]) {
	if (!astro.cache?.enabled) return;
	for (const hint of hints) if (hint) astro.cache.set(hint);
}

/** Link seguro vindo do CMS; vazio vira undefined. */
export function link(url?: string | null): string | undefined {
	if (!url || !url.trim()) return undefined;
	const safe = sanitizeHref(url.trim());
	return safe && safe !== "#" ? safe : url.trim().startsWith("#") ? url.trim() : undefined;
}

export function externo(url?: string | null) {
	return !!url && /^https?:\/\//i.test(url) && !url.includes("rethink.ad");
}

/** Divide um texto em linhas (o editor usa Enter para quebrar títulos). */
export function linhas(texto?: string | null): string[] {
	return (texto ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Remove quebras de linha de um título (para <title>, alt etc.). */
export function umaLinha(texto?: string | null) {
	return linhas(texto).join(" ");
}

const fmtData = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "short",
	year: "numeric",
	timeZone: "America/Sao_Paulo",
});

export function dataBR(d?: Date | string | null) {
	if (!d) return "";
	const date = d instanceof Date ? d : new Date(d);
	return Number.isNaN(date.getTime()) ? "" : fmtData.format(date).replace(/\./g, "");
}

export function dataISO(d?: Date | string | null) {
	if (!d) return undefined;
	const date = d instanceof Date ? d : new Date(d);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** URL absoluta de uma imagem do CMS (para og:image e JSON-LD). */
export function urlImagem(image: Dados | null | undefined, origin: string): string | undefined {
	if (!image) return undefined;
	const abs = (v: string) => {
		try {
			return new URL(v, origin).href;
		} catch {
			return undefined;
		}
	};
	if (image.src) return abs(image.src);
	if ((image.provider ?? "local") !== "local") return image.previewUrl ? abs(image.previewUrl) : undefined;
	const key = typeof image.meta?.storageKey === "string" ? image.meta.storageKey : image.id;
	return key ? `${origin}/_emdash/api/media/file/${key}` : undefined;
}

/** Dados institucionais (item "rethink" da coleção Dados da empresa). */
export async function getEmpresa() {
	const { entry, cacheHint } = await getEmDashEntry("dados_empresa", "rethink");
	return { empresa: (entry?.data ?? {}) as Dados, cacheHint };
}

/** Soluções publicadas, na ordem definida no painel. */
export async function getSolucoes() {
	const { entries, cacheHint } = await getEmDashCollection("solucoes", {
		orderBy: { ordem: "asc" },
		limit: 50,
	});
	return { solucoes: entries as unknown as Entrada[], cacheHint };
}

/** Cases publicados, ordenados pelo campo Ordem e depois pelos mais novos. */
export async function getCases() {
	const { entries, cacheHint } = await getEmDashCollection("cases", {
		orderBy: { ordem: "asc" },
		limit: 200,
	});
	return { cases: entries as unknown as Entrada[], cacheHint };
}

/** Clientes autorizados para a grade de logos. */
export async function getClientes() {
	const { entries, cacheHint } = await getEmDashCollection("clientes", {
		orderBy: { ordem: "asc" },
		limit: 200,
	});
	const clientes = (entries as unknown as Entrada[]).filter(
		(c) => c.data.autorizado === true && c.data.exibir_logo !== false,
	);
	return { clientes, todos: entries as unknown as Entrada[], cacheHint };
}

/** Índice id (ULID) → entrada, para resolver campos de referência. */
export function indice(lista: Entrada[]) {
	const map = new Map<string, Entrada>();
	for (const e of lista) {
		map.set(String(e.data.id), e);
		map.set(e.id, e);
	}
	return map;
}

/** Valor de referência pode vir como string (id) ou objeto resolvido. */
export function refId(v: unknown): string | undefined {
	if (!v) return undefined;
	if (typeof v === "string") return v;
	if (typeof v === "object") {
		const o = v as Dados;
		return String(o.id ?? o.data?.id ?? o.slug ?? "");
	}
	return undefined;
}

/** Texto simples de um Portable Text (para resumos e JSON-LD). */
export function textoPT(value: unknown): string {
	if (!Array.isArray(value)) return "";
	return value
		.map((b: Dados) =>
			Array.isArray(b?.children) ? b.children.map((c: Dados) => c?.text ?? "").join("") : "",
		)
		.filter(Boolean)
		.join("\n\n");
}

/** Converte um texto em âncora (id) estável. */
export function ancora(texto: string) {
	return texto
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);
}

/** Primeira métrica de um case (cards). */
export function metricaPrincipal(c: Entrada) {
	const m = Array.isArray(c.data.metricas) ? c.data.metricas[0] : undefined;
	return m ? { valor: String(m.valor ?? ""), indicador: String(m.indicador ?? "") } : undefined;
}

/** Nome do cliente de um case (referência ou título). */
export function nomeCliente(c: Entrada, clientes: Map<string, Entrada>) {
	const id = refId(c.data.cliente);
	return (id && clientes.get(id)?.data.title) || c.data.title;
}

export const WHATSAPP_BASE = "https://wa.me/";

export function urlWhatsapp(empresa: Dados) {
	const n = String(empresa.whatsapp_numero ?? "").replace(/\D/g, "");
	return n ? `${WHATSAPP_BASE}${n}` : undefined;
}

/** O valor ainda é um marcador de conteúdo a validar? (ex.: "[ano]") */
export function marcador(v?: string | null) {
	return !v || /^\s*\[.*\]\s*$/.test(v);
}

/** Insights publicados (mais novos primeiro) com a categoria de cada um. */
export async function getInsights(opcoes: { categoria?: string; limite?: number } = {}) {
	const [{ entries, cacheHint }, termos] = await Promise.all([
		getEmDashCollection("insights", {
			orderBy: { published_at: "desc" },
			limit: opcoes.limite ?? 500,
			...(opcoes.categoria ? { where: { categoria: opcoes.categoria } } : {}),
		}),
		getTaxonomyTermsWithCacheHint("categoria", { includeCounts: true }),
	]);
	const insights = entries as unknown as Entrada[];
	const mapa = await getTermsForEntries(
		"insights",
		insights.map((e) => String(e.data.id)),
		"categoria",
	);
	const categoriaDe = (e: Entrada) => mapa.get(String(e.data.id))?.[0];
	return { insights, categoriaDe, categorias: termos.data, cacheHint, cacheHintTermos: termos.cacheHint };
}

/** Rótulo "data · categoria · tempo" dos cards de insight. */
export function metaInsight(e: Entrada, categoria?: { label: string }) {
	return [
		dataBR(e.data.publishedAt ?? e.data.createdAt),
		categoria?.label,
		e.data.tempo_leitura ? `${e.data.tempo_leitura} min` : undefined,
	]
		.filter(Boolean)
		.join(" · ");
}

/** Primeiro hero de uma página: descrição e imagem padrão para SEO. */
export function padroesHero(blocos: unknown, origin: string) {
	const hero = Array.isArray(blocos) ? (blocos as Dados[]).find((b) => b._type === "hero") : undefined;
	return {
		defaultDescription: hero?.subtitulo?.trim() || undefined,
		defaultOgImage: hero?.imagem ? urlImagem(hero.imagem, origin) : undefined,
	};
}

/** URL de rede social preenchida de verdade (não só o domínio da rede). */
export function urlRede(url?: string | null) {
	const u = link(url);
	return u && !/^https?:\/\/(www\.)?(linkedin|instagram)\.com\/?$/i.test(u) ? u : undefined;
}
