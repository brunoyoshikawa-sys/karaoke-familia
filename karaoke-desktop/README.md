# Karaokê Palco — app de desktop (experimental)

Uma segunda forma de abrir o Palco, além do site normal. É a mesma tela do
Palco de sempre, só que numa janela própria em vez de uma aba do navegador —
com uma vantagem: quando alguém pede uma música com a incorporação bloqueada
pelo YouTube, esse app **volta sozinho pro Karaokê assim que o vídeo
termina**, sem precisar clicar em "Voltar".

Controle e Convidado continuam exatamente iguais — abrem no navegador normal
do celular/notebook, como sempre. Esse app aqui é só uma alternativa pra
quem hospeda, pra tela que vai na TV.

## Rodar em modo de teste

Precisa ter o [Node.js](https://nodejs.org) instalado (`node --version` pra
conferir).

```bash
cd karaoke-desktop
npm install
npm start
```

Por padrão ele se conecta no servidor do Render
(`https://karaoke-familia.onrender.com`). Pra testar contra o servidor local
(o `python3 server.py` rodando no seu Mac), edite o `config.json`:

```json
{ "servidor": "http://localhost:8123" }
```

A sala é gerada e salva automaticamente na primeira vez que abre (fica
guardada no computador, então reaproveita a mesma sala nas próximas vezes —
igual o site já faz).

## Gerar o instalador (.dmg)

```bash
npm run build
```

O arquivo `.dmg` aparece na pasta `dist/`.

**Primeira vez abrindo o app instalado**: como ele não tem assinatura paga da
Apple, o macOS vai avisar que é de um "desenvolvedor não identificado".
Clique com o botão direito no app → "Abrir" → confirme "Abrir mesmo assim".
Só precisa fazer isso uma vez — depois abre normal com duplo clique.
