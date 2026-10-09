# 🎓 Free Learner & Study Guide — AI Engineering Mastery

Welcome! This repository is **100% free and open-source (MIT Licensed)**, designed to take anyone from absolute zero to production AI engineer and researcher.

Whether you prefer **interactive visual web apps**, **pure math and code from scratch**, or **interview & certification preparation**, this guide will help you get started in under 60 seconds.

---

## 🚀 Choose How You Want to Learn

```
                                  ┌─────────────────────────────────────────────────┐
                                  │   🌟 How do you want to start learning?        │
                                  └──────────────────────┬──────────────────────────┘
                                                         │
               ┌─────────────────────────────────────────┼────────────────────────────────────────┐
               ▼                                         ▼                                        ▼
    ┌──────────────────────┐                  ┌──────────────────────┐                 ┌──────────────────────┐
    │  Path 1: Instant Web │                  │  Path 2: Code Labs   │                 │  Path 3: Prep & PDFs │
    │  (Zero Install / UI) │                  │  (524 Raw Lessons)   │                 │  (Interview & Certs) │
    └──────────────────────┘                  └──────────────────────┘                 └──────────────────────┘
```

---

### 🌐 Path 1: Instant Interactive Web Platform (Zero Setup)

If you don't want to install Node.js, Python, or complex dependencies right now, you can run the entire interactive learning suite right in your web browser:

1. **Download or Clone this Repository**:
   ```bash
   git clone https://github.com/harikiranchirala-AIworks/ai-engineering-from-scratch.git
   ```
2. **Open the App**:
   - Double-click **[`genai_learning_hub.html`](genai_learning_hub.html)** (or [`standalone/genai_learning_hub.html`](standalone/genai_learning_hub.html)) to open it in **Chrome**, **Edge**, or **Firefox**.
3. **What You Get Inside**:
   - **🌌 20 Phases Universe Explorer**: Browse and search all 524 first-principles lessons.
   - **🔬 Interactive AI Labs**:
     - *RAG Pipeline Simulator* (chunking, BM25 hybrid search, reranking)
     - *LangGraph Multi-Agent Builder* (Supervisor, Coder, Web Search state machines)
     - *GPU / VRAM Sizing Calculator* (FP16, 8-bit, 4-bit, LoRA parameter and KV cache calculator)
     - *Self-Attention & Transformer Heatmap Visualizer*
   - **📚 11 Production Engineering Modules (833 Topics)** with audio text-to-speech read aloud.
   - **🗂️ 5-Box Leitner Spaced Repetition Flashcards**.
   - **⏱️ Timed AI Mock Interview Simulator** with scorecard grading.

---

### 💻 Path 2: First-Principles Coding Labs (Python, Rust, TS, Julia)

If you want to understand the raw mathematics, neural networks, and algorithms from scratch:

#### 1. Setup Your Local Environment
Make sure you have **Python 3.10+** installed:
```bash
python --version
pip install -r requirements.txt
```

#### 2. Run Your First Math Lab
No black boxes or third-party wrappers — pure math from first principles:
```bash
# Vector operations & linear algebra foundation
python phases/01-math-foundations/01-linear-algebra-intuition/code/vectors.py

# Backpropagation and autograd from scratch
python phases/03-deep-learning-core/01-autograd/code/main.py

# Self-attention mechanism from scratch
python phases/07-transformers/01-attention-mechanisms/code/main.py

# Building an AI Agent loop from scratch
python phases/14-agent-engineering/01-the-agent-loop/code/main.py
```

#### 3. Run Deterministic Unit Tests
Every lesson includes a self-contained unit test suite:
```bash
python -m unittest discover phases/01-math-foundations/01-linear-algebra-intuition/code/tests/ -v
```

---

### 🎯 Path 3: Technical Interview & Certification Prep

Preparing for AI Engineer, ML Engineer, or Tech Lead technical interviews or Claude certifications?

1. **Practice with Flashcards**:
   - Open [`genai_learning_hub.html`](genai_learning_hub.html) and click **Flashcards / Leitner Box** to test your recall on 100+ production interview scenarios.
2. **Take a Timed Mock Interview**:
   - Click **Timed Mock Interview** in the UI to practice answering system design and architectural questions with real-time rubric grading.
3. **Explore the PDF Library & Architecture Cheat Sheets**:
   Check the [`pdfs/`](pdfs/) directory for comprehensive study materials:
   - `The complete AI Agentic interview Guide.pdf`
   - `CCAR-F.pdf` (Anthropic Claude Certified Architect Blueprint)
   - `Gen AI_AI Engineer Complete Blueprint 2026.pdf`
   - `Model Routing & AI Gateways.pdf`
   - `AI Chunking.pdf`
   - `LLM Security Issues.pdf`
   - `20 AI Terms for PM.pdf`

---

### 🗺️ Full 20-Phase Curriculum Roadmap

| Phase | Topic | What You Build From Scratch |
| :--- | :--- | :--- |
| **00** | Setup & Tooling | Dev environment preflights, linters, dependency auditing |
| **01** | Math Foundations | Vectors, dot products, matrix calculus, gradients, eigenvalues |
| **02** | ML Fundamentals | Linear regression, logistic regression, trees, gradient descent |
| **03** | Deep Learning Core | Autograd engine, computational graphs, backprop, optimizers |
| **04** | Computer Vision | Convolutions, kernels, pooling, Vision Transformers (ViT) |
| **05** | Natural Language Processing | Word embeddings, Skip-Gram, TF-IDF, positional encoding |
| **06** | Speech & Audio AI | Spectrograms, Mel-filterbanks, CTC decoding |
| **07** | Transformers | Multi-Head Self-Attention ($Q, K, V$), causal masks, RoPE |
| **08** | Generative AI & Diffusion | VAEs, score-based diffusion models, denoising loops |
| **09** | Reinforcement Learning | Bellman equations, Q-Learning, Policy Gradients |
| **10** | LLMs from Scratch | BPE Tokenizer, Transformer decoder, KV Cache, sampling |
| **11** | LLM Engineering | Prompt engineering, RAG, hybrid search, evals, fine-tuning |
| **12** | Multimodal AI | CLIP contrastive loss, vision-language projection |
| **13** | Tools & Protocols | Model Context Protocol (MCP) servers, Agent Skills SDK |
| **14** | Agent Engineering | ReAct loop, tool execution, state machines, reflection |
| **15** | Autonomous Systems | Planning, task decomposition, long-term memory |
| **16** | Multi-Agent Swarms | Supervisor routing, consensus, debate, delegation |
| **17** | Production & Serving | Quantization (AWQ/GGUF), model gateways, latency optimization |
| **18** | Safety & Alignment | DPO/RLHF, guardrails, red-teaming, prompt injection defense |
| **19** | Capstones | Production-ready AI systems end-to-end |

---

### 🤝 Share & Learn Together
Feel free to fork, clone, share with colleagues, and submit pull requests. Learning is better when shared!

- **GitHub Repository**: [https://github.com/harikiranchirala-AIworks/ai-engineering-from-scratch](https://github.com/harikiranchirala-AIworks/ai-engineering-from-scratch)
- **License**: Free and Open Source under the [MIT License](LICENSE)
