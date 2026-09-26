# Décodage spéculatif et EAGLE-3

> Le décodeur est lié à la mémoire. Un modèle 70B passe la plupart d'un passage avant en attendant que les poids sortent de HBM, produisant un jeton à la fin d'un ~70 ms d'attente. Leviathan, Kalai, Matias (2023) ont montré que vous pouvez laisser un petit modèle de projet deviner les prochains jetons K, les vérifier dans un large modèle passer à l'avant, et accepter le plus long préfixe correct  avec une équivalence prouvablement exacte à l'échantillonnage de la cible. EAGLE-3 (Li et al., NeurIPS 2025) pousse la moyenne des jetons acceptés par vérification à ~ 4,65 sur Spec-Bench, soit environ 2,4 fois plus rapide que le temps de la montre murale sur la distribution de sortie correspondante.

**Type:** Build
**Languages:** Python (stdlib only)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## Le problème

Le décoding autorégressif est le centre de coûts de la production LLM. Chaque jeton est un passage avant, et le passage avant est dominé par la lecture de la matrice de poids complet hors HBM  et non par l'arithmétique. Sur un H100 décoding un modèle 70B BF16, ~ 280 GB de poids doivent passer au-delà des unités de calcul pour produire un jeton. À 3,35 TB / s bande passante mémoire qui est d'environ 83 ms de sol, indépendante du calcul.

Vous ne pouvez pas réduire le modèle sans modifier sa distribution. Vous ne pouvez pas rendre la mémoire plus rapide. Le seul bouton restant est le ratio de jetons produits par passe avant.

Le décoding spéculatif exploite une inefficacité spécifique: le décodage est *mémoire-lié*, donc une fois que vous avez diffusé les poids au-delà des unités de calcul, vous avez une capacité arithmétique inutile significative. Un petit modèle de projet qui devine 4 jetons coûte presque rien par rapport à un passe-avenir cible. Si la plupart de ses suppositions sont correctes, vous amortez un poids lu sur plusieurs jetons  et vous le faites sans toucher la distribution de sortie de la cible.

Le schéma à `assets/speculative-decoding.svg`montre le pipeline complet: la chaîne de K-étape du projet, le passage unique de vérification de la cible, la boucle accept/rejet de gauche à droite, l'échantillon résiduel lors du premier rejet et le jeton bonus lors de l'acceptation complète. Gardez ouvert pendant la lecture de la section suivante.

## Le concept

### L'installation de deux modèles

- **Target**M_p: le modèle lent de haute qualité. Distribution p. C'est ce dont nous voulons des échantillons.
- **Draft**M_q: un petit prédicteur rapide. Distribution q. Typiquement 530x plus petit que la cible.

Par étape spéculative, à la position t:

1. Le projet génère des jetons K autorégressivement: x_1, ..., x_K ~ q.
2. La cible s' enfuit .**one forward pass**sur les positions K + 1 et retourne p                                                                                                                                                                                                                                                          
3. Une règle d'acceptation/déni consomme les jetons rédigés de gauche à droite, en acceptant le préfixe correspondant le plus long et soit en reprenant le modèle d'une distribution corrigée lors du premier rejet, soit en prenant un jeton cible bonus avec échantillon si tous les K sont acceptés.

Si le projet correspond parfaitement à la cible, vous produisez des jetons K + 1 par cible à l'avenir. Si le projet est erroné à la position 1, vous produisez toujours exactement 1 jeton. Vous ne produisez jamais moins d'un jeton par vérification.

### La règle de précision (Leviathan et coll., 2023)

Le truc est un test de rejet modifié qui préserve exactement p. Pour chaque jeton élaboré x_k avec probabilité de projet q(x_k) et probabilité cible p(x_k):

```
r ~ Uniform(0, 1)
if r < p(x_k) / q(x_k):
    accept x_k
else:
    sample replacement ~ residual(x) = max(p(x) - q(x), 0) / ||max(p - q, 0)||_1
    stop
```

Lorsque p = q la probabilité d'acceptation est 1. Lorsque p ≠ q l'échantillon rejeté provient du résiduel de la partie positive, qui est exactement la masse p que q a échoué à couvrir.

La spécialité avide est plus simple: accepter si et seulement si `argmax(p) == x_k`, émettront autrement`argmax(p)`et arrête.

### Accélération prévue

Si la probabilité d'acceptation par jeton est α (moyenne sur les positions), le nombre attendu de jetons par passe à terme cible est:

```
E[tokens per verify] = (1 - α^{K+1}) / (1 - α)
```

À α = 0,8 et K = 4, c'est 3,36 jetons par cible en avant. Un décode simple produit 1 jeton par cible en avant, de sorte que la vitesse de plafond est de 3,36 ×  moins le coût des étapes de projet K, ce qui est négligeable lorsque le coût (cible) ≫ K · coût (drafts).

Le seul vrai paramètre est α. Un bon projet est tout.

Les valeurs d'exemple à K = 4:

| α    | E[tokens per verify] | Ceiling speedup |
|------|----------------------|-----------------|
| 0.50 | 1.94                 | 1.94×           |
| 0.70 | 2.83                 | 2.83×           |
| 0.80 | 3.36                 | 3.36×           |
| 0.90 | 4.10                 | 4.10×           |

Le fait d' élever K au-delà de 68 aide rarement:`α^{K+1}`chaque étape supplémentaire ajoute une fréquence de latence sérielle que vous ne pouvez pas cacher.

### Formation du projet: distillation

Un modèle aléatoire fait un mauvais projet.

1. Choisissez un petit projet d'architecture partageant le jeton de la cible.
2. Faites passer la cible sur un corpus de données, stockez ses distributions de jetons suivants.
3. Trainer le projet avec KL divergence contre ces distributions stockées, pas contre les étiquettes de vérité de fond.

Les taux d'acceptation de la production se situent à 0,60,8 pour le chat, 0,70,85 pour le code, et tombent fortement pour l'écriture créative à haute température.

### L'AIGLE: réutilisation des caractéristiques et dessin d'arbres

Li, Wei, Zhang, Zhang (2024, "AIGLE") ont fait deux observations. Premièrement, un modèle de dérivé de projet séparé présente la cible déjà calculée lors de sa dernière vérification  l'état caché final de la cible est une prévision comprimée du prochain jeton et peut être introduite directement dans le projet. Deuxièmement, une chaîne linéaire de jetons de projet K jette un parallélisme bon marché: le projet pourrait produire un *arbre* de candidats, et le passe de vérification unique de la cible peut vérifier toutes les branches parallèlement en utilisant un masque d'attention en forme d'arbre, puis accepter le plus long chemin correct.

EAGLE-1 fait du projet une couche de décodeur de transformateur unique dont l'entrée est l'état caché ultime de la cible plus le dernier jeton émis. EAGLE-2 (EMNLP 2024) ajoute un arbre dynamique qui pousse plus large où le projet est incertain et reste étroit où il est sûr.

EAGLE-3 (NeurIPS 2025, arXiv:2503.01840) remplace la prédiction de fonctionnalités par la prédiction directe des jetons et fusionne les fonctionnalités de plusieurs couches de la cible  qui élimine le goulot d'étranglement d'information qui limite EAGLE-1/2 lorsque les données de formation sont augmentées.

### Vérification de l'attention portée aux arbres

Lorsque le projet émet un arbre, la cible vérifie chaque nœud dans un seul passage vers l'avant en changeant son masque d'attention de "strictement triangulaire inférieur sur la ligne" à "strictement triangulaire inférieur sur la topologie de l'arbre". Chaque nœud ne s'occupe que de ses ancêtres.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

Si vous`a,b`sont les premiers candidats à la compétition et `c,d,e,f`sont des continuations, toutes les six positions sont vérifiées en une seule passe vers l'avant; la sortie est le préfixe le plus long le long de tout chemin accepté.

### Quand il gagne, quand il ne gagne pas

**Wins**: code, sorties structurées, chat commun  haute α, petite masse vocabulaire où le projet et la cible ne sont pas d'accord.

**Loses**: écriture créative à température ≥ 1,0, où α s'effondre vers le 1/ du volet de décharge et où le dépôt de frais généraux domine.

Les magasins de production rapportent 23x sur le chat, 35x sur le code, presque zéro sur l'écriture créative.

## Faites-le

Les expéditeurs .`code/main.py`est stdlib- seulement et fonctionne sur **toy discrete distributions**(taille de vocabulaire 16) donc les mathématiques sont visibles sans un tokenizer ou un GPU.

1. Une .`target`La distribution et une perturbation`draft`La distribution sur un vocabulaire commun, tous deux construits à partir de graines fixes pour la reproductibilité.
2. `speculative_step(target_dists, draft_model, prefix, K)` une ronde de prélèvement d'échantillons Leviathan. Le projet propose des jetons K; la cible donne p à chaque position rédigée; la boucle accepter/rejeter se déroule de gauche à droite; le résidu est calculé lors du rejet; l'échantillon bonus est pris lors de l'acceptation complète.
3. Un test d'équivalence de distribution: exécuter le décoding spéculatif N=200k fois et le prélèvement d'échantillons cibles simples N=200k fois, mettre le jeton de sortie à la position 0, et affirmer la distance de variation totale < 0,01.
4. Un rapport de forme fermée α-vs-speedup qui marche α ∈ {0,5, 0,7, 0,9} × K ∈ {1...8} et imprime les jetons attendus par surface de vérification.
5. Un compteur de taux d'acceptation par position afin que vous puissiez voir α dérive à mesure que le préfixe augmente.

Je vais courir .

```
python3 code/main.py
```

Expérience de sortie: table des taux d'acceptation, ligne télévisée (`TV = 0.0034`-ish sur la semence par défaut), la surface de rappel et un`PASS`La course se termine en moins d'une seconde.

## Utilisez-le

- **vLLM**Le code de déchiffrement est une configuration de première classe.`--speculative-model <draft>`et `--num-speculative-tokens K`; ajouter `--speculative-draft-tensor-parallel-size`L'Eagle-3 est pris en charge via le `--speculative-method eagle3`branche dans v0.7+.
- **SGLang**Les navires EAGLE-2 et EAGLE-3 sont pris en charge et sont composés de radixAttention préfixe de mise en cache.
- **NVIDIA TensorRT-LLM**Les navires de Medusa et les arbres d'EAGLE sont deux modes de service distincts avec des noyaux réglés pour une attention structurée par les arbres.
- **Reference drafts**: La famille Llama 3 envoie un projet 1B compatible avec les points de contrôle 8B/70B/405B; Qwen3 envoie un projet 0,6B pour la cible 32B.
- **Medusa**(Cai et coll., 2024) est l'alternative déployable lorsque vous ne pouvez pas vous permettre un projet séparé: K prédiction se dirige sur la cible elle-même, formé par l'auto-distillation.
- **Lookahead decoding**(Fu et al., 2024) est sans projet  il réutilise n-grammes générés par les propres itérations Jacobi précédentes de la cible et les vérifie.

## La faire partir

Cette leçon produit `outputs/skill-spec-decoder.md` une compétence qui prend un profil de charge de travail (taille du modèle cible, mix de tâches, température, taille de lot, moteur de service) et recommande une configuration de décoding spéculative (modèle de projet, K, largeur de l'arbre, politique de température et si la décoding normale est nécessaire).

## Exercices

1. **Exactness under mismatch.**Délibérément, désactiver le projet (par exemple, scrambler ses probabilités) et réinitialiser le test de distance télévisée. Vérifiez que la sortie correspond toujours à l'échantillonnage de cible dans la tolérance empirique.

2. **Find the optimal K.**Pour α ∈ {0,5, 0,6, 0,7, 0,8, 0,9}, trouvez le K qui maxime `(1 - α^{K+1}) / (1 - α) / (K · cost_draft + cost_target)`en supposant`cost_draft / cost_target ∈ {0.05, 0.1, 0.2}`- Une intrigue.

3. **Tree vs chain.**Extension `main.py`Ainsi, le projet émet les branches supérieures 2 à chacune des profondeurs D. Construisez le masque d'attention de l'arbre comme une matrice d'adjacence; vérifiez que le `target`accepte le chemin le plus long et que la distribution de sortie est toujours exactement p.

4. **Temperature collapse.**• La température de la feuille de calcul est de 0,1 à 2,0 dans le projet et la cible. Mesurer α à chaque réglage. Reproduire l'effondrement qui motive "ne spécule pas à T ≥ 1,0 pour l'écriture créative".

5. **Draft training stub.**Sur la distribution des jouets, ajustez le projet en minimisant le KL ((target draw draw) avec une baisse de gradient sur une paramétrisation de softmax.

## Les termes clés

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

## Pour en savoir plus

- [Leviathan, Kalai, Matias — "Fast Inference from Transformers via Speculative Decoding" (ICML 2023)](https://arxiv.org/abs/2211.17192) la règle exacte de rejet et l'analyse de l'accélération.
- [Chen, Borgeaud, Irving et al. — "Accelerating Large Language Model Decoding with Speculative Sampling" (DeepMind 2023)](https://arxiv.org/abs/2302.01318) la dérivée simultanée de DeepMind.
- [Cai, Li, Geng, Peng, Lee, Chen, Dao — "Medusa" (2024)](https://arxiv.org/abs/2401.10774) des têtes parallèles alternatives à un modèle de projet.
- [Li, Wei, Zhang, Zhang — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty" (ICML 2024)](https://arxiv.org/abs/2401.15077) réutilisation des caractéristiques plus la rédaction d'arbres.
- [Li, Wei, Zhang, Zhang — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees" (EMNLP 2024)](https://arxiv.org/abs/2406.16858) topologie dynamique des arbres.
- [Li, Wei, Zhang, Zhang — "EAGLE-3: Scaling up Inference Acceleration via Training-Time Test" (NeurIPS 2025)](https://arxiv.org/abs/2503.01840) prédiction directe de jetons plus fusion de fonctionnalités multicouches.
- [Fu, Bailis, Stoica, Zhang — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding" (ICML 2024)](https://arxiv.org/abs/2402.02057) Jacobi/lookahead, l'alternative sans projet.
- [Rodionov et al. — "Hogwild! Inference: Parallel LLM Generation via Concurrent Attention" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2504.06261) une alternative parallèle aux travailleurs au décoding spéculatif.
- [Kumar, Dao, May — "Speculative Speculative Decoding" (ICLR 2026)](https://arxiv.org/abs/2603.03251) superposition des projets de spéculation avec la vérification elle-même.
- [Oliaro et al. — "SuffixDecoding" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2411.04975) rédaction de suffixe-arbre qui s'hybride avec EAGLE-3 pour 2,5x sur Spec-Bench.
