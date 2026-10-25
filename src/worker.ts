/**
 * Entrada do Worker: requisições pelo Astro/EmDash e tarefas agendadas.
 * O cron do EmDash (publicação agendada, plugins, retenção de contatos)
 * roda a cada execução; o Instagram se atualiza no máximo a cada 6 horas.
 */
import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";
import { atualizarInstagram } from "./lib/instagram";

export { PluginBridge };

const emdashScheduled = createScheduledHandler();

export default {
	...handler,
	async scheduled(controller, env, ctx) {
		ctx.waitUntil(
			atualizarInstagram(env as never).catch((e) => console.warn("instagram:", e instanceof Error ? e.message : e)),
		);
		await emdashScheduled(controller, env, ctx);
	},
} satisfies ExportedHandler<Record<string, unknown>>;
