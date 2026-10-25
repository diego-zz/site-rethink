// Import estático do env do Worker num módulo próprio (mesmo padrão do
// plugin de e-mail da Cloudflare) para o bundler resolver corretamente.
export { env } from "cloudflare:workers";
