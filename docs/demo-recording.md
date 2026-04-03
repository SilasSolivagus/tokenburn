# Recording tokenburn demos

Two approaches: **VHS** (recommended, deterministic) or **asciinema** (simpler, live recording).

## Option A: VHS (recommended)

VHS renders terminal recordings to GIF/MP4 from a `.tape` script file.
Deterministic, re-recordable, version-controllable.

### Install

```bash
brew install vhs        # macOS
# or: go install github.com/charmbracelet/vhs@latest
```

VHS requires `ffmpeg` and `ttyd` — `brew install vhs` pulls them automatically.

### Record

```bash
# Hero GIF (30s, for README)
vhs docs/demo-hero.tape

# Full demo (60s, for blog/Twitter)
vhs docs/demo-full.tape
```

Output lands in `docs/demo-hero.gif` and `docs/demo-full.gif`.

### Tips

- **Real data required.** The tapes drive the real `tokenburn` CLI, so you need
  Claude Code logs on the machine. Run `tokenburn import` first if needed.
- **First run.** `demo-hero.tape` assumes first run (no `~/.config/tokenburn/config.yaml`).
  Delete the config before recording: `rm -f ~/.config/tokenburn/config.yaml`
- **Timing.** If output takes longer than expected on your machine, increase the
  `Sleep` values after `Enter` commands.
- **MP4 instead of GIF.** Change `Output docs/demo-hero.gif` to `Output docs/demo-hero.mp4`.
- **WebM for smaller files.** Change to `Output docs/demo-hero.webm`.

### Customization

Edit the `.tape` files to tweak:
- `Set FontSize` — bump to 18 for Twitter, 14 for docs site
- `Set Width / Height` — 860x540 works well for GitHub README
- `Set Theme` — try "Dracula", "Tokyo Night", "GitHub Dark"
- `Set TypingSpeed` — 55ms feels natural, 40ms for fast cuts

---

## Option B: asciinema (live recording)

Good for ad-hoc recording or when you want genuine interactive feel.

### Install

```bash
brew install asciinema
pip install asciinema    # alternative
```

### Record the hero GIF

```bash
# Delete config to trigger onboarding
rm -f ~/.config/tokenburn/config.yaml

# Start recording
asciinema rec docs/demo-hero.cast \
  --title "tokenburn — htop for your AI spending" \
  --idle-time-limit 2 \
  --cols 90 --rows 28

# Now type these commands live:
#   tokenburn              (answer onboarding: 1, then 2)
#   tokenburn scan --last 7d
# Then Ctrl+D to stop recording
```

### Record the full demo

```bash
asciinema rec docs/demo-full.cast \
  --title "tokenburn full demo" \
  --idle-time-limit 3 \
  --cols 100 --rows 32

# Commands to run:
#   tokenburn
#   tokenburn scan --last 7d --fix    (answer y, n, n)
#   tokenburn optimize --simulate --model claude-haiku-4-5
#   tokenburn tree --last 3
#   tokenburn dashboard               (Ctrl+C after URL shows)
# Then Ctrl+D to stop
```

### Convert to GIF

asciinema produces `.cast` files. Convert to GIF with `agg`:

```bash
# Install agg (asciinema GIF generator)
cargo install --git https://github.com/asciinema/agg

# Convert
agg docs/demo-hero.cast docs/demo-hero.gif \
  --font-size 16 \
  --theme monokai \
  --cols 90 --rows 28 \
  --speed 1.2

agg docs/demo-full.cast docs/demo-full.gif \
  --font-size 15 \
  --theme monokai \
  --cols 100 --rows 32
```

Or upload to asciinema.org for an embedded player:

```bash
asciinema upload docs/demo-hero.cast
# Returns a URL like: https://asciinema.org/a/xxxxx
```

### Embed in README

**GIF (works everywhere):**
```markdown
![tokenburn demo](docs/demo-hero.gif)
```

**asciinema player (richer, but needs JS):**
```html
<a href="https://asciinema.org/a/xxxxx">
  <img src="https://asciinema.org/a/xxxxx.svg" width="600" />
</a>
```

---

## Scripted fake recording (no real data)

If you want a pixel-perfect demo without real log data, create a shell script
that prints pre-baked output, then record that instead:

```bash
#!/bin/bash
# docs/demo-fake.sh — print fake tokenburn output for recording

echo ""
echo -e "\033[1m\033[38;5;208m  🔥 tokenburn\033[0m"
echo -e "\033[2m  htop for your AI spending\033[0m"
echo ""
echo -e "\033[1m  Quick setup:\033[0m"
echo ""
echo -e "\033[36m  How do you pay for AI?\033[0m"
echo "  (1) Subscription (Claude Max, Cursor Pro, etc.)"
echo "  (2) API (pay per token)"
echo -ne "\033[2m  > \033[0m"
sleep 0.8
echo "1"
echo ""
echo -e "\033[36m  Monthly plan price?\033[0m"
echo "  (1) \$100"
echo "  (2) \$200"
echo "  (3) Custom amount"
echo -ne "\033[2m  > \033[0m"
sleep 0.8
echo "2"
echo ""
echo -e "\033[32m  ✓ Config saved\033[0m"
echo -e "\033[2m    Mode: subscription, Plan: \$200/mo\033[0m"
echo ""
echo -e "\033[2m  Imported 24,670 new records from Claude Code logs\033[0m"
echo ""
echo -e "\033[1m📊 Summary — Today\033[0m"
echo ""
echo "  API equivalent:   \$223.55"
echo "  Your plan:        \$200/mo (1.1x value ✓)"
echo "  Total requests:   1,847"
echo "  Avg cost/request: \$0.121"
echo "  Input tokens:     42.3M"
echo "  Output tokens:    8.7M"
echo "  Cache read:       31.1M"
echo ""
echo -e "\033[1m  By Model:\033[0m"
echo ""
echo "  ┌───────────────────────┬──────────┬──────────┬────────┬────────┐"
echo "  │ Model                 │     Cost │ Requests │  Input │ Output │"
echo "  ├───────────────────────┼──────────┼──────────┼────────┼────────┤"
echo "  │ claude-opus-4         │  \$187.20 │      412 │  38.1M │   6.2M │"
echo "  │ claude-sonnet-4       │   \$31.85 │    1,203 │   3.8M │   2.1M │"
echo "  │ claude-haiku-4-5      │    \$4.50 │      232 │   0.4M │   0.4M │"
echo "  └───────────────────────┴──────────┴──────────┴────────┴────────┘"
echo ""
echo -e "\033[33m  ⚠ 17 inefficiency patterns detected — run \`tokenburn scan\` for details\033[0m"
echo ""
```

Then point the VHS tape at this script instead:

```tape
# In demo-hero.tape, replace "Type tokenburn" with:
Type "bash docs/demo-fake.sh"
```

This gives you full control over the numbers displayed.
