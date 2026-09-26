# 投机解码和3

> 解码是记忆的. 一个70B模型大部分时间都在等待重量从HBM中流出,在等待70ms结束时产生一个代币. 利维亚坦,卡莱,马蒂亚斯 (2023) 显示,你可以让一个小的草稿模型猜测下一个K代码,在一个大模型前进传递中验证它们,并接受最长的正确前,具有可证明的准确等效率. 根据Eagle-3 (Li等等,NeurIPS 2025) 的数据,每次验证的平均接受代币达到4.65分,大约在匹配的输出分布上增加2.4倍的墙钟速度.

**Type:** Build
**Languages:** Python (stdlib only)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## 问题

电脑系统的重量解码是生产LLM服务的成本中心.每个代币是一个前进传递,而前进传递由读取HBM 的全重矩阵而不是算术主导.在70B BF16模型的H100解码上,约280GB的重量必须通过计算单位流出,才能产生一个代币.在3.35TB/s的内存带宽约为83ms地板,独立于计算.

没有改变分布的模型,你不能缩小模型.你不能更快地提升内存.唯一剩下的是每次前传输产生的代币比例.

投机解码利用了特定的效率低下:解码传递是*记忆绑定*,因此,一旦你通过计算单位流传权重,你就会有显著的空虚算术能力. 预测4个代币的小草案模型几乎不花费一笔目标前进. 如果大多数猜测是正确的,你将一个重量读取在多个代币中,

图表`assets/speculative-decoding.svg`显示完整的图案:草案的K-步骤链,目标的单个验证通过,左到右的接受/拒绝循环,第一次拒绝的残余样本,以及完全接受的奖金代币. 在阅读下一节时保持开放.

## 概念

### 两种模式的设置

- **Target**快速的高质量模型. 分布 p. 这就是我们想要的样本.
- **Draft**分布 q. 通常比目标小530倍.

按投机步骤,在位置t:

1. 草稿以自行降级方式生成K代码:x_1, ...,x_K ~ q.
2. 目标是逃跑的**one forward pass**在 K+1 位置上,返回 p                                                                                                                                                                                                                                                          
3. 接受/拒绝规则消耗了从左到右的起草代币,接受最长的匹配前,在第一次拒绝时从纠正的分布中重新样本化,或者如果所有K都被接受,则采用一个奖励目标样本代币.

如果草案完全匹配目标,你会产生K+1代币,每一个目标前进.如果草案在位置1上错误,你仍然会产生1代币.你永远不会产生不少于一个代币.

### 准确性规则 (Leviathan等, 2023)

技巧是修改的拒绝样本测试,以保持p精确.对于每一个草稿的代币 x_k,草稿概率 q(x_k) 和目标概率 p(x_k):

```
r ~ Uniform(0, 1)
if r < p(x_k) / q(x_k):
    accept x_k
else:
    sample replacement ~ residual(x) = max(p(x) - q(x), 0) / ||max(p - q, 0)||_1
    stop
```

当p=q时,接受概率为1. 当p≠q时,拒绝的样本来自正部分残余,这正是p的质量,q未能覆盖.结合两个分支,给出了从p的样本,结构没有偏见,没有校正因子,没有温度破裂.

贪的专业化更简单:接受如果,只有如果`argmax(p) == x_k`否则发射`argmax(p)`停止.

### 预期加速

如果每代币接受概率是 α (对位置平均),每次目标前进传递预期代币数量为:

```
E[tokens per verify] = (1 - α^{K+1}) / (1 - α)
```

在 α = 0.8 和 K = 4 的时,这相当于每一个目标前进的 3.36 个代币.一个平面解码产生每一个目标前进的 1 个代币,所以天花板加快是 3.36 × 减去K草案步骤的成本,这是成本标的成本.

只有一个真正的参数是 α. 一个好的草图是一切.

在K=4的示例值:

| α    | E[tokens per verify] | Ceiling speedup |
|------|----------------------|-----------------|
| 0.50 | 1.94                 | 1.94×           |
| 0.70 | 2.83                 | 2.83×           |
| 0.80 | 3.36                 | 3.36×           |
| 0.90 | 4.10                 | 4.10×           |

提高K超过68很少有帮助:`α^{K+1}`它们的数值在几何上,每一步增加一个连续延迟节奏,

### 培训项目:蒸

标准配方是根据目标的输出分布蒸草稿:

1. 选择一个小的设计图,分享目标的标记.
2. 运行目标在一个大体,存储其下一个代币分布.
3. 根据KL分歧,将草案训练与这些存储的分发,而不是与实质标签.

对于聊天,受收率降至0.60.8,对代码则降至0.70.8%,而对于高温的创意写作则大幅下降.

### :重用特征和树木绘制

李,韦,张,张 (2024,"") 进行了两项观察. 首先,一个单独的草案模型重新衍生了目标,该目标已经在最后一次验证期间计算出来. 其次,K草案代币的线性链会抛弃廉价的平行性:草案可以输出一个候选人*树,目标的单个验证通行可以通过树状注意力面具并行检查所有分支,然后接受最长的正确路径.

-1使草案成为一个单一的变压器解码器层,其输入是目标的最后隐藏状态加上最后发射的代币.-2 (EMNLP 2024) 添加了一个动态树,在草案不确定的地方生长更宽,而在确定的地方保持狭窄.

-3 (NeurIPS 2025, arXiv:2503.01840) 将功能预测取代了直接代币预测,并从目标的多层中融合了功能,在训练数据扩大时消除了限制EAGLE-1/2的信息瓶.

### 树木注意力验证

当草图发射树时,目标通过将注意力面具从"直线上严格下三角形"转换为"树顶点上严格下三角形".每个节点只关注其祖先.验证成本在树节点数量上增长,而不是深度,并且返回了最长的正确预测的根到叶路径.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

如果`a,b`竞争的第一名候选人`c,d,e,f`输出是任何接受的路径上最长的前.

### 当它赢得,当它不赢

**Wins**:代码,结构化输出,常见聊天 高 α,小语音质量,其中草案和目标不同意.

**Loses**创意写作在温度≥1.0时, α向1/2的口号调用处崩,草案上空费占主导地位.

制作商店在聊天上报道23×,在代码上报道35×,在创意写作上报道接近零.

## 建立它

它们被送往`code/main.py`仅使用Stdlib,并运行在**toy discrete distributions**算法可以看到的,没有代币器或GPU.

1. `target`的分布和的分布`draft`它们都由固定种子构成,以便可复制.
2. `speculative_step(target_dists, draft_model, prefix, K)`一轮利维亚坦采样.草案提出K代币;目标在每一个草案中位置给出p;接受/拒绝循环从左到右运行;在拒绝时计算残余;在完全接受时采集奖金样本.
3. 分布等效测试:运行投机解码N=200k次和平凡目标样本N=200k次,将输出代币放在0位置,并确认总变化距离 <0.01.这是2023年论文著名的实验精度检查.
4. 密封形式的 α-vs-speedup报告,行 α ∈ {0.5, 0.7, 0.9} × K ∈ {1...8},打印预期的每次验证表面的代币.
5. 随着前的增长,你可以看到 α 漂移.

运行:

```
python3 code/main.py
```

预期输出:接受率表,电视距离线 (`TV = 0.0034`速度升级表面,以及一个`PASS`整个比赛在不到一秒钟内结束.

## 用它

- **vLLM**通过 通过 通过 通过 通过 通过 通过 通过`--speculative-model <draft>`其他`--num-speculative-tokens K`加入`--speculative-draft-tensor-parallel-size`通过GPU支持EagLE-3的`--speculative-method eagle3`在v0.7+中的分支.
- **SGLang**支持EAGLE-2和EAGLE-3的船舶,并使用RadixAttention预写缓存.
- **NVIDIA TensorRT-LLM**作为两个不同的服务模式, 木头和树, 木结构的注意力.
- **Reference drafts**马3家族将1B草案发送,与8B/70B/405B检查站兼容;Qwen3为32B目标发送0.6B草案.
- **Medusa**(Cai et al., 2024) 是可部署的替代方案,当你无法支付单独的草案时:K预测头部在目标本身,通过自蒸训练.更简单地部署,略低于EAGLE.
- **Lookahead decoding**通过使用该数据,它可以使用本目标的先前Jacobi反复生成的 n-图,并验证它们.当输出中重复短语 (代码,结构化输出) 时,它最有效.

## 运送它

这一课产生了`outputs/skill-spec-decoder.md`一个技能,以工作负载的配置 (目标模型大小,任务组合,温度,批量大小,服务引擎) 并建议一个投机式解码配置 (草案模型,K,树宽,温度政策,是否回到平面解码).

## 运动

1. **Exactness under mismatch.**故意不匹配草案 (例如,乱其概率) 并再次运行电视距离测试. 检查输出仍然符合经验宽容内的普通目标样本. 这是拒绝规则购买你.

2. **Find the optimal K.**对于 α ∈ {0.5, 0.6, 0.7, 0.8, 0.9},求最大的 K`(1 - α^{K+1}) / (1 - α) / (K · cost_draft + cost_target)`假设`cost_draft / cost_target ∈ {0.05, 0.1, 0.2}`剧情.

3. **Tree vs chain.**延长时间`main.py`树的注意力面具作为一个邻立矩阵; 检查`target`接受最长正确的路径,并且输出分布仍然是正确的p.

4. **Temperature collapse.**扫描图和目标中的温度从0.1到2.0. 在每个设置中测量α. 复制导致"不要在T ≥1.0进行投机的崩".

5. **Draft training stub.**在玩具分布上,通过最小化KL (目标的图案) 调整,降梯度在软max参数化上.

## 关键词

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

## 进一步阅读

- [Leviathan, Kalai, Matias — "Fast Inference from Transformers via Speculative Decoding" (ICML 2023)](https://arxiv.org/abs/2211.17192)准确的拒绝规则和加快分析.
- [Chen, Borgeaud, Irving et al. — "Accelerating Large Language Model Decoding with Speculative Sampling" (DeepMind 2023)](https://arxiv.org/abs/2302.01318)来自深思维的同时衍生.
- [Cai, Li, Geng, Peng, Lee, Chen, Dao — "Medusa" (2024)](https://arxiv.org/abs/2401.10774)平行头替代草案模型.
- [Li, Wei, Zhang, Zhang — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty" (ICML 2024)](https://arxiv.org/abs/2401.15077)功能重复使用加上树木设计.
- [Li, Wei, Zhang, Zhang — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees" (EMNLP 2024)](https://arxiv.org/abs/2406.16858)动态树木拓.
- [Li, Wei, Zhang, Zhang — "EAGLE-3: Scaling up Inference Acceleration via Training-Time Test" (NeurIPS 2025)](https://arxiv.org/abs/2503.01840)直接预测代币加上多层功能融合.
- [Fu, Bailis, Stoica, Zhang — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding" (ICML 2024)](https://arxiv.org/abs/2402.02057) 雅可比/鲁卡赫德,无提名的替代品.
- [Rodionov et al. — "Hogwild! Inference: Parallel LLM Generation via Concurrent Attention" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2504.06261)一个平行工作者替代了投机解码.
- [Kumar, Dao, May — "Speculative Speculative Decoding" (ICLR 2026)](https://arxiv.org/abs/2603.03251)重叠投机草案与验证本身.
- [Oliaro et al. — "SuffixDecoding" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2411.04975)后树的编写,它与EAGLE-3混合为2.5×在Spec-Bench上.
