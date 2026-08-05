# Como ativar a busca de músicas dentro do app

Sem isso, a busca continua funcionando do jeito antigo (abre uma aba do
YouTube pra você copiar o link). Com isso configurado, o convidado digita o
nome da música, aperta "Buscar", e escolhe direto na tela — sem sair do app,
sem copiar link nenhum.

É gratuito (a cota diária dá pra centenas de buscas por dia, mais que
suficiente pra uma festa).

---

## Passo 1 — Criar a chave no Google

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e
   faça login com uma conta Google (qualquer uma, não precisa ser nova).
2. No topo, clique em **"Select a project"** → **"New Project"**. Dê
   qualquer nome, ex: `karaoke-familia`, e clique em **"Create"**.
3. Com o projeto selecionado, vá em **"APIs & Services" → "Library"** (ou
   acesse [este link direto](https://console.cloud.google.com/apis/library/youtube.googleapis.com)).
4. Busque por **"YouTube Data API v3"**, clique nela, e clique em **"Enable"**.
5. Vá em **"APIs & Services" → "Credentials"**.
6. Clique em **"+ Create Credentials" → "API key"**.
7. Copia a chave gerada (uma sequência de letras/números).

**Dica de segurança (opcional, mas recomendado):** clique em "Edit API key"
e, em "API restrictions", marque só "YouTube Data API v3" — assim, mesmo se
alguém pegar essa chave, ela só serve pra isso.

## Passo 2 — Colocar a chave no Render

1. Acesse o painel do seu serviço em [dashboard.render.com](https://dashboard.render.com).
2. No menu lateral, clique em **"Environment"**.
3. Clique em **"+ Add Environment Variable"**.
4. Em **Key**, digite: `YOUTUBE_API_KEY`
5. Em **Value**, cole a chave que você copiou no Passo 1.
6. Clique em **"Save Changes"**.

O Render vai reiniciar o serviço sozinho com a chave configurada — leva
1-2 minutos. Depois disso, a busca já funciona dentro do app.

## Se quiser usar localmente (Mac) também

No Terminal, antes de rodar o servidor:
```
export YOUTUBE_API_KEY="cole_sua_chave_aqui"
python3 server.py
```
(isso só vale pra aquela sessão do Terminal — se fechar e abrir de novo,
precisa exportar de novo, ou pode adicionar essa linha no `Ligar Karaoke.command`
se quiser que fique permanente.)

---

**Sem a chave configurada, nada quebra** — o app detecta sozinho e volta
pro modo antigo (abre uma aba de busca) automaticamente.
