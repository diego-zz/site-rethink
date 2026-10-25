/** Serve as imagens do Instagram guardadas no KV pelo cron. */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ params }) => {
	const id = params.id ?? "";
	const kv = (env as unknown as { INSTAGRAM?: KVNamespace }).INSTAGRAM;
	if (!/^\d+$/.test(id) || !kv) return new Response("Não encontrado", { status: 404 });
	const { value, metadata } = await kv.getWithMetadata<{ tipo?: string }>(`img:${id}`, "arrayBuffer");
	if (!value) return new Response("Não encontrado", { status: 404 });
	const tipo = metadata?.tipo?.startsWith("image/") ? metadata.tipo : "image/jpeg";
	return new Response(value, {
		headers: {
			"Content-Type": tipo,
			"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
			"X-Content-Type-Options": "nosniff",
		},
	});
};
