# Stick Engine Studio (finalização Fases 1–4)

Projeto de engine procedural de boneco palito para Canvas 2D com separação completa de engine e app, timeline autoral, sistema formal de poses e testes automatizados.

## Entregas implementadas

### ✅ Fase 1 — Núcleo estável
- Revisão e estabilização de estados (`idle`, `walk`, `run`, `jump`, `crouch`, `wave`).
- Correções de locomoção e IK (stride, joelhos/cotovelos, suporte ao solo).
- Limpeza estrutural e separação clara de responsabilidades.
- API básica e avançada documentada.

### ✅ Fase 2 — Poses e ações
- Sistema formal de poses em JSON.
- Import/export de poses.
- Biblioteca inicial de poses (`DEFAULT_POSES`).
- Ações com blend (`blendIn/blendOut`) e sobreposição por camada (`base` + `upper`).

### ✅ Fase 3 — Timeline + editor visual
- Timeline autoral com tracks numéricas e keyframes.
- Biblioteca de movimentos versionada (`MotionLibrary`, versão `1.0.0`).
- Editor visual no app principal (drag de juntas + salvar/carregar/exportar).
- Prévia de poses e playback de timeline.

### ✅ Fase 4 — Engine reutilizável + app principal
- Pacote da engine isolado em `engine/`:
  - `engine/stick-engine.js`
  - `engine/authoring.js`
- App principal completo em `index.html` + `app/`.
- Demo separado como exemplo de uso da API em `demo/`.
- Exemplo adicional multi-personagem em `examples/multi-character.html`.

---

## Estrutura do projeto

```txt
/
  engine/
    stick-engine.js
    authoring.js
  app/
    main.js
    style.css
  demo/
    index.html
    demo.js
    style.css
  docs/
    API.md
  examples/
    multi-character.html
  tests/
    *.test.js
  index.html
  package.json
```

---

## UX/UI do app principal

- O app principal é **desktop-only** e foi desenhado para uso em tela grande.
- Viewport alvo: **1366x768**.
- Não há adaptação para tablet/mobile/touch nesta etapa final.
- O demo foi mantido separado para exemplificar uso programático da API.

---

## Como executar

```bash
python -m http.server 8080
```

Acessos:
- App principal: `http://localhost:8080/`
- Demo API: `http://localhost:8080/demo/`
- Exemplo multi-character: `http://localhost:8080/examples/multi-character.html`

---

## Testes automatizados

```bash
npm test
```

Cobertura desta etapa:
- interpolação e ciclo de timeline;
- import/export da motion library versionada;
- validação básica dos exports públicos da engine.

---

## Próximo refinamento (pós-finalização)

- Polimento visual e microinterações da UI.
- Timeline com easing por keyframe e tangentes.
- Persistência de projeto (poses + timelines + cenas).
- Testes visuais (snapshot/canvas diff) em CI.
