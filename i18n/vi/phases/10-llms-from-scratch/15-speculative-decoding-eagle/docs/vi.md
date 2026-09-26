# Việc giải mã giả định và EAGLE-3

> Việc giải mã là gắn với bộ nhớ. Một mô hình 70B dành phần lớn thời gian đi trước để chờ trọng lượng chảy ra khỏi HBM, tạo ra một token vào cuối thời gian chờ ~ 70 ms. Leviathan, Kalai, Matias (2023) cho thấy bạn có thể để cho một mô hình sơ đồ nhỏ đoán các mã thông báo K tiếp theo, xác minh chúng trong một bước đi phía trước mô hình lớn, và chấp nhận tiền tố chính xác dài nhất  với một tương đương chính xác có thể chứng minh với lấy mẫu từ mục tiêu. EAGLE-3 (Li et al., NeurIPS 2025) đẩy trung bình các token được chấp nhận trên mỗi xác minh lên ~ 4,65 trên Spec-Bench, khoảng 2,4x tăng tốc độ đồng hồ tường trên phân phối đầu ra phù hợp.

**Type:** Build
**Languages:** Python (stdlib only)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## Vấn đề

Autoregressive decoding là trung tâm chi phí của sản xuất LLM phục vụ. Mỗi token là một chuyển tiếp về phía trước, và chuyển tiếp về phía trước được thống trị bằng cách đọc các khối lượng đầy đủ từ HBM  chứ không phải bằng toán học. Trên một H100 decoding một mô hình 70B BF16, ~ 280 GB trọng lượng phải chảy qua các đơn vị tính toán để tạo ra một token.

Bạn không thể thu hẹp mô hình mà không thay đổi phân phối của nó. Bạn không thể làm cho bộ nhớ nhanh hơn. nút duy nhất còn lại là tỷ lệ các token được tạo ra cho mỗi chuyển tiếp.

Việc giải mã giả định khai thác một sự không hiệu quả cụ thể: quá trình giải mã là * nhớ bị ràng buộc*, vì vậy một khi bạn đã truyền các trọng lượng qua các đơn vị tính toán bạn có khả năng toán học vô hiệu đáng kể. Một mô hình dự thảo nhỏ gọn đoán 4 token chi phí gần như không có gì so với một mục tiêu chuyển tiếp. Nếu hầu hết các đoán của nó là đúng, bạn giảm một trọng lượng đọc trên nhiều token và bạn làm điều đó mà không chạm vào phân phối đầu ra của mục tiêu.

Chụp đồ họa tại `assets/speculative-decoding.svg`cho thấy toàn bộ đường ống: chuỗi bước K của bản thảo, thông qua xác minh duy nhất của mục tiêu, vòng chấp nhận/rút bỏ từ trái sang phải, mẫu dư thừa khi từ chối lần đầu tiên và mã thông báo thưởng khi chấp nhận đầy đủ. Hãy giữ nó mở trong khi đọc phần tiếp theo.

## Khái niệm

### Thiết lập hai mô hình

- **Target**M_p: mô hình chất lượng cao chậm. phân phối p. Đây là những gì chúng tôi muốn mẫu từ.
- **Draft**M_q: một dự đoán nhanh nhỏ. Phân phối q. Thông thường nhỏ hơn mục tiêu 530x.

Mỗi bước đầu cơ, ở vị trí t:

1. Dự thảo tạo ra các token K theo cách tự động: x_1, ..., x_K ~ q.
2. Mục tiêu chạy **one forward pass**trên các vị trí K + 1 và trả lại p     + x_1...x_k) cho k = 0...K.
3. Một quy tắc chấp nhận/rút bỏ tiêu thụ các token được soạn thảo từ trái sang phải, chấp nhận tiền tố phù hợp dài nhất và hoặc lấy lại mẫu từ phân phối được sửa đổi khi từ chối lần đầu tiên hoặc lấy một token mục tiêu được lấy mẫu tiền thưởng nếu tất cả K được chấp nhận.

Nếu dự thảo phù hợp hoàn hảo với mục tiêu, bạn tạo ra các token K + 1 cho mỗi mục tiêu tiếp theo. Nếu dự thảo sai ở vị trí 1, bạn vẫn tạo ra chính xác 1 token. Bạn không bao giờ tạo ra ít hơn một token cho mỗi xác minh.

### Quy tắc chính xác (Leviathan et al., 2023)

Trù này là một thử nghiệm lấy mẫu từ chối được sửa đổi để bảo tồn chính xác p. Đối với mỗi mã thông báo x_k với xác suất dự thảo q(x_k) và xác suất mục tiêu p(x_k):

```
r ~ Uniform(0, 1)
if r < p(x_k) / q(x_k):
    accept x_k
else:
    sample replacement ~ residual(x) = max(p(x) - q(x), 0) / ||max(p - q, 0)||_1
    stop
```

Khi p = q xác suất chấp nhận là 1. Khi p ≠ q mẫu bị từ chối xuất phát từ phần tích cực còn lại, đó chính xác là khối lượng p mà q không thể phủ. Kết hợp hai nhánh cho bạn một mẫu được rút ra từ p bằng cấu trúc không có thiên vị, không có yếu tố điều chỉnh, không có sự phá vỡ nhiệt độ.

Sự chuyên môn tham lam đơn giản hơn: chấp nhận nếu và chỉ khi`argmax(p) == x_k`, nếu không phát `argmax(p)`và dừng lại.

### Tốc độ tăng tốc dự kiến

Nếu xác suất chấp nhận mỗi token là α (tỷ lệ trung bình trên các vị trí), số lượng token dự kiến cho mỗi mục tiêu chuyển tiếp là:

```
E[tokens per verify] = (1 - α^{K+1}) / (1 - α)
```

Khi α = 0,8 và K = 4, đó là 3,36 token cho mỗi mục tiêu tiến. Một mã hóa đơn giản tạo ra 1 token cho mỗi mục tiêu tiến, do đó tốc độ trần cột là 3,36 ×  trừ chi phí của các bước dự thảo K, điều này là không đáng kể khi chi phí (đối mục tiêu) ≫ K · chi phí (đối dự thảo).

Các tham số thực duy nhất là α. Một bản thảo tốt là tất cả.

Các giá trị ví dụ tại K = 4:

| α    | E[tokens per verify] | Ceiling speedup |
|------|----------------------|-----------------|
| 0.50 | 1.94                 | 1.94×           |
| 0.70 | 2.83                 | 2.83×           |
| 0.80 | 3.36                 | 3.36×           |
| 0.90 | 4.10                 | 4.10×           |

Tăng K qua 68 hiếm khi giúp:`α^{K+1}`các hợp chất theo hình học, và mỗi bước dự thảo thêm thêm thêm một đợt chậm trễ hàng không bạn không thể che giấu.

### Việc đào tạo dự án: chưng cất

Một mô hình nhỏ ngẫu nhiên tạo ra một bản thảo xấu.

1. Chọn một bản kiến trúc nhỏ chia sẻ token của mục tiêu.
2. Đưa mục tiêu trên một kho lớn, lưu trữ các mã số tiếp theo.
3. Trình bày bản thảo với sự khác biệt KL đối với những phân phối được lưu trữ, không phải đối với nhãn thực tại.

Tỷ lệ chấp nhận sản xuất giảm xuống 0,60.8 cho trò chuyện, 0,70.85 cho mã, và giảm mạnh đối với văn bản sáng tạo ở nhiệt độ cao.

### Eagle: sử dụng lại tính năng và vẽ cây

Li, Wei, Zhang, Zhang (2024, "Eagle") đã thực hiện hai quan sát. Đầu tiên, một bản dự thảo mô hình tách biệt dẫn xuất lại tính năng mục tiêu đã được tính toán trong xác minh cuối cùng của nó  trạng thái ẩn cuối cùng của mục tiêu là một dự báo nén của token tiếp theo và có thể được đưa trực tiếp vào bản dự thảo. Thứ hai, một chuỗi đường thẳng của các mã thông báo dự thảo K loại bỏ sự song song rẻ: dự thảo có thể tạo ra một * cây * của ứng cử viên, và một lần xác minh của mục tiêu có thể kiểm tra tất cả các nhánh song song bằng cách sử dụng một mặt nạ chú ý hình dạng cây, sau đó chấp nhận con đường chính xác dài nhất.

EAGLE-1 làm cho bản thảo một lớp decoder biến đổi duy nhất mà đầu vào là trạng thái ẩn cuối cùng của mục tiêu cộng với token phát ra cuối cùng. EAGLE-2 (EMNLP 2024) thêm một cây động phát triển rộng hơn nơi bản thảo không chắc chắn và duy trì hẹp nơi nó tự tin.

EAGLE-3 (NeurIPS 2025, arXiv:2503.01840) thay thế dự đoán tính năng bằng dự đoán token trực tiếp và hợp nhất các tính năng từ nhiều lớp của mục tiêu  loại bỏ nút thắt thông tin hạn chế EAGLE-1/2 khi dữ liệu đào tạo tăng cường. Các báo cáo Spec-Bench có nghĩa là token được chấp nhận mỗi bước ≈ 4,65 với EAGLE-3 và khoảng 2,4x tăng tốc độ đồng hồ tường ở kích thước lô 1.

### Kiểm tra sự chú ý của cây

Khi bản thảo phát ra một cây, mục tiêu xác minh mọi nút trong một bước đi tiến duy nhất bằng cách chuyển mặt nạ chú ý của nó từ "đường thẳng ba góc dưới đường" sang "đường thẳng ba góc dưới hình dáng trên hình dáng cây". Mỗi nút chỉ chăm sóc tổ tiên của nó.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

Nếu`a,b`là ứng cử viên đầu tiên và `c,d,e,f`là tiếp tục, tất cả sáu vị trí được xác minh trong một lần đi trước; đầu ra là tiền tố dài nhất dọc theo bất kỳ con đường nào được chấp nhận.

### Khi nó thắng, khi nó không thắng

**Wins**: mã, đầu ra có cấu trúc, trò chuyện chung  cao α, khối lượng từ ngữ nhỏ khi bản thảo và mục tiêu không đồng ý.

**Loses**: viết sáng tạo ở nhiệt độ ≥ 1,0, nơi α sụp đổ về phía 1/ của các dòng chữ và dự thảo trên tiêu thụ thống trị.

Các cửa hàng sản xuất báo cáo 23x trên trò chuyện, 35x trên mã, gần bằng không trên viết sáng tạo.

## Hãy xây dựng nó

Những người được gửi đi`code/main.py`chỉ có stdlib và hoạt động trên **toy discrete distributions**(kích thước từ ngữ 16) để toán học có thể nhìn thấy mà không cần một tokenizer hoặc GPU.

1. A `target`phân phối và một sự rối loạn `draft`phân phối trên một từ ngữ chung, cả hai được xây dựng từ hạt giống cố định để tái tạo.
2. `speculative_step(target_dists, draft_model, prefix, K)` một vòng lấy mẫu Leviathan. Dự thảo đề xuất các token K; mục tiêu cho p tại mỗi vị trí được dự thảo; accepte/reject loop chạy từ trái sang phải; dư lượng được tính khi từ chối; mẫu thưởng được lấy khi chấp nhận đầy đủ.
3. Một thử nghiệm tương đương phân phối: chạy mã hóa suy đoán N=200k lần và lấy mẫu mục tiêu đơn giản N=200k lần, vỏ token đầu ra ở vị trí 0, và khẳng định khoảng cách biến đổi tổng cộng < 0.01. Đây là kiểm tra chính xác thực nghiệm bài báo 2023 nổi tiếng.
4. Một báo cáo bốc đồng α-vs-speedup dạng đóng đi α ∈ {0.5, 0.7, 0.9} × K ∈ {1...8} và in các token dự kiến trên bề mặt xác minh.
5. Một bộ đếm tỷ lệ chấp nhận mỗi vị trí để bạn có thể thấy α trôi khi tiền tố tăng lên.

Đi chạy:

```
python3 code/main.py
```

Tạo ra dự kiến: bảng tỷ lệ chấp nhận, đường truyền hình (`TV = 0.0034`-ish trên hạt tiêu chuẩn), bề mặt tăng tốc, và một `PASS`toàn bộ cuộc chạy kết thúc trong vòng chưa đầy một giây.

## Sử dụng nó

- **vLLM**Khám phá giải mã giả định là cấu hình hạng nhất.`--speculative-model <draft>`và `--num-speculative-tokens K`; thêm `--speculative-draft-tensor-parallel-size`khi bản thảo là GPU- cư trú. EAGLE-3 được hỗ trợ thông qua `--speculative-method eagle3`nhánh trong v0.7+.
- **SGLang**tàu hỗ trợ EAGLE-2 và EAGLE-3 và tạo ra chúng với bản ghi nhớ trước của RadixAttention.
- **NVIDIA TensorRT-LLM**tàu Medusa đầu và cây Eagle như hai chế độ phục vụ riêng biệt với hạt nhân điều chỉnh cho sự chú ý cấu trúc cây.
- **Reference drafts**: Gia đình Llama 3 gửi một bản 1B tương thích với các điểm kiểm soát 8B/70B/405B; Qwen3 gửi một bản 0.6B cho mục tiêu 32B.
- **Medusa**(Cai et al., 2024) là một lựa chọn thay thế có thể triển khai khi bạn không thể đủ khả năng để có được một bản dự thảo riêng: K dự đoán đầu trên mục tiêu chính nó, được đào tạo thông qua tự chưng cất.
- **Lookahead decoding**(Fu et al., 2024) là bản thảo miễn phí  nó sử dụng lại n-gram được tạo ra bởi các lặp Jacobi trước đó của mục tiêu và xác minh chúng.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-spec-decoder.md` một kỹ năng lấy hồ sơ tải trọng công việc (kích thước mô hình mục tiêu, hỗn hợp nhiệm vụ, nhiệt độ, kích thước lô, động cơ phục vụ) và khuyến nghị cấu hình giải mã phỏng đoán (chế hoạch mô hình, K, chiều rộng cây, chính sách nhiệt độ và liệu có nên quay lại giải mã đơn giản hay không).

## Các bài tập

1. **Exactness under mismatch.**Chuẩn bị sai trái dự thảo (ví dụ, làm lộn xộn xác suất của nó) và chạy lại thử nghiệm khoảng cách TV. Kiểm tra xem kết quả vẫn phù hợp với lấy mẫu mục tiêu trong dung nạp kinh nghiệm. Đây là điều quy tắc từ chối mua cho bạn.

2. **Find the optimal K.**Đối với α ∈ {0,5, 0.6, 0.7, 0.8, 0.9}, tìm K tối đa hóa `(1 - α^{K+1}) / (1 - α) / (K · cost_draft + cost_target)`giả định`cost_draft / cost_target ∈ {0.05, 0.1, 0.2}`- Cố gắng.

3. **Tree vs chain.**Tăng `main.py`Vì vậy, bản thảo phát ra các nhánh 2 trên cùng ở mỗi độ sâu D. Xây dựng mặt nạ chú ý cây như một matrix lân cận; xác minh rằng `target`chấp nhận đường chính xác dài nhất và phân phối đầu ra vẫn chính xác là p.

4. **Temperature collapse.**Xét nhiệt độ từ 0,1 đến 2,0 trong bản thảo và mục tiêu. đo α tại mỗi thiết lập. Tạo lại sự sụp đổ thúc đẩy "không suy đoán ở T ≥ 1,0 cho việc viết sáng tạo".

5. **Draft training stub.**Trên phân phối đồ chơi, phù hợp với bản vẽ bằng cách giảm thiểu KL ((những bản vẽ mục tiêu) với sự giảm gradient trên một parameterization softmax.

## Các điều khoản chính

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

## Đọc thêm

- [Leviathan, Kalai, Matias — "Fast Inference from Transformers via Speculative Decoding" (ICML 2023)](https://arxiv.org/abs/2211.17192) quy tắc từ chối chính xác và phân tích tăng tốc.
- [Chen, Borgeaud, Irving et al. — "Accelerating Large Language Model Decoding with Speculative Sampling" (DeepMind 2023)](https://arxiv.org/abs/2302.01318) nguồn gốc đồng thời từ DeepMind.
- [Cai, Li, Geng, Peng, Lee, Chen, Dao — "Medusa" (2024)](https://arxiv.org/abs/2401.10774) Các đầu song song thay thế cho mô hình dự thảo.
- [Li, Wei, Zhang, Zhang — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty" (ICML 2024)](https://arxiv.org/abs/2401.15077) tính năng tái sử dụng cộng với việc vẽ cây.
- [Li, Wei, Zhang, Zhang — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees" (EMNLP 2024)](https://arxiv.org/abs/2406.16858) topology cây động.
- [Li, Wei, Zhang, Zhang — "EAGLE-3: Scaling up Inference Acceleration via Training-Time Test" (NeurIPS 2025)](https://arxiv.org/abs/2503.01840) dự đoán mã thông báo trực tiếp cộng với sự hợp nhất tính năng đa tầng.
- [Fu, Bailis, Stoica, Zhang — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding" (ICML 2024)](https://arxiv.org/abs/2402.02057) Jacobi/lookahead, sự thay thế không cần draft.
- [Rodionov et al. — "Hogwild! Inference: Parallel LLM Generation via Concurrent Attention" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2504.06261) một sự thay thế của công nhân song song với việc giải mã giả định.
- [Kumar, Dao, May — "Speculative Speculative Decoding" (ICLR 2026)](https://arxiv.org/abs/2603.03251) chồng chéo dự án đầu cơ với chính xác minh.
- [Oliaro et al. — "SuffixDecoding" (NeurIPS 2025 Spotlight)](https://arxiv.org/abs/2411.04975) bản vẽ cây hậu tố kết hợp với EAGLE-3 cho 2.5x trên Spec-Bench.
