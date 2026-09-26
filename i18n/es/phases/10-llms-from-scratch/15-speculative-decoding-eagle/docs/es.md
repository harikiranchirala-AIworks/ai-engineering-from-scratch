# Descifrado especulativo y EAGLE-3

> El decodificación está ligada a la memoria. Un modelo 70B pasa la mayor parte de un pase hacia adelante esperando que los pesos salgan de HBM, produciendo un token al final de un ~70 ms de espera. Leviathan, Kalai, Matias (2023) mostraron que se puede dejar que un modelo de borrador diminuto adivinar los siguientes tokens K, verificarlos en un pase hacia adelante de modelo grande, y aceptar el prefijo correcto más largo  con una equivalencia probada exactamente a la muestreo del objetivo. EAGLE-3 (Li et al., NeurIPS 2025) empuja el promedio de tokens aceptados por verificación a ~ 4,65 en Spec-Bench, aproximadamente un 2,4 × de velocidad del reloj de pared en la distribución de salida coincidente.

**Type:** Build
**Languages:** Python (stdlib only)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## El problema

El decodificación autoregressiva es el centro de costo de la producción LLM. Cada token es un pase hacia adelante, y el pase hacia adelante está dominado por la lectura de la matriz de peso completo de HBM  no por aritmética. En un H100 que decodifica un modelo 70B BF16, ~ 280 GB de pesos tienen que pasar por las unidades de cálculo para producir un token.

No se puede reducir el modelo sin cambiar su distribución. No se puede hacer la memoria más rápida. El único botón restante es la proporción de tokens producidos por pase hacia adelante.

La descifrado especulativo explota una ineficiencia específica: el decodificador pasa *memoria-ligado*, por lo que una vez que se han transmitido los pesos más allá de las unidades de cálculo que tiene una capacidad aritmética ociosa significativa. Un pequeño modelo de borrador que adivina 4 tokens cuesta casi nada en comparación con un pase de destino hacia adelante. Si la mayoría de sus suposiciones son correctas, amortiza un peso leído en múltiples tokens  y lo hace sin tocar la distribución de salida del objetivo.

El diagrama en `assets/speculative-decoding.svg`muestra la línea completa: la cadena de pasos K del borrador, el único pase de verificación del objetivo, el bucle de izquierda a derecha de aceptación/rechazo, la muestra residual en el primer rechazo y el token de bonificación en la aceptación completa. Mantén abierto mientras lees la siguiente sección.

## El concepto

### La configuración de dos modelos

- **Target**M_p: el modelo lento de alta calidad. Distribución p. Esto es lo que queremos muestras de.
- **Draft**M_q: un pequeño predictor rápido. Distribución q. Típicamente 530 veces más pequeño que el objetivo.

Por paso especulativo, en la posición t:

1. El borrador genera tokens K autoregresivamente: x_1, ..., x_K ~ q.
2. El objetivo corre .**one forward pass**sobre las posiciones K + 1 y devuelve p                                                                                                                                                                                                                                                          
3. Una regla de aceptación/rechazo consume los tokens redactados de izquierda a derecha, aceptando el prefijo de coincidencia más largo y repetiendo de una distribución corregida en el primer rechazo o tomando un token objetivo de bonificación con muestra si todos los K son aceptados.

Si el borrador coincide perfectamente con el objetivo, se producen tokens K + 1 por objetivo hacia adelante. Si el borrador está equivocado en la posición 1, todavía se produce exactamente 1 token. Nunca se produce menos de un token por verificación.

### La regla de exactitud (Leviathan et al., 2023)

El truco es una prueba de muestreo de rechazo modificada que conserva p exactamente. Para cada token redactado x_k con probabilidad de proyecto q(x_k) y probabilidad de objetivo p(x_k):

```
r ~ Uniform(0, 1)
if r < p(x_k) / q(x_k):
    accept x_k
else:
    sample replacement ~ residual(x) = max(p(x) - q(x), 0) / ||max(p - q, 0)||_1
    stop
```

Cuando p = q la probabilidad de aceptación es 1. Cuando p ≠ q la muestra rechazada proviene del residual de la parte positiva, que es exactamente la masa que p tiene que q no cubre. Combinando las dos ramas se da una muestra extraída de p por construcción  sin sesgo, sin factor de corrección, sin hackeo de temperatura.

La especialización codiciosa es más simple: acepta si y sólo si`argmax(p) == x_k`, de otro modo emitir`argmax(p)`y detenerse.

### Aceleración esperada

Si la probabilidad de aceptación por token es α (media sobre posiciones), el número esperado de tokens por pase a futuro objetivo es:

```
E[tokens per verify] = (1 - α^{K+1}) / (1 - α)
```

En α = 0,8 y K = 4, eso es 3,36 tokens por objetivo hacia adelante. Un decodo simple produce 1 token por objetivo hacia adelante, por lo que el aumento de velocidad del techo es 3,36 ×  menos el costo de los pasos del borrador K, lo que es insignificante cuando el costo  ≫ K · costo  borrador).

El único parámetro real es α. Un buen borrador es todo.

Valores de ejemplo en K = 4:

| α    | E[tokens per verify] | Ceiling speedup |
|------|----------------------|-----------------|
| 0.50 | 1.94                 | 1.94×           |
| 0.70 | 2.83                 | 2.83×           |
| 0.80 | 3.36                 | 3.36×           |
| 0.90 | 4.10                 | 4.10×           |

Aumentar el K más allá de 68 rara vez ayuda:`α^{K+1}`Los términos se componen geométricamente, y cada paso extra de la borrador añade una latencia de serie que no se puede ocultar.

### Formación del proyecto: destilación

Un modelo pequeño al azar hace un borrador malo. La receta estándar es destilar el borrador contra la distribución de salida del objetivo:

1. Elija un pequeño proyecto de arquitectura compartiendo el tokenizer del objetivo.
2. Envía el objetivo a un gran corpus, almacena sus siguientes tokens.
3. Entrenar el borrador con la divergencia KL contra esas distribuciones almacenadas, no contra las etiquetas de verdad.

Las tasas de aceptación de producción caen en 0,60.8 para el chat, 0,70.85 para el código, y caen drásticamente para la escritura creativa a alta temperatura.

### EL ÁGuila: reutilización de las características y dibujo de árboles

Li, Wei, Zhang, Zhang (2024, "EGLE") hicieron dos observaciones. En primer lugar, un proyecto de modelo re-deriva un objetivo ya calculado durante su última verificación  El estado oculto final del objetivo es una previsión comprimida del siguiente token y se puede introducir directamente en el proyecto. En segundo lugar, una cadena lineal de tokens de proyecto K elimina el paralelismo barato: el proyecto podría producir un árbol de candidatos, y el único pase de verificación del objetivo puede verificar todas las ramas en paralelo utilizando una máscara de atención en forma de árbol, luego aceptar el camino correcto más largo.

EAGLE-1 hace que el borrador sea una sola capa de decodificador de transformador cuya entrada es el último estado oculto del objetivo más el último token emitido. EAGLE-2 (EMNLP 2024) agrega un árbol dinámico que crece más ancho donde el borrador es incierto y se mantiene estrecho donde es seguro.

EAGLE-3 (NeurIPS 2025, arXiv:2503.01840) reemplaza la predicción de características con predicción de tokens directos y fusiona características de múltiples capas del objetivo  que elimina el cuello de botella de información que limita a EAGLE-1/2 cuando los datos de entrenamiento se escalan.

### Verificación de la atención al árbol

Cuando el borrador emite un árbol, el objetivo verifica cada nodo en un solo paso hacia adelante cambiando su máscara de atención de "estrictamente triangular inferior sobre la línea" a "estrictamente triangular inferior sobre la topología del árbol".

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

Si ...`a,b`están compitiendo los primeros candidatos y `c,d,e,f`Las posiciones de salida son continuas, todas las seis posiciones se verifican en un solo pase hacia adelante; la salida es el prefijo más largo a lo largo de cualquier camino aceptado.

### Cuando gana, cuando no gana

**Wins**: código, salidas estructuradas, chat común  alto α, masa de vocablas pequeña donde el borrador y el objetivo no coinciden.

**Loses**El sistema de escritura creativa a temperatura ≥ 1,0, donde α se desploma hacia la 1/ del desdoblamiento y el proyecto de gastos generales domina.

Las tiendas de producción informan 23× en el chat, 35× en el código, casi cero en la escritura creativa.

## Construye el mismo

Los enviados .`code/main.py`es sólo de uso exclusivo y opera en **toy discrete distributions**(tamaño de vocabulario 16) así que la matemática es visible sin un tokenizer o una GPU. Implementa:

1. ¿ Qué es esto ?`target`Distribución y un perturbado`draft`distribución en una vocabulario compartida, ambos construidos a partir de semillas fijas para su reproducción.
2. `speculative_step(target_dists, draft_model, prefix, K)` una ronda de muestreo Leviathan. El borrador propone tokens K; el objetivo da p en cada posición redactada; el bucle de aceptación/rechazo se ejecuta de izquierda a derecha; el residual se calcula al rechazar; la muestra de bonificación se toma al aceptar completamente.
3. Una prueba de equivalencia de distribución: ejecuta la descifrado especulativo N=200k veces y muestreo objetivo simple N=200k veces, cubra el token de salida en la posición 0, y asegure la distancia de variación total < 0.01. Esta es la verificación de exactitud empírica del documento 2023 es famoso por.
4. Un informe de forma cerrada α-vs-velocidad que va α ∈ {0.5, 0.7, 0.9} × K ∈ {1...8} y imprime las fichas esperadas por superficie de verificación.
5. Un contador de tasa de aceptación por posición para que pueda ver α deriva a medida que crece el prefijo.

- ¿Qué quieres decir ?

```
python3 code/main.py
```

Producción esperada: una tabla de tasa de aceptación, una línea de distancia de televisión (`TV = 0.0034`-ish en la semilla predeterminada), la superficie de aceleración y un `PASS`La carrera completa en menos de un segundo.

## Usalo

- **vLLM**expone la descifrado especulativo como una configuración de primera clase.`--speculative-model <draft>`y `--num-speculative-tokens K`añadir `--speculative-draft-tensor-parallel-size`Cuando el proyecto es GPU-residente. EAGLE-3 es compatible a través de la`--speculative-method eagle3`rama en v0.7+.
- **SGLang**Los buques EAGLE-2 y EAGLE-3 soportan y los compone con el caché de prefijos de RadixAttention.
- **NVIDIA TensorRT-LLM**Los barcos Medusa cabezas y árboles EAGLE como dos modos de servicio distintos con núcleos sintonizados para la atención estructurada en árboles.
- **Reference drafts**: La familia Llama 3 envía un proyecto 1B compatible con los puestos de control 8B/70B/405B; Qwen3 envía un proyecto 0,6B para el objetivo 32B.
- **Medusa**(Cai et al., 2024) es la alternativa desplegable cuando no se puede pagar un borrador separado: K predicción cabezas en el objetivo mismo, entrenado a través de la auto-distilación.
- **Lookahead decoding**(Fu et al., 2024) es libre de borrador  reutiliza n-gramas generados por las propias iteraciones anteriores de Jacobi del objetivo y los verifica. Funciona mejor cuando la salida ha repetido frases (código, salidas estructuradas).

## Envío

Esta lección produce`outputs/skill-spec-decoder.md` una habilidad que toma un perfil de carga de trabajo (tamaño del modelo objetivo, mezcla de tareas, temperatura, tamaño de lote, motor de servicio) y recomienda una configuración de decodificación especulativa (modelo de proyecto, K, ancho del árbol, política de temperatura y si volver a decodificar en forma simple).

## Los ejercicios

1. **Exactness under mismatch.**Desajuste deliberadamente el borrador (por ejemplo, desvirtuar sus probabilidades) y volver a ejecutar la prueba de distancia de televisión. Verifique si la salida todavía coincide con la muestreo objetivo en la tolerancia empírica. Esto es lo que la regla de rechazo le compra.

2. **Find the optimal K.**Para α ∈ {0,5, 0.6, 0.7, 0.8, 0.9}, encuentra el K que maximiza `(1 - α^{K+1}) / (1 - α) / (K · cost_draft + cost_target)`suponiendo`cost_draft / cost_target ∈ {0.05, 0.1, 0.2}`- La trama.

3. **Tree vs chain.**Extenderse`main.py`Así que el borrador emite las ramas superiores 2 en cada una de las profundidades de D. Construir la máscara de atención de árbol como una matriz adyacente; verificar que la `target`acepta el camino correcto más largo y que la distribución de salida es todavía exactamente p.

4. **Temperature collapse.**Especular la temperatura de 0,1 a 2,0 en el borrador y el objetivo. Medir α en cada configuración. Reproducir el colapso que motiva "no especular en T ≥ 1,0 para la escritura creativa".

5. **Draft training stub.**En la distribución de juguetes, ajuste el borrador minimizando el KL ((bordo de la meta) con descenso de gradiente sobre una parametrización de la máxima suave.

## Términos clave

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

## Leer más

- [Leviathan, Kalai, Matias — "Fast Inference from Transformers via Speculative Decoding" (ICML 2023)](https://arxiv.org/abs/2211.17192) la regla exacta de rechazo y el análisis de aceleración.
- [Chen, Borgeaud, Irving et al. — "Accelerating Large Language Model Decoding with Speculative Sampling" (DeepMind 2023)](https://arxiv.org/abs/2302.01318) la derivación simultánea de DeepMind.
- [Cai, Li, Geng, Peng, Lee, Chen, Dao — "Medusa" (2024)](https://arxiv.org/abs/2401.10774) cabezas paralelas alternativas a un modelo de proyecto.
- [Li, Wei, Zhang, Zhang — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty" (ICML 2024)](https://arxiv.org/abs/2401.15077) Reutilización de las características más elaboración de árboles.
- [Li, Wei, Zhang, Zhang — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees" (EMNLP 2024)](https://arxiv.org/abs/2406.16858) topología dinámica de árboles.
- [Li, Wei, Zhang, Zhang — "EAGLE-3: Scaling up Inference Acceleration via Training-Time Test" (NeurIPS 2025)](https://arxiv.org/abs/2503.01840) predicción directa de tokens más fusión de características de múltiples capas.
- [Fu, Bailis, Stoica, Zhang — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding" (ICML 2024)](https://arxiv.org/abs/2402.02057) Jacobi/lookahead, la alternativa libre de proyectos.
- [Rodionov et al. — "Hogwild! Inference: Parallel LLM Generation via Concurrent Attention" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2504.06261) una alternativa paralela a la descodificación especulativa.
- [Kumar, Dao, May — "Speculative Speculative Decoding" (ICLR 2026)](https://arxiv.org/abs/2603.03251) superposición de proyectos de especulación con la propia verificación.
- [Oliaro et al. — "SuffixDecoding" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2411.04975) la redacción de árbol de sufijo que se hibrida con EAGLE-3 para 2.5x en Spec-Bench.
