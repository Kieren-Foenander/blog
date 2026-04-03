---
title: "Re-Rolling With Advantage"
description: "AI agents often get you to working code, just not code you want to keep. “Re-rolling with advantage” is a practical prompting strategy for using the first attempt to guide a better second one."
pubDate: "Apr 03 2026"
heroImage: "../../assets/re-rolling-with-advantage.png"
---

Tell me if this sounds familiar. You write a prompt for your new feature. The agent thinks for a bit and builds the feature but then you read the code and just think, ew. Although the feature now exists and is “working” there is something off. Things you would not have done, abstractions that don’t need to be there. A goddamn `useEffect`… Now you spend the next few attempts either battling with your agent to fix what you don’t like or handling things yourself. The problem with the former is once the model has chosen a path, getting it to escape that can be harder than just starting over. The problem with the latter, how much time are you really saving now if you’re having to refactor it all yourself.

This is a bit overdramatized, but where I have been finding success lately is by what I am calling re-rolling with advantage. I’m not talking about taking the same prompt and throwing it at a different model or harness to see if the dice land better. I mean letting the agent build the feature, reading the code closely, finding what’s wrong and what I would have done differently, and then feeding those lessons back into the original prompt. It’s a bit like Groundhog Day. Once I’ve seen how the prompt plays out, I already know where this version of the day ends. So instead of trying to salvage it, I start a new session and run it back with the new knowledge I have.

The whole key to this approach is that the first output is extremely useful, even though I know most of the time I am going to throw it away. It tells me what I failed to say. It exposes the assumptions the model made on my behalf. Once I can see those assumptions in code, it becomes much easier to tighten the prompt than to keep negotiating with an implementation I already dislike. Using this strategy I am nudging the agent to create the code that I actually want to maintain. And the best part is that the agent has no attachment to any code it’s generated, because it has no idea it ever existed.

This is what’s working for me right now. But hey, give it about three weeks and this post will probably start to look like internet explorer.