"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { Button, ClearButton } from "@/app/components/Controls";
import BottomBar from "@/app/components/BottomBar";
import Icon from "@/app/components/Icon";
import { SCROLL_LANE } from "@/app/components/scrollLane";
import { DESTINATION_PARAM } from "@/lib/loginDestination";
import { JOBS_PARAM, jobRows, USER_JOBS_COPY as COPY } from "@/lib/userJobs";
import { PageRefusal, SignInHeader } from "../SignInParts";
import { chooseJobsAction } from "./actions";

/**
 * The job step's list, drawn as the design draws it (#554, Sign in 1k on a phone and 1l at a
 * desk): the heading and its sentence, a search, every job — its code and its name — to tick,
 * and the action, which says how many it saves.
 *
 * TWO LOOKS FOR ONE LIST. At a desk the column stands 10% of the window from its top and its
 * foot (0o, the layout reads `data-sign-in-list`) and the list fills what is left, scrolling in
 * 0i's lane with a Rule at each edge its rows are hidden past; a row is 36, its box first. On a
 * phone the page scrolls, the search stands in a band that holds to the top with a soft edge
 * once rows run under it, and the action rides in the foot bar; a row is 64, its code over its
 * name, its round check last.
 *
 * NOTHING CHOSEN IS SAID TWO WAYS, AS THE TWO DRAWINGS SAY IT. At a desk `Continue` is disabled
 * with `Choose at least one job.` over it at Ink 3 (1l); on a phone no button is ever disabled,
 * so `Continue` is live and a press says the same sentence in Red 12 above it, until a job is
 * chosen (Tools 0a Busy, 1k-c). So the action is drawn once per width, each hidden at the other.
 *
 * WHILE SEARCHING, THE JOBS CHOSEN BEFORE THE SEARCH STAY AT THE TOP (`jobRows`), so a choice
 * is never out of sight because of what was typed. Every chosen job is sent, shown or not, as a
 * hidden field of its own.
 *
 * EVERY WORD COMES FROM `lib/userJobs.js`, where a check can hold it.
 */
export default function JobsForm({ jobs, destination = "" }) {
    const [state, formAction, pending] = useActionState(chooseJobsAction, {});
    const [chosen, setChosen] = useState(() => new Set());
    const [query, setQuery] = useState("");
    const [pinned, setPinned] = useState([]);
    const [tried, setTried] = useState(false);
    const [answered, setAnswered] = useState(state);
    const searchRef = useRef(null);
    const noteId = useId();

    // A refusal from the action — nothing chosen, or nothing left of it — is the press's, as
    // the phone draws it; adjusted as the answer is rendered, React's way.
    if (state !== answered) {
        setAnswered(state);
        if (state?.refusal) setTried(true);
    }

    // Only a job the page still lists counts as chosen: the action redraws the page when a job
    // went since it was drawn, and what was ticked on it goes with it.
    const chosenIds = jobs.filter((job) => chosen.has(job.id)).map((job) => job.id);
    const count = chosenIds.length;
    const { rows, noMatch } = jobRows({ jobs, chosen: chosenIds, query, pinned });

    function toggle(id) {
        if (pending) return;
        setChosen((was) => {
            const next = new Set(was);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function search(typed) {
        // The choice as it stands when a search begins is what stays at the top through it.
        if (!query.trim() && typed.trim()) setPinned(chosenIds);
        setQuery(typed);
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (pending) return; // a second press while the first is on its way
        if (count === 0) {
            setTried(true);
            return;
        }
        startTransition(() => formAction(new FormData(event.currentTarget)));
    }

    const failed = Boolean(state?.error) && !pending;
    const refused = tried && count === 0;
    const label = COPY.action(count);
    return (
        <form data-sign-in-list="" onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col sm:min-h-0">
            <SignInHeader heading={COPY.heading} sentence={COPY.sentence} />
            <input type="hidden" name={DESTINATION_PARAM} value={destination} />
            {chosenIds.map((id) => (
                <input key={id} type="hidden" name={JOBS_PARAM} value={id} />
            ))}
            <SearchBand value={query} onChange={search} readOnly={pending} inputRef={searchRef} />
            <JobList rows={rows} noMatch={noMatch} query={query} onToggle={toggle} locked={pending} />
            {failed && <PageRefusal>{state.error}</PageRefusal>}
            <BottomBar stack="none">
                {refused && (
                    <p role="alert" className="flex items-start justify-center gap-mobile-input-message-gap text-mobile-body-sm text-danger sm:hidden">
                        <span className="flex h-[var(--text-mobile-body-sm--line-height)] shrink-0 items-center">
                            <Icon name="circle-alert" className="size-icon" />
                        </span>
                        <span className="text-pretty">{COPY.refusal.none}</span>
                    </p>
                )}
                {count === 0 && (
                    <p id={noteId} className="mt-sign-in-list-note-stack text-center text-body-sm text-foreground-subtle max-sm:hidden">
                        {COPY.refusal.none}
                    </p>
                )}
                <div className={`max-sm:hidden ${count === 0 || failed ? "mt-gap-lg" : "mt-sign-in-form-stack"}`}>
                    <Button type="submit" size="xl" disabled={count === 0} describedBy={count === 0 ? noteId : undefined} busy={pending} busyLabel={COPY.working}>
                        {label}
                    </Button>
                </div>
                <div className="sm:hidden">
                    <Button type="submit" size="xl" busy={pending} busyLabel={COPY.working}>
                        {label}
                    </Button>
                </div>
            </BottomBar>
        </form>
    );
}

/**
 * Whether the page has scrolled the band to the top and rows run under it, which is when its
 * soft edge shows (1k's top edge). Only a phone's page scrolls the window; at a desk the column
 * scrolls in its own lane and the band never holds.
 */
function useHeld(bandRef) {
    const [held, setHeld] = useState(false);
    useEffect(() => {
        const measure = () => {
            const band = bandRef.current?.getBoundingClientRect();
            if (band) setHeld(band.top <= 0.5 && window.scrollY > 0);
        };
        measure();
        window.addEventListener("scroll", measure, { passive: true });
        window.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
        };
    }, [bandRef]);
    return held;
}

/**
 * The search (1k, 1l). At a desk a 40 field on the Field ground with no border, its 14 mark 12
 * in and its words past it, white with the Edge focus border while it holds the caret — 0f's
 * search at a sign-in page's height, with no × as 1l draws it. On a phone a 50 form field in a
 * band 8 deep that holds to the top of the page: white on an Edge border, its 18 mark 10 before
 * the words and the clear × at its end once it holds anything (Tools 0a Field).
 *
 * ITS RETURN KEY IS `done` AND SENDS NOTHING: a search is not the step's answer, so Enter
 * lowers the keyboard rather than pressing `Continue`.
 */
function SearchBand({ value, onChange, readOnly, inputRef }) {
    const bandRef = useRef(null);
    const held = useHeld(bandRef);
    return (
        <div
            ref={bandRef}
            className="relative mt-sign-in-header-stack max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:isolate max-sm:-mx-mobile-gutter max-sm:mt-[calc(var(--spacing-sign-in-header-stack)-var(--spacing-mobile-sign-in-search-inset-y))] max-sm:px-mobile-gutter max-sm:py-mobile-sign-in-search-inset-y"
        >
            <span
                aria-hidden="true"
                data-held={held || undefined}
                className="pointer-events-none absolute inset-x-0 top-0 -bottom-mobile-sign-in-search-bleed -z-10 hidden bg-background-translucent opacity-0 backdrop-blur-sm [mask-image:linear-gradient(to_top,transparent,black_var(--spacing-mobile-sign-in-search-bleed))] data-held:opacity-100 max-sm:block"
            />
            <div
                role="search"
                className="relative flex items-center max-sm:h-mobile-input max-sm:gap-mobile-input-gap max-sm:rounded-mobile-control max-sm:border max-sm:border-border max-sm:bg-white max-sm:px-mobile-input-inset-x max-sm:focus-within:border-border-focus"
            >
                <Icon
                    name="search"
                    className="pointer-events-none size-icon-sm shrink-0 text-foreground-subtle sm:absolute sm:top-1/2 sm:left-input-inset-x sm:-translate-y-1/2 max-sm:size-mobile-input-icon"
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        event.currentTarget.blur();
                    }}
                    readOnly={readOnly}
                    aria-label={COPY.search}
                    placeholder={COPY.search}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="done"
                    className="w-full min-w-0 bg-transparent text-foreground-default caret-primary outline-none placeholder:text-foreground-subtle max-sm:h-full max-sm:flex-1 max-sm:text-mobile-body pointer-coarse:text-mobile-body sm:h-control-xl sm:rounded-control sm:border sm:border-transparent sm:bg-background-muted sm:pr-input-inset-x sm:pl-[calc(var(--spacing-input-inset-x)+var(--size-icon-sm)+var(--spacing-gap))] sm:text-body sm:focus:border-border-focus sm:focus:bg-white"
                />
                {value !== "" && !readOnly && (
                    <ClearButton
                        onClear={() => {
                            onChange("");
                            inputRef.current?.focus();
                        }}
                    />
                )}
            </div>
        </div>
    );
}

/** Whether a scrolling list has rows hidden above it and below it — 0l's Rules, for 1l's lane. */
function useHiddenEdges(scrollerRef) {
    const [hidden, setHidden] = useState({ above: false, below: false });
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return undefined;
        const measure = () => {
            const scrolls = getComputedStyle(scroller).overflowY === "auto";
            const above = scrolls && scroller.scrollTop > 0;
            const below = scrolls && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
            setHidden((was) => (was.above === above && was.below === below ? was : { above, below }));
        };
        const observer = new ResizeObserver(measure);
        observer.observe(scroller);
        scroller.addEventListener("scroll", measure);
        window.addEventListener("resize", measure);
        measure();
        return () => {
            observer.disconnect();
            scroller.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
        };
    }, [scrollerRef]);
    return hidden;
}

/**
 * The jobs, each a checkbox named by its code and its name. A native checkbox under the drawing,
 * as every box in this app is: the browser says checked, takes Space and a press anywhere on the
 * row, and what is drawn over it is the look — 1l's 16 box at a desk, 1k's 24 round check on a
 * phone. While the step saves, a press changes nothing.
 *
 * AT A DESK THE LIST TAKES THE COLUMN'S REST and scrolls in 0i's lane, its rows' text on the
 * column's edge with the hover face 12 past it; it never stands shorter than three rows, and
 * below that the column scrolls in the page's lane instead. A row's box, code and name stand
 * 10 apart and the name 8 further (1l). A search that finds nothing says so under any row it
 * keeps at the top.
 */
function JobList({ rows, noMatch, query, onToggle, locked }) {
    const scrollerRef = useRef(null);
    const { above, below } = useHiddenEdges(scrollerRef);
    return (
        <div
            ref={scrollerRef}
            role="group"
            aria-label={COPY.list}
            className={`flex flex-col max-sm:-mx-mobile-gutter max-sm:mt-mobile-sign-in-search-inset-y max-sm:mb-mobile-bottom-bar-bleed sm:mt-sign-in-list-stack sm:-mr-[calc(var(--spacing-input-inset-x)+var(--spacing-scrollbar-gutter))] sm:-ml-input-inset-x sm:min-h-[calc(3*var(--height-control-lg)+2*var(--spacing-sign-in-list-inset-y)+2px)] sm:flex-1 sm:basis-0 sm:overflow-y-auto sm:overscroll-contain sm:border-y sm:py-sign-in-list-inset-y sm:[scrollbar-gutter:stable] ${
                above ? "sm:border-t-divider" : "sm:border-t-transparent"
            } ${below ? "sm:border-b-divider" : "sm:border-b-transparent"} ${SCROLL_LANE}`}
        >
            {rows.map((job) => (
                <label
                    key={job.id}
                    className="relative flex h-control-lg shrink-0 cursor-pointer items-center gap-menu-box-gap rounded-control px-input-inset-x text-body has-[input:focus-visible]:bg-hover sm:hover:bg-hover max-sm:h-auto max-sm:min-h-mobile-sign-in-option max-sm:gap-mobile-sign-in-option-inline max-sm:rounded-none max-sm:px-mobile-gutter max-sm:active:bg-hover max-sm:not-first:before:absolute max-sm:not-first:before:inset-x-mobile-gutter max-sm:not-first:before:top-0 max-sm:not-first:before:h-px max-sm:not-first:before:bg-divider-subtle"
                >
                    <span className="relative flex shrink-0 items-center justify-center max-sm:order-last">
                        <input
                            type="checkbox"
                            checked={job.on}
                            onChange={() => onToggle(job.id)}
                            aria-disabled={locked || undefined}
                            className="peer size-icon cursor-pointer appearance-none rounded-badge border border-checkbox-border bg-white outline-none checked:border-primary checked:bg-primary max-sm:size-mobile-sign-in-check max-sm:rounded-full max-sm:border-[1.5px] max-sm:bg-transparent max-sm:checked:border-primary max-sm:checked:bg-primary"
                        />
                        <Icon name="check" className="pointer-events-none absolute hidden size-sign-in-check-mark text-white peer-checked:block max-sm:size-mobile-sign-in-check-mark" />
                    </span>
                    <span className="flex min-w-0 flex-1 items-baseline max-sm:flex-col max-sm:items-stretch">
                        <span className="shrink-0 text-foreground-default tabular-nums max-sm:text-mobile-body max-sm:font-medium">{job.jobCode}</span>
                        <span className="min-w-0 truncate text-foreground-subtle sm:ml-[calc(var(--spacing-menu-box-gap)+var(--spacing-gap))] max-sm:text-mobile-body-sm">{job.jobName}</span>
                    </span>
                </label>
            ))}
            {noMatch && (
                <p className="py-sign-in-list-empty-inset-y text-center text-body text-foreground-default max-sm:px-mobile-gutter max-sm:py-mobile-sign-in-list-empty-inset-y max-sm:text-mobile-body max-sm:text-foreground-subtle">
                    {COPY.noneMatch} {COPY.echo(query)}
                </p>
            )}
        </div>
    );
}
