# Karaokê Palco — app de desktop (experimental)

Uma segunda forma de abrir o Palco, além do site normal. É a mesma tela do
Palco de sempre, só que numa janela própria em vez de uma aba do navegador —
com uma vantagem: quando alguém pede uma música com a incorporação bloqueada
pelo YouTube, esse app **volta sozinho pro Karaokê assim que o vídeo
termina**, sem precisar clicar em "Voltar".

Controle e Convidado continuam exatamente iguais — abrem no navegador normal
do celular/notebook, como sempre. Esse app aqui é só uma alternativa pra
quem hospeda, pra tela que vai na TV.

Também vem com o [uBlock Origin](https://github.com/gorhill/uBlock) embutido
(`vendor/ublock-origin/`, código aberto sob GPL-3.0 — licença em
`vendor/ublock-origin/LICENSE.txt`), só pra filtrar os anúncios do YouTube
nos vídeos com incorporação bloqueada.

---

## Pra quem vai só instalar e usar (família, amigos)

Nenhum comando, nenhum terminal — os instaladores ficam disponíveis pra
download direto no site: acesse **[/baixar-app.html](https://karaoke-familia.onrender.com/baixar-app.html)**
(tem um link pra lá também no rodapé da tela do Controle) e escolha Mac ou
Windows. A própria página explica os passos de instalação de cada um.

---

## Pra quem vai gerar/atualizar o instalador (você)

Isso aqui já é técnico — só quem for mexer no código ou publicar uma versão
nova precisa disso. Requer o [Node.js](https://nodejs.org) instalado.

**Testar sem gerar instalador** (roda o app direto):
```bash
cd karaoke-desktop
npm install
npm start
```

**Gerar os instaladores (Mac universal + Windows x64) de uma vez**:
```bash
npm run build
```
Os arquivos saem em `karaoke-desktop/dist/`:
- `Karaoke Palco-1.1.0-universal.dmg`
- `Karaoke Palco Setup 1.1.0.exe`

(dá pra gerar só um dos dois com `npm run build:mac` ou `npm run build:win`)

Por padrão o app se conecta no servidor do Render
(`https://karaoke-familia.onrender.com`). Pra apontar pra um servidor local
em vez disso, edite `config.json` antes de gerar o instalador:
```json
{ "servidor": "http://localhost:8123" }
```

### Publicar uma versão nova

**Sempre** suba como um Release novo, nunca sobrescreva um arquivo já
publicado (`gh release upload --clobber`) — sem um número de versão
diferente no nome do arquivo, não tem como saber se quem baixou pegou a
versão velha ou a nova, o que já causou confusão uma vez.

1. Atualize a versão em `package.json` (campo `"version"`).
2. Gere os instaladores (`npm run build`) — o nome dos arquivos em `dist/`
   já sai com a versão nova.
3. Suba como um Release novo no GitHub (troque `1.1.0` pela versão real):
   ```bash
   gh release create karaoke-palco-v1.1.0 \
     "dist/Karaoke Palco-1.1.0-universal.dmg" \
     "dist/Karaoke Palco Setup 1.1.0.exe" \
     --title "Karaoke Palco — App de Desktop v1.1.0" \
     --notes "Descreva o que mudou aqui."
   ```
4. Atualize os links em `../baixar-app.html` pra apontar pro Release novo
   (troque a tag e o nome dos arquivos nos dois `href`, e o texto da versão
   embaixo de cada botão).
5. (Opcional) Apague o Release antigo pra ninguém baixar a versão velha por
   engano: `gh release delete karaoke-palco-v1.0.0 --yes --cleanup-tag`.
