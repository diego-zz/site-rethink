#!/usr/bin/env python3
"""Gera seed/seed.json (esquema do CMS + conteúdo inicial do site da Rethink).

Uso: python3 scripts/seed/build-seed.py
O seed só é aplicado num banco vazio (primeiro acesso). Depois disso o conteúdo
é editado no painel /_emdash/admin.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = "https://pub-da52ac9b2d454fe8996979e23bdad69a.r2.dev/seed"
_key = {"n": 0}


def k(prefix="k"):
    _key["n"] += 1
    return f"{prefix}{_key['n']:04d}"


def media(file, alt):
    return {"$media": {"url": f"{ASSETS}/{file}", "alt": alt, "filename": file}}


def pt(*paragraphs, style="normal"):
    """Portable Text simples: cada string vira um parágrafo."""
    out = []
    for p in paragraphs:
        if isinstance(p, tuple):
            st, text = p
        else:
            st, text = style, p
        out.append({"_type": "block", "_key": k("b"), "style": st,
                    "markDefs": [], "children": [{"_type": "span", "_key": k("s"), "text": text, "marks": []}]})
    return out


def block(type_, key, **fields):
    return {"_type": type_, "_version": 1, "_key": key, **fields}


# ---------------------------------------------------------------- campos
def f(slug, label, type_, **extra):
    d = {"slug": slug, "label": label, "type": type_}
    d.update(extra)
    return d


def rep(slug, label, sub, **extra):
    v = {"subFields": sub}
    v.update(extra.pop("validation", {}))
    return f(slug, label, "repeater", validation=v, **extra)


LINK = {"pattern": "^(?:$|/|(?:https?://|mailto:|tel:|/(?!/)|#).+)$"}
LINK_HELP = " (começa com /, https://, mailto:, tel: ou #)"


def bt(slug, label, description, fields):
    return {"slug": slug, "label": label, "description": description, "category": "Rethink",
            "currentVersion": 1, "versions": [{"version": 1, "fields": fields}]}


ROTULO = f("rotulo", "Rótulo da seção (ex.: 01 — Quem somos)", "string")
TITULO = f("titulo", "Título (use Enter para quebrar linha)", "text")
INTRO = f("introducao", "Texto de apoio", "text")
ANCORA = f("ancora", "Âncora (id da seção, opcional)", "string")

block_types = [
    bt("hero", "Abertura (hero)", "Título grande no topo da página, com botões e foto opcional", [
        ROTULO,
        f("titulo", "Título (use Enter para quebrar linha)", "text", required=True),
        f("subtitulo", "Texto de apoio", "text"),
        f("cta1_texto", "Botão principal — texto", "string"),
        f("cta1_link", "Botão principal — link" + LINK_HELP, "string", validation=LINK),
        f("cta2_texto", "Botão secundário — texto", "string"),
        f("cta2_link", "Botão secundário — link" + LINK_HELP, "string", validation=LINK),
        f("imagem", "Foto", "image"),
        f("legenda_imagem", "Legenda sobre a foto", "string"),
        f("assinatura", "Assinatura sob os botões", "string"),
        f("fundo_escuro", "Fundo preto", "boolean", defaultValue=False),
        f("mostrar_trilha", "Mostrar trilha (Início / página)", "boolean", defaultValue=True),
    ]),
    bt("logos_clientes", "Logos de clientes", "Grade com os logos dos clientes marcados para exibição", [
        ROTULO,
        f("limite", "Quantidade máxima de logos", "integer", defaultValue=8),
    ]),
    bt("texto_duas_colunas", "Título + texto", "Título à esquerda e texto à direita, com link opcional", [
        ANCORA, ROTULO, TITULO,
        f("texto", "Texto", "portableText"),
        f("link_texto", "Link — texto", "string"),
        f("link_url", "Link — endereço" + LINK_HELP, "string", validation=LINK),
        f("fundo_branco", "Fundo branco", "boolean", defaultValue=False),
    ]),
    bt("ficha", "Ficha (dados rápidos)", "Pares rótulo e valor, como Fundação e Sede", [
        rep("itens", "Itens", [f("rotulo", "Rótulo", "string", required=True), f("valor", "Valor", "string", required=True)],
            validation={"minItems": 1, "maxItems": 6}),
    ]),
    bt("fundadora", "Perfil de pessoa", "Foto, nome, trajetória e números de uma pessoa (ex.: sócia-fundadora)", [
        ROTULO,
        f("nome", "Nome", "string", required=True),
        f("cargo", "Cargo e formação", "string"),
        f("foto", "Retrato", "image"),
        f("legenda_foto", "Legenda do retrato", "string"),
        f("texto", "Trajetória", "portableText"),
        rep("numeros", "Números de destaque", [f("valor", "Valor", "string", required=True), f("legenda", "Legenda", "string", required=True)],
            validation={"maxItems": 4}),
        f("foto_evento", "Foto adicional", "image"),
        f("legenda_evento", "Legenda da foto adicional", "string"),
        f("link_texto", "Link — texto", "string"),
        f("link_url", "Link — endereço" + LINK_HELP, "string", validation=LINK),
    ]),
    bt("imagem_larga", "Imagem larga", "Foto em largura total com legenda", [
        f("imagem", "Imagem", "image"),
        f("legenda", "Legenda", "string"),
        f("largura_total", "Ocupar toda a largura da tela", "boolean", defaultValue=False),
    ]),
    bt("lista_solucoes", "Lista de soluções", "Mostra as soluções cadastradas", [
        ANCORA, ROTULO, TITULO, INTRO,
        f("formato_linhas", "Formato em linhas grandes (em vez de cards)", "boolean", defaultValue=False),
    ]),
    bt("metodologia", "Etapas (metodologia)", "Etapas numeradas", [
        ROTULO, TITULO, INTRO,
        rep("etapas", "Etapas", [f("titulo", "Etapa", "string", required=True), f("descricao", "Descrição", "text")],
            validation={"minItems": 1, "maxItems": 8}),
        f("formato_linhas", "Formato em linhas (em vez de colunas)", "boolean", defaultValue=False),
    ]),
    bt("diferenciais", "Diferenciais", "Lista de diferenciais em colunas", [
        ROTULO, TITULO,
        rep("itens", "Diferenciais", [f("titulo", "Título", "string", required=True), f("texto", "Texto", "text")],
            validation={"minItems": 1, "maxItems": 8}),
    ]),
    bt("destaque_cases", "Cases em destaque", "Case principal e cases recentes (fundo preto)", [
        ROTULO, TITULO,
        f("botao_texto", "Texto do botão para todos os cases", "string"),
        f("quantidade", "Quantidade de cases além do destaque", "integer", defaultValue=3),
    ]),
    bt("grade_cases", "Grade de cases", "Todos os cases publicados, com filtro por solução", [
        f("mostrar_filtro", "Mostrar filtro por solução", "boolean", defaultValue=True),
    ]),
    bt("destaque_insights", "Insights recentes", "Últimos artigos publicados", [
        ROTULO, TITULO, INTRO,
        f("quantidade", "Quantidade", "integer", defaultValue=3),
    ]),
    bt("grade_insights", "Grade de insights", "Artigo em destaque, filtro por categoria e paginação", [
        f("por_pagina", "Artigos por página", "integer", defaultValue=6),
    ]),
    bt("instagram", "Instagram", "Últimos posts do Instagram", [
        ROTULO,
        f("link_texto", "Link — texto", "string"),
    ]),
    bt("contato", "Contato", "Chamada de contato com canais e formulário", [
        ANCORA, ROTULO,
        f("titulo", "Título (use Enter para quebrar linha)", "text", required=True),
        INTRO,
        f("mostrar_canais", "Mostrar canais (e-mail, WhatsApp, redes)", "boolean", defaultValue=True),
        f("mostrar_formulario", "Mostrar formulário", "boolean", defaultValue=True),
        f("titulo_pagina", "Usar como título principal da página (h1)", "boolean", defaultValue=False),
    ]),
    bt("faq", "Perguntas frequentes", "Perguntas e respostas (também vira dado estruturado para buscadores)", [
        ROTULO, TITULO,
        rep("perguntas", "Perguntas", [f("pergunta", "Pergunta", "string", required=True), f("resposta", "Resposta", "text", required=True)],
            validation={"minItems": 1, "maxItems": 12}),
    ]),
    bt("cta_faixa", "Faixa de chamada", "Faixa preta com título grande e botão", [
        f("titulo", "Título (use Enter para quebrar linha)", "text", required=True),
        f("texto", "Texto de apoio", "text"),
        f("botao_texto", "Botão — texto", "string"),
        f("botao_link", "Botão — link" + LINK_HELP, "string", validation=LINK),
    ]),
    bt("texto_longo", "Texto longo", "Texto corrido com índice (ex.: política de privacidade)", [
        f("aviso", "Aviso em destaque", "text"),
        f("atualizado_em", "Texto de atualização (ex.: Última atualização: 25/10/2026)", "string"),
        f("conteudo", "Conteúdo (use Título 2 para cada seção)", "portableText", required=True),
        f("mostrar_indice", "Mostrar índice lateral", "boolean", defaultValue=True),
    ]),
]
ALL_BLOCKS = [b["slug"] for b in block_types]

FAQ_SUB = [f("pergunta", "Pergunta", "string", required=True), f("resposta", "Resposta", "text", required=True)]

collections = [
    {
        "slug": "paginas", "label": "Páginas", "labelSingular": "Página", "icon": "file",
        "urlPattern": "/{slug}", "supports": ["drafts", "revisions", "preview", "seo", "search"], "sortOrder": 1,
        "fields": [
            f("title", "Título", "string", required=True, searchable=True),
            f("conteudo", "Seções", "blocks", validation={"allowedTypes": ALL_BLOCKS, "maxItems": 30}),
        ],
    },
    {
        "slug": "solucoes", "label": "Soluções", "labelSingular": "Solução", "icon": "lightbulb",
        "urlPattern": "/solucoes/{slug}", "supports": ["drafts", "revisions", "preview", "seo", "search"], "sortOrder": 2,
        "fields": [
            f("title", "Nome", "string", required=True, searchable=True),
            f("numero", "Número (ex.: 01)", "string", required=True),
            f("ordem", "Ordem de exibição", "integer", defaultValue=1),
            f("excerpt", "Resumo (cards e buscadores)", "text", required=True, searchable=True),
            f("introducao", "Texto da abertura", "text", searchable=True),
            f("imagem", "Imagem", "image"),
            f("para_que_titulo", "Para quê — título", "string"),
            f("para_que_texto", "Para quê — texto", "portableText", searchable=True),
            f("frentes_titulo", "Frentes — título", "string", defaultValue="Frentes de trabalho."),
            f("frentes_unidade", "Frentes — como contar (ex.: frentes, disciplinas)", "string", defaultValue="frentes"),
            rep("frentes", "Frentes de trabalho", [f("titulo", "Frente", "string", required=True)], validation={"maxItems": 20}),
            f("frentes_nota", "Nota abaixo das frentes", "text"),
            rep("faq", "Perguntas frequentes", FAQ_SUB, validation={"maxItems": 12}),
        ],
    },
    {
        "slug": "cases", "label": "Cases", "labelSingular": "Case", "icon": "briefcase",
        "urlPattern": "/cases/{slug}", "supports": ["drafts", "revisions", "preview", "scheduling", "seo", "search"], "sortOrder": 3,
        "fields": [
            f("title", "Título do case (ex.: nome do cliente)", "string", required=True, searchable=True),
            f("cliente", "Cliente", "reference", options={"collection": "clientes"}),
            f("setor", "Setor", "string"),
            f("solucao", "Solução", "reference", options={"collection": "solucoes"}),
            f("periodo", "Período (ex.: mar/2025 – set/2025)", "string"),
            f("frase_titulo", "Frase-título (resultado em linguagem simples)", "text", searchable=True),
            f("excerpt", "Resumo do card (desafio e solução em uma frase)", "text", searchable=True),
            f("imagem", "Imagem principal", "image"),
            rep("metricas", "Resultados em números", [f("valor", "Valor (ex.: +32%)", "string", required=True),
                                                       f("indicador", "Indicador e período de comparação", "string", required=True)],
                validation={"maxItems": 4}),
            f("contexto", "Contexto", "portableText", searchable=True),
            f("desafio", "Desafio", "portableText", searchable=True),
            f("o_que_fizemos", "O que fizemos", "portableText", searchable=True),
            rep("entregas", "Principais entregas", [f("item", "Entrega", "string", required=True)], validation={"maxItems": 12}),
            f("imagem_apoio", "Imagem de apoio", "image"),
            f("legenda_apoio", "Legenda da imagem de apoio", "string"),
            f("resultado", "Resultado", "portableText", searchable=True),
            f("depoimento", "Depoimento do cliente (com autorização)", "text"),
            f("depoimento_autor", "Autor do depoimento (Nome · Cargo, Empresa)", "string"),
            f("destaque", "Destacar na Home", "boolean", defaultValue=False),
            f("ordem", "Ordem de exibição", "integer", defaultValue=10),
        ],
    },
    {
        "slug": "insights", "label": "Insights", "labelSingular": "Insight", "icon": "newspaper",
        "urlPattern": "/insights/{slug}", "supports": ["drafts", "revisions", "preview", "scheduling", "seo", "search"], "sortOrder": 4,
        "fields": [
            f("title", "Título", "string", required=True, searchable=True),
            f("linha_fina", "Linha fina (o que o leitor vai aprender)", "text", searchable=True),
            f("excerpt", "Resumo (cards e meta description)", "text", required=True, searchable=True),
            f("capa", "Imagem de capa", "image"),
            f("legenda_capa", "Legenda e crédito da capa", "string"),
            f("content", "Texto", "portableText", required=True, searchable=True),
            f("tempo_leitura", "Tempo de leitura (min)", "integer"),
            f("link_linkedin", "Link do post no LinkedIn", "url"),
            f("destaque", "Destacar na página de Insights", "boolean", defaultValue=False),
        ],
    },
    {
        "slug": "clientes", "label": "Clientes", "labelSingular": "Cliente", "icon": "buildings",
        "supports": ["drafts", "revisions"], "routable": False, "sortOrder": 5,
        "fields": [
            f("title", "Nome", "string", required=True, searchable=True),
            f("logo", "Logo (PNG ou SVG, fundo transparente)", "image"),
            f("site", "Site", "url"),
            f("setor", "Setor", "string"),
            f("autorizado", "Uso do nome e logo autorizado pelo cliente", "boolean", defaultValue=False),
            f("exibir_logo", "Exibir na grade de logos", "boolean", defaultValue=True),
            f("ordem", "Ordem de exibição", "integer", defaultValue=10),
        ],
    },
    {
        "slug": "dados_empresa", "label": "Dados da empresa", "labelSingular": "Dados da empresa", "icon": "identification-card",
        "description": "Contatos, redes, endereço e barra de aviso. Use só o item \"rethink\".",
        "supports": ["revisions"], "routable": False, "sortOrder": 6,
        "fields": [
            f("title", "Nome da empresa", "string", required=True),
            f("razao_social", "Razão social", "string"),
            f("cnpj", "CNPJ", "string"),
            f("ano_fundacao", "Ano de fundação", "string"),
            f("email", "E-mail de contato", "string"),
            f("whatsapp", "WhatsApp (como aparece, ex.: +55 51 99999-9999)", "string"),
            f("whatsapp_numero", "WhatsApp (só números com DDI, ex.: 5551999999999)", "string"),
            f("endereco", "Endereço", "string"),
            f("cidade", "Cidade", "string"),
            f("uf", "UF", "string"),
            f("cep", "CEP", "string"),
            f("linkedin_url", "LinkedIn (URL da página)", "url"),
            f("instagram_url", "Instagram (URL do perfil)", "url"),
            f("instagram_perfil", "Instagram (@perfil)", "string"),
            f("aviso_texto", "Barra de aviso no topo — texto", "string"),
            f("aviso_link", "Barra de aviso no topo — link" + LINK_HELP, "string", validation=LINK),
            f("descricao_organizacao", "Descrição curta da empresa (buscadores e IAs)", "text"),
            f("cta_titulo", "Faixa final padrão — título (soluções, insights)", "text"),
            f("cta_botao", "Faixa final padrão — texto do botão", "string"),
            f("cta_case_titulo", "Faixa final dos cases — título", "text"),
        ],
    },
]

taxonomies = [
    {"name": "categoria", "label": "Categorias", "labelSingular": "Categoria", "hierarchical": True,
     "collections": ["insights"],
     "terms": [{"slug": s, "label": l} for s, l in [("estrategia", "Estratégia"), ("dados", "Dados"),
                                                     ("inovacao", "Inovação"), ("comunicacao", "Comunicação")]]},
    {"name": "tag", "label": "Tags", "labelSingular": "Tag", "hierarchical": False, "collections": ["insights"], "terms": []},
]

menus = [
    {"name": "principal", "label": "Menu principal", "items": [
        {"type": "custom", "label": "Quem somos", "url": "/quem-somos"},
        {"type": "custom", "label": "Nossas soluções", "url": "/solucoes"},
        {"type": "custom", "label": "Cases", "url": "/cases"},
        {"type": "custom", "label": "Insights", "url": "/insights"},
        {"type": "custom", "label": "Contato", "url": "/contato"},
    ]},
    {"name": "rodape", "label": "Rodapé — Rethink", "items": [
        {"type": "custom", "label": "Quem somos", "url": "/quem-somos"},
        {"type": "custom", "label": "Nossas soluções", "url": "/solucoes"},
        {"type": "custom", "label": "Cases", "url": "/cases"},
        {"type": "custom", "label": "Insights", "url": "/insights"},
    ]},
    {"name": "legal", "label": "Rodapé — links legais", "items": [
        {"type": "custom", "label": "Política de Privacidade", "url": "/privacidade"},
    ]},
]

# ---------------------------------------------------------------- conteúdo
solucoes = [
    {
        "id": "sol-dados", "slug": "data-driven-marketing", "numero": "01", "ordem": 1,
        "title": "Data Driven Marketing",
        "excerpt": "Planejamento, pesquisa e analytics para decisões de marketing baseadas em dados — e capacitação do time.",
        "introducao": "Planejamento estratégico, pesquisa e analytics para que as decisões de marketing sejam tomadas com base em dados — e capacitação do time para sustentar essa cultura.",
        "imagem": media("dados.jpg", "Analista anota um gráfico impresso ao lado de um notebook com painéis de dados"),
        "para_que_titulo": "Decidir com dados.",
        "para_que_texto": pt("Transformar dados em decisões de marketing: do portfólio à comunicação, com pesquisa de mercado, estruturas de business analytics e treinamento para que o time acompanhe métricas e indicadores de performance no dia a dia."),
        "frentes": ["Planejamento estratégico de portfólio data based", "Pesquisas de mercado", "Planejamento estratégico de comunicação",
                    "Gestão de canais — social media", "Target analytics", "Capacitação de equipes", "Mentoria para a área de marketing",
                    "Desenvolvimento de estrutura de business analytics para marketing",
                    "Treinamento para adoção de ferramentas de análise de performance de marketing e mídia",
                    "Workshops e cursos de IA aplicada", "Mentorias para team building", "Trilhas educacionais"],
    },
    {
        "id": "sol-midia", "slug": "inteligencia-de-midia-e-performance", "numero": "02", "ordem": 2,
        "title": "Inteligência de Mídia e Performance",
        "excerpt": "Mídia planejada e avaliada com dados: arquitetura de canais, performance, influência e eventos.",
        "introducao": "Planejamento e avaliação de mídia com inteligência de dados: arquitetura de canais, performance e preparo dos gestores — inclusive em marketing de influência e eventos.",
        "imagem": media("case-financeiro.jpg", "Profissional acompanha painéis de dados de mídia em vários monitores"),
        "para_que_titulo": "Mídia que se mede.",
        "para_que_texto": pt("Planejar, avaliar e conduzir investimentos de mídia a partir de dados: desenhar a arquitetura de canais, definir o que é performance para cada frente e preparar gestores e equipes para tomar decisões de mídia com segurança."),
        "frentes": ["Planejamento estratégico de mídia", "Media training para gestores", "Desenho de arquitetura de canais",
                    "Mentoria de mídia e performance para marketing e comunicação", "Avaliação de projetos de mídia",
                    "Planejamento de performance para marketing de influência", "Condução de eventos a partir da inteligência de dados"],
    },
    {
        "id": "sol-inovacao", "slug": "aculturamento-e-gestao-da-inovacao", "numero": "03", "ordem": 3,
        "title": "Aculturamento e Gestão da Inovação",
        "excerpt": "Imersões, cursos e projetos que levam a cultura de inovação e o intraempreendedorismo para dentro das equipes.",
        "introducao": "Imersões, cursos e projetos que levam a cultura de inovação e o intraempreendedorismo para dentro das equipes — com metodologia e governança.",
        "imagem": media("ig-1.jpg", "Consultora conduz workshop diante de um quadro com anotações"),
        "para_que_titulo": "Inovação como cultura.",
        "para_que_texto": pt("Tratar inovação como gestão, e não como projeto isolado: preparar times com metodologia, imersões e projetos intraempreendedores, enfrentar as barreiras para inovar e incorporar diversidade, equidade e inclusão desde o desenho."),
        "frentes": ["Workshops para team building", "Cursos e metodologia para gestão da inovação", "Imersões para aculturamento de times",
                    "Projetos intraempreendedores", "Mindset intraempreendedor e gestão de barreiras para inovação",
                    "Projetos e governança DEI by Design (Diversidade, Equidade e Inclusão por Design)"],
    },
    {
        "id": "sol-warroom", "slug": "war-room", "numero": "04", "ordem": 4,
        "title": "War Room",
        "excerpt": "Sala de operação com dados em tempo real para conduzir eventos, projetos e produtos de curto prazo.",
        "introducao": "Uma sala de operação com dados em tempo real para conduzir eventos, projetos e produtos de curto prazo — com inteligência, mídia, imprensa e lideranças na mesma mesa.",
        "imagem": media("hero.jpg", "Equipe reunida diante de um quadro com análises"),
        "para_que_titulo": "Decisão em tempo real.",
        "para_que_texto": pt("Identificar problemas e oportunidades, promover a resolução em curto espaço de tempo, desenvolver insights e traduzi-los em ações ágeis com foco em resultados."),
        "frentes_titulo": "Quem está na sala.", "frentes_unidade": "disciplinas",
        "frentes": ["Inteligência", "Mídia", "PR e assessoria de imprensa", "Análise de dados", "Social media", "Lideranças do cliente"],
        "frentes_nota": "A Rethink planeja e conduz a operação dessa equipe estratégica de marketing, que monitora dados em tempo real para conduzir eventos, projetos e produtos de curto prazo.",
    },
]

NOTA_METODO = "Como toda frente da Rethink, segue a nossa metodologia data driven: indicadores definidos no início orientam o planejamento, a execução e os ajustes."
sol_entries = []
for s in solucoes:
    data = {kk: vv for kk, vv in s.items() if kk not in ("id", "slug", "frentes")}
    data["para_que_texto"] = s["para_que_texto"] + pt(NOTA_METODO)
    data["frentes"] = [{"titulo": t} for t in s["frentes"]]
    data.setdefault("frentes_titulo", "Frentes de trabalho.")
    data.setdefault("frentes_unidade", "frentes")
    sol_entries.append({"id": s["id"], "slug": s["slug"], "status": "published", "data": data})

ETAPAS = [
    {"titulo": "[Diagnóstico]", "descricao": "Leitura do momento da empresa e do mercado a partir de dados."},
    {"titulo": "[Estratégia]", "descricao": "Objetivos, indicadores de performance e plano priorizado."},
    {"titulo": "[Execução]", "descricao": "Projetos de comunicação e marketing com gestão próxima e ritmo definido."},
    {"titulo": "[Medição e ajuste]", "descricao": "Indicadores acompanhados e estratégia repensada quando o dado pede."},
]

home = [
    block("hero", "home-hero", rotulo="Consultoria de marketing · data driven · inovação", titulo="Let’s\nRethink.",
          subtitulo="Convidamos empresas a repensar sua estratégia de marketing à luz do momento atual do negócio e do mercado — e a executá-la com decisões baseadas em dados, métricas claras e foco em valor de longo prazo.",
          cta1_texto="Vamos conversar", cta1_link="/contato", cta2_texto="Ver cases", cta2_link="/cases",
          imagem=media("hero.jpg", "Consultora apresenta estratégia ao time diante de um quadro"), legenda_imagem="Workshop de diagnóstico",
          assinatura="Inteligência de marketing com resultados", fundo_escuro=True, mostrar_trilha=False),
    block("logos_clientes", "home-logos", rotulo="Empresas que já repensaram com a gente", limite=8),
    block("texto_duas_colunas", "home-quem", rotulo="01 — Quem somos", titulo="Estratégia que se prova em resultado.",
          texto=pt("A Rethink é uma consultoria de marketing com forte experiência no desenvolvimento e na gestão de projetos de comunicação e marketing, unindo estratégia, inteligência de dados e gestão da inovação em processos e portfólio.",
                   "Atuamos do planejamento à execução, com metodologia própria e decisões baseadas em dados, acompanhando métricas e indicadores de performance o tempo todo — e levando a cultura data driven para dentro dos nossos clientes."),
          link_texto="Conheça a Rethink", link_url="/quem-somos", fundo_branco=False),
    block("lista_solucoes", "home-solucoes", rotulo="02 — Nossas soluções", titulo="Do diagnóstico\nà execução.",
          introducao="Quatro frentes que podem ser contratadas separadamente ou combinadas em um mesmo projeto.", formato_linhas=False),
    block("metodologia", "home-metodo", rotulo="03 — Como trabalhamos", titulo="Metodologia [nome].",
          introducao="Metodologia própria, data driven decision based. [Validar etapas reais.]", etapas=ETAPAS, formato_linhas=False),
    block("destaque_cases", "home-cases", rotulo="04 — Cases", titulo="Resultados que\na gente mede.", botao_texto="Todos os cases", quantidade=3),
    block("destaque_insights", "home-insights", rotulo="05 — Insights", titulo="Para repensar.",
          introducao="Artigos publicados aqui primeiro e compartilhados no LinkedIn — o conteúdo trabalha pelo SEO do site.", quantidade=3),
    block("instagram", "home-instagram", rotulo="No Instagram", link_texto="Seguir"),
    block("contato", "home-contato", ancora="contato", rotulo="06 — Contato", titulo="Let’s\nRethink\ntogether.",
          introducao="Conte o momento da sua empresa e o que você quer repensar.", mostrar_canais=True, mostrar_formulario=True, titulo_pagina=False),
]

quem_somos = [
    block("hero", "qs-hero", rotulo="Quem somos", titulo="Repensar\né o nosso\nmétodo.",
          subtitulo="Somos uma consultoria de marketing que une estratégia, inteligência de dados e gestão da inovação — do planejamento à execução, com foco em resultados e em valor de longo prazo para os nossos clientes.",
          fundo_escuro=False, mostrar_trilha=True),
    block("imagem_larga", "qs-foto", imagem=media("escritorio.jpg", "Duas consultoras analisam um painel de dados na parede do escritório"),
          legenda="[Imagem ilustrativa — substituir por foto real do escritório ou de um projeto]", largura_total=False),
    block("texto_duas_colunas", "qs-porque", rotulo="01 — Por que existimos", titulo="Let’s Rethink.",
          texto=pt("Mercados mudam, empresas mudam — e a estratégia de marketing precisa acompanhar. Por isso convidamos nossos clientes a repensar suas estratégias à luz do momento atual da empresa e do mercado.",
                   "Concretizamos cada projeto com uma metodologia própria, totalmente orientada a decisões baseadas em dados, com olhar constante sobre métricas e indicadores de performance.")),
    block("ficha", "qs-ficha", itens=[{"rotulo": "Fundação", "valor": "[ano]"}, {"rotulo": "Sede", "valor": "Porto Alegre/RS"},
                                      {"rotulo": "Fundadora", "valor": "Roberta Krause"}]),
    block("fundadora", "qs-roberta", rotulo="Quem está à frente", nome="Roberta Krause",
          cargo="Sócia-fundadora · Publicitária · Doutora e Mestre em Ciências da Comunicação",
          foto=media("roberta-retrato.jpg", "Retrato de Roberta Krause, sócia-fundadora da Rethink"),
          legenda_foto="Roberta Fleck Saibro Krause · Sócia-fundadora",
          texto=pt("Com mais de 20 anos de experiência em comunicação, passou por grandes agências de publicidade nacionais em São Paulo, Brasília e no Rio Grande do Sul, à frente do planejamento de clientes como Caixa Econômica Federal, Ministério da Saúde, Grupo Gerdau, Nissan, Renault e Apex-Brasil.",
                   "Tem forte experiência no desenvolvimento e na gestão de projetos de comunicação, valor de marca e estratégias de marketing para os segmentos de varejo, indústria, consultorias e educação.",
                   "Na ESPM, coordena cursos de pós-graduação, é coordenadora nacional do Atitude Empreendedora e coordenadora de Projetos de Inovação e Educação Executiva em Porto Alegre. Leciona na graduação em São Paulo, Rio de Janeiro e Porto Alegre, e na pós-graduação em Curitiba, Porto Alegre e Florianópolis."),
          numeros=[{"valor": "20+", "legenda": "anos em comunicação e planejamento"}, {"valor": "Dra.", "legenda": "em Ciências da Comunicação"},
                   {"valor": "ESPM", "legenda": "coordenação e docência em 5 cidades"}],
          foto_evento=media("roberta-palestra.jpg", "Roberta Krause palestra em evento da ESPM"),
          legenda_evento="Roberta no Lifelong Learning Experience, da ESPM Porto Alegre, no Instituto Caldeira.",
          link_texto="Roberta no LinkedIn", link_url="https://www.linkedin.com/"),
    block("diferenciais", "qs-dif", rotulo="02 — O que nos diferencia", titulo="Performance\ncom método.", itens=[
        {"titulo": "Foco em resultado", "texto": "Capacidade de performance orientada a resultados, medida por indicadores definidos desde o início."},
        {"titulo": "Cultura data driven", "texto": "Iniciativas ancoradas no aculturamento data driven: o cliente passa a decidir com dados, não só a receber relatórios."},
        {"titulo": "Gestão da inovação", "texto": "Inovação tratada como gestão — em processos e portfólio — e não como projeto isolado."},
        {"titulo": "Estratégia que executa", "texto": "Time de alta capacidade estratégica e operacional: quem planeja acompanha a execução."},
    ]),
    block("metodologia", "qs-metodo", rotulo="03 — Metodologia", titulo="Metodologia [nome].",
          introducao="Data driven decision based: cada etapa tem entregáveis e indicadores próprios. [Validar nome, etapas e entregáveis.]",
          etapas=[{**e, "descricao": e["descricao"] + " Entregável: [validar]."} for e in ETAPAS], formato_linhas=True),
    block("logos_clientes", "qs-logos", rotulo="Empresas que já repensaram com a gente", limite=6),
    block("cta_faixa", "qs-cta", titulo="Vamos repensar\njuntos?", botao_texto="Fale com a gente", botao_link="/contato"),
]

pagina_solucoes = [
    block("hero", "sol-hero", rotulo="Nossas soluções", titulo="Do diagnóstico\nà execução.",
          subtitulo="Quatro frentes que podem ser contratadas separadamente ou combinadas em um único projeto — sempre com indicadores definidos desde o início.",
          fundo_escuro=False, mostrar_trilha=True),
    block("lista_solucoes", "sol-lista", formato_linhas=True),
    block("texto_duas_colunas", "sol-combina", rotulo="Como combinamos", titulo="Um projeto,\num painel.", fundo_branco=True,
          texto=pt("Cada solução tem escopo próprio, mas todas compartilham a mesma metodologia data driven: os indicadores definidos no diagnóstico guiam a estratégia, a execução e os ajustes.",
                   "Projetos de inteligência de mercado e expansão, por exemplo, combinam pesquisa e diagnóstico com estratégia de marketing e uma governança de acompanhamento junto à liderança do cliente."),
          link_texto="Conheça a metodologia", link_url="/quem-somos"),
    block("cta_faixa", "sol-cta", titulo="Não sabe por\nonde começar?",
          texto="Uma conversa de diagnóstico ajuda a identificar qual frente faz mais sentido agora.", botao_texto="Agendar conversa", botao_link="/contato"),
]

pagina_cases = [
    block("hero", "cases-hero", rotulo="Cases", titulo="Resultados que\na gente mede.",
          subtitulo="Cada case mostra o desafio, o que fizemos e os números que mudaram — com autorização dos clientes.", fundo_escuro=True, mostrar_trilha=True),
    block("grade_cases", "cases-grade", mostrar_filtro=True),
    block("cta_faixa", "cases-cta", titulo="O próximo case\npode ser o seu.", botao_texto="Vamos conversar", botao_link="/contato"),
]

pagina_insights = [
    block("hero", "ins-hero", rotulo="Insights", titulo="Para\nrepensar.",
          subtitulo="Análises e ideias sobre marketing, dados e inovação — publicadas aqui e compartilhadas no LinkedIn.", fundo_escuro=False, mostrar_trilha=True),
    block("grade_insights", "ins-grade", por_pagina=6),
    block("cta_faixa", "ins-cta", titulo="Acompanhe\nno LinkedIn.",
          texto="Cada novo artigo é compartilhado na nossa página — siga para receber no seu feed.", botao_texto="Seguir a Rethink", botao_link="https://www.linkedin.com/"),
]

pagina_contato = [
    block("contato", "contato-form", rotulo="Contato", titulo="Let’s\nRethink\ntogether.",
          introducao="Conte o momento da sua empresa e o que você quer repensar.", mostrar_canais=True, mostrar_formulario=True, titulo_pagina=True),
]

PRIV = [
    ("h2", "1. Quem somos"), "[Razão social, CNPJ e endereço da Rethink Consultoria como controladora dos dados.]",
    ("h2", "2. Dados que coletamos"), "[Formulário de contato: nome, empresa, e-mail, telefone (opcional), solução de interesse e mensagem. Junto com o envio, a origem da visita: site de referência, parâmetros de campanha (UTM) e identificadores de clique de anúncios. Dados de navegação, conforme o consentimento de cookies.]",
    ("h2", "3. Para que usamos"), "[Responder ao contato e, se autorizado, enviar conteúdos. Melhorar o site com métricas agregadas.]",
    ("h2", "4. Base legal"), "[Hipóteses legais aplicáveis a cada finalidade — a definir com o jurídico.]",
    ("h2", "5. Compartilhamento"), "[Operadores envolvidos — ex.: Cloudflare (hospedagem, e-mail) e Google (métricas, com consentimento) — e transferência internacional.]",
    ("h2", "6. Cookies e métricas"), "[Google Tag Manager e Google Analytics, carregados só após o seu consentimento no aviso de cookies.]",
    ("h2", "7. Retenção e segurança"), "[Contatos recebidos pelo formulário são guardados por até 24 meses e depois excluídos automaticamente.]",
    ("h2", "8. Seus direitos"), "[Confirmação, acesso, correção, anonimização, portabilidade, eliminação e revogação do consentimento — e como exercê-los.]",
    ("h2", "9. Contato do encarregado"), "[Nome ou canal do encarregado (DPO) e e-mail para solicitações.]",
]
pagina_privacidade = [
    block("hero", "priv-hero", titulo="Política de\nPrivacidade.", fundo_escuro=False, mostrar_trilha=True),
    block("texto_longo", "priv-texto", aviso="Estrutura de página. O texto definitivo precisa ser redigido e validado por assessoria jurídica conforme a LGPD (Lei 13.709/2018).",
          atualizado_em="Última atualização: [data]", conteudo=pt(*PRIV), mostrar_indice=True),
]

pagina_404 = [
    block("hero", "nf-hero", rotulo="Erro 404 · página não encontrada", titulo="Vamos\nrepensar\no caminho.",
          subtitulo="O endereço que você procurou não existe ou mudou de lugar. Estes caminhos podem ajudar:",
          cta1_texto="Ir para o início", cta1_link="/", cta2_texto="Nossas soluções", cta2_link="/solucoes",
          imagem=media("ins-escada.jpg", "Escada em espiral vista de baixo"), fundo_escuro=True, mostrar_trilha=False),
]


def page(id_, slug, title, blocks_):
    return {"id": id_, "slug": slug, "status": "published", "data": {"title": title, "conteudo": blocks_}}


paginas = [
    page("pg-home", "home", "Início", home),
    page("pg-quem-somos", "quem-somos", "Quem somos", quem_somos),
    page("pg-solucoes", "solucoes", "Nossas soluções", pagina_solucoes),
    page("pg-cases", "cases", "Cases", pagina_cases),
    page("pg-insights", "insights", "Insights", pagina_insights),
    page("pg-contato", "contato", "Contato", pagina_contato),
    page("pg-privacidade", "privacidade", "Política de Privacidade", pagina_privacidade),
    page("pg-404", "nao-encontrada", "Página não encontrada", pagina_404),
]

# Cases e insights de exemplo ficam em rascunho: servem de modelo para a equipe
# e não aparecem no site até terem conteúdo real e autorização do cliente.
cases = [
    {"id": "case-exemplo-a", "slug": "exemplo-midia", "status": "draft", "data": {
        "title": "[Cliente A]", "setor": "[Setor]", "solucao": "$ref:sol-midia", "periodo": "[mês/ano – mês/ano]",
        "frase_titulo": "[Frase-título do case: o resultado principal em linguagem simples.]",
        "excerpt": "[Desafio e solução em uma frase.]", "imagem": media("case-varejo.jpg", "[Imagem do projeto — ilustrativa]"),
        "metricas": [{"valor": "[+00%]", "indicador": "[Indicador e período de comparação]"}, {"valor": "[00x]", "indicador": "[Indicador e período de comparação]"}],
        "contexto": pt("[Quem é o cliente, em que momento estava e por que procurou a Rethink.]"),
        "desafio": pt("[O problema de negócio em termos mensuráveis: qual indicador precisava mudar.]"),
        "o_que_fizemos": pt("[Abordagem, etapas da metodologia aplicadas e principais entregas.]"),
        "entregas": [{"item": "[Entrega 1]"}, {"item": "[Entrega 2]"}, {"item": "[Entrega 3]"}],
        "resultado": pt("[O que mudou, com os números acima explicados — e o que ficou de cultura no time do cliente.]"),
        "depoimento": "[Depoimento real do cliente, com autorização por escrito.]", "depoimento_autor": "[Nome] · [Cargo], [Cliente]",
        "destaque": True, "ordem": 1}},
    {"id": "case-exemplo-b", "slug": "exemplo-data-driven", "status": "draft", "data": {
        "title": "[Cliente B]", "setor": "[Setor]", "solucao": "$ref:sol-dados", "excerpt": "[Desafio e solução em uma frase.]",
        "imagem": media("case-financeiro.jpg", "[Imagem do projeto — ilustrativa]"),
        "metricas": [{"valor": "[+00%]", "indicador": "[indicador]"}], "ordem": 2}},
    {"id": "case-exemplo-c", "slug": "exemplo-war-room", "status": "draft", "data": {
        "title": "[Cliente C]", "setor": "[Setor]", "solucao": "$ref:sol-warroom", "excerpt": "[Desafio e solução em uma frase.]",
        "imagem": media("case-estudio.jpg", "[Imagem do projeto — ilustrativa]"),
        "metricas": [{"valor": "[+00%]", "indicador": "[indicador]"}], "ordem": 3}},
]

insights = [
    {"id": "ins-exemplo", "slug": "exemplo-de-artigo", "status": "draft", "bylines": [{"byline": "byline-roberta"}],
     "taxonomies": {"categoria": ["dados"]}, "data": {
        "title": "[Título do artigo — claro, com a palavra-chave principal]",
        "linha_fina": "[Linha fina: o que o leitor vai aprender, em uma frase.]",
        "excerpt": "[Resumo de duas linhas, usado também como meta description.]",
        "capa": media("ins-escada.jpg", "[Descrição da imagem de capa]"), "legenda_capa": "[Legenda e crédito da imagem]",
        "content": pt("[Parágrafo de abertura: o problema ou a pergunta que o artigo responde.]",
                      "[Segundo parágrafo: contexto e por que isso importa agora.]",
                      ("h2", "[Intertítulo 1]"), "[Desenvolvimento.]",
                      ("h2", "[Intertítulo 2]"), "[Desenvolvimento.]",
                      ("blockquote", "[Frase de destaque do próprio artigo.]"),
                      ("h2", "[Conclusão: e agora?]"), "[Fechamento com recomendação prática e convite para conversar.]"),
        "tempo_leitura": 6, "destaque": True}},
]

dados_empresa = [{"id": "empresa", "slug": "rethink", "status": "published", "data": {
    "title": "Rethink Consultoria", "razao_social": "[Razão social]", "cnpj": "[00.000.000/0000-00]", "ano_fundacao": "[ano]",
    "email": "[contato@rethink.ad]", "whatsapp": "[+55 00 00000-0000]", "whatsapp_numero": "",
    "endereco": "", "cidade": "Porto Alegre", "uf": "RS", "cep": "",
    "linkedin_url": "https://www.linkedin.com/", "instagram_url": "https://www.instagram.com/", "instagram_perfil": "@[perfil]",
    "aviso_texto": "", "aviso_link": "/insights",
    "cta_titulo": "Vamos repensar\njuntos?", "cta_botao": "Fale com a gente", "cta_case_titulo": "Desafio parecido?",
    "descricao_organizacao": "A Rethink é uma consultoria de marketing de Porto Alegre que une estratégia, inteligência de dados e gestão da inovação, do planejamento à execução, com decisões baseadas em dados e foco em resultado.",
}}]

seed = {
    "$schema": "https://emdashcms.com/seed.schema.json",
    "version": "1",
    "meta": {"name": "Rethink Consultoria", "description": "Site institucional da Rethink Consultoria", "author": "Bonaparte"},
    "settings": {"title": "Rethink Consultoria", "tagline": "Inteligência de marketing com resultados",
                 "timezone": "America/Sao_Paulo", "seo": {"titleSeparator": "—", "disallowAiTraining": True}},
    "blockTypes": block_types,
    "collections": collections,
    "taxonomies": taxonomies,
    "menus": menus,
    "bylines": [{"id": "byline-roberta", "slug": "roberta-krause", "displayName": "Roberta Krause",
                 "bio": "Sócia-fundadora da Rethink. Publicitária, doutora e mestre em Ciências da Comunicação."}],
    "content": {"solucoes": sol_entries, "paginas": paginas, "cases": cases, "insights": insights, "dados_empresa": dados_empresa},
}

out = ROOT / "seed" / "seed.json"
out.write_text(json.dumps(seed, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
print(f"seed gravado em {out} ({out.stat().st_size} bytes)")
