import { addPropertyControls, ControlType } from "framer"

/**
 * Skillpath: Footer
 *
 * Three links and a copyright line. The year comes from the clock so it never
 * goes stale.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicHeight 140
 * @framerIntrinsicWidth 1200
 */
export default function SkillpathFooter(props) {
    const { links = [], companyName = "Skillpath", style } = props

    return (
        <footer style={{ ...styles.footer, ...style }}>
            <div style={styles.inner}>
                <nav style={styles.nav}>
                    {links.map((link, index) => (
                        <a
                            key={`${link.label}-${index}`}
                            href={link.url || "#"}
                            style={styles.link}
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                <p style={styles.copyright}>
                    © {new Date().getFullYear()} {companyName}. All rights
                    reserved.
                </p>
            </div>
        </footer>
    )
}

const styles: Record<string, React.CSSProperties> = {
    footer: {
        width: "100%",
        boxSizing: "border-box",
        padding: "40px 24px",
        backgroundColor: "#0F172A",
        fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    inner: {
        maxWidth: 1160,
        margin: "0 auto",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
    },
    nav: { display: "flex", flexWrap: "wrap", gap: 24 },
    link: {
        fontSize: 14,
        color: "#CBD5E1",
        textDecoration: "none",
    },
    copyright: { margin: 0, fontSize: 13, color: "#64748B" },
}

SkillpathFooter.defaultProps = {
    companyName: "Skillpath",
    links: [
        { label: "About", url: "#" },
        { label: "Courses", url: "#courses" },
        { label: "Contact", url: "#" },
    ],
}

addPropertyControls(SkillpathFooter, {
    companyName: { type: ControlType.String, title: "Company" },
    links: {
        type: ControlType.Array,
        title: "Links",
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, defaultValue: "About" },
                url: { type: ControlType.Link },
            },
        },
    },
})
