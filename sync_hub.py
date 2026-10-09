import shutil, os

source = 'standalone/genai_learning_hub.html'
destinations = [
    'genai_learning_hub.html',
    'frontend/public/standalone.html',
    'frontend/public/index.html'
]

if not os.path.exists(source):
    print(f"Error: {source} does not exist.")
    exit(1)

with open(source, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Loaded source: {source} ({len(content)} chars)")

for dest in destinations:
    os.makedirs(os.path.dirname(dest) if os.path.dirname(dest) else '.', exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Synced -> {dest}")

print("All files synchronized with AI Prompt2Prod branding.")
