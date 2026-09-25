"use strict";

/* =====================================================================
   CONFIGURAÇÃO — o único trecho que você normalmente precisa mexer
   ===================================================================== */
const CONFIG = {
  // Planilha carregada automaticamente ao abrir o site
  arquivoPadrao: "dados/colaboradores.csv",

  // Nomes das colunas-chave (primeira linha da planilha)
  campoCodigo: "codigo_cracha",
  campoNome: "nome_completo",
  campoFoto: "foto", // opcional: link ou caminho da imagem

  // Como cada coluna aparece na tela. Coluna nova sem rótulo aqui
  // aparece com o próprio nome escrito na planilha.
  rotulos: {
    cargo: "Cargo",
    area: "Área",
    gestor: "Gestor(a)",
    email: "E-mail",
    ramal: "Ramal",
    unidade: "Unidade",
    data_admissao: "Data de admissão",
    situacao: "Situação"
  },

  minimoLetrasNome: 3,   // letras mínimas para começar a buscar por nome
  maximoResultados: 20   // quantos nomes mostrar quando há vários
};

/* =====================================================================
   ESTADO E ELEMENTOS DA TELA
   ===================================================================== */
let colaboradores = [];  // registros lidos da planilha
let colunas = [];        // [{ chave, rotulo }] na ordem da planilha
let ultimaLista = null;  // para o botão "voltar aos resultados"

const campo = document.getElementById("campo-busca");
const form = document.getElementById("form-busca");
const resultado = document.getElementById("resultado");
const statusEl = document.getElementById("status");
const arquivo = document.getElementById("arquivo");

/* =====================================================================
   UTILITÁRIOS DE TEXTO
   ===================================================================== */

// Tira acentos, espaços duplicados e maiúsculas: "José  Conceição" -> "jose conceicao"
function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Código sem espaços e sem zeros à esquerda: "004233" e "4233" viram o mesmo
function normalizarCodigo(texto) {
  return normalizar(texto).replace(/\s/g, "").replace(/^0+(?=.)/, "");
}

// Cabeçalho da planilha -> chave interna: "Nome Completo" -> "nome_completo"
function chaveDe(cabecalho) {
  return normalizar(cabecalho).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Excel no Windows costuma salvar CSV em Windows-1252; aceitamos os dois
function decodificar(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/* =====================================================================
   LEITURA DO CSV
   Aceita ";" (padrão do Excel em português) ou ",", e campos entre aspas.
   ===================================================================== */
function lerCSV(texto) {
  texto = texto.replace(/^\uFEFF/, "");
  const primeira = texto.split(/\r?\n/, 1)[0];
  const sep = primeira.split(";").length >= primeira.split(",").length ? ";" : ",";

  const linhas = [];
  let linha = [];
  let valor = "";
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') { valor += '"'; i++; }
      else if (c === '"') { entreAspas = false; }
      else { valor += c; }
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === sep) {
      linha.push(valor); valor = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(valor); linhas.push(linha);
      linha = []; valor = "";
    } else {
      valor += c;
    }
  }
  if (valor !== "" || linha.length) { linha.push(valor); linhas.push(linha); }

  const cabecalho = (linhas.shift() || []).map(h => h.trim());
  const dados = linhas.filter(l => l.some(v => v.trim() !== ""));
  return { cabecalho, dados };
}

function carregarBase(texto, origem) {
  const { cabecalho, dados } = lerCSV(texto);
  colunas = cabecalho.map(h => {
    const chave = chaveDe(h);
    return { chave, rotulo: CONFIG.rotulos[chave] || h };
  });

  const faltando = [CONFIG.campoCodigo, CONFIG.campoNome]
    .filter(c => !colunas.some(col => col.chave === c));
  if (faltando.length) {
    colaboradores = [];
    mostrarStatus(`A planilha precisa das colunas: ${faltando.join(", ")}. Confira a primeira linha.`, true);
    return;
  }

  colaboradores = dados.map(valores => {
    const registro = {};
    colunas.forEach((col, i) => { registro[col.chave] = (valores[i] ?? "").trim(); });
    registro._codigo = normalizarCodigo(registro[CONFIG.campoCodigo]);
    registro._nome = normalizar(registro[CONFIG.campoNome]);
    return registro;
  });

  const total = colaboradores.length.toLocaleString("pt-BR");
  mostrarStatus(`${total} colaboradores carregados de ${origem}.`);
  if (campo.value) pesquisar(campo.value);
}

/* =====================================================================
   BUSCA
   1) Código do crachá exato  2) Nome completo exato  3) Nome contendo
   todas as palavras digitadas (em qualquer ordem)
   ===================================================================== */
function buscar(consulta) {
  const q = normalizar(consulta);
  if (!q) return { tipo: "vazio" };

  const porCodigo = colaboradores.find(c => c._codigo === normalizarCodigo(consulta));
  if (porCodigo) return { tipo: "um", item: porCodigo };

  if (q.replace(/\s/g, "").length < CONFIG.minimoLetrasNome) return { tipo: "curto" };

  const exatos = colaboradores.filter(c => c._nome === q);
  if (exatos.length === 1) return { tipo: "um", item: exatos[0] };

  const termos = q.split(" ");
  const achados = colaboradores.filter(c => termos.every(t => c._nome.includes(t)));
  if (achados.length === 1) return { tipo: "um", item: achados[0] };
  if (achados.length > 1) return { tipo: "varios", itens: achados };
  return { tipo: "nenhum" };
}

function pesquisar(consulta) {
  if (!colaboradores.length) return;
  const r = buscar(consulta);
  ultimaLista = null;

  if (r.tipo === "vazio") return limpar();
  if (r.tipo === "curto") return mensagem(`Digite ao menos ${CONFIG.minimoLetrasNome} letras do nome ou o código completo do crachá.`);
  if (r.tipo === "nenhum") return mensagem("Nenhum colaborador com esse código ou nome. Confira a grafia ou busque só pelo sobrenome.");
  if (r.tipo === "um") return mostrarCracha(r.item);
  ultimaLista = r.itens;
  mostrarLista(r.itens);
}

/* =====================================================================
   DESENHO NA TELA
   Usamos textContent (nunca innerHTML) para que nada escrito na
   planilha seja interpretado como código.
   ===================================================================== */
function el(tag, atributos = {}, filhos = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (k === "texto") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const f of [].concat(filhos)) if (f) n.append(f);
  return n;
}

function mostrarStatus(texto, erro = false) {
  statusEl.textContent = texto;
  statusEl.classList.toggle("erro", erro);
}

function limpar() { resultado.replaceChildren(); }

function mensagem(texto) {
  resultado.replaceChildren(el("p", { class: "mensagem", texto }));
}

function iniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] || "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function mostrarLista(itens) {
  const visiveis = itens.slice(0, CONFIG.maximoResultados);
  const titulo = itens.length > visiveis.length
    ? `${itens.length} colaboradores encontrados. Mostrando os ${visiveis.length} primeiros; digite mais do nome para refinar.`
    : `${itens.length} colaboradores encontrados. Escolha um:`;

  const lista = el("ul", { class: "lista" }, visiveis.map(p => {
    const detalhe = [`Crachá ${p[CONFIG.campoCodigo]}`, p.cargo, p.area].filter(Boolean).join(", ");
    const botao = el("button", { type: "button" }, [
      el("strong", { texto: p[CONFIG.campoNome] }),
      el("span", { texto: detalhe })
    ]);
    botao.addEventListener("click", () => mostrarCracha(p));
    return el("li", {}, botao);
  }));

  resultado.replaceChildren(el("p", { class: "mensagem", texto: titulo }), lista);
}

function mostrarCracha(p) {
  const nome = p[CONFIG.campoNome];

  const foto = el("div", { class: "cracha-foto", texto: iniciais(nome) });
  if (p[CONFIG.campoFoto]) {
    const img = el("img", { src: p[CONFIG.campoFoto], alt: `Foto de ${nome}` });
    img.addEventListener("error", () => img.remove()); // se o link falhar, ficam as iniciais
    foto.append(img);
  }

  const ignorar = [CONFIG.campoCodigo, CONFIG.campoNome, CONFIG.campoFoto];
  const dados = el("dl", { class: "cracha-dados" });
  colunas
    .filter(col => !ignorar.includes(col.chave) && p[col.chave])
    .forEach(col => dados.append(
      el("dt", { texto: col.rotulo }),
      el("dd", { texto: p[col.chave] })
    ));

  const cracha = el("article", { class: "cracha", "aria-label": `Dados de ${nome}` }, [
    el("div", { class: "cracha-lateral" }, foto),
    el("div", { class: "cracha-corpo" }, [
      el("h2", { class: "cracha-nome", texto: nome }),
      el("span", { class: "cracha-codigo", texto: p[CONFIG.campoCodigo] }),
      dados.childElementCount ? dados : null
    ])
  ]);

  const partes = [];
  if (ultimaLista) {
    const voltar = el("button", { type: "button", class: "voltar", texto: "Voltar aos resultados" });
    voltar.addEventListener("click", () => mostrarLista(ultimaLista));
    partes.push(voltar);
  }
  partes.push(cracha);
  resultado.replaceChildren(...partes);
}

/* =====================================================================
   EVENTOS
   ===================================================================== */
let espera;
campo.addEventListener("input", () => {
  clearTimeout(espera);
  espera = setTimeout(() => pesquisar(campo.value), 200); // espera a pessoa parar de digitar
});

form.addEventListener("submit", e => {
  e.preventDefault();
  clearTimeout(espera);
  pesquisar(campo.value);
});

campo.addEventListener("keydown", e => {
  if (e.key === "Escape") { campo.value = ""; limpar(); }
});

arquivo.addEventListener("change", async () => {
  const f = arquivo.files[0];
  if (!f) return;
  carregarBase(decodificar(await f.arrayBuffer()), f.name);
  campo.focus();
});

// Carga automática da planilha que está no repositório
fetch(CONFIG.arquivoPadrao, { cache: "no-store" })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
  .then(buf => carregarBase(decodificar(buf), CONFIG.arquivoPadrao.split("/").pop()))
  .catch(() => mostrarStatus("Nenhuma planilha encontrada no site. Use “Carregar outra planilha” no rodapé.", true));
