import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Skillpath: Courses section
 *
 * Fetches courses and the viewer's country from a deliberately flaky API
 * (~1 in 3 requests returns 404/500) and renders a responsive card grid.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicHeight 900
 * @framerIntrinsicWidth 1200
 */

const BASE_URL = "https://syncsphere-hiv6.onrender.com"

// The two calls are independent on purpose: country failing must not take the
// courses down with it. See loadAll().
const COURSES_PATH = "/assignment/course-data"
const COUNTRY_PATH = "/assignment/country-code"

// Country we fall back to when /country-code fails. Courses still render at
// full quality, we just say out loud which currency the viewer is looking at.
const FALLBACK_COUNTRY = "IN"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * GET with a small retry budget.
 *
 * The API fails randomly rather than persistently, so a retry is usually a
 * different roll of the dice, not the same failure again. Three attempts with
 * a backoff takes a ~33% failure rate down to ~4% while still surfacing a real
 * outage within about a second. Only GET is ever sent, because every other
 * method on this API returns 405 and a read-only section has no reason to
 * send one.
 */
async function getJSON<T>(
    path: string,
    signal: AbortSignal,
    attempts = 3
): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const response = await fetch(BASE_URL + path, {
                method: "GET",
                headers: { Accept: "application/json" },
                // The country endpoint flips between IN and US, so a cached
                // response would quietly freeze the currency.
                cache: "no-store",
                signal,
            })

            if (!response.ok) {
                throw new Error(`${path} responded ${response.status}`)
            }

            return (await response.json()) as T
        } catch (error) {
            // An aborted request means the component unmounted or the user hit
            // retry. That is not a failure worth retrying.
            if (signal.aborted) throw error

            lastError = error
            if (attempt < attempts - 1) await sleep(300 * 2 ** attempt)
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Request failed")
}

type Course = {
    courseName: string
    courseCode: string
    description: string
    mainCategory: string
    shortCourse: string
    courseType: string
    pricePaise: number
    priceUsdCents: number
    mangoId: string
    refundable: boolean
}

type CountryCode = "IN" | "US"

/** Keeps anything malformed out of the grid instead of rendering blank cards. */
function isRenderableCourse(value: unknown): value is Course {
    const course = value as Course
    return (
        !!course &&
        typeof course === "object" &&
        typeof course.courseName === "string" &&
        course.courseName.trim().length > 0
    )
}

/**
 * Both price fields arrive in minor units, paise and cents. 199900 paise is
 * ₹1,999.00, not ₹1,99,900. So: divide by 100, then let Intl place the symbol,
 * the grouping (Indian grouping is 1,99,900, not 199,900) and the decimals.
 * Trailing .00 is dropped in both currencies because ₹1,999 and $40 are how
 * prices are actually written on a pricing page.
 */
function formatPrice(course: Course, country: CountryCode): string | null {
    const isUS = country === "US"
    const minorUnits = isUS ? course.priceUsdCents : course.pricePaise

    if (typeof minorUnits !== "number" || !Number.isFinite(minorUnits)) {
        return null
    }

    return new Intl.NumberFormat(isUS ? "en-US" : "en-IN", {
        style: "currency",
        currency: isUS ? "USD" : "INR",
        minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(minorUnits / 100)
}

/** The value we sort on has to match the currency on screen. */
function priceInMinorUnits(course: Course, country: CountryCode): number {
    const value = country === "US" ? course.priceUsdCents : course.pricePaise
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

/**
 * Column count comes from the section's own width, not the browser window.
 * On the Framer canvas a media query measures the editor viewport, so a frame
 * sitting at phone width would still get the desktop grid. Measuring the
 * element keeps canvas and published site honest.
 */
function useColumns(ref: React.RefObject<HTMLDivElement>) {
    const [columns, setColumns] = useState(3)

    useEffect(() => {
        const element = ref.current
        if (!element) return

        const measure = (width: number) => {
            if (width >= 960) setColumns(3)
            else if (width >= 620) setColumns(2)
            else setColumns(1)
        }

        measure(element.clientWidth)

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) measure(entry.contentRect.width)
        })

        observer.observe(element)
        return () => observer.disconnect()
    }, [ref])

    return columns
}

type Status = "loading" | "error" | "ready"
type SortKey = "default" | "priceAsc" | "priceDesc"

export default function SkillpathCourses(props) {
    const {
        heading = "Courses built to be finished",
        accentColor = "#4F46E5",
        showSearch = true,
        showSort = true,
        style,
    } = props

    const [status, setStatus] = useState<Status>("loading")
    const [courses, setCourses] = useState<Course[]>([])
    const [country, setCountry] = useState<CountryCode>(FALLBACK_COUNTRY)
    // True when /country-code failed and we fell back. Drives the notice.
    const [countryIsAssumed, setCountryIsAssumed] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")

    const [query, setQuery] = useState("")
    const [sortKey, setSortKey] = useState<SortKey>("default")

    const sectionRef = useRef<HTMLDivElement>(null)
    const columns = useColumns(sectionRef)

    const loadAll = useCallback(async (signal: AbortSignal) => {
        setStatus("loading")
        setErrorMessage("")

        // allSettled, not all: one endpoint failing must not decide the other's
        // fate. Courses are the section; country only decides the currency.
        const [coursesResult, countryResult] = await Promise.allSettled([
            getJSON<unknown>(COURSES_PATH, signal),
            getJSON<{ country_code?: string }>(COUNTRY_PATH, signal),
        ])

        if (signal.aborted) return

        // Country resolves first so a successful country code is applied even
        // if the course call is what failed.
        if (
            countryResult.status === "fulfilled" &&
            (countryResult.value?.country_code === "IN" ||
                countryResult.value?.country_code === "US")
        ) {
            setCountry(countryResult.value.country_code)
            setCountryIsAssumed(false)
        } else {
            // Failed or returned something we do not recognise. Showing no
            // price at all is worse than showing a correct price and labelling
            // the assumption, so we fall back and say so under the grid.
            setCountry(FALLBACK_COUNTRY)
            setCountryIsAssumed(true)
        }

        if (coursesResult.status !== "fulfilled") {
            setStatus("error")
            setErrorMessage(
                coursesResult.reason instanceof Error
                    ? coursesResult.reason.message
                    : "Could not reach the course API."
            )
            return
        }

        // An object where an array was promised is a broken response, not an
        // empty catalogue, and the two need different messages.
        if (!Array.isArray(coursesResult.value)) {
            setStatus("error")
            setErrorMessage("The course API returned an unexpected shape.")
            return
        }

        setCourses(coursesResult.value.filter(isRenderableCourse))
        setStatus("ready")
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        loadAll(controller.signal)
        return () => controller.abort()
    }, [loadAll])

    const retry = useCallback(() => {
        const controller = new AbortController()
        loadAll(controller.signal)
    }, [loadAll])

    const visibleCourses = useMemo(() => {
        const needle = query.trim().toLowerCase()

        const filtered = needle
            ? courses.filter((course) =>
                  [
                      course.courseName,
                      course.description,
                      course.mainCategory,
                  ].some((field) =>
                      String(field ?? "")
                          .toLowerCase()
                          .includes(needle)
                  )
              )
            : courses

        if (sortKey === "default") return filtered

        // Copy before sorting, because sort mutates and courses is state.
        return [...filtered].sort((a, b) => {
            const delta =
                priceInMinorUnits(a, country) - priceInMinorUnits(b, country)
            return sortKey === "priceAsc" ? delta : -delta
        })
    }, [courses, query, sortKey, country])

    const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 20,
        // minmax(0, 1fr) rather than 1fr so long unbroken words cannot push a
        // column wider than its share and break the row.
        alignItems: "stretch",
    }

    return (
        <section ref={sectionRef} style={{ ...styles.section, ...style }}>
            <header style={styles.header}>
                <h2 style={styles.heading}>{heading}</h2>

                {(showSearch || showSort) && (
                    <div style={styles.toolbar}>
                        {showSearch && (
                            <input
                                type="search"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Search courses"
                                aria-label="Search courses"
                                style={styles.input}
                                disabled={status !== "ready"}
                            />
                        )}

                        {showSort && (
                            <select
                                value={sortKey}
                                onChange={(event) =>
                                    setSortKey(event.target.value as SortKey)
                                }
                                aria-label="Sort courses"
                                style={styles.select}
                                disabled={status !== "ready"}
                            >
                                <option value="default">Featured</option>
                                <option value="priceAsc">Price: low to high</option>
                                <option value="priceDesc">Price: high to low</option>
                            </select>
                        )}
                    </div>
                )}
            </header>

            {/* Screen readers get told the section changed state, not just
                sighted users. */}
            <div aria-live="polite" style={styles.visuallyHidden}>
                {status === "loading" && "Loading courses"}
                {status === "error" && "Courses failed to load"}
                {status === "ready" &&
                    `${visibleCourses.length} courses shown`}
            </div>

            {status === "loading" && (
                <div style={gridStyle}>
                    {/* Fixed count of skeletons because the real count is
                        exactly what we do not know yet. */}
                    {Array.from({ length: columns * 2 }).map((_, index) => (
                        <SkeletonCard key={index} />
                    ))}
                </div>
            )}

            {status === "error" && (
                <ErrorState
                    message={errorMessage}
                    accentColor={accentColor}
                    onRetry={retry}
                />
            )}

            {status === "ready" && courses.length === 0 && (
                <EmptyState
                    title="No courses published yet"
                    body="The catalogue is empty right now. Check back shortly."
                />
            )}

            {status === "ready" &&
                courses.length > 0 &&
                visibleCourses.length === 0 && (
                    <EmptyState
                        title={`No courses match “${query.trim()}”`}
                        body="Try a shorter word, or clear the search to see everything."
                    />
                )}

            {status === "ready" && visibleCourses.length > 0 && (
                <>
                    <div style={gridStyle}>
                        {visibleCourses.map((course) => (
                            <CourseCard
                                key={
                                    course.mangoId ||
                                    course.courseCode ||
                                    course.courseName
                                }
                                course={course}
                                country={country}
                                accentColor={accentColor}
                            />
                        ))}
                    </div>

                    {countryIsAssumed && (
                        <p style={styles.notice}>
                            We couldn’t detect your region, so prices are shown
                            in{" "}
                            {FALLBACK_COUNTRY === "IN"
                                ? "Indian rupees"
                                : "US dollars"}
                            .{" "}
                            <button
                                type="button"
                                onClick={retry}
                                style={{
                                    ...styles.linkButton,
                                    color: accentColor,
                                }}
                            >
                                Try again
                            </button>
                        </p>
                    )}
                </>
            )}
        </section>
    )
}

function CourseCard({
    course,
    country,
    accentColor,
}: {
    course: Course
    country: CountryCode
    accentColor: string
}) {
    const price = formatPrice(course, country)

    return (
        <article style={styles.card}>
            <div style={styles.cardTop}>
                {/* The extra field: category. It is the one a learner scanning
                    a grid actually uses to decide if a course is for them.
                    courseCode and mangoId are plumbing, shortCourse is a
                    truncated name. */}
                <span style={{ ...styles.category, color: accentColor }}>
                    {course.mainCategory || "General"}
                </span>

                {course.refundable === true && (
                    <span style={styles.badge}>Refundable</span>
                )}
            </div>

            <h3 style={styles.cardTitle}>{course.courseName}</h3>

            <p style={styles.description}>{course.description}</p>

            <div style={styles.cardFooter}>
                <span style={styles.price}>
                    {price ?? "Price unavailable"}
                </span>
                <span
                    style={{ ...styles.enroll, backgroundColor: accentColor }}
                >
                    Enroll
                </span>
            </div>
        </article>
    )
}

function SkeletonCard() {
    return (
        <div style={{ ...styles.card, ...styles.skeletonCard }} aria-hidden>
            <div style={{ ...styles.shimmer, width: "35%", height: 12 }} />
            <div style={{ ...styles.shimmer, width: "75%", height: 20 }} />
            <div style={{ ...styles.shimmer, width: "100%", height: 12 }} />
            <div style={{ ...styles.shimmer, width: "85%", height: 12 }} />
            <div
                style={{
                    ...styles.shimmer,
                    width: "40%",
                    height: 18,
                    marginTop: "auto",
                }}
            />
        </div>
    )
}

function ErrorState({
    message,
    accentColor,
    onRetry,
}: {
    message: string
    accentColor: string
    onRetry: () => void
}) {
    return (
        <div style={styles.stateBox} role="alert">
            <h3 style={styles.stateTitle}>Couldn’t load the courses</h3>
            <p style={styles.stateBody}>
                The course service didn’t respond. This usually clears up on a
                second try.
            </p>
            <button
                type="button"
                onClick={onRetry}
                style={{ ...styles.retryButton, backgroundColor: accentColor }}
            >
                Try again
            </button>
            {/* The raw status stays visible but quiet: useful to a developer,
                meaningless noise to a visitor if it were the headline. */}
            {message && <p style={styles.errorDetail}>{message}</p>}
        </div>
    )
}

function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div style={styles.stateBox}>
            <h3 style={styles.stateTitle}>{title}</h3>
            <p style={styles.stateBody}>{body}</p>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    section: {
        width: "100%",
        boxSizing: "border-box",
        padding: "72px 24px",
        backgroundColor: "#F8F9FC",
        fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0F172A",
    },
    header: {
        maxWidth: 1160,
        margin: "0 auto 32px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
    },
    heading: {
        margin: 0,
        // Scales with the viewport instead of snapping at a breakpoint.
        fontSize: "clamp(26px, 3.4vw, 38px)",
        lineHeight: 1.2,
        fontWeight: 700,
        letterSpacing: "-0.02em",
    },
    toolbar: { display: "flex", flexWrap: "wrap", gap: 10 },
    input: {
        minWidth: 200,
        flex: "1 1 200px",
        padding: "10px 14px",
        fontSize: 14,
        fontFamily: "inherit",
        color: "#0F172A",
        border: "1px solid #DDE1EC",
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        outline: "none",
    },
    select: {
        padding: "10px 14px",
        fontSize: 14,
        fontFamily: "inherit",
        color: "#0F172A",
        border: "1px solid #DDE1EC",
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        cursor: "pointer",
    },
    card: {
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        padding: 24,
        backgroundColor: "#FFFFFF",
        border: "1px solid #EBEEF5",
        borderRadius: 16,
        boxSizing: "border-box",
    },
    cardTop: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    category: {
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
    },
    badge: {
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 600,
        color: "#047857",
        backgroundColor: "#ECFDF5",
        border: "1px solid #A7F3D0",
        borderRadius: 999,
        whiteSpace: "nowrap",
    },
    cardTitle: {
        margin: 0,
        fontSize: 19,
        lineHeight: 1.3,
        fontWeight: 650,
        // Long single words (a URL-ish course name) wrap instead of
        // overflowing the card.
        overflowWrap: "anywhere",
    },
    description: {
        margin: 0,
        fontSize: 14,
        lineHeight: 1.55,
        color: "#5A6478",
        // Two lines, cut with an ellipsis rather than a hard slice mid-word.
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
    },
    cardFooter: {
        marginTop: "auto",
        paddingTop: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    price: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" },
    enroll: {
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 600,
        color: "#FFFFFF",
        borderRadius: 999,
        whiteSpace: "nowrap",
    },
    skeletonCard: { minHeight: 210 },
    shimmer: {
        borderRadius: 6,
        backgroundColor: "#E9ECF3",
        // No keyframes: a Framer code component cannot rely on a global
        // stylesheet, and a static grey block already reads as "loading".
        opacity: 0.9,
    },
    stateBox: {
        maxWidth: 520,
        margin: "0 auto",
        padding: "40px 24px",
        textAlign: "center",
        backgroundColor: "#FFFFFF",
        border: "1px solid #EBEEF5",
        borderRadius: 16,
    },
    stateTitle: { margin: "0 0 8px", fontSize: 19, fontWeight: 650 },
    stateBody: {
        margin: "0 0 20px",
        fontSize: 14,
        lineHeight: 1.55,
        color: "#5A6478",
    },
    retryButton: {
        padding: "10px 22px",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "inherit",
        color: "#FFFFFF",
        border: "none",
        borderRadius: 999,
        cursor: "pointer",
    },
    errorDetail: {
        margin: "16px 0 0",
        fontSize: 12,
        color: "#94A3B8",
        wordBreak: "break-word",
    },
    notice: {
        maxWidth: 1160,
        margin: "24px auto 0",
        fontSize: 13,
        color: "#5A6478",
        textAlign: "center",
    },
    linkButton: {
        padding: 0,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
        background: "none",
        border: "none",
        cursor: "pointer",
        textDecoration: "underline",
    },
    visuallyHidden: {
        position: "absolute",
        width: 1,
        height: 1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
    },
}

SkillpathCourses.defaultProps = {
    heading: "Courses built to be finished",
    accentColor: "#4F46E5",
    showSearch: true,
    showSort: true,
}

addPropertyControls(SkillpathCourses, {
    heading: {
        type: ControlType.String,
        title: "Heading",
        defaultValue: "Courses built to be finished",
        placeholder: "Section heading",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#4F46E5",
    },
    showSearch: {
        type: ControlType.Boolean,
        title: "Search",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    showSort: {
        type: ControlType.Boolean,
        title: "Sort",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
})
