/**
 * rethink-ad-contatos — contatos recebidos pelo formulário do site.
 *
 * - Rota pública POST /_emdash/api/plugins/rethink-ad-contatos/enviar
 *   (valida, confere Turnstile, limita abusos, guarda e avisa por e-mail).
 * - Página "Contatos" no painel (Block Kit): lista, detalhes, marcar como
 *   respondido, excluir, excluir por e-mail (pedido do titular) e CSV.
 * - Widget no painel inicial e cron diário de retenção (LGPD).
 *
 * Configuração (wrangler.jsonc → vars):
 *   CONTACT_NOTIFY_TO         quem recebe o aviso (vírgula para vários)
 *   CONTACT_RETENTION_MONTHS  meses até a exclusão automática
 * Segredo: TURNSTILE_SECRET_KEY (npx wrangler secret put TURNSTILE_SECRET_KEY)
 */
import type { PluginContext, ResolvedPlugin, RouteContext, StorageCollection } from "emdash";
import { definePlugin } from "emdash";
import { CAPACIDADES, ID } from "./constantes.mjs";
import { env } from "./env";

export interface Contato {
	nome: string;
	empresa: string;
	email: string;
	telefone?: string;
	solucao?: string;
	mensagem: string;
	origem?: string;
	consentimento: true;
	consentimentoTexto: string;
	recebidoEm: string;
	status: "novo" | "respondido";
	respondidoEm?: string;
	pais?: string | null;
}

const TEXTO_CONSENTIMENTO =
	"Concordo com o uso dos meus dados para retorno deste contato, conforme a Política de Privacidade.";
const LIMITE_POR_HORA = 5;
const POR_PAGINA = 20;

type Vars = Record<string, string | undefined>;
const vars = () => env as unknown as Vars;
const colecao = (ctx: PluginContext) => (ctx.storage as Record<string, StorageCollection<Contato>>).contatos;

// ------------------------------------------------------------------ util
const limpar = (v: unknown, max: number) =>
	typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "short",
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});
const dataBR = (iso?: string) => (iso ? fmt.format(new Date(iso)) : "");

async function hash(texto: string) {
	const dados = new TextEncoder().encode(`rethink-ad:${texto}`);
	const buf = await crypto.subtle.digest("SHA-256", dados);
	return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verificarTurnstile(token: string, ip: string | null) {
	const segredo = vars().TURNSTILE_SECRET_KEY;
	const chavePublica = vars().PUBLIC_TURNSTILE_SITE_KEY;
	// Sem Turnstile configurado (ex.: desenvolvimento local), não bloqueia.
	if (!segredo || !chavePublica) return true;
	if (!token) return false;
	const corpo = new FormData();
	corpo.set("secret", segredo);
	corpo.set("response", token);
	if (ip) corpo.set("remoteip", ip);
	try {
		const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: corpo });
		const j = (await r.json()) as { success?: boolean };
		return j.success === true;
	} catch {
		return false;
	}
}

function destinatarios() {
	return (vars().CONTACT_NOTIFY_TO ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter((s) => EMAIL_RE.test(s));
}

function mesesRetencao() {
	const n = Number.parseInt(vars().CONTACT_RETENTION_MONTHS ?? "24", 10);
	return Number.isFinite(n) && n > 0 ? n : 24;
}

async function avisarPorEmail(ctx: PluginContext, c: Contato) {
	const para = destinatarios();
	if (!para.length || !ctx.email) return;
	const linhas: [string, string | undefined][] = [
		["Nome", c.nome],
		["Empresa", c.empresa],
		["E-mail", c.email],
		["Telefone", c.telefone],
		["Solução de interesse", c.solucao || "Ainda não sabe — quer um diagnóstico"],
		["Enviado de", c.origem],
		["Recebido em", dataBR(c.recebidoEm)],
	];
	const texto = [
		"Novo contato pelo site da Rethink.",
		"",
		...linhas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
		"",
		"Mensagem:",
		c.mensagem,
		"",
		"Responda direto a este e-mail para falar com o contato.",
		"Todos os contatos ficam no painel: https://www.rethink.ad/_emdash/admin/plugins/rethink-ad-contatos/",
	].join("\n");
	const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#F6F8F6;font-family:Arial,sans-serif;color:#333">
<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E6E7E6"><tr><td style="padding:28px">
<p style="margin:0 0 4px;font:12px monospace;letter-spacing:.1em;text-transform:uppercase;color:#3860BE">Novo contato pelo site</p>
<h1 style="margin:0 0 20px;font-size:24px;color:#000">${esc(c.nome)} — ${esc(c.empresa)}</h1>
<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px">
${linhas
	.filter(([, v]) => v)
	.map(
		([k, v]) =>
			`<tr><td style="padding:6px 12px 6px 0;color:#595959;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#000">${esc(v!)}</td></tr>`,
	)
	.join("\n")}
</table>
<p style="margin:20px 0 6px;font:12px monospace;letter-spacing:.1em;text-transform:uppercase;color:#595959">Mensagem</p>
<p style="margin:0;font-size:16px;line-height:1.6;white-space:pre-wrap;color:#000">${esc(c.mensagem)}</p>
<p style="margin:24px 0 0;font-size:13px;color:#595959">Responda a este e-mail para falar com o contato. <a href="https://www.rethink.ad/_emdash/admin/plugins/rethink-ad-contatos/" style="color:#3860BE">Ver no painel</a></p>
</td></tr></table></body></html>`;
	for (const to of para) {
		try {
			await ctx.email.send({
				to,
				replyTo: c.email,
				subject: `Novo contato: ${c.nome} (${c.empresa})`,
				text: texto,
				html,
			});
		} catch (e) {
			ctx.log.error("contatos: falha ao enviar aviso por e-mail", { erro: e instanceof Error ? e.message : String(e) });
		}
	}
}

// ------------------------------------------------------------------ rota pública
async function enviar(ctx: RouteContext) {
	if (ctx.request.method !== "POST") return { ok: false, erro: "METODO" };
	const i = (ctx.input ?? {}) as Record<string, unknown>;

	// Armadilha para robôs: o campo "site" fica escondido para pessoas.
	if (limpar(i.site, 200)) return { ok: true };

	const c: Contato = {
		nome: limpar(i.nome, 120),
		empresa: limpar(i.empresa, 160),
		email: limpar(i.email, 160).toLowerCase(),
		telefone: limpar(i.telefone, 40) || undefined,
		solucao: limpar(i.solucao, 120) || undefined,
		mensagem: limpar(i.mensagem, 4000),
		origem: limpar(i.origem, 200).startsWith("/") ? limpar(i.origem, 200) : undefined,
		consentimento: true,
		consentimentoTexto: TEXTO_CONSENTIMENTO,
		recebidoEm: new Date().toISOString(),
		status: "novo",
		pais: ctx.requestMeta?.geo?.country ?? null,
	};
	if (!c.nome || !c.empresa || !EMAIL_RE.test(c.email) || c.mensagem.length < 2 || i.consentimento !== true) {
		return { ok: false, erro: "INVALIDO" };
	}

	const ip = ctx.requestMeta?.ip ?? null;
	if (!(await verificarTurnstile(limpar(i.turnstile, 4096), ip))) return { ok: false, erro: "TURNSTILE" };

	// Limite por endereço de origem (guardado só como hash).
	const janela = new Date().toISOString().slice(0, 13);
	const chave = `limite:${await hash(ip ?? c.email)}:${janela}`;
	const atual = await ctx.kv.getVersioned<number>(chave);
	if ((atual?.value ?? 0) >= LIMITE_POR_HORA) return { ok: false, erro: "LIMITE" };
	await ctx.kv.compareAndSet(chave, atual?.revision ?? null, (atual?.value ?? 0) + 1);

	const id = `${c.recebidoEm.replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
	await colecao(ctx).put(id, c);
	ctx.log.info("contatos: novo contato recebido", { id });
	await avisarPorEmail(ctx, c);
	return { ok: true };
}

// ------------------------------------------------------------------ painel
type Bloco = Record<string, unknown>;
type Interacao =
	| { type: "page_load"; page?: string }
	| { type: "block_action"; action_id: string; value?: unknown }
	| { type: "form_submit"; action_id: string; values?: Record<string, unknown> };

async function resumo(ctx: PluginContext) {
	const col = colecao(ctx);
	const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
	const [total, novos, mes] = await Promise.all([
		col.count(),
		col.count({ status: "novo" }),
		col.count({ recebidoEm: { gte: desde } }),
	]);
	return { total, novos, mes };
}

function blocoContato(id: string, c: Contato): Bloco {
	const titulo = `${dataBR(c.recebidoEm)} · ${c.nome} — ${c.empresa}${c.status === "novo" ? "  •  NOVO" : ""}`;
	return {
		type: "accordion",
		label: titulo.slice(0, 200),
		default_open: false,
		blocks: [
			{
				type: "fields",
				fields: [
					{ label: "E-mail", value: c.email },
					{ label: "Telefone", value: c.telefone || "—" },
					{ label: "Solução de interesse", value: c.solucao || "Diagnóstico (não sabe ainda)" },
					{ label: "Status", value: c.status === "novo" ? "Novo" : `Respondido em ${dataBR(c.respondidoEm)}` },
					{ label: "Enviado de", value: c.origem || "—" },
					{ label: "País", value: c.pais || "—" },
				],
			},
			{ type: "section", text: c.mensagem.slice(0, 4000) },
			{ type: "context", text: `Consentimento registrado: “${c.consentimentoTexto}”` },
			{
				type: "actions",
				elements: [
					{
						type: "link",
						label: "Responder por e-mail",
						target: { kind: "external", url: `mailto:${c.email}?subject=${encodeURIComponent("Re: contato pelo site da Rethink")}` },
						appearance: "primary",
					},
					c.status === "novo"
						? { type: "button", label: "Marcar como respondido", action_id: "respondido", value: id }
						: { type: "button", label: "Marcar como novo", action_id: "novo", value: id },
					{
						type: "button",
						label: "Excluir",
						action_id: "excluir",
						value: id,
						style: "danger",
						confirm: {
							title: "Excluir este contato?",
							text: "Os dados serão apagados de forma permanente.",
							confirm: "Excluir",
							deny: "Cancelar",
						},
					},
				],
			},
		],
	};
}

async function pagina(ctx: PluginContext, opts: { cursor?: string; filtro?: string; toast?: Bloco } = {}) {
	const col = colecao(ctx);
	const [r, s] = await Promise.all([
		col.query({
			where: opts.filtro === "novos" ? { status: "novo" } : undefined,
			orderBy: { recebidoEm: "desc" },
			limit: POR_PAGINA,
			cursor: opts.cursor,
		}),
		resumo(ctx),
	]);
	const blocos: Bloco[] = [
		{ type: "header", text: "Contatos do site" },
		{
			type: "stats",
			items: [
				{ label: "Novos", value: String(s.novos) },
				{ label: "Últimos 30 dias", value: String(s.mes) },
				{ label: "Total guardado", value: String(s.total) },
			],
		},
		{
			type: "actions",
			elements: [
				{ type: "button", label: "Todos", action_id: "filtro", value: "todos", style: opts.filtro === "novos" ? undefined : "primary" },
				{ type: "button", label: "Só novos", action_id: "filtro", value: "novos", style: opts.filtro === "novos" ? "primary" : undefined },
				{ type: "button", label: "Exportar CSV", action_id: "csv" },
			],
		},
		{ type: "divider" },
	];
	if (!r.items.length) {
		blocos.push({ type: "empty", title: "Nenhum contato por aqui", description: "As mensagens enviadas pelo formulário do site aparecem nesta página." });
	} else {
		for (const it of r.items) blocos.push(blocoContato(it.id, it.data));
		if (r.hasMore && r.cursor) {
			blocos.push({
				type: "actions",
				elements: [{ type: "button", label: "Carregar mais antigos", action_id: "mais", value: JSON.stringify({ cursor: r.cursor, filtro: opts.filtro }) }],
			});
		}
	}
	blocos.push(
		{ type: "divider" },
		{
			type: "accordion",
			label: "Pedido do titular (LGPD): excluir todos os contatos de um e-mail",
			default_open: false,
			blocks: [
				{
					type: "form",
					block_id: "titular",
					fields: [{ type: "text_input", action_id: "email", label: "E-mail do titular" }],
					submit: { label: "Excluir contatos deste e-mail", action_id: "excluir_email" },
				},
			],
		},
		{
			type: "context",
			text: `Contatos são excluídos automaticamente após ${mesesRetencao()} meses (CONTACT_RETENTION_MONTHS). Avisos por e-mail vão para: ${destinatarios().join(", ") || "ninguém configurado"} (CONTACT_NOTIFY_TO).`,
		},
	);
	return { blocks: blocos, ...(opts.toast ? { toast: opts.toast } : {}) };
}

const csvCampo = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

async function gerarCsv(ctx: PluginContext) {
	const col = colecao(ctx);
	const linhas = ["recebido_em;status;nome;empresa;email;telefone;solucao;origem;mensagem"];
	let cursor: string | undefined;
	let n = 0;
	do {
		const r = await col.query({ orderBy: { recebidoEm: "desc" }, limit: 100, cursor });
		for (const { data: c } of r.items) {
			linhas.push(
				[dataBR(c.recebidoEm), c.status, c.nome, c.empresa, c.email, c.telefone, c.solucao, c.origem, c.mensagem]
					.map(csvCampo)
					.join(";"),
			);
			n++;
		}
		cursor = r.hasMore ? r.cursor : undefined;
	} while (cursor && n < 2000);
	let csv = linhas.join("\n");
	const cortado = csv.length > 60000;
	if (cortado) csv = csv.slice(0, 60000);
	return { csv, n, cortado };
}

async function admin(ctx: RouteContext) {
	const i = (ctx.input ?? { type: "page_load" }) as Interacao;
	const col = colecao(ctx);

	if (i.type === "page_load" && i.page === "widget:resumo") {
		const s = await resumo(ctx);
		return {
			blocks: [
				{ type: "stats", items: [{ label: "Novos", value: String(s.novos) }, { label: "30 dias", value: String(s.mes) }] },
				{ type: "actions", elements: [{ type: "link", label: "Abrir contatos", target: { kind: "plugin-page", path: "/" } }] },
			],
		};
	}

	if (i.type === "block_action") {
		const v = typeof i.value === "string" ? i.value : "";
		if (i.action_id === "filtro") return pagina(ctx, { filtro: v === "novos" ? "novos" : undefined });
		if (i.action_id === "mais") {
			const p = JSON.parse(v || "{}") as { cursor?: string; filtro?: string };
			return pagina(ctx, p);
		}
		if (i.action_id === "respondido" || i.action_id === "novo") {
			const atual = await col.get(v);
			if (atual) {
				await col.put(v, {
					...atual,
					status: i.action_id === "respondido" ? "respondido" : "novo",
					respondidoEm: i.action_id === "respondido" ? new Date().toISOString() : undefined,
				});
			}
			return pagina(ctx, { toast: { type: "success", message: "Contato atualizado" } });
		}
		if (i.action_id === "excluir") {
			await col.delete(v);
			ctx.log.info("contatos: contato excluído pelo painel", { id: v, por: ctx.user?.id });
			return pagina(ctx, { toast: { type: "success", message: "Contato excluído" } });
		}
		if (i.action_id === "csv") {
			const { csv, n, cortado } = await gerarCsv(ctx);
			const base = await pagina(ctx);
			base.blocks.splice(4, 0, {
				type: "accordion",
				label: `CSV gerado — ${n} contatos (copie e cole numa planilha; separador “;”)`,
				default_open: true,
				blocks: [
					{ type: "code", code: csv, language: "bash" },
					...(cortado ? [{ type: "banner", variant: "alert", description: "O CSV foi cortado por tamanho. Exporte por períodos menores ou exclua contatos antigos." }] : []),
				],
			});
			ctx.log.info("contatos: CSV exportado", { n, por: ctx.user?.id });
			return base;
		}
	}

	if (i.type === "form_submit" && i.action_id === "excluir_email") {
		const email = limpar(i.values?.email, 160).toLowerCase();
		if (!EMAIL_RE.test(email)) return pagina(ctx, { toast: { type: "error", message: "Informe um e-mail válido" } });
		let apagados = 0;
		let cursor: string | undefined;
		do {
			const r = await col.query({ where: { email }, limit: 100, cursor });
			apagados += await col.deleteMany(r.items.map((x) => x.id));
			cursor = r.hasMore ? r.cursor : undefined;
		} while (cursor);
		ctx.log.info("contatos: exclusão a pedido do titular", { apagados, por: ctx.user?.id });
		return pagina(ctx, { toast: { type: "success", message: `${apagados} contato(s) excluído(s)` } });
	}

	return pagina(ctx);
}

// ------------------------------------------------------------------ retenção
async function aplicarRetencao(ctx: PluginContext) {
	const limite = new Date();
	limite.setMonth(limite.getMonth() - mesesRetencao());
	const col = colecao(ctx);
	let total = 0;
	for (let rodada = 0; rodada < 50; rodada++) {
		const r = await col.query({ where: { recebidoEm: { lt: limite.toISOString() } }, limit: 100 });
		if (!r.items.length) break;
		total += await col.deleteMany(r.items.map((x) => x.id));
	}
	if (total) ctx.log.info("contatos: retenção aplicada", { excluidos: total, meses: mesesRetencao() });
}

export function createPlugin(): ResolvedPlugin {
	return definePlugin({
		id: ID,
		version: "1.0.0",
		capabilities: CAPACIDADES as ResolvedPlugin["capabilities"],
		storage: {
			contatos: { indexes: ["recebidoEm", "status", "email", ["status", "recebidoEm"]] },
		},
		hooks: {
			"plugin:activate": async (_e, ctx) => {
				await ctx.cron?.schedule("retencao", { schedule: "23 6 * * *" });
			},
			cron: async (e, ctx) => {
				if (e.name === "retencao") await aplicarRetencao(ctx);
			},
		},
		routes: {
			enviar: { public: true, methods: ["POST"], handler: enviar },
			admin: { permission: "comments:moderate", handler: admin },
		},
		admin: {
			pages: [{ path: "/", label: "Contatos", icon: "envelope" }],
			widgets: [{ id: "resumo", title: "Contatos recebidos", size: "third" }],
		},
	});
}
