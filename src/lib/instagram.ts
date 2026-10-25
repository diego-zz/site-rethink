/**
 * Instagram: o cron busca os últimos posts (Instagram API com login do
 * Instagram) e guarda no KV INSTAGRAM, junto com as imagens, para que o site
 * não dependa de URLs temporárias do CDN do Instagram nem chame a API a cada
 * visita.
 *
 * Segredo necessário: INSTAGRAM_TOKEN (token de longa duração).
 *   npx wrangler secret put INSTAGRAM_TOKEN
 * O token é renovado automaticamente a cada execução (vale 60 dias).
 */

export interface PostInstagram {
	id: string;
	link: string;
	legenda: string;
	imagem: string; // caminho servido pelo site: /instagram/<id>.jpg
	data: string;
}

interface Env {
	INSTAGRAM?: KVNamespace;
	INSTAGRAM_TOKEN?: string;
}

const INTERVALO_MS = 6 * 60 * 60 * 1000;
const QTD = 6;

export async function lerPosts(kv?: KVNamespace): Promise<PostInstagram[]> {
	if (!kv) return [];
	try {
		return ((await kv.get("posts", "json")) as PostInstagram[] | null) ?? [];
	} catch {
		return [];
	}
}

export async function atualizarInstagram(env: Env, forcar = false): Promise<void> {
	const kv = env.INSTAGRAM;
	if (!kv) return;
	const token = (await kv.get("token")) || env.INSTAGRAM_TOKEN;
	if (!token) return;
	const ultimo = Number((await kv.get("atualizado_em")) ?? 0);
	if (!forcar && Date.now() - ultimo < INTERVALO_MS) return;
	await kv.put("atualizado_em", String(Date.now()));

	const campos = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
	const r = await fetch(
		`https://graph.instagram.com/me/media?fields=${campos}&limit=${QTD * 2}&access_token=${encodeURIComponent(token)}`,
	);
	if (!r.ok) {
		console.warn("instagram: falha ao buscar posts", r.status);
		return;
	}
	const json = (await r.json()) as { data?: Record<string, string>[] };
	const posts: PostInstagram[] = [];
	for (const m of json.data ?? []) {
		if (posts.length >= QTD) break;
		const src = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
		if (!src || !/^\d+$/.test(m.id ?? "")) continue;
		const img = await fetch(src);
		if (!img.ok) continue;
		const bytes = await img.arrayBuffer();
		if (bytes.byteLength > 2_000_000) continue;
		await kv.put(`img:${m.id}`, bytes, {
			metadata: { tipo: img.headers.get("content-type") ?? "image/jpeg" },
			expirationTtl: 60 * 60 * 24 * 30,
		});
		posts.push({
			id: m.id,
			link: m.permalink?.startsWith("https://www.instagram.com/") ? m.permalink : "https://www.instagram.com/",
			legenda: (m.caption ?? "").slice(0, 300),
			imagem: `/instagram/${m.id}.jpg`,
			data: m.timestamp ?? "",
		});
	}
	if (posts.length) await kv.put("posts", JSON.stringify(posts));

	// Renova o token de longa duração (válido por 60 dias) uma vez por semana.
	const renovado = Number((await kv.get("token_renovado_em")) ?? 0);
	if (Date.now() - renovado > 7 * 24 * 60 * 60 * 1000) {
		const rr = await fetch(
			`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
		);
		if (rr.ok) {
			const novo = (await rr.json()) as { access_token?: string };
			if (novo.access_token) {
				await kv.put("token", novo.access_token);
				await kv.put("token_renovado_em", String(Date.now()));
			}
		}
	}
}
