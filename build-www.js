/**
 * build-www.js
 * Copia os arquivos do projeto para a pasta www/ (exigida pelo Capacitor)
 * Execute: node build-www.js
 */

const fs   = require("fs");
const path = require("path");

const SRC  = __dirname;
const DEST = path.join(__dirname, "www");

const ARQUIVOS = [
  "index.html",
  "script.js",
  "main.css",
  "sw.js",
  "manifest.json",
  "logo.png",
  "logo2.png",
  "fundo-login.png",
  "catalogo-erp.apk"   // copiado só se existir
];

const PASTAS = ["icons"];

function copiarArquivo(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Aviso: ${src} não encontrado, pulando...`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copiado: ${path.basename(src)}`);
}

function copiarPasta(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Aviso: pasta ${src} não encontrada, pulando...`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const items = fs.readdirSync(src);
  items.forEach(item => {
    const srcItem  = path.join(src, item);
    const destItem = path.join(dest, item);
    if (fs.statSync(srcItem).isDirectory()) {
      copiarPasta(srcItem, destItem);
    } else {
      fs.copyFileSync(srcItem, destItem);
      console.log(`Copiado: icons/${item}`);
    }
  });
}

// Criar pasta www
fs.mkdirSync(DEST, { recursive: true });
console.log("Construindo www/...\n");

// Copiar arquivos
ARQUIVOS.forEach(nome => {
  copiarArquivo(path.join(SRC, nome), path.join(DEST, nome));
});

// Copiar pastas
PASTAS.forEach(pasta => {
  copiarPasta(path.join(SRC, pasta), path.join(DEST, pasta));
});

console.log("\nwww/ construído com sucesso!");
console.log("Próximo passo: npx cap sync android");
