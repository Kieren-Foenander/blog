---
title: "Forgive me Father For I Have Ralphed"
description: "After multiple failed attempts with AI Ralph loops, I discovered they only work for specific tasks: quantifiable progress, atomic fixes, and zero risky assumptions. Here's how I fixed 150 TypeScript errors in 27 iterations without changing runtime behavior."
pubDate: "Mar 04 2026"
heroImage: "../../assets/ralph-article.png"
---

If you don't know what a Ralph loop is I'll give you a quick rundown. Its essentially just a bash loop that sends the same prompt to an AI agent with some kind of checklist and way of managing what it has already done so it knows where it left off. It is a strategy to keep AI context window low so the AI is smarter when making changes. As a general rule, the higher an agents context window is the dumber it gets. There are lots of different ways to implement this but I find the one that works best is to have a PRD/plan markdown file with what you are trying to do, this should most of the time have some sort of list that the agent can tick off as it goes. It also needs a memory so at the start of each session it can give itself a brief refresher of what it has already done. Some people put this in another markdown file but I like to have it query the git history and ensure it writes meaningful commits to refresh itself instead.

I've played around with this few times now and despite everyone online screaming about how good ralph is, each time I've tried I have gotten less than average results. The problem I always run into is when left to its own devices (which is the whole point) the agent is forced to make assumptions and once that assumption is made there is no turning back. The agent is locked in on whatever decision it made very early on. Even if you give the AI a good feedback loop with type checking and tests to ensure its not breaking existing functionality as soon as it makes a bad assumption, you're new feature is cooked. Now you could call it a skill issue, maybe my PRD just wasn't clear enough, but if I can't get a good enough PRD after getting AI to grill me with questions for 20 minutes to make a plan. And bad assumptions still get made I no longer see this method as being productive.

Until today. I think I have found the perfect use case for the ralph loop. In our codebase we started developing on nuxt3, we have just recently attempted an upgrade to nuxt4 and in doing so learnt that typescript gets set to strict mode by default. After we did the upgrade the codebase lit up with ~150 new type errors that were previously missed due to not having strict mode on. This gave me the idea. This issue is quantifiable by the return value of the typescript compiler, it can be broken up into small sub tasks that can be tackled one by one. And most importantly **bad assumptions won't affect the overall outcome**. We are not looking to change any functionality but simply make the compiler happy and ensure all existing functionality stays the same.

Here is the plan file I used.

```markdown
# Plan: Fix TypeScript Strict Mode Errors

## Goal

This repository was developed with TypeScript strict mode set to false. It has
now been set to true, exposing many type errors. The goal is to fix _all_
TypeScript errors systematically — not with quick hacks, but with proper,
type-safe solutions that improve code quality.

## Principles

1. _Understand before you fix._ Read surrounding code, check how values flow,
   and understand why the error exists before changing anything.
2. _Look for patterns, not just symptoms._ If you see the same class of error
   in multiple places, fix them together as a batch. Examples:
   - Missing null checks on a commonly used utility
   - A shared type that should have been | undefined
   - Implicit any on event handlers across components
3. _Never change runtime behaviour._ The app should work identically before
   and after each fix. You are only improving type safety.
4. _Prefer narrow fixes over broad escapes._ Avoid as any, @ts-ignore,
   or overly loose types. Use type guards, narrowing, proper generics, or
   explicit | undefined as appropriate.
5. _Small batches, always verified._ Fix a small, coherent group of errors,
   then run the typecheck to confirm the count went down and nothing new broke.

## Typecheck Command

pnpm dlx nuxt typecheck

## Workflow Per Iteration

1. _Run the typecheck command._ Capture the output.
2. _Triage the errors._ Group them mentally by:
   - File / module (co-located errors are often related)
   - Error code (TS2322, TS2532, TS7006, etc.)
   - Root cause (e.g. a shared type is wrong → many downstream errors)
3. _Pick ONE small, coherent group_ to fix this iteration. Prefer:
   - Upstream fixes first (fixing a type definition may resolve many consumers)
   - Errors in the same file or closely related files
   - A single error category (e.g. all Object is possibly undefined in one
     composable)
4. _Explore the code_ around each error. Read the file, check imports, look at
   how the value is produced and consumed. Understand intent.
5. _Make the fix._ Apply the smallest correct change.
6. _Re-run the typecheck._ Confirm:
   - The errors you targeted are gone
   - No new errors were introduced
   - Total error count decreased (or stayed the same if you refactored types
     that will pay off in the next iteration)
7. _Commit and log._ Follow the Ralph commit format.

## Completion Criteria

- pnpm dlx nuxt typecheck exits with _zero errors_.
- No @ts-ignore, @ts-expect-error, or as any was added (unless
  absolutely unavoidable and documented in memory.md with justification).
- No runtime behaviour was changed.

## Progress Tracking

After each iteration, update the commit log. The commit messages themselves
serve as the progress record. If the total error count is noteworthy, log it
in memory.md so future iterations can see the trajectory:
```

And here is the `ralph.ps1` file (Our team is on windows machines so using powerShell instead of bash but you could easily pump this into claude or codex and say convert to a shell script).

```powershell
param(
    [Parameter(Mandatory = $true, Position = 0, HelpMessage = "Path to the plan file.")]
    [string]$PlanFile,

    [string]$MemoryFile = ".agent/.ralph-memory.md",
    [int]$MaxIterations = 25,
    [string]$DoneFile = ".agent/.ralph-done"
)

# --- Validate inputs ---
if (-not (Test-Path $PlanFile)) {
    Write-Host "ERROR: Plan file '$PlanFile' not found." -ForegroundColor Red
    exit 1
}

# Clean up from previous runs
if (Test-Path $DoneFile) { Remove-Item $DoneFile }

# Ensure memory file exists
if (-not (Test-Path $MemoryFile)) {
    @"
# Ralph Memory

Non-obvious learnings, gotchas, and context discovered during execution.
Do NOT bloat this file. Only add entries that confer real value for future iterations.
Remove entries that are no longer relevant.

---

"@ | Set-Content $MemoryFile -Encoding UTF8
}

$ITERATION = 0

Write-Host "=== Ralph Loop Started ===" -ForegroundColor Cyan
Write-Host "Plan: $PlanFile"
Write-Host "Memory: $MemoryFile"
Write-Host "Done flag: $DoneFile"
Write-Host "Max iterations: $MaxIterations"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

while ($ITERATION -lt $MaxIterations) {
    $ITERATION++
    Write-Host "--- Iteration $ITERATION / $MaxIterations ---" -ForegroundColor Yellow

    $message = @"
You are Ralph, an autonomous agent working on a SINGLE large task across many small iterations.
Each iteration you do ONE small, atomic piece of work. Keep your context window small. Be surgical.

## Step 1 — Orient yourself (do this FIRST, every time)
1. Check the current branch commit history to load context from previous iterations.
2. Read $MemoryFile for non-obvious learnings and gotchas from previous iterations.
3. Read $PlanFile to understand the overall goal.
These three steps tell you where you are and what's been done. Do them before anything else.

## Step 2 — Execute one micro-step
1. From the git log and plan, identify the NEXT logical micro-step. Do NOT try to do everything.
2. Execute the micro-step. One small, meaningful piece of work.
3. If you need external knowledge (packages, APIs, docs), search for it. Be pragmatic.

## Step 3 — Record your work
1. Write a DESCRIPTIVE git commit message that future-you can use to reconstruct context.
   Format: ralph: <what you did> | next: <what should happen next>
2. If you discovered something non-obvious (a gotcha, a constraint, an insight) that would save
   future iterations time, append it to $MemoryFile. Keep entries terse. Remove stale entries.
3. If $MemoryFile is getting bloated (>50 lines of entries), prune old/irrelevant entries.

## Step 4 — Completion check
When the ENTIRE task described in $PlanFile is complete, create the file $DoneFile and exit.

## Rules
- NEVER git push. ONLY commit.
- NEVER verify that edits or commits succeeded by re-reading files you just wrote. Trust your tools.
- ONE micro-step per iteration. Then stop. The loop will call you again.
- If you are STUCK, write what you tried and why it failed into $MemoryFile so the next iteration can try a different approach. Then stop.
"@

    copilot -p $message --allow-all

    # Check if the agent signalled completion
    if (Test-Path $DoneFile) {
        Write-Host "=== Ralph Done! ===" -ForegroundColor Green
        break
    }

    # Brief pause between iterations
    Start-Sleep -Seconds 2
}

if ($ITERATION -ge $MaxIterations) {
    Write-Host "=== Max iterations reached ===" -ForegroundColor Red
}
```

You may notice how I said earlier that I liked to used git for the agents memory but I still have a memory file. I do use git for the main portion of memory context but I like to also include this file as a way for the agent to document bespoke or non-obvious learnings that a previous agent may have already encountered. So I use this as a bit of a pre-warning so later agents don't waste time going down a rabbit hole they don't need to.

With all this in place I spun up a new git work-tree, ran the command `./.agent/ralph.ps1 .agent/plan.md -MaxIterations 20` and after 2 runs, 27 iterations and 2 hours of working in the background all type errors were now gone again. I am now able to review all the changes and make the small tweaks necessary and we don't need the looming tech debt ticket of `remove typescript strict mode false and fix type errors`. So from now on I will still ralph on occasion but if I do, it will be for a task that is quantifiable from the start, each task will be atomic, and the task will have zero or very few bad assumptions that can be made without my input.
