# Project notes for Claude

Activity search: a personal app that syncs erin's activities from the Garmin Connect Personal API into Neon Postgres and shows them in a paginated table. Hosted on Netlify (functions in `netlify/functions/`, shared code in `lib/`, React front end in `src/`).

## Coding standards

These rules match erin's `coding-standards` skill. Follow the spirit of each rule, not just its wording, and before every push work through the checklist at the end of this file against the diff.

## erin works without a terminal

Setup and anything erin has to do must be possible in a browser (GitHub, Netlify, Neon, Garmin Connect). Don't hand over steps that need a console. Work that needs to run somewhere runs on Netlify (the hourly `sync-schedule` function starts the `sync-garmin` background function).

## Node and Temporal

The project runs on the Node version in `.nvmrc` (also pinned in `package.json` engines), which has `Temporal` built in. Use Temporal rather than `Date` or hand-rolled parsing for dates and times. Containers for Claude Code on the web start on an older Node, where code using Temporal fails with `Temporal is not defined`; `.claude/hooks/session-start.sh` installs and selects the pinned version at session start. If that failure shows up, check `node -v` first.

## Checks

`npm test`, `npm run typecheck` and `npm run format` (Prettier, single quotes). Run all three before pushing.

## PRs with visible changes

When a change affects anything visible in the UI (layout, colour, sizing, new components, etc.), capture screenshots showing the change, as long as capturing one is feasible (e.g. a Vite preview with the API mocked, in a headless browser), and show them in chat rather than attaching them to the PR. Prefer before/after or open/closed states where relevant. Skip this only when no visible surface changed, or a screenshot genuinely can't be captured.

Don't commit screenshots into the repo to get them into a PR - GitHub's API doesn't take image attachments directly, and committing PNGs just to work around that leaves them sitting in history for no lasting benefit. Say what you verified in chat, along with the images themselves, where they're free to include without that tradeoff.

## No module-level variables for cross-component state

Don't reach for a `let` at module scope to pass ephemeral state between component instances (e.g. "which item should regain focus after the next render"). It's invisible to React's data flow and got flagged in review. Reach for a hook instead - often a plain `useRef` inside the component already does the job: React preserves a component instance (and its refs/state) across a re-render as long as its `key` doesn't change, even if it moves position within a keyed list, so state that only needs to survive "this instance, across its own re-render" doesn't need to live outside the component at all. Only use React Context (with a Provider mounted above the components that need to share it) for state that genuinely must be shared _across_ different component instances.

## Only comment what the code can't say

Write code that reads on its own - name things well, keep functions small - and only add a comment when it explains something a reader couldn't work out by looking at the code: a browser or library quirk, a constraint from outside the file (data written by older versions, how real Firebase behaves), a test fixture fact like which weekday a date falls on, or why the obvious approach would break. A comment that restates what the code does, labels a section, or leaves code commented out doesn't earn its place. This applies to every language and file type here, scripts and config included. The reasoning behind a change belongs in the commit message or the PR description.

## Function names describe what the function does

A function name should describe what the function does. As such, it should include both a verb and a noun - `createItem`, NOT `item`. If a function name uses the verb "resolve" because it does multiple things, it's probably a bad function.

A verb and a noun are the minimum, not the test. The name has to tell a reader what this specific function does without opening it: `syncWithGarmin`, not `runSync`; `connectToDatabase`, not `getSql`. Generic verbs (`run`, `get`, `handle`, `process`, `do`) and generic nouns (`data`, `item`, `result`, `info`, `sql`) need a reason. The same goes for variables and parameters: no `a`, `v`, `la`, `res`, `opts`, `p` outside a one-line callback.

## No default exports unless something requires them

Use named exports. Only use a default export when a framework or tool requires it (here, Netlify functions). Even then, give the function a name: `export default async function getActivitiesPage(...)`, not `export default async (...) =>`.

## One component per file

Give every component its own props type, and its own file. A child component only belongs in its parent's file when it's very small (under 10 lines), has no real logic of its own, and is tightly coupled to the parent. Anything bigger, or anything with state, handlers or derived values, gets its own file, even if only the parent uses it. When a component starts doing several jobs, split those jobs into child components rather than letting the file grow.

## No comments that document abandoned approaches

A code comment should explain the code that's actually there - never an alternative you tried, reasoned about, and discarded before landing on the final version. Comments like "this doesn't need X" or "unlike the previous approach, this avoids Y" reference an implementation history that isn't in the file: nothing on the page shows what X or "the previous approach" was, so a future reader (who never saw your intermediate attempts) has no way to resolve what the comment is contrasting against. It reads as confusing at best, meaningless at worst.

That narrative belongs in the PR description or commit message, where "here's what I tried and why I changed direction" actually has the surrounding context to land in. In the code itself, only document a non-obvious property of the code as it stands - e.g. "this edge is stable regardless of the box's height" is fine; "this doesn't need the max-height reset the earlier version had" is not, because the earlier version is gone and nobody reading this file will ever see it.

Before finishing any change, reread new comments as if you have no memory of the debugging session that produced them - if a comment only makes sense to someone who watched you write and discard code, cut it or rewrite it to describe only what's actually there.

## Test the current behaviour, not the change

A test describes what the code does today, for someone who never saw the version before it. Write it that way: if a change removes close-on-blur, the test worth having is one that pins down what closing the form _does_ require, not one that memorialises what used to happen. A test that only makes sense as a diff against an earlier implementation is the test equivalent of a comment about an abandoned approach.

The tell is an assertion that something _didn't_ happen where nothing gave it any reason to happen. `expect(onSubmit).not.toHaveBeenCalled()` after a validation error is a real test - submission was attempted and the code stopped it. The same assertion when nobody clicked submit tests nothing; it would pass against an empty component. Likewise "expect the form not to submit" is a claim about behaviour, while "expect the input to still be on the screen" after an unrelated click is just restating that React didn't unmount something for no reason.

Before writing a negative assertion, ask what would have to be true for the thing to happen at all. If the answer is "nothing in this test", cut the assertion and test the positive path instead.

## Don't assert absence with queryBy

`expect(screen.queryByRole("textbox")).not.toBeInTheDocument()` usually tests nothing. If the input gains a label, changes role, or the whole block stops rendering for an unrelated reason, the query returns null and the test still passes - including in exactly the broken state it was meant to catch.

When the point is that an element _disappears_, grab it with `getBy` while it's still there, hold the reference, and assert on that reference afterwards:

```js
const input = screen.getByRole('textbox', { name: 'Description' });
await user.keyboard('{Escape}');
expect(input).not.toBeInTheDocument();
```

That version fails if the element is still mounted, and it also fails at the `getBy` if the starting state was never right. Reach for `queryBy` only when the element genuinely never existed in the test - and then consider whether the assertion is earning its place at all.

## Group tests in describe blocks

Don't write a test file as a flat list of `it`s. Group them in `describe` blocks - by the thing under test, and then by the condition it's under - and work out the groupings yourself rather than waiting to be given them. Nested describes are good: `describe("paused tasks") > describe("when one is due today") > it("wakes it up")`.

The point is that the name of a test should read as a sentence with the describes above it, so a failure tells you the situation as well as the broken expectation. It also stops the same setup being restated in every test name, keeps related cases next to each other, and makes a missing case obvious - an empty branch of the tree is easier to spot than an absence in a list.

This applies to a file with three tests in it, not just to big ones.

## Don't resolve review comments

Reply to review comments, push the fix, and leave the thread open. Resolving is the reviewer's call - it's how they track what they've checked, and closing a thread on their behalf hides it from them before they've seen the change. This holds even when the comment is unambiguous and the fix is obviously what was asked for.

## PR descriptions are for the record, not for erin

Write a PR description if it's useful, but don't expect erin to read it. Anything erin needs to know or act on goes in chat as well.

## No placeholder text in form fields

Never use placeholder text in form fields (the greyed-out text inside an empty input). It disappears the moment the user types, is invisible to screen readers by default, and gets mistaken for a filled-in value. Use a `<label>`, help text below the field, or a tooltip instead.

## Target browsers

Nothing needs to run on Safari. Don't add polyfills, fallbacks or workarounds for it.

## CSS lives with its component

Each component imports its own CSS file, kept next to it (`ActivitiesTable.tsx` and `ActivitiesTable.css`). Scope its selectors to the component (`.pagination button`, not `button`). `src/index.css` only holds design tokens, `body`, and genuinely global utilities such as `.visually-hidden`.

## Before every push: check the diff against these rules

Read through the whole diff (`git diff` against the base branch) with this list open, and fix anything it turns up before pushing. Don't skip it for small changes.

1. **Names.** Every new or renamed function, variable and parameter: does the name alone tell a reader what it does or holds? Verb + specific noun for functions. No single letters or abbreviations outside one-line callbacks.
2. **Comments.** Every new comment: would a reader be unable to work this out from the code? Cut anything that restates the code, labels a section, or only makes sense to someone who saw an earlier version.
3. **Exports.** `grep -n 'export default'` on the diff: each one must be required by a framework, and must be a named function.
4. **Components.** One component per file with its own props type. Any component file doing several jobs gets split.
5. **CSS.** New styles sit in the component's own CSS file, with scoped selectors.
6. **Dates.** `grep -n 'Date'` on the diff: no `new Date`, `Date.now`, `Date.UTC` or date regexes; use Temporal. Types for dates and times are Temporal types, not strings, past the JSON boundary.
7. **Tests.** Nested describes that read as sentences; no negative assertions with nothing to trigger them; no `queryBy` absence checks.
8. **UI.** No placeholder text; no Safari workarounds.
9. **Visible changes.** Screenshots taken and shown in chat.
10. **Checks.** `npm test`, `npm run typecheck` and `npm run format` all pass.
