# Skillpath

Landing page for a fictional learning platform, built in Framer. The courses
section is a React code component that pulls live data from a deliberately
flaky API.

- **Live page:** https://skill-path-courses.onrender.com/
- **Code:** this repo. [`SkillpathCourses.tsx`](./SkillpathCourses.tsx) is the section that matters

## Files

| File | What it is |
| --- | --- |
| `SkillpathCourses.tsx` | The courses section. Fetching, states, currency, grid. |
| `SkillpathHero.tsx` | Headline, subline, one button. |
| `SkillpathFooter.tsx` | Three links and a copyright line. |

## Installing in Framer

Framer → Assets → Code → **New Code File**, paste the file, and drag the
component onto the canvas. Set the courses section to **Fill** width; height is
auto.

## The API

Base: `https://syncsphere-hiv6.onrender.com`

- `GET /assignment/course-data` → array of 5-10 courses (count varies per call)
- `GET /assignment/country-code` → `{"country_code":"IN"|"US"}`, flips between the two

Roughly 1 in 3 requests returns 404 or 500. Every method other than GET returns
405, so the component only ever sends GET.

## Decisions worth pointing at

**Retries, not a single shot.** The API fails randomly rather than
persistently, so a retry is a fresh roll of the dice. Three attempts with
300ms → 600ms backoff takes a ~33% failure rate to roughly 4%, and still shows
the error state inside a second when the service is genuinely down.

**The two calls are independent.** `Promise.allSettled`, not `Promise.all`.
Courses *are* the section; country only decides which currency to print. If
country fails and courses succeed, the grid renders in full using the fallback
(IN) and a line under the grid says the region couldn't be detected, with a
retry link. Hiding prices or blanking the section because a *secondary* call
failed would be the wrong trade. If the country call fails but returns an
unrecognised code, it takes the same path.

**Price math.** Both fields are minor units. Divide by 100, then hand the
result to `Intl.NumberFormat` so it places the symbol, the grouping (`en-IN`
groups as `1,99,900`, not `199,900`) and the decimals. `199900` paise renders
as **₹1,999**; `3999` cents renders as **$39.99**. Trailing `.00` is dropped
because that's how prices are written on a real pricing page.

**Columns come from the element, not the window.** A media query on the Framer
canvas measures the editor viewport, so a frame sitting at phone width would
still get three columns. A `ResizeObserver` on the section measures the section:
≥960px → 3, ≥620px → 2, below → 1. Grid tracks are `minmax(0, 1fr)` so a long
unbroken word can't push a column past its share.

**Four states.** Skeleton cards while loading (count follows the current column
count, since the real card count is exactly what isn't known yet) → error with
a retry button and the raw status kept small and quiet → two different empty
states, one for "the catalogue is empty" and one for "your search matched
nothing" → the grid.

**The extra field is `mainCategory`.** It's the one a learner scanning a grid
actually uses to decide whether a course is for them. `courseCode` and
`mangoId` are plumbing, `shortCourse` is a truncated name, `courseType` means
nothing to a buyer.

## Property controls

| Control | Type | Why |
| --- | --- | --- |
| Heading | String | The copy a designer changes first, every time. |
| Accent | Color | Repaints the category label, buttons and enroll pill from one swatch. |
| Search | Boolean | Show/hide the filter. |
| Sort | Boolean | Show/hide price sorting. |

## Extras

Search, sort by price, skeleton loaders, retry button, and a refundable badge
that only renders on `refundable === true`. Sorting uses the minor-unit field
for the *active* country so the order always matches the currency on screen.

## Note

I'd spend the first of two extra days on caching. Every remount refetches, and
on a flaky API that means a visitor can hit the error state on a section they
already saw working. A short-lived cache plus a stale-while-revalidate render
would fix it.

The country fallback is the thing I'm least settled on. Defaulting to IN is a
guess dressed up as a decision. It's right for this project's likely audience
and wrong for half the internet. A real build would read the region from a
first-party signal and treat this endpoint as a hint. I kept it because the
alternatives were worse: hiding prices makes the section useless, and showing
both currencies makes every card cluttered to route around one failed call.

Where I got stuck: responsiveness on the Framer canvas. My media queries looked
correct and behaved wrongly, because inside the editor they measure the browser
window and not the frame. Switching to a `ResizeObserver` on the section fixed
it, and that's also why the skeleton count is derived rather than fixed.

Not happy about: no `prefers-reduced-motion` handling, no keyboard focus
styling on the search input, and the skeletons are static blocks rather than
animated, because a Framer code component can't rely on a global stylesheet for
keyframes and I didn't want to inject a `<style>` tag for it.

## AI usage

Claude (Opus). Roughly 30-40% of the code, mostly the first pass.

What it wrote: the initial `fetch` wrapper, the card markup and most of the
style object, the search/sort `useMemo`.

What I changed:

- Its first fetch used `Promise.all`, which meant a failed country call killed
  the courses too. Swapped to `allSettled` and split the failure handling.
- It formatted prices with string concatenation (`"₹" + pricePaise / 100`).
  That produces `₹1999`: no grouping, and wrong grouping style for `en-IN`.
  Replaced with `Intl.NumberFormat`.
- It retried on every error including aborts, which fired retries on unmount.
  Added the `signal.aborted` check.
- It used media queries for the grid, which is the canvas bug above. Rewrote
  with `ResizeObserver`.
- It had one empty state. I split it into "no courses" and "no search results"
  because they're different problems for the visitor.
