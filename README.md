# Vértice | Agente de Demanda

MVP 1 funcional do Agente de Demanda da Vértice.

## Rodar

```bash
npm install
npm run dev:api
npm run dev
```

O app usa `localStorage` como memória local do MVP. O schema Supabase completo está em `supabase/schema.sql`.

Para IA real, rode a API local com `OPENAI_API_KEY` configurada. Para Meta Ads real, configure `META_ACCESS_TOKEN` e `META_AD_ACCOUNT_ID`. Sem essas variáveis, o produto mantém fallback seguro e registra o uso em `ai_usage`.

## O que está implementado

- Dashboard operacional.
- CRUD assistido de empresas, DNA, produtos e ofertas.
- Sessões guiadas e modos isolados.
- Agente estratégico determinístico com validação de briefing.
- Geração de estratégia, copy, roteiro de vídeo, prompt de imagem, carrossel, funil, landing page e formulário.
- Aprovação humana obrigatória antes de execução.
- Campanhas internas e criação Meta Ads pausada em modo simulado.
- Métricas, diagnósticos, aprendizados e recomendações.
- Serviços separados conforme especificação.
