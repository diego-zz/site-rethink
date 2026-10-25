/**
 * Comportamento do formulário de contato no navegador:
 * validação acessível, Turnstile, envio e estado de sucesso.
 */
declare global {
	interface Window {
		turnstile?: {
			render: (el: HTMLElement, opts: Record<string, unknown>) => string;
			reset: (id?: string) => void;
			getResponse: (id?: string) => string | undefined;
		};
		dataLayer?: unknown[];
	}
}

const MENSAGENS: Record<string, string> = {
	nome: "Informe seu nome.",
	empresa: "Informe a empresa.",
	email: "Informe um e-mail válido.",
	mensagem: "Conte o que você quer repensar.",
	consentimento: "É preciso concordar com o uso dos dados para responder.",
};

const ERROS_API: Record<string, string> = {
	TURNSTILE: "Não foi possível confirmar que você não é um robô. Tente novamente.",
	LIMITE: "Recebemos muitas mensagens deste endereço. Tente novamente mais tarde.",
	INVALIDO: "Revise os campos destacados e tente novamente.",
};

function renderTurnstile(form: HTMLFormElement): Promise<string | undefined> {
	const alvo = form.querySelector<HTMLElement>("[data-turnstile]");
	if (!alvo) return Promise.resolve(undefined);
	return new Promise((resolve) => {
		let tentativas = 0;
		const tentar = () => {
			if (window.turnstile) {
				const id = window.turnstile.render(alvo, {
					sitekey: alvo.dataset.sitekey,
					language: "pt-br",
					appearance: "interaction-only",
				});
				alvo.dataset.widget = id;
				resolve(id);
			} else if (tentativas++ < 100) {
				setTimeout(tentar, 100);
			} else {
				resolve(undefined);
			}
		};
		tentar();
	});
}

export function iniciarFormularios() {
	document.querySelectorAll<HTMLFormElement>("form[data-contato]").forEach((form) => {
		if (form.dataset.iniciado) return;
		form.dataset.iniciado = "1";
		const caixa = form.parentElement!;
		const sucesso = caixa.querySelector<HTMLElement>("[data-sucesso]");
		const erro = form.querySelector<HTMLElement>("[data-erro]");
		const botao = form.querySelector<HTMLButtonElement>("button[type=submit]");
		const widget = renderTurnstile(form);

		const mostrarErro = (texto: string) => {
			if (!erro) return;
			erro.textContent = texto;
			erro.hidden = false;
		};

		form.addEventListener("input", (e) => {
			const el = e.target as HTMLInputElement;
			if (el.getAttribute("aria-invalid") === "true" && el.checkValidity()) el.removeAttribute("aria-invalid");
		});

		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			if (erro) erro.hidden = true;
			let primeiro: HTMLElement | null = null;
			const faltando: string[] = [];
			for (const el of Array.from(form.elements) as HTMLInputElement[]) {
				if (!el.name || el.type === "hidden" || el.name === "site") continue;
				const ok = el.type === "checkbox" ? !el.required || el.checked : el.checkValidity() && (!el.required || el.value.trim() !== "");
				if (!ok) {
					el.setAttribute("aria-invalid", "true");
					faltando.push(MENSAGENS[el.name] ?? "Revise este campo.");
					primeiro ??= el;
				} else {
					el.removeAttribute("aria-invalid");
				}
			}
			if (faltando.length) {
				mostrarErro(faltando.join(" "));
				primeiro?.focus();
				return;
			}

			const dados = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
			const idWidget = await widget;
			if (idWidget && window.turnstile) {
				dados.turnstile = window.turnstile.getResponse(idWidget) ?? "";
			}
			if (botao) botao.disabled = true;
			try {
				const r = await fetch(form.dataset.endpoint!, {
					method: "POST",
					headers: { "Content-Type": "application/json", Accept: "application/json" },
					body: JSON.stringify({ ...dados, consentimento: dados.consentimento === "on" }),
				});
				const json = (await r.json().catch(() => ({}))) as { data?: { ok?: boolean; erro?: string } };
				const res = json.data;
				if (r.ok && res?.ok) {
					window.dataLayer?.push({ event: "formulario_contato_enviado", solucao: dados.solucao || "diagnostico" });
					form.reset();
					form.hidden = true;
					if (sucesso) {
						sucesso.hidden = false;
						sucesso.focus();
					}
				} else {
					mostrarErro(ERROS_API[res?.erro ?? ""] ?? "Não foi possível enviar agora. Tente de novo em instantes.");
					if (idWidget) window.turnstile?.reset(idWidget);
				}
			} catch {
				mostrarErro("Sem conexão no momento. Verifique sua internet e tente novamente.");
			} finally {
				if (botao) botao.disabled = false;
			}
		});

		caixa.querySelector("[data-outra]")?.addEventListener("click", () => {
			if (sucesso) sucesso.hidden = true;
			form.hidden = false;
			form.querySelector<HTMLInputElement>("input[name=nome]")?.focus();
		});
	});
}
