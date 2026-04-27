# Stick Engine Prototype — versão corrigida

Protótipo de engine de boneco palito articulado, renderizado diretamente no navegador com Canvas 2D.

## Correção principal desta versão

A versão anterior usava ES Modules (`<script type="module">` com `import/export`). Isso funciona bem em servidor HTTP, mas pode falhar quando o arquivo é aberto diretamente com `file://`, por causa das regras de segurança/CORS dos módulos no navegador. Esta versão usa um bundle JavaScript clássico (`js/stick-engine.js`) carregado com `<script defer>`, sem imports, para funcionar tanto em servidor quanto ao abrir o `index.html` localmente.

## Como usar

Abra `index.html` no navegador ou publique a pasta inteira no servidor.

Se quiser servir localmente:

```bash
python -m http.server 8080
```

Depois acesse:

```txt
http://localhost:8080
```

## Controles

- A/D: mover
- Shift: correr
- W: pular
- S: agachar
- Espaço: acenar
- Mouse: controlar olhar e alvo da mão

## API pública

No console do navegador:

```js
StickEngineDemo.play('walk');
StickEngineDemo.play('run');
StickEngineDemo.stop();
StickEngineDemo.jump();
StickEngineDemo.crouch(true);
StickEngineDemo.crouch(false);
StickEngineDemo.wave('right');
StickEngineDemo.reach('rightHand', 620, 180);
StickEngineDemo.reach('both', 620, 180);
StickEngineDemo.lookAt(500, 200);
StickEngineDemo.setFacing('left');
StickEngineDemo.setEnergy(0.9);
StickEngineDemo.setScale(1.15);
StickEngineDemo.setSmoothing(0.22);
StickEngineDemo.setFootLock(true);
StickEngineDemo.setReach(true, false);
StickEngineDemo.setDebug(true);
StickEngineDemo.getState();
```

## Arquivos

```txt
stick-engine-prototype-fixed/
  index.html
  README.md
  css/style.css
  js/stick-engine.js
```


## Versão organic-v2

Ajustes finos desta versão:
- contraste corrigido entre palco e personagem;
- correção do overlay vermelho de erro que podia aparecer mesmo com `hidden`;
- quadril reposicionado acima do chão, evitando pernas dobradas de forma artificial;
- caminhada/corrida com ciclo mais natural: bob vertical, sway do quadril, contra-movimento de tronco e braços;
- salto com antecipação, fase aérea e aterrissagem;
- agachamento interpolado, sem quebra brusca;
- linhas do boneco com contorno escuro + núcleo claro para leitura visual.

## Versão organic-v4

Ajustes finos desta versão:
- correção da inversão dos joelhos ao andar para esquerda/direita;
- correção da inversão dos cotovelos ao virar o personagem;
- inclusão de pole vectors internos para braços e pernas, estabilizando a direção preferida de dobra;
- caminhada espelhada corretamente pelo `facing`, sem reaproveitar a lógica corporal da direita ao andar para a esquerda;
- botão `Agachar` agora alterna entre agachar/desagachar;
- tecla `S` agora desagacha ao soltar, mantendo o personagem parado no lugar.


## Organic v4

Correção do ciclo das pernas: a fase aérea agora leva o pé de trás para frente na direção do deslocamento. A fase de apoio continua passando de frente para trás em relação ao corpo, como em uma marcha em esteira, para dar sensação de contato com o chão.

## Validação do estado atual (auditoria rápida)

Checklist do que o código atual já cobre:

- ✅ Respiração em idle (`breathe` + oscilação corporal em repouso).
- ✅ Andar e correr com ciclo de pernas e braços procedural.
- ✅ Pulo com antecipação, fase aérea e aterrissagem.
- ✅ Agachar via teclado (`S`) e botão com alternância.
- ✅ Aceno acionável por botão, teclado e API.
- ✅ Olhar e alcance por mouse, com opção de mão esquerda espelhada.
- ✅ IK de braços e pernas com pole vectors (evita inversões de cotovelo/joelho).
- ✅ Exibição de debug de juntas e alvos.
- ✅ Recentralização por botão.
- ✅ Controles por teclado + painel.

Lacunas em relação a engine “completa” (ainda não implementadas):

- ❌ Separação total entre pacote de engine e demo.
- ❌ Sistema formal de poses com import/export JSON.
- ❌ Timeline autoral, editor visual e biblioteca de movimentos versionada.
- ❌ Testes automatizados.
