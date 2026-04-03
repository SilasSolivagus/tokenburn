# tokenburn — Full 60-second demo (for blog / Twitter / docs site)
# Record with: vhs docs/demo-full.tape
#
# Prerequisites:
#   brew install vhs
#   npm install -g tokenburn
#   Ensure you have Claude Code log data (or run tokenburn import first)

Output docs/demo-full.gif

Set Shell "bash"
Set FontSize 15
Set Width 960
Set Height 600
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms
Set CursorBlink false

# ============================================================
# Scene 1: Zero-config auto-import (tokenburn with no args)
# ============================================================

Sleep 400ms
Type "# Zero config — just run it"
Sleep 200ms
Enter
Sleep 600ms

Type "tokenburn"
Sleep 300ms
Enter
Sleep 2000ms

# If this is first run, answer onboarding prompts:
# How do you pay? -> 1 (Subscription)
Type "1"
Sleep 200ms
Enter
Sleep 800ms

# Plan price? -> 2 ($200)
Type "2"
Sleep 200ms
Enter
Sleep 1500ms

# Auto-import + summary output
Sleep 3500ms

# ============================================================
# Scene 2: Scan with interactive fix mode
# ============================================================

Type "# Find waste patterns and fix them interactively"
Sleep 200ms
Enter
Sleep 600ms

Type "tokenburn scan --last 7d --fix"
Sleep 300ms
Enter
Sleep 2500ms

# Scan output renders, then fix prompts appear.
# Apply first fix:
Sleep 2000ms
Type "y"
Sleep 200ms
Enter
Sleep 1000ms

# Skip second fix:
Type "n"
Sleep 200ms
Enter
Sleep 1000ms

# Skip remaining:
Type "n"
Sleep 200ms
Enter
Sleep 1500ms

# ============================================================
# Scene 3: What-if simulation — switch everything to Haiku
# ============================================================

Type "# What if we used Haiku for everything?"
Sleep 200ms
Enter
Sleep 600ms

Type "tokenburn optimize --simulate --model claude-haiku-4-5"
Sleep 300ms
Enter
Sleep 2500ms

# Let simulation output render
Sleep 2500ms

# ============================================================
# Scene 4: Agent cost tree
# ============================================================

Type "# See cost per agent turn in a session"
Sleep 200ms
Enter
Sleep 600ms

Type "tokenburn tree --last 3"
Sleep 300ms
Enter
Sleep 2500ms

# Tree output renders
Sleep 3000ms

# ============================================================
# Scene 5: Dashboard (opens browser)
# ============================================================

Type "# Full dashboard in your browser"
Sleep 200ms
Enter
Sleep 600ms

Type "tokenburn dashboard"
Sleep 300ms
Enter
Sleep 2500ms

# Dashboard starts, shows URL
Sleep 2000ms

# Send Ctrl+C to stop the server
Ctrl+C
Sleep 800ms

# Hold final frame
Sleep 2000ms
