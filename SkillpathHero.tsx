import { addPropertyControls, ControlType } from "framer"

/**
 * Skillpath: Hero
 *
 * Headline, one supporting line, one button. Everything editable from the
 * panel so the copy never needs a code change.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicHeight 460
 * @framerIntrinsicWidth 1200
 */
export default function SkillpathHero(props) {
    const {
        headline = "Learn the skill. Then actually use it.",
        subline = "Short, practical courses from people who ship, not lecture theatre.",
        buttonLabel = "Browse courses",
        buttonLink = "#courses",
        accentColor = "#4F46E5",
        style,
    } = props

    return (
        <section style={{ ...styles.section, ...style }}>
            <div style={styles.inner}>
                <h1 style={styles.headline}>{headline}</h1>
                <p style={styles.subline}>{subline}</p>
                <a
                    href={buttonLink}
                    style={{ ...styles.button, backgroundColor: accentColor }}
                >
                    {buttonLabel}
                </a>
            </div>
        </section>
    )
}

const styles: Record<string, React.CSSProperties> = {
    section: {
        width: "100%",
        boxSizing: "border-box",
        padding: "96px 24px",
        backgroundColor: "#0F172A",
        fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    inner: { maxWidth: 760, margin: "0 auto", textAlign: "center" },
    headline: {
        margin: "0 0 18px",
        // Fluid type: no breakpoint to break between.
        fontSize: "clamp(34px, 5.5vw, 60px)",
        lineHeight: 1.08,
        letterSpacing: "-0.03em",
        fontWeight: 700,
        color: "#FFFFFF",
    },
    subline: {
        margin: "0 0 34px",
        fontSize: "clamp(15px, 1.7vw, 19px)",
        lineHeight: 1.6,
        color: "#94A3B8",
    },
    button: {
        display: "inline-block",
        padding: "14px 30px",
        fontSize: 15,
        fontWeight: 600,
        color: "#FFFFFF",
        textDecoration: "none",
        borderRadius: 999,
    },
}

SkillpathHero.defaultProps = {
    headline: "Learn the skill. Then actually use it.",
    subline:
        "Short, practical courses from people who ship, not lecture theatre.",
    buttonLabel: "Browse courses",
    buttonLink: "#courses",
    accentColor: "#4F46E5",
}

addPropertyControls(SkillpathHero, {
    headline: { type: ControlType.String, title: "Headline" },
    subline: { type: ControlType.String, title: "Subline" },
    buttonLabel: { type: ControlType.String, title: "Button" },
    buttonLink: { type: ControlType.Link, title: "Link" },
    accentColor: { type: ControlType.Color, title: "Accent" },
})
