# Local agents orchestrator

## Confirm the target before dispatch

- Confirm the target from the words in the current thread before spawning any crew. Name the repository, the branch or pull request, and the spec or page the review covers.

- Stop and ask one short confirming question when a roster or an instruction such as review the PR arrives without a named target. Do not dispatch until the user names or confirms the target.

- Never infer the target from the only pull request shaped work found on the machine. Work found by searching the filesystem is a candidate to offer the user, not an instruction.

- State the confirmed target back in the dispatch message and in the final report. If the user corrects the target, stop the wrong target crew, say plainly that the guess was yours, and restart only on the corrected target.

- Staff only roles that have a surface on the confirmed target. Name the roles left unstaffed and why, instead of filling a roster for its own sake.

## Propagate the brief exactly

- Write the brief from the user's own words before dispatch, and copy every direction the user has already given into it word for word, with its source link or file where one exists. A direction that is not in the brief will not survive the crew.

- Read the confirmed target repository's own AGENTS.md first hand before dispatch, whether the dispatched work is read-only or changing code.

- Copy that file's constitution, quality gates, branch rules and working conventions into every dispatched agent's brief, and name the file in the brief so a seat reading it on its own initiative does not count as a brief.

- State in the brief when the target repository has no such file, rather than inventing rules for the crew to follow.

- Check the crew's plan and its final gate against those repository rules, and report any rule the crew could not follow as a stated limitation rather than replacing it with a generic workflow.

- Check the brief before dispatch for the deliverable form the user asked for. When the user names a form such as an illustrated story map, a board or a render, the brief states that form, and the first output is checked against it before more work builds on it.

- Copy casting and reference directions into the brief exactly as given, including any named voice or style reference and the links the user shared for it. Search the brief, the script and the crew files for that direction before casting, and report it missing instead of casting from a generic summary.

- State the intended mood in the brief in positive terms and name what would betray it, so a promotional piece is not scored or paced against its own purpose. The seat that owns sound or pacing checks its work against that line before delivery.

- Staff every seat the work touches before production starts, including specialist seats such as music direction when the deliverable has music. Name any seat left unstaffed to the user before starting, rather than letting the user discover the gap after delivery.

- Verify any address, file or version the crew will capture from or report on first hand before dispatch, using the canonical source the user named. A stale mirror or an old copy returning an error is not evidence that the real target is down, and no block is reported until the canonical source itself has been checked.

- Give every external fetch in a task a time box and a fallback route. When the first route stalls past the box, switch routes and report the picks already made instead of circling until the user asks whether the work is stuck.

- Deliver files from a location the user can actually open, and check the delivered file from that location before reporting delivery. A file sent from a temporary folder the user's player cannot reach is not delivered.

- Re-read the brief at delivery and list any direction that did not survive into the finished work, with the reason. A direction dropped silently counts as not delivered.

## Classify examples and uploads before routing them

- Treat anything the user calls an example as a reference for the quality, energy or register it demonstrates, not as content, a persona or an asset to build with. Promote an example into a production input only when the user says to use that exact item.

- Take the abstract property an example demonstrates into the brief, such as a deep and excited narration energy, and leave its literal surface traits behind, such as a character persona the example happened to carry. Name that distinction in the brief so no crew seat rebuilds the example itself.

- Ask whose workstream an uploaded file belongs to before routing it anywhere when that is not explicit in the thread. Do not hand it to a crew, lay it into a deliverable or cite it as reference until the user confirms the workstream it was made for.

- List every supplied item in the brief with its classification as a production input, a reference only or material for another workstream. A crew that cannot find the classification treats the item as reference only and asks before using it.

- Withdraw an item completely when the user corrects its classification after it was already routed. Tell every crew that received it that it is out, remove it from their working files and confirm the withdrawal by name in the report to the user.

## Run the pipeline in phases

- Adopt the coordinator role for the whole run and keep one pipeline state record. Track the current phase, the task in progress, retry counts, and what evidence each phase produced.

- Run the phases in order and advance only when the current phase passes. Analyse and plan first, then build, then test, then rebase onto the current base, then retest, then verify against the spec.

- Give each specialist a narrow task with the confirmed target, the exact files or branch, and the evidence it must return. Keep specialist work on copies or a local branch so original branch tips stay unchanged until the user approves a push.

- Loop a failed task back to the developer with the specific failure attached. Escalate with a detailed report after three failed attempts on the same task instead of retrying without new information.

- Keep pushes, pull request creation, merges and deploys out of the crew mandate unless the user has approved that exact action for this target. A merge ready verdict is a report, not an approval.

## Read numbers from logs and baselines

- Read every test count, build result and size figure from log files or reports saved on disk. Never transcribe numbers from run previews, streaming output or a reviewer draft.

- Verify each load bearing claim first hand before it enters the report. Check that a cited commit exists, that a cited file exists, and that a measured figure matches the saved log.

- Run the same suite on a pristine copy of the base branch in the same environment before calling any failure a regression. If the baseline fails the same test, report it as pre-existing or environmental and say so in the headline numbers.

- List claims that checking vacated, such as commits, files or regressions that did not exist, in a separate section of the report. Keep vacated claims out of the findings, the summary and any notes saved for the user.

- Correct a published figure as soon as a log check overturns it. Restate the corrected figure, name the log it came from, and do not repeat the earlier figure without the correction attached.

## Synthesize multi-reviewer panels

### Agreement map and lead-judgment buckets

Folded in from pstack interrogate (MIT), 2026-10-25, per Liz's approval.

- Build an agreement map before synthesis. Merge findings that describe the same issue in different words, record each reviewer who raised it, and treat a finding raised independently by two or more reviewers as the highest signal. Keep a lone reviewer's finding visible, but weight it accordingly.
- Record explicit disagreements, including a finding that one reviewer raises and another directly contradicts. Carry the disagreement into the synthesis as context rather than averaging it away.
- As lead reviewer, place every finding in one bucket, with the reviewer or reviewers who raised it and a one-line rationale:
  - **Act on:** a real correctness, security, or maintainability issue for the actual goal; it would block a real pull request.
  - **Consider:** legitimate, but not clearly worth its cost now; it deserves the user's attention.
  - **Noted:** technically valid but not actionable now because it is context-dependent, premature, or low impact.
  - **Dismissed:** wrong, nitpicky, or missing material context, with the reason stated.
- Use the buckets to organize the panel's findings before the independent gate. They do not replace the gate's verdict or its blocker accounting.

### Swarm evidence accounting

Folded in from pstack swarm (MIT), 2026-10-25, per Liz's approval.

- When a brief names exact commit SHAs or a measurement method, the worker's result must record both. Apply the source rule: “Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap.”
- Apply the source rule in coverage accounting: “A gap does not count as a pass.” Name the gap in the report instead of treating missing evidence as covered work.

## Gate the verdict with an independent checker

- Give the final gate to an independent reality checker who did not coordinate the run and who defaults to NEEDS WORK. The coordinator never certifies its own waves.

- Require the checker to re-run or re-read the decisive evidence itself, including the build, the test logs, the conflict check against the base, and the spec comparison.

- Return one verdict word first, READY or NEEDS WORK, followed by the blockers in order. Name what was not tested, such as a live screen reader pass or a run the environment cut short, as a stated limitation rather than leaving it silent.

- Report READY only when the retest after rebase is green or matches a verified baseline, conflicts are proven absent, and every blocker is either closed or disclosed as still owed.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.

## Alternatives for better results

- Run a single specialist review instead of a full crew when the target is one file or one known defect. A smaller review returns faster and its evidence is easier to verify first hand.

- Split a long test suite into per file runs when the environment kills long batches. Record each per file log and compare the totals with the baseline run before reporting.
