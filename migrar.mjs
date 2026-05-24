import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs
} from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

/* FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyCmWszDrWHTQ5PXK_dxnayhxMmvHfKzeBU",
  authDomain: "catalogoteste2.firebaseapp.com",
  projectId: "catalogoteste2",
  storageBucket: "catalogoteste2.firebasestorage.app",
  messagingSenderId: "1040593537973",
  appId: "1:1040593537973:web:714986bb161e996ab167fc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* SUPABASE */
const supabaseUrl = "https://nzsatubgbwlqiykvcuuz.supabase.co";
const supabaseKey = "sb_publishable_L-0vv2RuCRXOf2zEfWfklg_qHqUdfjT";
const supabase = createClient(supabaseUrl, supabaseKey);

function texto(valor) {
  return String(valor || "").trim();
}

function maiusculo(valor) {
  return texto(valor).toUpperCase();
}

async function inserirTabela(nomeTabela, dados) {
  const { error } = await supabase.from(nomeTabela).insert(dados);

  if (error) {
    console.log(`ERRO EM ${nomeTabela}:`, error.message);
    return false;
  }

  return true;
}

async function migrarTudo() {
  console.log("====================================");
  console.log("INICIANDO MIGRAÇÃO COMPLETA");
  console.log("FIREBASE → SUPABASE");
  console.log("====================================");

  const snap = await getDoc(doc(db, "catalogo", "dados"));

  if (!snap.exists()) {
    console.log("Documento catalogo/dados não encontrado.");
    return;
  }

  const dados = snap.data();

  const produtos = dados.produtos || [];
  const categorias = dados.categorias || [];
  const tabelasComerciais = dados.tabelasComerciais || [];
  const empresa = dados.empresa || {};

  console.log("Produtos:", produtos.length);
  console.log("Categorias:", categorias.length);
  console.log("Tabelas comerciais:", tabelasComerciais.length);

  console.log("Migrando empresa...");

  await supabase.from("empresa").upsert({
    id: 1,
    nome: empresa.nome || "REI DA MUSSARELA",
    cnpj: empresa.cnpj || "",
    telefone: empresa.telefone || "",
    logo: empresa.logo || ""
  });

  console.log("Migrando categorias...");

  for (const categoria of categorias) {
    await supabase.from("categorias").upsert({
      nome: maiusculo(categoria)
    });
  }

  console.log("Migrando tabelas comerciais...");

  for (const tabela of tabelasComerciais) {
    await supabase.from("tabelas_comerciais").upsert({
      id: Number(tabela.id),
      nome: maiusculo(tabela.nome),
      tipo: tabela.tipo || "vendedor"
    });
  }

  console.log("Migrando produtos e preços...");

  let produtosOk = 0;
  let tabelasOk = 0;
  let erros = 0;

  for (const produto of produtos) {
    const produtoId = Number(produto.id || Date.now());

    const { error: erroProduto } = await supabase.from("produtos").upsert({
      id: produtoId,
      codigo: produto.codigo || "",
      nome: maiusculo(produto.nome || "SEM NOME"),
      categoria: maiusculo(produto.categoria || "SEM CATEGORIA"),
      descricao: maiusculo(produto.descricao || ""),
      imagem_url: produto.imagem || produto.imagem_url || "",
      ativo: produto.ativo !== false,
      criado_em: produto.criadoEm || "",
      atualizado_em: produto.atualizadoEm || ""
    });

    if (erroProduto) {
      erros++;
      console.log("Erro produto:", produto.nome, erroProduto.message);
      continue;
    }

    produtosOk++;

    const tabelas = Array.isArray(produto.tabelas) ? produto.tabelas : [];

    for (const tabela of tabelas) {
      const ok = await inserirTabela("produto_tabelas", {
        produto_id: produtoId,
        nome_tabela: maiusculo(tabela.nomeTabela || "TABELA PADRÃO"),
        tipo_tabela: tabela.tipoTabela || "vendedor",
        descricao_tabela: maiusculo(tabela.descricaoTabela || ""),
        comissao: texto(tabela.comissao || "0"),
        valor: texto(tabela.valor || "0,00")
      });

      if (ok) tabelasOk++;
      else erros++;
    }

    console.log("Migrado:", produto.nome);
  }

  console.log("Migrando usuários...");

  const usuariosSnap = await getDocs(collection(db, "usuarios"));
  let usuariosOk = 0;

  for (const item of usuariosSnap.docs) {
    const usuario = item.data();

    const { error } = await supabase.from("usuarios").upsert({
      id: item.id,
      nome: maiusculo(usuario.nome || ""),
      email: usuario.email || "",
      permissao: usuario.permissao || "vendedor",
      tabela_vinculada: maiusculo(usuario.tabelaVinculada || ""),
      criado_em: usuario.criadoEm || "",
      atualizado_em: usuario.atualizadoEm || ""
    });

    if (error) {
      erros++;
      console.log("Erro usuário:", usuario.email, error.message);
    } else {
      usuariosOk++;
    }
  }

  console.log("====================================");
  console.log("MIGRAÇÃO FINALIZADA");
  console.log("Produtos migrados:", produtosOk);
  console.log("Preços/tabelas migrados:", tabelasOk);
  console.log("Usuários migrados:", usuariosOk);
  console.log("Erros:", erros);
  console.log("====================================");
}

migrarTudo();