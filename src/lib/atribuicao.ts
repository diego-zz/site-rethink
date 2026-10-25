/**
 * Atribuição de origem dos contatos (navegador).
 *
 * Em cada página, registra de onde o visitante veio: site de referência,
 * UTMs e identificadores de clique das plataformas de mídia. Guarda:
 *  - primeiro toque: a primeira origem conhecida;
 *  - último toque: a origem mais recente com informação (UTM, clique ou
 *    referência externa) — visitas diretas não apagam a origem anterior;
 *  - página de entrada e páginas vistas na sessão.
 *
 * Privacidade (LGPD): sem consentimento, tudo fica só na sessão do navegador
 * (sessionStorage, apagado ao fechar a aba). Com consentimento de métricas
 * ou marketing, o primeiro toque é lembrado por 90 dias (localStorage).
 * Os dados só saem do navegador junto com o formulário de contato.
 */

export const PARAMETROS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"] as const;
export const IDS_CLIQUE = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "li_fat_id", "ttclid", "twclid"] as const;

export interface Toque {
	em: string;
	entrada: string;
	referencia?: string;
	utm: Partial<Record<(typeof PARAMETROS_UTM)[number], string>>;
	cliques: Partial<Record<(typeof IDS_CLIQUE)[number], string>>;
}

export interface Atribuicao {
	primeiro?: Toque;
	ultimo?: Toque;
	entrada_sessao?: string;
	paginas?: string[];
	ga_client_id?: string;
}

const CHAVE_SESSAO = "rethink-atribuicao";
const CHAVE_PRIMEIRO = "rethink-primeiro-toque";
const VALIDADE_PRIMEIRO_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_PAGINAS = 15;

const limpar = (v: string | null, max = 200) => (v ?? "").replace(/[\u0000-\u001F\u007F<>]/g, "").trim().slice(0, max);

function ler<T>(armazem: Storage | undefined, chave: string): T | undefined {
	try {
		const v = armazem?.getItem(chave);
		return v ? (JSON.parse(v) as T) : undefined;
	} catch {
		return undefined;
	}
}

function gravar(armazem: Storage | undefined, chave: string, valor: unknown) {
	try {
		armazem?.setItem(chave, JSON.stringify(valor));
	} catch {
		/* navegação privada ou armazenamento bloqueado */
	}
}

function consentiu(): boolean {
	const c = ler<{ v: number; analise?: boolean; marketing?: boolean }>(globalThis.localStorage, "rethink-consentimento");
	return !!(c && c.v === 1 && (c.analise || c.marketing));
}

/** Endereço da página sem parâmetros de clique (que identificam o anúncio, não a página). */
function caminho(url: URL) {
	const u = new URL(url.href);
	for (const p of IDS_CLIQUE) u.searchParams.delete(p);
	return limpar(u.pathname + (u.search ? u.search : ""), 300);
}

function referenciaExterna(): string | undefined {
	const r = document.referrer;
	if (!r) return undefined;
	try {
		const u = new URL(r);
		if (u.host === location.host) return undefined;
		// Só origem e caminho: a query de outros sites pode ter dados pessoais.
		return limpar(`${u.origin}${u.pathname}`, 300);
	} catch {
		return undefined;
	}
}

function toqueAtual(): Toque {
	const url = new URL(location.href);
	const utm: Toque["utm"] = {};
	for (const p of PARAMETROS_UTM) {
		const v = limpar(url.searchParams.get(p));
		if (v) utm[p] = v;
	}
	const cliques: Toque["cliques"] = {};
	for (const p of IDS_CLIQUE) {
		const v = limpar(url.searchParams.get(p), 300);
		if (v) cliques[p] = v;
	}
	return { em: new Date().toISOString(), entrada: caminho(url), referencia: referenciaExterna(), utm, cliques };
}

const temOrigem = (t: Toque) => !!t.referencia || Object.keys(t.utm).length > 0 || Object.keys(t.cliques).length > 0;

function gaClientId(): string | undefined {
	const m = document.cookie.match(/(?:^|;\s*)_ga=GA\d\.\d\.(\d+\.\d+)/);
	return m?.[1];
}

/** Chamado em toda página: atualiza a origem da visita. */
export function registrarVisita() {
	const sessao: Atribuicao = ler<Atribuicao>(globalThis.sessionStorage, CHAVE_SESSAO) ?? {};
	const agora = toqueAtual();
	const comOrigem = temOrigem(agora);

	// Primeiro toque: o mais antigo entre o guardado (com consentimento) e o da sessão.
	const guardado = ler<Toque>(globalThis.localStorage, CHAVE_PRIMEIRO);
	const guardadoValido = guardado && Date.now() - Date.parse(guardado.em) < VALIDADE_PRIMEIRO_MS ? guardado : undefined;
	if (!sessao.primeiro) sessao.primeiro = guardadoValido ?? agora;
	if (consentiu() && !guardadoValido) gravar(globalThis.localStorage, CHAVE_PRIMEIRO, sessao.primeiro);

	// Último toque: só muda quando a visita traz origem (UTM, clique ou referência).
	if (comOrigem || !sessao.ultimo) sessao.ultimo = agora;

	if (!sessao.entrada_sessao) sessao.entrada_sessao = agora.entrada;
	const paginas = sessao.paginas ?? [];
	if (paginas[paginas.length - 1] !== agora.entrada) paginas.push(agora.entrada);
	sessao.paginas = paginas.slice(-MAX_PAGINAS);

	gravar(globalThis.sessionStorage, CHAVE_SESSAO, sessao);
}

/** Dados enviados junto com o formulário. */
export function lerAtribuicao(): Atribuicao {
	const sessao = ler<Atribuicao>(globalThis.sessionStorage, CHAVE_SESSAO) ?? {};
	return { ...sessao, ga_client_id: consentiu() ? gaClientId() : undefined };
}
