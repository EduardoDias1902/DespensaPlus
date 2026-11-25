# Guia: Usando a Gemini API com sua Conta Google AI Pro

## Posso "linkar" minha assinatura Google AI Pro diretamente via login OAuth no código?

Em aplicativos backend próprios (como o **Smart Pantry Assistant**), a autenticação na **Gemini Developer API** é feita exclusivamente via **chave de API (`GEMINI_API_KEY`)** gerada no **Google AI Studio** — não existe login direto da assinatura de consumidor do aplicativo web Gemini para liberar chamadas ilimitadas no código.

**Boa notícia:** sua assinatura **Google AI Pro** traz benefícios diretos no **Google AI Studio**, e além disso o Google AI Studio oferece um **Free Tier (camada gratuita)** generoso para desenvolvimento e validação de MVPs!

---

## Passo a Passo para Gerar sua Chave e Resgatar Benefícios Pro

1. **Acesse o Google AI Studio com sua conta Google AI Pro**
   - Abra: https://aistudio.google.com/
   - Certifique-se de estar logado com o mesmo e-mail da sua assinatura **Google AI Pro**.

2. **Resgate os créditos mensais de desenvolvedor (se aplicável ao seu plano Pro)**
   - No menu lateral esquerdo do Google AI Studio, verifique a opção de **créditos/benefícios do plano Google AI Pro** (planos Pro/Ultra oferecem créditos mensais promocionais do Google Cloud aplicáveis às chaves pagas da Gemini API).
   - Siga o fluxo guiado para vincular os créditos ao seu projeto de faturamento.
   - *Obs.:* Para validar o MVP, o **Free Tier gratuito** do AI Studio já permite centenas de testes de OCR e geração de receitas a custo zero.

3. **Crie sua chave de API (`GEMINI_API_KEY`)**
   - Acesse diretamente: https://aistudio.google.com/apikey
   - Clique em **"Create API key"** (Criar chave de API).
   - Copie a chave gerada (começa normalmente com `AIza...`).

4. **Configure com segurança no Backend (RNF05)**
   - Na raiz do projeto `smart-pantry-assistant/`, copie `.env.example` para `.env`.
   - Edite o `.env`:
     ```env
     GEMINI_API_KEY=AIzaSy_SUA_CHAVE_REAL_AQUI
     GEMINI_MODEL=gemini-4-hydrogen
     ```
   - Reinicie o backend (`npm run dev:backend`).
   - Acesse `http://localhost:3001/api/health` e confirme:
     ```json
     {
       "status": "ok",
       "geminiConfigured": true,
       "geminiModel": "gemini-4-hydrogen"
     }
     ```

---

## Boas Práticas de Segurança (RNF05)

- **Nunca coloque a `GEMINI_API_KEY` no código React/Frontend** (nem em variáveis `VITE_*`), pois qualquer pessoa poderia inspecionar o código no navegador e consumir sua cota.
- No **Smart Pantry Assistant**, o frontend envia as imagens e pedidos de receitas para o **Backend Express** (`/api/ocr/analyze` e `/api/cron/run`), que faz a chamada oficial pelo SDK `@google/genai` mantendo a chave isolada no servidor.
- Nunca faça commit do arquivo `.env` no GitHub (ele já está bloqueado no `.gitignore`).
