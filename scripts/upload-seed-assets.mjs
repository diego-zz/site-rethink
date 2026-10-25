#!/usr/bin/env node
/**
 * Envia as imagens iniciais (seed/media) para o bucket público
 * rethink-ad-assets, de onde o EmDash as baixa no primeiro acesso
 * (assistente de configuração). Rodar uma vez antes do primeiro deploy;
 * o GitHub Actions roda automaticamente a cada deploy (é idempotente).
 *
 * Requer: CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID no ambiente
 * (ou `npx wrangler login`).
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

const BUCKET = "rethink-ad-assets";
const PASTA = "seed/media";
const TIPOS = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

const arquivos = readdirSync(PASTA).filter((f) => TIPOS[extname(f).toLowerCase()]);
for (const f of arquivos) {
	execFileSync(
		"npx",
		["wrangler", "r2", "object", "put", `${BUCKET}/seed/${f}`, "--file", join(PASTA, f), "--content-type", TIPOS[extname(f).toLowerCase()], "--cache-control", "public, max-age=31536000, immutable", "--remote"],
		{ stdio: ["ignore", "ignore", "inherit"] },
	);
	console.log(`✓ ${f}`);
}
console.log(`${arquivos.length} imagens enviadas para ${BUCKET}/seed/`);
