import SkillpathHero from "../SkillpathHero"
import SkillpathCourses from "../SkillpathCourses"
import SkillpathFooter from "../SkillpathFooter"

/**
 * The demo page: the same three components, in the order they sit on the
 * Framer canvas. Props left at their defaults so what renders here is what a
 * designer sees before touching the panel.
 */
export default function App() {
    return (
        <main>
            <SkillpathHero />

            {/* The hero button links to #courses, so the anchor lives here
                rather than inside the section component. */}
            <div id="courses">
                <SkillpathCourses />
            </div>

            <SkillpathFooter />
        </main>
    )
}
