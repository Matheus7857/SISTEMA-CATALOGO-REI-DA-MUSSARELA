import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "AIzaSyCmWszDrWHTQ5PXK_dxnayhxMmvHfKzeBU",
  authDomain: "catalogoteste2.firebaseapp.com",
  projectId: "catalogoteste2",
  storageBucket: "catalogoteste2.firebasestorage.app",
  messagingSenderId: "1040593537973",
  appId: "1:1040593537973:web:714986bb161e996ab167fc"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

const secondaryApp  = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

/* ================= SUPABASE ================= */

const SUPABASE_URL    = "https://nzsatubgbwlqiykvcuuz.supabase.co";
const SUPABASE_KEY    = "sb_publishable_L-0vv2RuCRXOf2zEfWfklg_qHqUdfjT";
const SUPABASE_BUCKET = "produtos";

async function uploadImagemSupabase(arquivo, nomeArquivo) {
  // Remove imagem antiga se existir (ignora erro)
  await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${nomeArquivo}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${SUPABASE_KEY}`, "apikey": SUPABASE_KEY }
  }).catch(() => {});

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${nomeArquivo}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "apikey": SUPABASE_KEY,
      "Content-Type": arquivo.type,
      "x-upsert": "true"
    },
    body: arquivo
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("SUPABASE UPLOAD: " + err);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${nomeArquivo}`;
}

async function deletarImagemSupabase(url) {
  if (!url || !url.includes(SUPABASE_BUCKET)) return;
  const nomeArquivo = url.split(`/${SUPABASE_BUCKET}/`)[1];
  if (!nomeArquivo) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${nomeArquivo}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${SUPABASE_KEY}`, "apikey": SUPABASE_KEY }
  }).catch(() => {});
}


/* ================= SUPABASE DATABASE ================= */

async function supabaseFetch(tabela, opcoes = {}) {
  const {
    method = "GET",
    query = "",
    body = null,
    prefer = "return=minimal"
  } = opcoes;

  const url = `${SUPABASE_URL}/rest/v1/${tabela}${query}`;

  const res = await fetch(url, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": prefer
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    const textoErro = await res.text();
    throw new Error(`SUPABASE ${tabela}: ${textoErro}`);
  }

  if (res.status === 204) return null;

  const texto = await res.text();
  return texto ? JSON.parse(texto) : null;
}

async function limparTabelaSupabase(tabela, filtro = "id=not.is.null") {
  await supabaseFetch(tabela, {
    method: "DELETE",
    query: `?${filtro}`,
    prefer: "return=minimal"
  }).catch(erro => {
    console.warn(`Aviso ao limpar ${tabela}:`, erro.message || erro);
  });
}

async function inserirSupabase(tabela, dados, onConflict = "") {
  if (!dados || (Array.isArray(dados) && dados.length === 0)) return;

  const query = onConflict ? `?on_conflict=${onConflict}` : "";

  await supabaseFetch(tabela, {
    method: "POST",
    query,
    body: dados,
    prefer: "resolution=merge-duplicates,return=minimal"
  });
}

function numeroSeguro(valor, fallback = Date.now()) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : fallback + Math.floor(Math.random() * 99999);
}



let produtos          = [];
let categorias        = [];
let tabelasComerciais = [];

let empresa = {
  nome: "REI DA MUSSARELA",
  cnpj: "",
  telefone: "",
  logo: ""
};

let usuarioAtual        = null;
let dadosUsuarioAtual   = {
  nome: "",
  email: "",
  permissao: "vendedor",
  tabelaVinculada: ""
};

/* ================= TOAST ================= */

function toast(mensagem, tipo = "sucesso", duracao = 3500) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icone = tipo === "sucesso" ? "fa-check-circle"
    : tipo === "erro" ? "fa-circle-exclamation"
    : "fa-circle-info";

  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.innerHTML = `<i class="fa-solid ${icone}"></i><span>${mensagem}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = "toastSaida .3s forwards";
    setTimeout(() => el.remove(), 320);
  }, duracao);
}

/* ================= LOADING ================= */

function mostrarLoading(texto = "PROCESSANDO...") {
  const overlay = document.getElementById("loadingOverlay");
  const textoEl = document.getElementById("loadingTexto");
  if (!overlay) return;
  if (textoEl) textoEl.textContent = texto;
  overlay.classList.add("ativo");
}

function ocultarLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.remove("ativo");
}

/* ================= CONFIRMAÇÃO ================= */

function confirmar(mensagem) {
  return window.confirm(mensagem);
}

/* ================= HELPERS ================= */

function paraMaiusculo(texto) {
  return String(texto || "").trim().toUpperCase();
}

function isAdmin() {
  return dadosUsuarioAtual.permissao === "admin";
}

function tabelaUsuario() {
  return paraMaiusculo(dadosUsuarioAtual.tabelaVinculada);
}

function gerarCodigo() {
  return String(produtos.length + 1).padStart(6, "0");
}

function formatarTipo(tipo) {
  if (tipo === "representante_comfro") return "REPRESENTANTE COMFRO";
  if (tipo === "representante") return "REPRESENTANTE";
  if (tipo === "vendedor") return "VENDEDOR";
  if (tipo === "admin") return "ADMIN";
  return paraMaiusculo(tipo);
}

function formatarValor(valor) {
  const numero = String(valor || "0")
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (isNaN(numero)) return valor;

  return Number(numero).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function normalizarValorXLS(valor) {
  return String(valor || "")
    .replace("R$", "")
    .replace(/\s/g, "")
    .trim();
}

function imagemPadrao() {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1050" height="1050">
      <rect width="100%" height="100%" fill="#f0f2f8"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle"
        fill="#9ca3af" font-size="48" font-family="Arial" font-weight="bold">
        SEM IMAGEM
      </text>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        fill="#d1d5db" font-size="28" font-family="Arial">
        CLIQUE PARA ADICIONAR
      </text>
    </svg>
  `);
}

function fecharMenuMobileDepoisClique() {
  const menu = document.getElementById("menuLateral");
  if (menu && window.innerWidth <= 768) {
    menu.classList.remove("ativo");
  }
}

/* ================= MENU MOBILE ================= */

function toggleMenuMobile() {
  document.getElementById("menuLateral").classList.toggle("ativo");
}

// Fechar menu ao clicar fora
document.addEventListener("click", e => {
  const menu    = document.getElementById("menuLateral");
  const btnMenu = document.querySelector(".btn-mobile");
  if (
    menu &&
    menu.classList.contains("ativo") &&
    !menu.contains(e.target) &&
    btnMenu && !btnMenu.contains(e.target) &&
    window.innerWidth <= 768
  ) {
    menu.classList.remove("ativo");
  }
});

// Fechar modais com ESC
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  document.querySelectorAll(".modal.ativo").forEach(m => m.classList.remove("ativo"));
});

// Fechar modais ao clicar no backdrop
document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.remove("ativo");
  });
});

/* ================= LOGIN ================= */

async function fazerLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value.trim();
  const erro  = document.getElementById("loginErro");

  erro.textContent = "";

  if (!email || !senha) {
    erro.textContent = "DIGITE EMAIL E SENHA.";
    return;
  }

  const btnLogin = document.querySelector(".btn-login");
  if (btnLogin) {
    btnLogin.disabled = true;
    btnLogin.textContent = "ENTRANDO...";
  }

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch {
    erro.textContent = "EMAIL OU SENHA INVÁLIDOS.";
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket" style="margin-right:8px"></i>ENTRAR';
    }
  }
}

// Login com Enter
document.getElementById("loginSenha")?.addEventListener("keydown", e => {
  if (e.key === "Enter") fazerLogin();
});
document.getElementById("loginEmail")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginSenha")?.focus();
});

async function logoutSistema() {
  if (!confirmar("DESEJA SAIR DO SISTEMA?")) return;
  await signOut(auth);
}

onAuthStateChanged(auth, async user => {
  if (user) {
    mostrarLoading("CARREGANDO SISTEMA...");
    usuarioAtual = user;

    await carregarUsuario(user);
    await carregarFirebase();

    document.getElementById("telaLogin").classList.add("oculto");
    document.getElementById("sistema").classList.remove("oculto");

    aplicarPermissoes();
    renderizarCatalogo();
    ocultarLoading();
  } else {
    usuarioAtual = null;
    document.getElementById("telaLogin").classList.remove("oculto");
    document.getElementById("sistema").classList.add("oculto");
  }
});

async function carregarUsuario(user) {
  let dados = null;

  const snapUid = await getDoc(doc(db, "usuarios", user.uid));

  if (snapUid.exists()) {
    dados = snapUid.data();
  } else {
    const snapAdmin = await getDoc(doc(db, "usuarios", "admin"));
    if (snapAdmin.exists() && snapAdmin.data().email === user.email) {
      dados = snapAdmin.data();
    }
  }

  if (!dados) {
    dados = {
      nome: user.email,
      email: user.email,
      permissao: "vendedor",
      tabelaVinculada: ""
    };
  }

  dadosUsuarioAtual = {
    nome: paraMaiusculo(dados.nome || user.email),
    email: dados.email || user.email,
    permissao: dados.permissao || "vendedor",
    tabelaVinculada: paraMaiusculo(dados.tabelaVinculada || "")
  };

  document.getElementById("usuarioNome").textContent       = dadosUsuarioAtual.nome;
  document.getElementById("usuarioPermissao").textContent  = formatarTipo(dadosUsuarioAtual.permissao);
  document.getElementById("usuarioTabela").textContent     = dadosUsuarioAtual.tabelaVinculada || "SEM TABELA";
}

function aplicarPermissoes() {
  document.querySelectorAll(".admin-only").forEach(item => {
    item.style.display = isAdmin() ? "" : "none";
  });
}

/* ================= SUPABASE / BANCO PRINCIPAL ================= */

async function salvarFirebase() {
  // Mantive o nome salvarFirebase() para não precisar trocar todas as chamadas do sistema.
  // Agora essa função salva no Supabase e NÃO salva mais no documento gigante catalogo/dados.
  try {
    normalizarDados(false);

    const categoriasFormatadas = [...new Set(categorias.map(c => paraMaiusculo(c)).filter(Boolean))]
      .map(nome => ({ nome }));

    const tabelasFormatadas = tabelasComerciais.map(tabela => ({
      id: numeroSeguro(tabela.id),
      nome: paraMaiusculo(tabela.nome),
      tipo: tabela.tipo || "vendedor"
    })).filter(t => t.nome);

    const produtosFormatados = produtos.map(produto => {
      const produtoId = numeroSeguro(produto.id);
      produto.id = produtoId;

      return {
        id: produtoId,
        codigo: produto.codigo || "",
        nome: paraMaiusculo(produto.nome || "SEM NOME"),
        categoria: paraMaiusculo(produto.categoria || "SEM CATEGORIA"),
        descricao: paraMaiusculo(produto.descricao || ""),
        imagem_url: produto.imagem || produto.imagem_url || "",
        ativo: produto.ativo !== false,
        criado_em: produto.criadoEm || "",
        atualizado_em: new Date().toISOString()
      };
    });

    const produtoTabelasFormatadas = [];

    produtos.forEach(produto => {
      const produtoId = numeroSeguro(produto.id);
      const tabelas = Array.isArray(produto.tabelas) ? produto.tabelas : [];

      tabelas.forEach(tabela => {
        produtoTabelasFormatadas.push({
          produto_id: produtoId,
          nome_tabela: paraMaiusculo(tabela.nomeTabela || "TABELA PADRÃO"),
          tipo_tabela: tabela.tipoTabela || "vendedor",
          descricao_tabela: paraMaiusculo(tabela.descricaoTabela || ""),
          comissao: String(tabela.comissao || "0"),
          valor: String(tabela.valor || "0,00")
        });
      });
    });

    await limparTabelaSupabase("produto_tabelas");
    await limparTabelaSupabase("produtos");
    await limparTabelaSupabase("categorias");
    await limparTabelaSupabase("tabelas_comerciais");

    await inserirSupabase("empresa", {
      id: 1,
      nome: empresa.nome || "REI DA MUSSARELA",
      cnpj: empresa.cnpj || "",
      telefone: empresa.telefone || "",
      logo: empresa.logo || ""
    }, "id");

    await inserirSupabase("categorias", categoriasFormatadas, "nome");
    await inserirSupabase("tabelas_comerciais", tabelasFormatadas, "id");
    await inserirSupabase("produtos", produtosFormatados, "id");
    await inserirSupabase("produto_tabelas", produtoTabelasFormatadas);
  } catch (erro) {
    ocultarLoading();
    console.error("[Supabase] Erro ao salvar:", erro);
    toast("ERRO AO SALVAR NO SUPABASE: " + (erro.message || erro), "erro");
    throw erro;
  }
}

async function carregarFirebase() {
  // Mantive o nome carregarFirebase() para não quebrar o restante do sistema.
  // Agora os dados principais vêm do Supabase.
  try {
    const empresaBanco = await supabaseFetch("empresa", {
      query: "?id=eq.1&select=*",
      prefer: "return=representation"
    });

    const categoriasBanco = await supabaseFetch("categorias", {
      query: "?select=*&order=nome.asc",
      prefer: "return=representation"
    });

    const tabelasBanco = await supabaseFetch("tabelas_comerciais", {
      query: "?select=*&order=nome.asc",
      prefer: "return=representation"
    });

    const produtosBanco = await supabaseFetch("produtos", {
      query: "?select=*&order=nome.asc",
      prefer: "return=representation"
    });

    const produtoTabelasBanco = await supabaseFetch("produto_tabelas", {
      query: "?select=*",
      prefer: "return=representation"
    });

    empresa = empresaBanco && empresaBanco[0] ? {
      nome: empresaBanco[0].nome || "REI DA MUSSARELA",
      cnpj: empresaBanco[0].cnpj || "",
      telefone: empresaBanco[0].telefone || "",
      logo: empresaBanco[0].logo || ""
    } : empresa;

    categorias = Array.isArray(categoriasBanco) && categoriasBanco.length > 0
      ? categoriasBanco.map(c => paraMaiusculo(c.nome))
      : ["LATICÍNIOS", "CONGELADOS", "EMBUTIDOS", "BEBIDAS"];

    tabelasComerciais = Array.isArray(tabelasBanco) ? tabelasBanco.map(t => ({
      id: t.id,
      nome: paraMaiusculo(t.nome),
      tipo: t.tipo || "vendedor"
    })) : [];

    const tabelasPorProduto = {};

    (produtoTabelasBanco || []).forEach(tabela => {
      const produtoId = String(tabela.produto_id);
      if (!tabelasPorProduto[produtoId]) tabelasPorProduto[produtoId] = [];

      tabelasPorProduto[produtoId].push({
        nomeTabela: paraMaiusculo(tabela.nome_tabela || "TABELA PADRÃO"),
        tipoTabela: tabela.tipo_tabela || "vendedor",
        descricaoTabela: paraMaiusculo(tabela.descricao_tabela || ""),
        comissao: tabela.comissao || "0",
        valor: tabela.valor || "0,00"
      });
    });

    produtos = Array.isArray(produtosBanco) ? produtosBanco.map(produto => ({
      id: produto.id,
      codigo: produto.codigo || "",
      nome: paraMaiusculo(produto.nome || "SEM NOME"),
      categoria: paraMaiusculo(produto.categoria || "SEM CATEGORIA"),
      descricao: paraMaiusculo(produto.descricao || ""),
      imagem: produto.imagem_url || "",
      ativo: produto.ativo !== false,
      criadoEm: produto.criado_em || "",
      atualizadoEm: produto.atualizado_em || "",
      tabelas: tabelasPorProduto[String(produto.id)] || []
    })) : [];

    normalizarDados(false);
    atualizarEmpresaTela();
    atualizarSelectCategorias();
    atualizarDashboard();
  } catch (erro) {
    console.error("[Supabase] Erro ao carregar:", erro);
    toast("ERRO AO CARREGAR DO SUPABASE: " + (erro.message || erro), "erro");

    produtos = [];
    categorias = ["LATICÍNIOS", "CONGELADOS", "EMBUTIDOS", "BEBIDAS"];
    tabelasComerciais = [];

    atualizarEmpresaTela();
    atualizarSelectCategorias();
    atualizarDashboard();
  }
}

function normalizarDados(salvar = true) {
  categorias = [...new Set(categorias.map(c => paraMaiusculo(c)))].sort();

  tabelasComerciais = tabelasComerciais.map(tabela => ({
    id:   tabela.id   || Date.now() + Math.floor(Math.random() * 9999),
    nome: paraMaiusculo(tabela.nome),
    tipo: tabela.tipo || "vendedor"
  }));

  produtos = produtos.map(produto => {
    produto.id       = produto.id       || Date.now() + Math.floor(Math.random() * 9999);
    produto.codigo   = produto.codigo   || gerarCodigo();
    produto.nome     = paraMaiusculo(produto.nome);
    produto.categoria = paraMaiusculo(produto.categoria || "SEM CATEGORIA");
    produto.descricao = paraMaiusculo(produto.descricao || "");
    produto.ativo    = produto.ativo !== false;
    produto.imagem   = produto.imagem || "";

    if (!produto.tabelas && produto.precos) {
      produto.tabelas = produto.precos.map(preco => ({
        nomeTabela:      paraMaiusculo(preco.nomeTabela || "TABELA PADRÃO"),
        tipoTabela:      preco.tipoTabela || "vendedor",
        descricaoTabela: paraMaiusculo(preco.descricaoTabela || `COMISSÃO ${preco.comissao || "0"}%`),
        comissao:        preco.comissao || "0",
        valor:           preco.valor    || "0,00"
      }));
    }

    produto.tabelas = Array.isArray(produto.tabelas) ? produto.tabelas : [];
    produto.tabelas = produto.tabelas.map(tabela => ({
      nomeTabela:      paraMaiusculo(tabela.nomeTabela || "TABELA PADRÃO"),
      tipoTabela:      tabela.tipoTabela || "vendedor",
      descricaoTabela: paraMaiusculo(tabela.descricaoTabela || `COMISSÃO ${tabela.comissao || "0"}%`),
      comissao:        tabela.comissao || "0",
      valor:           tabela.valor    || "0,00"
    }));

    if (!categorias.includes(produto.categoria)) {
      categorias.push(produto.categoria);
    }

    return produto;
  });

  categorias = [...new Set(categorias)].sort();

  if (salvar) salvarFirebase();
}

/* ================= HORA ================= */

function atualizarHora() {
  const agora = new Date();
  const dataEl = document.getElementById("dataAtual");
  const horaEl = document.getElementById("horaAtual");
  if (dataEl) dataEl.textContent = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  if (horaEl) horaEl.textContent = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

setInterval(atualizarHora, 1000);
atualizarHora();

/* ================= EMPRESA ================= */

function atualizarEmpresaTela() {
  const nomeEl = document.getElementById("empresaNomeTopo");
  if (nomeEl) nomeEl.textContent = paraMaiusculo(empresa.nome || "REI DA MUSSARELA");

  const logo = document.getElementById("empresaLogoTopo");
  if (!logo) return;

  if (empresa.logo) {
    logo.src = empresa.logo;
    logo.style.display = "block";
  } else {
    logo.style.display = "none";
  }
}

function abrirModalEmpresa() {
  if (!isAdmin()) return;
  document.getElementById("empresaNome").value    = empresa.nome     || "";
  document.getElementById("empresaCnpj").value    = empresa.cnpj     || "";
  document.getElementById("empresaTelefone").value = empresa.telefone || "";
  document.getElementById("modalEmpresa").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalEmpresa() {
  document.getElementById("modalEmpresa").classList.remove("ativo");
}

async function salvarEmpresa() {
  if (!isAdmin()) return;

  empresa.nome      = paraMaiusculo(document.getElementById("empresaNome").value || "REI DA MUSSARELA");
  empresa.cnpj      = paraMaiusculo(document.getElementById("empresaCnpj").value);
  empresa.telefone  = paraMaiusculo(document.getElementById("empresaTelefone").value);

  const arquivoLogo = document.getElementById("empresaLogo").files[0];

  mostrarLoading("SALVANDO EMPRESA...");

  try {
    if (arquivoLogo) {
      const ext = arquivoLogo.name.split(".").pop();
      empresa.logo = await uploadImagemSupabase(arquivoLogo, `logo-empresa.${ext}`);
    }
    await salvarFirebase();
    ocultarLoading();
    atualizarEmpresaTela();
    fecharModalEmpresa();
    toast("EMPRESA ATUALIZADA COM SUCESSO.");
  } catch (erro) {
    ocultarLoading();
    toast("ERRO AO SALVAR EMPRESA: " + (erro.message || erro), "erro");
  }
}

/* ================= CATEGORIAS ================= */

function abrirModalCategoria() {
  if (!isAdmin()) return;
  limparFormularioCategoria();
  renderizarCategorias();
  document.getElementById("modalCategoria").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalCategoria() {
  document.getElementById("modalCategoria").classList.remove("ativo");
}

function limparFormularioCategoria() {
  const editando = document.getElementById("categoriaEditandoNome");
  if (editando) editando.value = "";
  document.getElementById("novaCategoria").value = "";
}

async function salvarCategoria() {
  if (!isAdmin()) return;

  const campoEditando = document.getElementById("categoriaEditandoNome");
  const nomeAntigo    = campoEditando ? paraMaiusculo(campoEditando.value) : "";
  const nome          = paraMaiusculo(document.getElementById("novaCategoria").value);

  if (!nome) { toast("DIGITE O NOME DA CATEGORIA.", "erro"); return; }

  const existe = categorias.some(c => c === nome && c !== nomeAntigo);
  if (existe) { toast("ESSA CATEGORIA JÁ EXISTE.", "erro"); return; }

  if (nomeAntigo) {
    categorias = categorias.map(c => c === nomeAntigo ? nome : c);
    produtos   = produtos.map(p => {
      if (p.categoria === nomeAntigo) p.categoria = nome;
      return p;
    });
  } else {
    categorias.push(nome);
  }

  categorias = [...new Set(categorias.map(c => paraMaiusculo(c)))].sort();

  limparFormularioCategoria();

  mostrarLoading("SALVANDO...");
  await salvarFirebase();
  ocultarLoading();

  renderizarCategorias();
  atualizarSelectCategorias();
  renderizarCatalogo();

  toast(nomeAntigo ? "CATEGORIA ATUALIZADA." : "CATEGORIA SALVA.");
}

function editarCategoria(nome) {
  if (!isAdmin()) return;
  const campoEditando = document.getElementById("categoriaEditandoNome");
  if (campoEditando) campoEditando.value = nome;
  document.getElementById("novaCategoria").value = nome;
  document.getElementById("novaCategoria").focus();
}

async function excluirCategoria(nome) {
  if (!isAdmin()) return;

  const emUso = produtos.some(p => p.categoria === nome);
  if (emUso) {
    toast("NÃO É POSSÍVEL EXCLUIR. EXISTEM PRODUTOS NESSA CATEGORIA.", "erro");
    return;
  }

  if (!confirmar(`DESEJA EXCLUIR A CATEGORIA "${nome}"?`)) return;

  categorias = categorias.filter(c => c !== nome);

  mostrarLoading("EXCLUINDO...");
  await salvarFirebase();
  ocultarLoading();

  renderizarCategorias();
  atualizarSelectCategorias();
  renderizarCatalogo();

  toast("CATEGORIA EXCLUÍDA.");
}

function renderizarCategorias() {
  const lista = document.getElementById("listaCategorias");

  if (categorias.length === 0) {
    lista.innerHTML = `<div class="vazio"><i class="fa-solid fa-layer-group"></i>NENHUMA CATEGORIA CADASTRADA.</div>`;
    return;
  }

  lista.innerHTML = categorias.map(categoria => `
    <div class="categoria-item">
      <strong>${categoria}</strong>
      <div class="usuario-acoes">
        <button class="btn-editar-user" onclick="editarCategoria('${categoria.replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-pen" style="margin-right:5px"></i>EDITAR
        </button>
        <button class="btn-excluir-user" onclick="excluirCategoria('${categoria.replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-trash" style="margin-right:5px"></i>EXCLUIR
        </button>
      </div>
    </div>
  `).join("");
}

function atualizarSelectCategorias() {
  const select = document.getElementById("produtoCategoria");
  const filtro = document.getElementById("filtroCategoria");

  if (!select || !filtro) return;

  const valorProduto = select.value;
  const valorFiltro  = filtro.value;

  select.innerHTML = `<option value="">SELECIONE</option>`;
  filtro.innerHTML = `<option value="todos">TODAS CATEGORIAS</option>`;

  categorias.forEach(categoria => {
    select.innerHTML += `<option value="${categoria}">${categoria}</option>`;
    filtro.innerHTML  += `<option value="${categoria}">${categoria}</option>`;
  });

  if (categorias.includes(valorProduto)) select.value = valorProduto;
  if (categorias.includes(valorFiltro))  filtro.value = valorFiltro;
}

/* ================= TABELAS ================= */

function abrirModalTabelas() {
  if (!isAdmin()) return;
  limparFormularioTabela();
  renderizarTabelasComerciais();
  document.getElementById("modalTabelas").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalTabelas() {
  document.getElementById("modalTabelas").classList.remove("ativo");
}

function limparFormularioTabela() {
  document.getElementById("tabelaEditandoId").value   = "";
  document.getElementById("tabelaNomeAntigo").value   = "";
  document.getElementById("novaTabelaNome").value     = "";
  document.getElementById("novaTabelaTipo").value     = "vendedor";
}

async function salvarTabelaComercial() {
  if (!isAdmin()) return;

  const idEditando = document.getElementById("tabelaEditandoId").value;
  const nomeAntigo = document.getElementById("tabelaNomeAntigo").value;
  const nome       = paraMaiusculo(document.getElementById("novaTabelaNome").value);
  const tipo       = document.getElementById("novaTabelaTipo").value;

  if (!nome) { toast("DIGITE O NOME DA TABELA.", "erro"); return; }

  const existe = tabelasComerciais.some(t => t.nome === nome && String(t.id) !== String(idEditando));
  if (existe) { toast("ESSA TABELA JÁ EXISTE.", "erro"); return; }

  if (idEditando) {
    tabelasComerciais = tabelasComerciais.map(t => {
      if (String(t.id) === String(idEditando)) return { ...t, nome, tipo };
      return t;
    });

    produtos = produtos.map(p => {
      p.tabelas = (p.tabelas || []).map(t => {
        if (paraMaiusculo(t.nomeTabela) === paraMaiusculo(nomeAntigo)) {
          return { ...t, nomeTabela: nome, tipoTabela: tipo };
        }
        return t;
      });
      return p;
    });

    await atualizarUsuariosComTabela(nomeAntigo, nome);
  } else {
    tabelasComerciais.push({ id: Date.now(), nome, tipo });
  }

  mostrarLoading("SALVANDO TABELA...");
  await salvarFirebase();
  ocultarLoading();

  limparFormularioTabela();
  renderizarTabelasComerciais();
  renderizarCatalogo();

  toast("TABELA SALVA COM SUCESSO.");
}

function editarTabelaComercial(id) {
  const tabela = tabelasComerciais.find(t => String(t.id) === String(id));
  if (!tabela) return;

  document.getElementById("tabelaEditandoId").value = tabela.id;
  document.getElementById("tabelaNomeAntigo").value = tabela.nome;
  document.getElementById("novaTabelaNome").value   = tabela.nome;
  document.getElementById("novaTabelaTipo").value   = tabela.tipo || "vendedor";
  document.getElementById("novaTabelaNome").focus();
}

async function excluirTabelaComercial(id) {
  if (!isAdmin()) return;

  const tabela = tabelasComerciais.find(t => String(t.id) === String(id));
  if (!tabela) return;

  const emUso = produtos.some(p =>
    (p.tabelas || []).some(t => paraMaiusculo(t.nomeTabela) === paraMaiusculo(tabela.nome))
  );

  if (emUso) {
    toast("TABELA EM USO EM PRODUTOS. REMOVA DOS PRODUTOS PRIMEIRO.", "erro");
    return;
  }

  if (!confirmar("DESEJA EXCLUIR ESSA TABELA?")) return;

  tabelasComerciais = tabelasComerciais.filter(t => String(t.id) !== String(id));

  mostrarLoading("EXCLUINDO...");
  await salvarFirebase();
  ocultarLoading();

  renderizarTabelasComerciais();
  toast("TABELA EXCLUÍDA.");
}

function renderizarTabelasComerciais() {
  const lista = document.getElementById("listaTabelasComerciais");

  if (tabelasComerciais.length === 0) {
    lista.innerHTML = `<div class="vazio"><i class="fa-solid fa-table"></i>NENHUMA TABELA CADASTRADA.</div>`;
    return;
  }

  lista.innerHTML = tabelasComerciais.map(tabela => `
    <div class="usuario-item">
      <div>
        <strong>${tabela.nome}</strong>
        <small>${formatarTipo(tabela.tipo)}</small>
      </div>
      <div class="usuario-acoes">
        <button class="btn-editar-user" onclick="editarTabelaComercial(${tabela.id})">
          <i class="fa-solid fa-pen" style="margin-right:5px"></i>EDITAR
        </button>
        <button class="btn-excluir-user" onclick="excluirTabelaComercial(${tabela.id})">
          <i class="fa-solid fa-trash" style="margin-right:5px"></i>EXCLUIR
        </button>
      </div>
    </div>
  `).join("");
}

async function atualizarUsuariosComTabela(nomeAntigo, nomeNovo) {
  const snap = await getDocs(collection(db, "usuarios"));
  for (const item of snap.docs) {
    const usuario = item.data();
    if (paraMaiusculo(usuario.tabelaVinculada) === paraMaiusculo(nomeAntigo)) {
      await setDoc(doc(db, "usuarios", item.id), { tabelaVinculada: nomeNovo }, { merge: true });
    }
  }
}

/* ================= PRODUTOS ================= */

function abrirModalProduto(id = null) {
  if (!isAdmin()) return;

  limparFormularioProduto();
  atualizarSelectCategorias();

  if (id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    document.getElementById("produtoId").value        = produto.id;
    document.getElementById("produtoCodigo").value    = produto.codigo;
    document.getElementById("produtoNome").value      = produto.nome;
    document.getElementById("produtoCategoria").value = produto.categoria;
    document.getElementById("produtoAtivo").value     = produto.ativo ? "true" : "false";
    document.getElementById("produtoDescricao").value = produto.descricao || "";

    const preview = document.getElementById("produtoImagemPreview");
    if (preview && produto.imagem) {
      preview.src = produto.imagem;
      preview.style.display = "block";
    }

    produto.tabelas.forEach(tabela =>
      adicionarTabela(tabela.nomeTabela, tabela.tipoTabela, tabela.descricaoTabela, tabela.comissao, tabela.valor)
    );
  } else {
    document.getElementById("produtoCodigo").value = gerarCodigo();
    document.getElementById("produtoAtivo").value  = "true";
    adicionarTabela("TABELA PADRÃO", "vendedor", "COMISSÃO 0,5%", "0.5", "");
  }

  document.getElementById("modalProduto").classList.add("ativo");
  fecharMenuMobileDepoisClique();
  setTimeout(() => document.getElementById("produtoNome")?.focus(), 150);
}

function fecharModalProduto() {
  document.getElementById("modalProduto").classList.remove("ativo");
}

function limparFormularioProduto() {
  document.getElementById("produtoId").value        = "";
  document.getElementById("produtoCodigo").value    = gerarCodigo();
  document.getElementById("produtoNome").value      = "";
  document.getElementById("produtoCategoria").value = "";
  document.getElementById("produtoAtivo").value     = "true";
  document.getElementById("produtoDescricao").value = "";
  document.getElementById("produtoImagem").value    = "";
  const preview = document.getElementById("produtoImagemPreview");
  if (preview) { preview.src = ""; preview.style.display = "none"; }
  document.getElementById("listaTabelas").innerHTML = "";
}

function previsualizarImagem(input) {
  const preview = document.getElementById("produtoImagemPreview");
  if (!preview) return;

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function adicionarTabela(
  nomeTabela     = "",
  tipoTabela     = "vendedor",
  descricaoTabela = "",
  comissao       = "0.5",
  valor          = ""
) {
  const lista = document.getElementById("listaTabelas");
  const linha = document.createElement("div");
  linha.className = "linha-tabela item-tabela";

  const opcoesTabelas = tabelasComerciais.length > 0
    ? tabelasComerciais.map(t => `
        <option value="${t.nome}" ${paraMaiusculo(nomeTabela) === t.nome ? "selected" : ""}>
          ${t.nome}
        </option>
      `).join("")
    : `<option value="${paraMaiusculo(nomeTabela || "TABELA PADRÃO")}">${paraMaiusculo(nomeTabela || "TABELA PADRÃO")}</option>`;

  linha.innerHTML = `
    <select class="tabela-nome">${opcoesTabelas}</select>
    <select class="tabela-tipo">
      <option value="vendedor"           ${tipoTabela === "vendedor"           ? "selected" : ""}>VENDEDOR</option>
      <option value="representante"      ${tipoTabela === "representante"      ? "selected" : ""}>REPRESENTANTE</option>
      <option value="representante_comfro" ${tipoTabela === "representante_comfro" ? "selected" : ""}>REP. COMFRO</option>
    </select>
    <input class="tabela-descricao" placeholder="EX: COMISSÃO 0,5%" value="${paraMaiusculo(descricaoTabela)}">
    <input class="tabela-comissao" placeholder="0.5" value="${comissao}">
    <input class="tabela-valor" placeholder="39,49" value="${valor}">
    <button class="btn-remover-tabela" onclick="removerTabela(this)" type="button"><i class="fa-solid fa-trash"></i></button>
  `;

  lista.appendChild(linha);
}

function removerTabela(botao) {
  botao.parentElement.remove();
  if (document.querySelectorAll(".item-tabela").length === 0) {
    adicionarTabela("TABELA PADRÃO", "vendedor", "COMISSÃO 0,5%", "0.5", "");
  }
}

function capturarTabelas() {
  const linhas  = document.querySelectorAll(".item-tabela");
  const tabelas = [];

  linhas.forEach(linha => {
    const nomeTabela      = paraMaiusculo(linha.querySelector(".tabela-nome").value);
    const tipoTabela      = linha.querySelector(".tabela-tipo").value;
    const descricaoTabela = paraMaiusculo(linha.querySelector(".tabela-descricao").value);
    const comissao        = linha.querySelector(".tabela-comissao").value.trim();
    const valor           = linha.querySelector(".tabela-valor").value.trim();

    if (nomeTabela && valor) {
      tabelas.push({ nomeTabela, tipoTabela, descricaoTabela, comissao, valor });
    }
  });

  return tabelas;
}

async function salvarProduto() {
  if (!isAdmin()) return;

  const id        = document.getElementById("produtoId").value;
  const codigo    = document.getElementById("produtoCodigo").value;
  const nome      = paraMaiusculo(document.getElementById("produtoNome").value);
  const categoria = paraMaiusculo(document.getElementById("produtoCategoria").value);
  const ativo     = document.getElementById("produtoAtivo").value === "true";
  const descricao = paraMaiusculo(document.getElementById("produtoDescricao").value);
  const tabelas   = capturarTabelas();

  if (!nome || !categoria) { toast("PREENCHA NOME E CATEGORIA.", "erro"); return; }
  if (tabelas.length === 0) { toast("ADICIONE PELO MENOS UMA TABELA COM PREÇO.", "erro"); return; }

  mostrarLoading("SALVANDO PRODUTO...");

  try {
    const arquivoImagem = document.getElementById("produtoImagem").files[0];
    const produtoAtual  = produtos.find(p => String(p.id) === String(id));
    let imagem          = produtoAtual ? produtoAtual.imagem : "";

    if (arquivoImagem) {
      const ext          = arquivoImagem.name.split(".").pop();
      const nomeArquivo  = `produto-${id || Date.now()}.${ext}`;
      imagem = await uploadImagemSupabase(arquivoImagem, nomeArquivo);
    }

    await salvarProdutoFinal(id, codigo, nome, categoria, ativo, descricao, tabelas, imagem);
  } catch (erro) {
    ocultarLoading();
    toast("ERRO AO SALVAR IMAGEM: " + (erro.message || erro), "erro");
  }
}

async function salvarProdutoFinal(id, codigo, nome, categoria, ativo, descricao, tabelas, imagem) {
  if (id) {
    produtos = produtos.map(p => {
      if (String(p.id) === String(id)) {
        return { ...p, codigo, nome, categoria, ativo, descricao, tabelas, imagem, atualizadoEm: new Date().toISOString() };
      }
      return p;
    });
  } else {
    produtos.push({
      id:           Date.now(),
      codigo,
      nome,
      categoria,
      ativo,
      descricao,
      tabelas,
      imagem,
      criadoEm:     new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });
  }

  await salvarFirebase();
  ocultarLoading();
  fecharModalProduto();
  renderizarCatalogo();
  toast(id ? "PRODUTO ATUALIZADO COM SUCESSO." : "PRODUTO CRIADO COM SUCESSO.");
}

async function duplicarProduto(id) {
  if (!isAdmin()) return;
  if (!confirmar("DESEJA DUPLICAR ESTE PRODUTO?")) return;

  const produto = produtos.find(p => String(p.id) === String(id));
  if (!produto) { toast("PRODUTO NÃO ENCONTRADO.", "erro"); return; }

  const novoProduto = {
    ...JSON.parse(JSON.stringify(produto)),
    id:           Date.now(),
    codigo:       gerarCodigo(),
    nome:         produto.nome + " (CÓPIA)",
    criadoEm:     new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  produtos.push(novoProduto);

  mostrarLoading("DUPLICANDO...");
  await salvarFirebase();
  ocultarLoading();
  renderizarCatalogo();
  toast("PRODUTO DUPLICADO COM SUCESSO.");
}

async function excluirProduto(id) {
  if (!isAdmin()) return;
  if (!confirmar("DESEJA EXCLUIR ESTE PRODUTO? ESSA AÇÃO NÃO PODE SER DESFEITA.")) return;

  const produto = produtos.find(p => String(p.id) === String(id));
  produtos = produtos.filter(p => String(p.id) !== String(id));

  mostrarLoading("EXCLUINDO...");
  await salvarFirebase();
  if (produto?.imagem) await deletarImagemSupabase(produto.imagem);
  ocultarLoading();
  renderizarCatalogo();
  toast("PRODUTO EXCLUÍDO.", "info");
}

async function alternarStatusProduto(id) {
  if (!isAdmin()) return;

  produtos = produtos.map(p => {
    if (p.id === id) return { ...p, ativo: !p.ativo, atualizadoEm: new Date().toISOString() };
    return p;
  });

  mostrarLoading("ATUALIZANDO...");
  await salvarFirebase();
  ocultarLoading();
  renderizarCatalogo();

  const produto = produtos.find(p => p.id === id);
  toast(produto?.ativo ? "PRODUTO ATIVADO." : "PRODUTO DESATIVADO.", "info");
}

/* ================= CATÁLOGO ================= */

function filtrarTabelasDoUsuario(produto) {
  if (isAdmin()) return produto.tabelas || [];

  const tabelaPermitida = tabelaUsuario();
  if (!tabelaPermitida) return [];

  return (produto.tabelas || []).filter(t =>
    paraMaiusculo(t.nomeTabela) === tabelaPermitida
  );
}

function renderizarCatalogo() {
  normalizarDados(false);
  atualizarSelectCategorias();
  atualizarDashboard();

  const tela          = document.getElementById("catalogoProdutos");
  const pesquisa      = paraMaiusculo(document.getElementById("pesquisaProduto")?.value || "");
  const categoriaFiltro = document.getElementById("filtroCategoria")?.value || "todos";

  let lista = produtos;

  if (!isAdmin()) {
    lista = lista.filter(p => p.ativo);
  }

  if (pesquisa) {
    lista = lista.filter(p =>
      p.nome.includes(pesquisa) ||
      p.categoria.includes(pesquisa) ||
      (p.codigo || "").includes(pesquisa) ||
      (p.descricao || "").includes(pesquisa)
    );
  }

  if (categoriaFiltro !== "todos") {
    lista = lista.filter(p => p.categoria === categoriaFiltro);
  }

  lista = lista.filter(p => filtrarTabelasDoUsuario(p).length > 0);

  if (lista.length === 0) {
    tela.innerHTML = `
      <div class="vazio">
        <i class="fa-solid fa-magnifying-glass"></i>
        NENHUM PRODUTO ENCONTRADO.
      </div>`;
    return;
  }

  // Agrupar por categoria
  const grupos = lista.reduce((acc, produto) => {
    const cat = produto.categoria || "SEM CATEGORIA";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(produto);
    return acc;
  }, {});

  const renderCard = produto => `
    <div class="card-produto ${produto.ativo ? "" : "inativo"}">
      <div class="card-produto-img-wrap" onclick="abrirPopupProduto(${produto.id})" title="VER VALORES">
        <img src="${produto.imagem || imagemPadrao()}" alt="${produto.nome}" loading="lazy">
        <div class="img-overlay"><i class="fa-solid fa-eye"></i></div>
      </div>

      <div class="info-produto">
        <div class="info-produto-topo">
          <span class="categoria-produto">${produto.categoria}</span>
          ${isAdmin() ? `
            <span class="status-produto ${produto.ativo ? "status-ativo" : "status-inativo"}">
              ${produto.ativo ? "ATIVO" : "INATIVO"}
            </span>
          ` : ""}
        </div>

        ${produto.codigo ? `<span class="codigo-badge"># ${produto.codigo}</span>` : ""}

        <h3>${produto.nome}</h3>
        <p>${produto.descricao || "SEM DESCRIÇÃO"}</p>

        <div class="aviso-valores" onclick="abrirPopupProduto(${produto.id})">
          <i class="fa-solid fa-tag" style="margin-right:6px"></i>
          VER VALORES
        </div>
      </div>

      ${isAdmin() ? `
        <div class="acoes-produto">
          <button class="btn-editar"   onclick="event.stopPropagation(); abrirModalProduto(${produto.id})">EDITAR</button>
          <button class="btn-duplicar" onclick="event.stopPropagation(); duplicarProduto(${produto.id})">DUPLICAR</button>
          <button class="btn-status"
            onclick="event.stopPropagation(); alternarStatusProduto(${produto.id})">
            ${produto.ativo ? "DESATIVAR" : "ATIVAR"}
          </button>
          <button class="btn-excluir"  onclick="event.stopPropagation(); excluirProduto(${produto.id})">EXCLUIR</button>
        </div>
      ` : ""}
    </div>
  `;

  tela.innerHTML = Object.keys(grupos).sort().map(categoria => `
    <div class="categoria-secao">
      <div class="categoria-secao-titulo">
        <span>${categoria}</span>
        <small>${grupos[categoria].length} PRODUTO${grupos[categoria].length !== 1 ? "S" : ""}</small>
      </div>
      <div class="catalogo-grid-inner">
        ${grupos[categoria].map(renderCard).join("")}
      </div>
    </div>
  `).join("");
}

function atualizarDashboard() {
  const produtosVisiveis = isAdmin()
    ? produtos
    : produtos.filter(p => p.ativo && filtrarTabelasDoUsuario(p).length > 0);

  const ativos       = produtosVisiveis.filter(p => p.ativo).length;
  const totalTabelas = produtosVisiveis.reduce((total, p) => total + filtrarTabelasDoUsuario(p).length, 0);

  animarContador("totalProdutos", produtosVisiveis.length);
  animarContador("totalAtivos",   ativos);
  animarContador("totalTabelas",  totalTabelas);
}

function animarContador(id, valorFinal) {
  const el = document.getElementById(id);
  if (!el) return;

  const valorAtual = parseInt(el.textContent) || 0;
  if (valorAtual === valorFinal) return;

  const duracao = 500;
  const inicio  = performance.now();

  const animar = (agora) => {
    const progresso = Math.min((agora - inicio) / duracao, 1);
    const easing    = 1 - Math.pow(1 - progresso, 3);
    el.textContent  = Math.round(valorAtual + (valorFinal - valorAtual) * easing);
    if (progresso < 1) requestAnimationFrame(animar);
  };

  requestAnimationFrame(animar);
}

/* ================= POPUP PRODUTO ================= */

function abrirPopupProduto(id) {
  const produto = produtos.find(p => p.id === id);
  if (!produto) return;

  const precos = filtrarTabelasDoUsuario(produto);

  if (!isAdmin() && precos.length === 0) {
    toast("VOCÊ NÃO TEM PERMISSÃO PARA VER ESTA TABELA.", "erro");
    return;
  }

  document.getElementById("popupProdutoTitulo").textContent  = produto.nome;
  document.getElementById("popupProdutoImagem").src          = produto.imagem || imagemPadrao();
  document.getElementById("popupProdutoDescricao").textContent = produto.descricao || "SEM DESCRIÇÃO";

  document.getElementById("popupProdutoPrecos").innerHTML = precos.length > 0
    ? precos.map(tabela => `
        <div class="popup-preco-linha">
          <div class="popup-preco-info">
            <strong>${tabela.descricaoTabela || tabela.nomeTabela || 'TABELA'}</strong>
            <small class="popup-comissao-badge">COMISSÃO: ${tabela.comissao || '0'}%</small>
          </div>
          <span>R$ ${formatarValor(tabela.valor)}</span>
        </div>
      `).join("")
    : `<div class="vazio" style="padding:24px">SEM PREÇOS CONFIGURADOS.</div>`;

  document.getElementById("popupProduto").classList.add("ativo");
}

function fecharPopupProduto() {
  document.getElementById("popupProduto").classList.remove("ativo");
}

/* ================= USUÁRIOS ================= */

function abrirModalUsuarios() {
  if (!isAdmin()) return;
  limparFormularioUsuario();
  atualizarSelectTabelasUsuario();
  listarUsuarios();
  document.getElementById("modalUsuarios").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalUsuarios() {
  document.getElementById("modalUsuarios").classList.remove("ativo");
}

function limparFormularioUsuario() {
  document.getElementById("usuarioEditandoId").value    = "";
  document.getElementById("usuarioNovoNome").value      = "";
  document.getElementById("usuarioNovoEmail").value     = "";
  document.getElementById("usuarioNovoSenha").value     = "";
  document.getElementById("usuarioNovoPermissao").value = "vendedor";
  atualizarSelectTabelasUsuario();
  document.getElementById("usuarioNovaTabela").value = "";
}

function atualizarSelectTabelasUsuario() {
  const select = document.getElementById("usuarioNovaTabela");
  if (!select) return;

  const valorAtual = paraMaiusculo(select.value);
  select.innerHTML = `<option value="">SELECIONE UMA TABELA</option>`;

  tabelasComerciais
    .slice()
    .sort((a, b) => paraMaiusculo(a.nome).localeCompare(paraMaiusculo(b.nome)))
    .forEach(tabela => {
      const nome = paraMaiusculo(tabela.nome);
      select.innerHTML += `<option value="${nome}">${nome} - ${formatarTipo(tabela.tipo)}</option>`;
    });

  if (valorAtual) select.value = valorAtual;
}

async function criarUsuario() {
  if (!isAdmin()) return;

  const idEditando    = document.getElementById("usuarioEditandoId").value;
  const nome          = paraMaiusculo(document.getElementById("usuarioNovoNome").value);
  const email         = document.getElementById("usuarioNovoEmail").value.trim();
  const senha         = document.getElementById("usuarioNovoSenha").value.trim();
  const permissao     = document.getElementById("usuarioNovoPermissao").value;
  const tabelaVinculada = paraMaiusculo(document.getElementById("usuarioNovaTabela").value);

  if (!nome || !email) { toast("PREENCHA NOME E EMAIL.", "erro"); return; }
  if (permissao !== "admin" && !tabelaVinculada) { toast("SELECIONE A TABELA VINCULADA.", "erro"); return; }

  mostrarLoading("SALVANDO USUÁRIO...");

  try {
    if (idEditando) {
      await setDoc(doc(db, "usuarios", idEditando), {
        nome, email, permissao, tabelaVinculada,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });

      ocultarLoading();
      toast("USUÁRIO ATUALIZADO COM SUCESSO.");
    } else {
      if (!senha) { ocultarLoading(); toast("INFORME A SENHA DO NOVO USUÁRIO.", "erro"); return; }

      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);

      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nome, email, permissao, tabelaVinculada,
        criadoEm: new Date().toISOString()
      });

      await signOut(secondaryAuth);
      ocultarLoading();
      toast("USUÁRIO CRIADO COM SUCESSO.");
    }

    limparFormularioUsuario();
    listarUsuarios();
  } catch (erro) {
    ocultarLoading();
    toast("ERRO AO SALVAR USUÁRIO: " + erro.message, "erro");
  }
}

async function listarUsuarios() {
  const lista = document.getElementById("listaUsuarios");
  lista.innerHTML = `<div class="vazio"><i class="fa-solid fa-spinner fa-spin"></i>CARREGANDO...</div>`;

  const snap = await getDocs(collection(db, "usuarios"));
  let html = "";

  snap.forEach(item => {
    const usuario = item.data();
    html += `
      <div class="usuario-item">
        <div>
          <strong>${paraMaiusculo(usuario.nome || "SEM NOME")}</strong>
          <small>${usuario.email || ""}</small>
          <small>${formatarTipo(usuario.permissao || "")} · ${paraMaiusculo(usuario.tabelaVinculada || "SEM TABELA")}</small>
        </div>
        <div class="usuario-acoes">
          <button class="btn-editar-user" onclick="editarUsuario('${item.id}')">
            <i class="fa-solid fa-pen" style="margin-right:5px"></i>EDITAR
          </button>
        </div>
      </div>
    `;
  });

  lista.innerHTML = html || `<div class="vazio">NENHUM USUÁRIO CADASTRADO.</div>`;
}

async function editarUsuario(id) {
  const snap = await getDoc(doc(db, "usuarios", id));

  if (!snap.exists()) { toast("USUÁRIO NÃO ENCONTRADO.", "erro"); return; }

  const usuario = snap.data();

  document.getElementById("usuarioEditandoId").value    = id;
  document.getElementById("usuarioNovoNome").value      = paraMaiusculo(usuario.nome || "");
  document.getElementById("usuarioNovoEmail").value     = usuario.email || "";
  document.getElementById("usuarioNovoSenha").value     = "";
  document.getElementById("usuarioNovoPermissao").value = usuario.permissao || "vendedor";

  atualizarSelectTabelasUsuario();
  document.getElementById("usuarioNovaTabela").value = paraMaiusculo(usuario.tabelaVinculada || "");
  document.getElementById("usuarioNovoNome").focus();
}

/* ================= PDF ================= */

function abrirPopupPDF() {
  document.getElementById("popupPDF").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharPopupPDF() {
  document.getElementById("popupPDF").classList.remove("ativo");
}

function agruparPorCategoria(lista) {
  return lista.reduce((grupos, produto) => {
    const categoria = produto.categoria || "SEM CATEGORIA";
    if (!grupos[categoria]) grupos[categoria] = [];
    grupos[categoria].push(produto);
    return grupos;
  }, {});
}

async function gerarPDF() {
  fecharPopupPDF();

  const produtosVisiveis = produtos.filter(p => {
    if (isAdmin()) return true;
    return p.ativo && filtrarTabelasDoUsuario(p).length > 0;
  });

  if (produtosVisiveis.length === 0) {
    toast("NENHUM PRODUTO DISPONÍVEL PARA O PDF.", "erro");
    return;
  }

  mostrarLoading("GERANDO PDF...");

  const area = document.getElementById("areaPDF");
  area.innerHTML = "";

  const grupos  = agruparPorCategoria(produtosVisiveis);
  const paginas = [];
  let numeroPagina = 1;

  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });

  function criarPagina() {
    const pagina = document.createElement("div");
    pagina.className = "pagina-pdf";
    pagina.innerHTML = `
      <div class="cabecalho-pdf">
        ${empresa.logo ? `<img class="logo-pdf" src="${empresa.logo}">` : ""}
        <div class="cabecalho-pdf-info">
          <h1>${paraMaiusculo(empresa.nome || "REI DA MUSSARELA")}</h1>
          <span class="cabecalho-pdf-badge">CATÁLOGO COMERCIAL</span>
          ${empresa.cnpj ? `<div class="cabecalho-pdf-cnpj">CNPJ: ${empresa.cnpj}</div>` : ""}
        </div>
      </div>
      <div class="conteudo-pdf"></div>
      <div class="rodape-pdf">
        <span>${empresa.telefone || "CATÁLOGO DIGITAL"}</span>
        <span class="rodape-pdf-centro">GERADO EM ${dataGeracao}</span>
        <span>${numeroPagina}/${0}</span>
      </div>
    `;
    area.appendChild(pagina);
    paginas.push(pagina);
    numeroPagina++;
    return pagina;
  }

  let paginaAtual   = criarPagina();
  let conteudoAtual = paginaAtual.querySelector(".conteudo-pdf");

  function passouLimite() { return conteudoAtual.scrollHeight > 997; }

  Object.keys(grupos).sort().forEach(categoria => {
    const qtdCategoria = grupos[categoria].length;

    let tituloCategoria = document.createElement("div");
    tituloCategoria.className  = "categoria-pdf";
    tituloCategoria.innerHTML = `${categoria}<span class="categoria-pdf-qtd">${qtdCategoria} PRODUTO${qtdCategoria !== 1 ? "S" : ""}</span>`;
    conteudoAtual.appendChild(tituloCategoria);

    let grid = document.createElement("div");
    grid.className = "grid-pdf";
    conteudoAtual.appendChild(grid);

    grupos[categoria].forEach(produto => {
      const card = document.createElement("div");
      card.className = "produto-pdf";
      card.innerHTML = `
        <div class="produto-pdf-img-wrap">
          <img src="${produto.imagem || imagemPadrao()}">
          ${produto.codigo ? `<span class="produto-pdf-codigo"># ${produto.codigo}</span>` : ""}
        </div>
        <h3>${produto.nome}</h3>
        <p>${produto.descricao || ""}</p>
        <div class="produto-pdf-footer">
          <div class="sem-preco">CONSULTE VALORES</div>
        </div>
      `;

      grid.appendChild(card);

      if (passouLimite()) {
        card.remove();
        if (grid.children.length === 0) {
          grid.remove();
          tituloCategoria.remove();
        }

        paginaAtual   = criarPagina();
        conteudoAtual = paginaAtual.querySelector(".conteudo-pdf");

        tituloCategoria = document.createElement("div");
        tituloCategoria.className   = "categoria-pdf";
        tituloCategoria.innerHTML = `${categoria} (CONT.)<span class="categoria-pdf-qtd">${qtdCategoria} PRODUTO${qtdCategoria !== 1 ? "S" : ""}</span>`;
        conteudoAtual.appendChild(tituloCategoria);

        grid = document.createElement("div");
        grid.className = "grid-pdf";
        conteudoAtual.appendChild(grid);

        grid.appendChild(card);
      }
    });
  });

  paginas.forEach((pagina, index) => {
    const rodapeSpans = pagina.querySelectorAll(".rodape-pdf span");
    const ultimoSpan = rodapeSpans[rodapeSpans.length - 1];
    if (ultimoSpan) ultimoSpan.textContent = `${index + 1}/${paginas.length}`;
  });

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  for (let i = 0; i < paginas.length; i++) {
    const canvas = await html2canvas(paginas[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
  }

  pdf.save("CATALOGO-ERP.pdf");
  ocultarLoading();
  toast("PDF GERADO COM SUCESSO.");
}

/* ================= XLS ================= */

function lerArquivoXLS(arquivo, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const dados    = new Uint8Array(e.target.result);
    const workbook = XLSX.read(dados, { type: "array" });
    const aba      = workbook.SheetNames[0];
    const planilha = workbook.Sheets[aba];
    const linhas   = XLSX.utils.sheet_to_json(planilha, { defval: "" });
    callback(linhas);
  };
  reader.readAsArrayBuffer(arquivo);
}

function encontrarProdutoPorCodigoOuNome(codigo, nome) {
  const codigoBusca = paraMaiusculo(codigo);
  const nomeBusca   = paraMaiusculo(nome);

  return produtos.find(p =>
    paraMaiusculo(p.codigo) === codigoBusca ||
    paraMaiusculo(p.nome)   === nomeBusca
  );
}

function baixarPlanilhaProdutos() {
  if (!isAdmin()) return;

  const linhas = [];
  produtos.forEach(produto => {
    (produto.tabelas || []).forEach(tabela => {
      linhas.push({
        CODIGO:       produto.codigo   || "",
        PRODUTO:      produto.nome     || "",
        CATEGORIA:    produto.categoria || "",
        DESCRICAO:    produto.descricao || "",
        ATIVO:        produto.ativo ? "SIM" : "NÃO",
        TABELA:       tabela.nomeTabela     || "",
        TIPO:         tabela.tipoTabela     || "vendedor",
        COMISSAO:     tabela.descricaoTabela || "",
        COMISSAO_VALOR: tabela.comissao     || "",
        VALOR:        tabela.valor          || ""
      });
    });
  });

  const planilha = XLSX.utils.json_to_sheet(linhas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, "PRODUTOS");
  XLSX.writeFile(workbook, "produtos-sistema.xlsx");
  toast("PLANILHA BAIXADA COM SUCESSO.");
}

async function importarAtualizacaoProdutos(evento) {
  if (!isAdmin()) return;

  const arquivo = evento.target.files[0];
  if (!arquivo) return;

  mostrarLoading("IMPORTANDO PLANILHA...");

  lerArquivoXLS(arquivo, async linhas => {
    let cadastrados = 0;
    let atualizados = 0;

    linhas.forEach(linha => {
      const codigo      = paraMaiusculo(linha.CODIGO || linha.Código || linha.codigo || "");
      const nome        = paraMaiusculo(linha.PRODUTO || linha.Produto || linha.produto || linha.NOME || "");
      const categoria   = paraMaiusculo(linha.CATEGORIA || linha.Categoria || linha.categoria || "SEM CATEGORIA");
      const descricao   = paraMaiusculo(linha.DESCRICAO || linha.DESCRIÇÃO || linha.descricao || "");
      const ativoTexto  = paraMaiusculo(linha.ATIVO || linha.Status || linha.status || "SIM");
      const tabelaNome  = paraMaiusculo(linha.TABELA || linha.Tabela || linha.tabela || "TABELA PADRÃO");
      const tipoTabela  = String(linha.TIPO || linha.Tipo || linha.tipo || "vendedor").toLowerCase();
      const descricaoComissao = paraMaiusculo(linha.COMISSAO || linha.COMISSÃO || linha.Comissao || linha.comissao || "");
      const comissao    = normalizarValorXLS(linha.COMISSAO_VALOR || linha.comissao_valor || "");
      const valor       = normalizarValorXLS(linha.VALOR || linha.PRECO || linha.PREÇO || linha.valor || linha.preco || "");

      if (!nome || !valor) return;

      if (!categorias.includes(categoria)) categorias.push(categoria);

      if (!tabelasComerciais.some(t => t.nome === tabelaNome)) {
        tabelasComerciais.push({
          id: Date.now() + Math.floor(Math.random() * 99999),
          nome: tabelaNome,
          tipo: tipoTabela || "vendedor"
        });
      }

      let produto = encontrarProdutoPorCodigoOuNome(codigo, nome);

      const novaTabela = {
        nomeTabela: tabelaNome,
        tipoTabela,
        descricaoTabela: descricaoComissao || `COMISSÃO ${comissao}%`,
        comissao: comissao || "0",
        valor
      };

      if (produto) {
        produto.codigo   = codigo || produto.codigo;
        produto.nome     = nome;
        produto.categoria = categoria;
        produto.descricao = descricao;
        produto.ativo    = ativoTexto !== "NÃO" && ativoTexto !== "NAO" && ativoTexto !== "INATIVO";
        produto.tabelas  = produto.tabelas || [];

        const tabelaExistente = produto.tabelas.find(t =>
          paraMaiusculo(t.nomeTabela) === tabelaNome &&
          paraMaiusculo(t.descricaoTabela) === paraMaiusculo(novaTabela.descricaoTabela)
        );

        if (tabelaExistente) {
          tabelaExistente.tipoTabela      = novaTabela.tipoTabela;
          tabelaExistente.descricaoTabela = novaTabela.descricaoTabela;
          tabelaExistente.comissao        = novaTabela.comissao;
          tabelaExistente.valor           = novaTabela.valor;
        } else {
          produto.tabelas.push(novaTabela);
        }

        produto.atualizadoEm = new Date().toISOString();
        atualizados++;
      } else {
        produtos.push({
          id:           Date.now() + Math.floor(Math.random() * 99999),
          codigo:       codigo || gerarCodigo(),
          nome,
          categoria,
          descricao,
          ativo:        ativoTexto !== "NÃO" && ativoTexto !== "NAO" && ativoTexto !== "INATIVO",
          imagem:       "",
          tabelas:      [novaTabela],
          criadoEm:     new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        });
        cadastrados++;
      }
    });

    categorias        = [...new Set(categorias.map(c => paraMaiusculo(c)))].sort();
    tabelasComerciais = [...new Map(tabelasComerciais.map(t => [t.nome, t])).values()];

    await salvarFirebase();
    ocultarLoading();

    atualizarSelectCategorias();
    renderizarCatalogo();

    toast(`${cadastrados} CRIADOS · ${atualizados} ATUALIZADOS.`);
    evento.target.value = "";
  });
}

/* ================= EVENTOS ================= */

document.addEventListener("DOMContentLoaded", () => {
  const arquivoAtualizar = document.getElementById("arquivoAtualizarProdutos");
  if (arquivoAtualizar) {
    arquivoAtualizar.addEventListener("change", importarAtualizacaoProdutos);
  }
});

/* ================= EXPORTS (window) ================= */

window.toggleMenuMobile     = toggleMenuMobile;
window.fazerLogin           = fazerLogin;
window.logoutSistema        = logoutSistema;

window.abrirModalProduto    = abrirModalProduto;
window.fecharModalProduto   = fecharModalProduto;
window.salvarProduto        = salvarProduto;
window.excluirProduto       = excluirProduto;
window.alternarStatusProduto = alternarStatusProduto;

window.adicionarTabela      = adicionarTabela;
window.removerTabela        = removerTabela;

window.abrirModalCategoria  = abrirModalCategoria;
window.fecharModalCategoria = fecharModalCategoria;
window.salvarCategoria      = salvarCategoria;
window.excluirCategoria     = excluirCategoria;
window.editarCategoria      = editarCategoria;
window.limparFormularioCategoria = limparFormularioCategoria;

window.abrirModalTabelas    = abrirModalTabelas;
window.fecharModalTabelas   = fecharModalTabelas;
window.salvarTabelaComercial = salvarTabelaComercial;
window.excluirTabelaComercial = excluirTabelaComercial;
window.editarTabelaComercial = editarTabelaComercial;
window.limparFormularioTabela = limparFormularioTabela;

window.abrirModalEmpresa    = abrirModalEmpresa;
window.fecharModalEmpresa   = fecharModalEmpresa;
window.salvarEmpresa        = salvarEmpresa;

window.abrirModalUsuarios   = abrirModalUsuarios;
window.fecharModalUsuarios  = fecharModalUsuarios;
window.criarUsuario         = criarUsuario;
window.editarUsuario        = editarUsuario;
window.limparFormularioUsuario = limparFormularioUsuario;

window.abrirPopupPDF        = abrirPopupPDF;
window.fecharPopupPDF       = fecharPopupPDF;
window.gerarPDF             = gerarPDF;

window.abrirPopupProduto    = abrirPopupProduto;
window.fecharPopupProduto   = fecharPopupProduto;

window.baixarPlanilhaProdutos     = baixarPlanilhaProdutos;
window.importarAtualizacaoProdutos = importarAtualizacaoProdutos;

window.duplicarProduto      = duplicarProduto;
window.previsualizarImagem  = previsualizarImagem;
window.renderizarCatalogo   = renderizarCatalogo;