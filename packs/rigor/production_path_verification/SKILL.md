# Verify the production path

## Measure the rendered layout

- Read the bounding box of every element a layout claim names at load with scroll at zero and record its top and bottom in the report.

- Treat a claim that two elements sit beside each other as failed when the top of one sits below the bottom of the other at load.

- Reject a screenshot alone as proof of a layout claim when no bounding box numbers back it.

- Re-measure after a layout fix at the same viewport and scroll position that first showed the failure and record both sets of numbers.

## Exercise the production path

- Trace a guard or installer from the entry point production calls with no injected host and no test double in the chain.

- Treat a test that constructs a fake host as unproven for the production path even when it passes.

- Add a second test through the no argument default path whenever the first test pins a fake path.

- Install and remount repeatedly through the default path and count the resulting listeners or effects after each round.

## Demand a test oracle for every invariant

- List every invariant word in the claim, such as never, always, only once, or stands down.

- Write one automated test for each listed invariant that asserts that exact behaviour directly.

- Wait longer than the longest delay or probe in the chain before asserting a stand down or a never loops result.

- Reject a timing test that waits less than the delay it guards as vacuous even when it passes.

- Report a behaviour that only a manual probe covers as untested in the verdict instead of passing it.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.

## Alternatives for better results

- Run the independent reality checker gate after these three checks so a second reviewer re-runs the decisive evidence itself.

- Split a claim into one invariant per test so a single passing test cannot hide a failing sibling behaviour.
