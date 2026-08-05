# Como colocar o Karaokê na internet (Render.com — grátis)

Isso permite acessar o Palco, Controle e a fila de qualquer lugar, sem precisar
do seu notebook ligado nem de todo mundo estar na mesma rede Wi-Fi. Depois de
publicado, você recebe uma URL fixa tipo `https://seukaraoke.onrender.com`.

**Único trade-off do plano grátis:** se ninguém acessar por 15 minutos, o
servidor "dorme", e a próxima pessoa a abrir espera uns 30-60 segundos ele
acordar. Solução simples: abra a página do Palco uns 2 minutos antes de começar
a festa.

---

## Passo 1 — Criar uma conta no GitHub (se ainda não tiver)

1. Acesse [github.com](https://github.com) e crie uma conta gratuita.

## Passo 2 — Subir os arquivos para um repositório

**Pelo site (mais simples, sem usar Terminal):**

1. No GitHub, clique em **"New repository"** (botão verde).
2. Dê um nome, ex: `karaoke-familia`. Deixe como **Public** ou **Private** (tanto faz).
3. Clique em **"Create repository"**.
4. Na página do repositório vazio, clique em **"uploading an existing file"**.
5. Arraste os arquivos: `karaoke.html`, `server.py`, `requirements.txt`.
6. Clique em **"Commit changes"**.

## Passo 3 — Criar uma conta no Render

1. Acesse [render.com](https://render.com) e crie uma conta gratuita (dá pra
   entrar direto com a conta do GitHub, facilita o próximo passo).

## Passo 4 — Criar o "Web Service"

1. No painel do Render, clique em **"New +"** → **"Web Service"**.
2. Conecte sua conta do GitHub (se pedir) e selecione o repositório que você
   criou no Passo 2.
3. Preencha:
   - **Name**: qualquer nome, ex: `karaoke-familia`
   - **Runtime**: Python 3
   - **Build Command**: deixe em branco (ou `pip install -r requirements.txt`)
   - **Start Command**: `python3 server.py`
   - **Instance Type**: Free
4. Clique em **"Create Web Service"**.

O Render vai buildar e subir o serviço — leva 1-2 minutos na primeira vez.
Quando terminar, ele mostra a URL pública no topo da página, algo como:

```
https://karaoke-familia.onrender.com
```

## Passo 5 — Usar

Abra `https://karaoke-familia.onrender.com/karaoke.html` — a tela inicial
já aparece **sem pedir IP nem porta** (isso só existe no modo rede local).
É só clicar em "Abrir Palco" ou "Abrir Controle".

O QR code dos convidados também funciona automaticamente, e agora funciona
mesmo que o convidado **não esteja na mesma rede Wi-Fi** — só precisa ter
internet no celular.

---

## Quando eu quiser atualizar o karaokê depois de mudanças novas

Sempre que eu (o Claude) mandar uma versão nova do `karaoke.html` ou
`server.py`, é só repetir: no GitHub, vá no arquivo antigo dentro do seu
repositório → ícone de lápis (editar) → apagar tudo → colar o conteúdo novo →
"Commit changes". O Render detecta a mudança e republica sozinho em
1-2 minutos.

## Se quiser usar localmente (sem internet) também

Isso continua funcionando exatamente como antes — os arquivos
`Ligar Karaoke.command` e `Parar Karaoke.command` continuam válidos pra usar
na rede local de casa, sem depender do Render. São dois modos independentes,
usando os mesmos `karaoke.html`/`server.py`.
