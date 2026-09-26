# İsteğe bağlı Çözümleme ve EAGLE-3

> Deşifreleme hafıza bağlanmış. 70B modeli, ağırlıkların HBM'den akışmasını bekleyen bir ileri geçişin büyük kısmını harcıyor ve ~70 ms bekleme sonunda bir token üretmektedir. Leviathan, Kalai, Matias (2023) küçük bir taslak modelinin bir sonraki K tokenlerini tahmin etmesine izin verebileceğini, onları bir büyük model ileri geçişinde doğrulayabileceğini ve en uzun doğru önlamayı  ile hedefliden örneklemeye doğru bir eşdeğerlik ile kabul edebileceğini gösterdi. EAGLE-3 (Li et al., NeurIPS 2025) Spec-Bench'de doğrulama başına ortalama kabul edilen tokenleri ~4.65'e doğru ilerler, yaklaşık olarak eşleşen çıkış dağılımında 2.4× duvar saat hızlandırması.

**Type:** Build
**Languages:** Python (stdlib only)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## Sorun

Autoregressive dekodlama, LLM servisinin maliyet merkezi olarak hizmet vermektedir. Her token bir ileri geçişi oluşturur ve ileri geçişi HBM 'den tam ağırlık matrisi okumayla egemen edilir. 70B BF16 modelinde H100 dekodlamasında, bir token üretmek için hesaplama birimlerinin ötesine ~280 GB ağırlık akmak zorundadır.

Modelin dağılımını değiştirmeden modelini küçültemezsin. Hatırayı daha hızlı yapamazsın.

Spekülatör dekodlama belirli bir verimsizlikten yararlanır: dekod geçiş * hafıza bağlıdır*, bu nedenle ağırlıkları hesap üniteleri üzerinden akışlattıktan sonra önemli bir boş aritmetik kapasiteye sahip olursunuz. 4 token tahmin eden küçük bir taslak modeli, bir hedef ileri geçişle karşılaştırıldığında neredeyse hiçbir şey masraf etmez. Eğer tahminlerinin çoğu doğruysa, bir ağırlığı bir çok tokenin üzerinde okuduklarını amortise edersiniz ve hedefin çıkış dağılımına dokunmadan yaparsınız.

Şekil:`assets/speculative-decoding.svg`projeyi K-adım zinciri, hedefin tek doğrulama geçişini, soldan sağa kabul/reddet döngüsünü, ilk reddedilme sırasında kalan örnek ve tam kabul sırasında bonus jetonu gösterir.

## Anlaşım

### İki modelli kurulum

- **Target**M_p: yavaş yüksek kaliteli model. dağıtım p.
- **Draft**M_q: küçük hızlı bir tahminci. dağılım q. Tipik olarak hedeften 530× daha küçük.

Tahminci adım başına, t pozisyonunda:

1. Tasarım, K jetonlarını autoregressiv olarak oluşturur: x_1, ..., x_K ~ q.
2. Hedef kaçıyor .**one forward pass**K + 1 pozisyonları üzerinde ve p                                                                                                                                                                                                                                                           
3. Kabul/Refut kuralı, yazılmış tokenleri soldan sağa tüketir, en uzun eşleşen prefiks kabul eder ve ya ilk reddedilme sırasında düzeltilmiş bir dağılımdan yeniden örnekleme yapar veya tüm K'ler kabul edilirse bir bonus hedef örneklenmiş token alır.

Eğer taslak hedefe mükemmel bir şekilde eşleşirse, hedefe ileride K + 1 jeton üretirsiniz. Eğer taslak pozisyon 1'de yanlışsa, yine de tam olarak 1 jeton üretirsiniz.

### Düzgünlük Kuralı (Leviathan et al., 2023)

Bu numune, p'yi tam olarak koruyan değiştirilmiş bir reddetme örneği testidir.

```
r ~ Uniform(0, 1)
if r < p(x_k) / q(x_k):
    accept x_k
else:
    sample replacement ~ residual(x) = max(p(x) - q(x), 0) / ||max(p - q, 0)||_1
    stop
```

P = q olduğunda kabul olasılığı 1. p ≠ q olduğunda reddedilen örnek pozitif-parçalanıktan gelir, bu da p'nin k'nin kapamadığı kütleyi tam olarak içerir. İki dalı birleştirmek, p'den yapım yoluyla alınan bir örnek verir  tarafsızlık, düzeltme faktörü, sıcaklık çatlaklığı yoktur.

Açgözlü uzmanlık daha basit: Eğer ve sadece eğer kabul edin.`argmax(p) == x_k`, başka türlü yayımlar`argmax(p)`Ve dur.

### Beklenen hızlanma

Eğer bir token için kabul olasılığı α ( pozisyonlar üzerinde ortalama) ise, hedef ileri geçiş başına beklenen token sayısı:

```
E[tokens per verify] = (1 - α^{K+1}) / (1 - α)
```

α = 0.8 ve K = 4'te, hedef ileri başına 3.36 token olur. Bir düz dekod, hedef ileri başına 1 token üretir, bu nedenle tavan hızlandırması 3.36 ×  K taslak adımlarının maliyetini eksik eder.

Tek gerçek parametre α. İyi bir taslak her şeydir.

K = 4'teki örnek değerler:

| α    | E[tokens per verify] | Ceiling speedup |
|------|----------------------|-----------------|
| 0.50 | 1.94                 | 1.94×           |
| 0.70 | 2.83                 | 2.83×           |
| 0.80 | 3.36                 | 3.36×           |
| 0.90 | 4.10                 | 4.10×           |

K' yi 68'den geçmek nadiren yardımcı olur:`α^{K+1}`Geometri olarak birleşimleri terim ve her ekstra çizim adım gizleyemeyeceğiniz bir seri gecikme çarpımı ekler.

### Tasarım eğitimi: Destilasyon

Bir küçük model yanlış bir taslak yapar. Standart tarif, taslakı hedefin çıkış dağılımına göre distillemek.

1. Hedefin tokenini paylaşan küçük bir mimari taslak seçin.
2. Hedefi büyük bir korpus üzerinde çalıştırın, sonraki token dağıtımlarını saklayın.
3. KL farklılığı ile taslakı, yerçekimsel gerçeklik etiketlerine karşı değil, bu depolanmış dağıtımlara karşı eğit.

Üretim kabul oranları sohbet için 0.60.8'e, kod için 0.70.85'e düşer ve yüksek sıcaklıkta yaratıcı yazma için keskin düşer.

### KANAK: Özellikleri yeniden kullanmak ve ağaç çizimleri

Li, Wei, Zhang, Zhang (2024, "AKI") iki gözlem yaptı. İlk olarak, ayrı bir taslak model yeniden çıkarır, son doğrulama sırasında zaten hesaplanmış hedefi gösterir  hedefin nihai gizli durumu bir sonraki token'ın sıkıştırılmış bir tahminidir ve doğrudan taslağa eklenebilir. İkincisi, K taslak jetonlarının bir çizgi zinciri ucuz paralelliği atıyor: taslak bir * ağaç* adaylar çıkarabilir ve hedefin tek doğrulama geçişi tüm dalları paralel olarak ağaç şeklinde bir dikkat maskası kullanarak kontrol edebilir ve daha sonra en uzun doğru yolu kabul edebilir.

EAGLE-1 taslakı, girişinin hedefin son gizli durumunu artı son emisyonu olan bir dönüştürücü dekoder katmanı haline getirir. EAGLE-2 (EMNLP 2024) taslak belirsiz olduğunda daha geniş büyüyen ve güvendiği yerde dar kalan dinamik bir ağaç ekler.

EAGLE-3 (NeurIPS 2025, arXiv:2503.01840) özellik tahminini doğrudan jeton tahmin ile değiştirir ve hedef 'nin birden fazla katmandan özellikleri birleştirir. Bu, eğitim verileri büyütüldüğünde EAGLE-1/2'yi sınırlayan bilgi boğazını ortadan kaldırır. Spec-Bench raporları, EAGLE-3 ile adım başına ≈ 4.65 kabul edilen jetonları ve yaklaşık olarak 2.4 × duvar saat hızlandırmasını içerir.

### Ağaç dikkatini doğrulama

Bir ağaç yayıldığında, hedef, dikkat maskesini "sırın üzerinde kesinlikle alt üçgenli"den "ağaç topolojisinin üzerinde kesinlikle alt üçgenli"ye geçerek bir ileri geçişte her düğümü doğruluyor.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

- Eğer`a,b`İlk adaylar yarışıyor ve `c,d,e,f`devamlar, tüm altı pozisyon bir ileri geçişle doğrulanır; çıkış, kabul edilen herhangi bir yol boyunca en uzun önbölümdür.

### Kazandığında, kazanmadığında

**Wins**: kod, yapılandırılmış çıkışlar, ortak sohbet  yüksek α, taslak ve hedef anlaşmazlıkları olan küçük kelime kütlesi.

**Loses**Bu nedenle, bu durumun bir sonraki aşamasında, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, bu aşamada, aşamada, aşamada, aşama edilen aşama edilen aşamalar, aşama edilen aşama, aşama edilen aşamalarda, aşama edilen aşama aşama aşama gereği, aşama edilen aşama gereği, aşama edilen aşama gereği, aşama gereği, aşama gereği gibi, aşama edilebilir:

Üretim dükkanları sohbette 23×, kodda 35×, yaratıcı yazıda neredeyse sıfır raporlar veriyor.

## Yapın

Gönderilir .`code/main.py`sadece stdlib ve üzerinde çalışır **toy discrete distributions**Bu yüzden matematik, bir tokenizer veya GPU olmadan görünür.

1. A.`target`dağılım ve bir rahatsız `draft`paylaşılan bir kelime üzerinde dağıtım, her ikisi de yeniden üretilebilirlik için sabit tohumlardan inşa edilmiştir.
2. `speculative_step(target_dists, draft_model, prefix, K)` Leviathan örneklemesi bir tur.Tap K simgeler önerir; hedef her taslağındaki pozisyonda p verir; kabul/reddet döngüsü soldan sağa gider; geri kalanı reddetme sırasında hesaplanır; bonus örneği tam kabul sırasında alınır.
3. Bir dağılım-eşitlik testi: spekülatör çözme N=200k defa ve sıradan hedef örnekleme N=200k defa çalıştırın, çıkış tokenini 0 pozisyonunda kürekleyin ve toplam değişim mesafesini < 0.01 belirtin.
4. Kapalı bir α-vs-speedup raporu, α ∈ {0.5, 0.7, 0.9} × K ∈ {1...8} ile yürür ve kontrol yüzeyine göre beklenen tokenleri basar.
5. Bir pozisyon başına kabul oranı sayıcısı, böylece önbellek büyüdükçe α sürüşünü görebilirsiniz.

Çık:

```
python3 code/main.py
```

Beklenen çıkış: kabul oranı tablosu, TV mesafe hattı (`TV = 0.0034`-is, standart tohum üzerinde), hızlandırma yüzeyi ve bir `PASS`Tüm koşuk bir saniyede biter.

## Kullan

- **vLLM**Birinci sınıf bir yapılandırma olarak spekülasyonsal çözümü ortaya çıkarır.`--speculative-model <draft>`ve `--num-speculative-tokens K`Ekle `--speculative-draft-tensor-parallel-size`EAGLE-3'ün desteklenmesi için `--speculative-method eagle3`v0.7+'de şubesi.
- **SGLang**EAGLE-2 ve EAGLE-3 desteği olan gemiler, RadixAttention önbelleği önbelleği ile oluşturulur.
- **NVIDIA TensorRT-LLM**Gemiler Medusa kafaları ve EAGLE ağaçları ağaç yapılı dikkat için ayarlanmış çekirdeklerle iki farklı servis modları olarak.
- **Reference drafts**Llama 3 ailesi, 8B/70B/405B kontrol noktalarına uygun bir 1B taslak gönderir. Qwen3 ise 32B hedefi için 0.6B taslak gönderir.
- **Medusa**(Cai et al., 2024) ayrı bir taslak karşılayamadığınızda kullanılabilir alternatifdir: K öngörü hedefin başına, kendi kendini distillatörlükle eğitilmiştir.
- **Lookahead decoding**(Fu et al., 2024) taslaksız  hedefin kendi önceki Jacobi iterasyonları tarafından üretilen n-gramları tekrar kullanır ve doğruluyor.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-spec-decoder.md` bir iş yükü profili (hedef model boyutu, görev karışımı, sıcaklık, parti boyutu, servis motorları) ve spekülatör bir dekode yapılandırmasını öneren bir beceri (çeft model, K, ağaç genişliği, sıcaklık politikası ve sıradan dekodeye geri düşmek mi)

## Egzersizler

1. **Exactness under mismatch.**Kasıtlı olarak taslakla eşleşme (örneğin, olasılıklarını karıştırın) ve TV mesafe testi tekrar çalıştırın. Çıktı sonuçların empiriyel tolerans içinde hala basit hedef örnekleme ile uyumlu olduğunu kontrol edin. Bu, reddetme kuralının size satın aldığı şeydir.

2. **Find the optimal K.**α ∈ {0.5, 0.6, 0.7, 0.8, 0.9} için, yi en üst düzeye çıkaran K'yi bul`(1 - α^{K+1}) / (1 - α) / (K · cost_draft + cost_target)`- ... ...`cost_draft / cost_target ∈ {0.05, 0.1, 0.2}`- Planı.

3. **Tree vs chain.**Uzaklaştırma`main.py`Bu nedenle, çizim, D derinliklerinin her birinde üst 2 dalı yayar.`target`en uzun doğru yolu kabul eder ve çıkış dağılımının hala tam olarak p olduğunu.

4. **Temperature collapse.**Çizgi ve hedefdeki sıcaklığı 0,1'den 2,0'a kadar tarayın. Her ayarda α ölçün. "Yaratıcı yazılar için T ≥ 1,0'da spekülasyon yapmayın" yönündeki çöküşü yeniden üretin.

5. **Draft training stub.**Oyuncak dağıtımında, KL'yi en aza indirerek taslakla uyumlu hale getirin.

## Anahtar Terimler

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

## Daha Fazla Okumak

- [Leviathan, Kalai, Matias — "Fast Inference from Transformers via Speculative Decoding" (ICML 2023)](https://arxiv.org/abs/2211.17192) tam reddetme kuralı ve hızlandırma analizi.
- [Chen, Borgeaud, Irving et al. — "Accelerating Large Language Model Decoding with Speculative Sampling" (DeepMind 2023)](https://arxiv.org/abs/2302.01318) DeepMind'den eş zamanlı olarak çıkarılmış.
- [Cai, Li, Geng, Peng, Lee, Chen, Dao — "Medusa" (2024)](https://arxiv.org/abs/2401.10774) Bir taslak modeline paralel başlar alternatif.
- [Li, Wei, Zhang, Zhang — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty" (ICML 2024)](https://arxiv.org/abs/2401.15077) özellikleri yeniden kullanmak ve ağaç çizimleri.
- [Li, Wei, Zhang, Zhang — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees" (EMNLP 2024)](https://arxiv.org/abs/2406.16858) dinamik ağaç topolojisi.
- [Li, Wei, Zhang, Zhang — "EAGLE-3: Scaling up Inference Acceleration via Training-Time Test" (NeurIPS 2025)](https://arxiv.org/abs/2503.01840) doğrudan token tahminleri artı çok katmanlı özellik birleşimi.
- [Fu, Bailis, Stoica, Zhang — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding" (ICML 2024)](https://arxiv.org/abs/2402.02057) Jacobi/lookahead, tasfiye dışı alternatif.
- [Rodionov et al. — "Hogwild! Inference: Parallel LLM Generation via Concurrent Attention" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2504.06261) spekülasyonsal çözüme kavuşturma için paralel çalışanlar için bir alternatif.
- [Kumar, Dao, May — "Speculative Speculative Decoding" (ICLR 2026)](https://arxiv.org/abs/2603.03251) Tahminler taslakının verifikasyonla örtüşmesi.
- [Oliaro et al. — "SuffixDecoding" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2411.04975) SPEC-Bench'de 2.5× için EAGLE-3 ile hibridleşen bir ek ağaç tasarımı.
