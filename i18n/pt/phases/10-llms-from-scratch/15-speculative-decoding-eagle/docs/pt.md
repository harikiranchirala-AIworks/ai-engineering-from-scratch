# Descodificação especulativa e EAGLE-3

> O decodificação é ligado à memória. Um modelo 70B gasta a maior parte de uma passagem avançada esperando que pesos saibam do HBM, produzindo um token no final de uma espera de ~70 ms. Leviathan, Kalai, Matias (2023) mostraram que você pode deixar um modelo de rascunho pequeno adivinhar os próximos tokens K, verificá-los em um grande modelo de passagem para a frente, e aceitar o prefixo correto mais longo  com uma provavelmente exata equivalência à amostragem do alvo. EAGLE-3 (Li et al., NeurIPS 2025) empurra a média de tokens aceitos por verificação para ~ 4,65 no Spec-Bench, aproximadamente um 2,4x de aceleração do relógio de parede na distribuição de saída correspondente.

**Type:** Build
**Languages:** Python (stdlib only)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## O problema

A descodificação autoregressiva é o centro de custos da produção LLM. Cada token é um passagem para frente, e o passagem para frente é dominado pela leitura da matriz de peso total de HBM  não por aritmética. Em um H100 decodificando um modelo 70B BF16, ~ 280 GB de pesos têm que passar pelas unidades de computação para produzir um token.

Não se pode encolher o modelo sem mudar a sua distribuição. Não se pode tornar a memória mais rápida. O único botão restante é a proporção de tokens produzidos por passagem avançada.

A descodificação especulativa explora uma ineficiência específica: o decodificador passa com *memória-bound*, então, uma vez que você transmite os pesos além das unidades de cálculo, você tem uma capacidade aritmética ociosa significativa. Um pequeno modelo de projeto que adivinha 4 tokens custa quase nada em comparação com um passe de destino. Se a maioria das suas conjecturas estiver correta, você amortizar um peso lido em vários tokens  e você faz isso sem tocar na distribuição de saída do alvo.

O diagrama em `assets/speculative-decoding.svg`mostra o conjunto completo: a cadeia de passos K do esboço, a única passagem de verificação do alvo, o ciclo de aceitação/rejeição de esquerda para direita, a amostra residual na primeira rejeição e o token de bônus na aceitação completa.

## O conceito

### A configuração de dois modelos

- **Target**M_p: o modelo lento de alta qualidade. Distribuição p. É disso que queremos amostras.
- **Draft**M_q: um pequeno preditor rápido. Distribuição q. Tipicamente 530x menor do que o alvo.

Por etapa especulativa, na posição t:

1. O rascunho gera tokens K autoregressivamente: x_1, ..., x_K ~ q.
2. O alvo corre .**one forward pass**sobre as posições K + 1 e retorna p                                                                                                                                                                                                                                                          
3. Uma regra de aceitação/recusão consome os tokens redigidos de esquerda para direita, aceitando o prefixo de correspondência mais longo e remodelação de uma distribuição corrigida na primeira rejeição ou tomando um token-alvo extra com amostra se todos os K forem aceitos.

Se o projeto coincide perfeitamente com o objetivo, você produz tokens K + 1 por objetivo para frente. Se o projeto estiver errado na posição 1, você ainda produz exatamente 1 token. Você nunca produz menos de um token por verificação.

### A regra da exatidão (Leviathan et al., 2023)

O truque é um teste de amostragem de rejeição modificado que preserva p exatamente. Para cada token elaborado x_k com probabilidade de projeto q(x_k) e probabilidade de alvo p(x_k):

```
r ~ Uniform(0, 1)
if r < p(x_k) / q(x_k):
    accept x_k
else:
    sample replacement ~ residual(x) = max(p(x) - q(x), 0) / ||max(p - q, 0)||_1
    stop
```

Quando p = q a probabilidade de aceitação é 1. Quando p ≠ q a amostra rejeitada vem do resíduo da parte positiva, que é exatamente a massa que p tem que q não conseguiu cobrir. Combinando os dois ramos dá-se uma amostra tirada de p por construção  sem viés, sem fator de correção, sem haque de temperatura.

A especialização gananciosa é mais simples: aceitar se e só se`argmax(p) == x_k`, em caso contrário emitir`argmax(p)`E pára.

### A aceleração esperada

Se a probabilidade de aceitação por token for α (media sobre posições), o número esperado de tokens por passagem prospectiva-alvo é:

```
E[tokens per verify] = (1 - α^{K+1}) / (1 - α)
```

A α = 0,8 e K = 4 é 3,36 tokens por objetivo para frente. Um decodificador simples produz 1 token por objetivo para frente, então o aumento de velocidade do teto é 3,36 ×  menos o custo dos passos do projeto K, o que é insignificante quando custo (target) ≫ K · custo (projeto).

O único parâmetro real é α. Um bom rascunho é tudo.

Valores de exemplo em K = 4:

| α    | E[tokens per verify] | Ceiling speedup |
|------|----------------------|-----------------|
| 0.50 | 1.94                 | 1.94×           |
| 0.70 | 2.83                 | 2.83×           |
| 0.80 | 3.36                 | 3.36×           |
| 0.90 | 4.10                 | 4.10×           |

Aumentar o K para além de 68 raramente ajuda:`α^{K+1}`Os termos compostos geométricamente, e cada passo extra de rascunho adiciona um ritmo de latência serial que não pode esconder.

### Formação do projecto: destilação

Um modelo aleatório faz um esboço ruim. A receita padrão é destilar o esboço contra a distribuição de saída do alvo:

1. Escolha um pequeno rascunho de arquitetura que compartilhe o tokenizer do alvo.
2. Exerce o alvo sobre um grande corpus, armazenar as suas distribuições de tokens seguintes.
3. Treinar o rascunho com a divergência KL contra essas distribuições armazenadas, não contra os rótulos de verdade.

As taxas de aceitação da produção caem em 0,60,8 para o chat, 0,70,85 para o código, e caem drasticamente para a escrita criativa em alta temperatura.

### AIGLE: reutilização das características e desenho de árvores

Li, Wei, Zhang, Zhang (2024, "AIGLE") fizeram duas observações. Primeiro, um modelo de redireção de projeto separado apresenta o objetivo já calculado durante sua última verificação  O estado oculto final do objetivo é uma previsão comprimida do próximo token e pode ser inserido diretamente no projeto. Em segundo lugar, uma cadeia linear de tokens de projeto K descarta o paralelismo barato: o projeto poderia emitir uma árvore de candidatos, e o único passe de verificação do alvo pode verificar todos os ramos em paralelo usando uma máscara de atenção em forma de árvore, e então aceitar o caminho correto mais longo.

A EAGLE-1 torna o projeto uma única camada de decodificador transformador cuja entrada é o último estado oculto do alvo mais o último token emitido.

EAGLE-3 (NeurIPS 2025, arXiv:2503.01840) substitui a previsão de recursos com previsão de tokens direta e funciona recursos de várias camadas do alvo  que remove o gargalo de informação que limitou a EAGLE-1/2 quando os dados de treinamento foram aumentados.

### Verificação da atenção à árvore

Quando o esboço emite uma árvore, o alvo verifica cada nó em uma única passagem para a frente, mudando sua máscara de atenção de "estritamente triangular inferior sobre a linha" para "estritamente triangular inferior sobre a topologia da árvore". Cada nó atende apenas aos seus antepassados.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

Se`a,b`estão a competir os primeiros candidatos e `c,d,e,f`são continuidades, todas as seis posições são verificadas em uma passagem para a frente; a saída é o prefixo mais longo ao longo de qualquer caminho aceito.

### Quando ganha, quando não ganha.

**Wins**: código, saídas estruturadas, chat comum  alto α, pequena massa de vocablas onde o esboço e o alvo discordam. tamanhos de lotes de memória (18) onde o alvo tem FLOPs inativos.

**Loses**A escrita criativa a temperatura ≥ 1,0, onde α desce em direcção à 1/ do volume de vocais e o rascunho de carga superior domina.

As lojas de produção relatam 23× no chat, 35× no código, quase zero na escrita criativa.

## Construí-lo

Os enviados .`code/main.py`é apenas de restrição e opera em**toy discrete distributions**( tamanho de vocabulário 16) para que a matemática seja visível sem um tokenizer ou uma GPU.

1. A.`target`Distribuição e perturbação`draft`distribuição numa vocabulária compartilhada, ambas construídas a partir de sementes fixas para reprodução.
2. `speculative_step(target_dists, draft_model, prefix, K)` uma rodada de amostragem Leviathan. O projecto propõe tokens K; o alvo dá p em cada posição elaborada; o ciclo aceitar/reject correr de esquerda para direita; o resíduo é calculado na rejeição; a amostra bônus é tomada na aceitação total.
3. Um teste de equivalência de distribuição: executar a descodificação especulativa N=200k vezes e amostragem de alvo simples N=200k vezes, colocar o token de saída na posição 0, e afirmar a distância total de variação < 0,01. Esta é a verificação de exatidão empírica do documento de 2023 é famoso.
4. Um relatório de forma fechada α-vs-velocidade que percorre α ∈ {0,5, 0,7, 0,9} × K ∈ {1...8} e imprime os tokens esperados por superfície de verificação.
5. Um contador de taxa de aceitação por posição para que você possa ver α deriva à medida que o prefixo cresce.

- Correr .

```
python3 code/main.py
```

Output esperado: uma tabela de taxa de aceitação, uma linha de distância de TV (`TV = 0.0034`-ish na semente padrão), a superfície de aceleração e um `PASS`A corrida completa em menos de um segundo.

## Usá-lo

- **vLLM**Expõe a descodificação especulativa como uma configuração de primeira classe.`--speculative-model <draft>`E ...`--num-speculative-tokens K`; adicionar `--speculative-draft-tensor-parallel-size`Quando o projeto é residente em GPU.`--speculative-method eagle3`ramo em v0.7+.
- **SGLang**Os navios EAGLE-2 e EAGLE-3 suportam e os compõem com o caching de prefixos RadixAttention.
- **NVIDIA TensorRT-LLM**Navio Medusa cabeças e árvores EAGLE como dois modos de serviço distintos com núcleos sintonizados para a atenção estruturada em árvore.
- **Reference drafts**: A família Llama 3 embarca um projecto 1B compatível com os pontos de controlo 8B/70B/405B; a Qwen3 embarca um projecto 0,6B para o alvo 32B.
- **Medusa**(Cai et al., 2024) é a alternativa implementável quando você não pode pagar um esboço separado: K previsão cabe no próprio alvo, treinado através de auto-distilação.
- **Lookahead decoding**(Fu et al., 2024) é livre de esboço  reutiliza n-gramas gerados pelas próprias iterações anteriores do Jacobi do alvo e as verifica.

## Envia-o

Esta lição produz`outputs/skill-spec-decoder.md` uma habilidade que assume um perfil de carga de trabalho ( tamanho do modelo-alvo, mistura de tarefas, temperatura, tamanho do lote, motor de serviço) e recomenda uma configuração de decodificação especulativa (modelo de projeto, K, largura da árvore, política de temperatura e se voltar a decodificar simplesmente).

## Exercícios

1. **Exactness under mismatch.**Descolar deliberadamente o esboço (por exemplo, descolar suas probabilidades) e reexercer o teste de distância de TV. Verifique se a saída ainda corresponde à amostragem de alvo comum dentro da tolerância empírica.

2. **Find the optimal K.**Para α ∈ {0,5, 0,6, 0,7, 0,8, 0,9}, encontre o K que maximiza `(1 - α^{K+1}) / (1 - α) / (K · cost_draft + cost_target)`- Supondo que`cost_draft / cost_target ∈ {0.05, 0.1, 0.2}`- Trama.

3. **Tree vs chain.**Extensão`main.py`Assim, o rascunho emite os dois ramos superiores em cada uma das profundidades D. Construa a máscara de atenção da árvore como uma matriz adjacente; verifique se o `target`aceita o caminho correto mais longo e que a distribuição de saída ainda é exatamente p.

4. **Temperature collapse.**Esvaziar a temperatura de 0,1 a 2,0 no esboço e no alvo. Medir α em cada configuração. Reproduzir o colapso que motiva "não especular em T ≥ 1,0 para a escrita criativa".

5. **Draft training stub.**Na distribuição dos brinquedos, ajuste o rascunho minimizando o KL ((alvo de desenho de desenho) com descida de gradiente sobre uma parametrização de softmax.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Target model | "The big model" | The slow high-quality model; samples from p |
| Draft model | "The speculator" | The small fast predictor; samples from q; 5–30× smaller |
| K (draft length) | "Lookahead" | Number of speculated tokens per verify pass |
| α (acceptance rate) | "Hit rate" | Per-token probability the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that keeps the overall sample distributed as p |
| Residual distribution | "Corrected p − q" | max(p − q, 0) / ||max(p − q, 0)||₁ — sampled on rejection |
| Bonus token | "Free sample" | Extra token drawn from p after all K proposals accepted |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates verified in one pass |
| Tree attention mask | "Topological mask" | Causal mask encoding tree topology; each node attends only to ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target; no separate draft |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is the target's last hidden state, not raw tokens |
| Multi-layer feature fusion | "EAGLE-3 trick" | Draft conditions on features from several target layers, not just the top |
| Direct token prediction | "EAGLE-3 head" | EAGLE-3's draft predicts tokens, not features, fixing the scaling cliff |

## Mais leitura

- [Leviathan, Kalai, Matias — "Fast Inference from Transformers via Speculative Decoding" (ICML 2023)](https://arxiv.org/abs/2211.17192) a regra exata de rejeição e a análise de aceleração.
- [Chen, Borgeaud, Irving et al. — "Accelerating Large Language Model Decoding with Speculative Sampling" (DeepMind 2023)](https://arxiv.org/abs/2302.01318) a derivação simultânea de DeepMind.
- [Cai, Li, Geng, Peng, Lee, Chen, Dao — "Medusa" (2024)](https://arxiv.org/abs/2401.10774) cabeças paralelas alternativas a um modelo de projecto.
- [Li, Wei, Zhang, Zhang — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty" (ICML 2024)](https://arxiv.org/abs/2401.15077) recurso de reutilização mais elaboração de árvores.
- [Li, Wei, Zhang, Zhang — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees" (EMNLP 2024)](https://arxiv.org/abs/2406.16858) topologia dinâmica de árvores.
- [Li, Wei, Zhang, Zhang — "EAGLE-3: Scaling up Inference Acceleration via Training-Time Test" (NeurIPS 2025)](https://arxiv.org/abs/2503.01840)Previsão direta de tokens mais fusão de recursos de várias camadas.
- [Fu, Bailis, Stoica, Zhang — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding" (ICML 2024)](https://arxiv.org/abs/2402.02057) Jacobi/lookahead, a alternativa livre de esboços.
- [Rodionov et al. — "Hogwild! Inference: Parallel LLM Generation via Concurrent Attention" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2504.06261) uma alternativa paralelas ao decodificação especulativa.
- [Kumar, Dao, May — "Speculative Speculative Decoding" (ICLR 2026)](https://arxiv.org/abs/2603.03251) sobreposição do projecto de especulação com a própria verificação.
- [Oliaro et al. — "SuffixDecoding" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2411.04975) desenho de árvore de sufixo que se hibrida com EAGLE-3 para 2,5× no Spec-Bench.
