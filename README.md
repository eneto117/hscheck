# Consulta de colaboradores

Digite o código do crachá ou o nome completo e o site mostra os dados do colaborador.

## Estrutura

```
consulta-colaboradores/
├── index.html              tela inicial com o campo de busca
├── css/style.css           aparência (cores no topo do arquivo)
├── js/app.js               leitura da planilha e busca (CONFIG no topo)
└── dados/colaboradores.csv modelo da base de dados
```

## Como alimentar a base

1. Abra `dados/colaboradores.csv` no Excel.
2. Mantenha a primeira linha. As colunas `codigo_cracha` e `nome_completo` são obrigatórias.
3. Substitua as linhas de exemplo pelos dados reais, uma pessoa por linha.
4. Salve como **CSV UTF-8 (delimitado por vírgulas)** ou CSV comum. Os dois funcionam.

Para acrescentar uma informação (ex.: turno), crie uma coluna nova. Ela aparece sozinha no resultado.
Para dar um nome bonito a ela, inclua `turno: "Turno"` em `rotulos`, no topo de `js/app.js`.

A coluna `foto` é opcional: coloque um link de imagem ou um caminho como `fotos/104233.jpg`.

## Publicar no GitHub Pages

1. Crie um repositório e envie todos os arquivos (Add file → Upload files).
2. Settings → Pages → Branch `main`, pasta `/ (root)` → Save.
3. Em alguns minutos o site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

**Atenção:** em conta gratuita, repositório e site do Pages são públicos. Não suba dados reais de pessoas
em `dados/colaboradores.csv`. Deixe o arquivo só com exemplos (ou apague-o) e use o link
"Carregar outra planilha" no rodapé: a planilha é lida no navegador e não sai do computador.

## Testar no computador

Abrir o `index.html` direto funciona com o botão "Carregar outra planilha".
Para a carga automática, rode na pasta: `python -m http.server` e acesse `http://localhost:8000`.
