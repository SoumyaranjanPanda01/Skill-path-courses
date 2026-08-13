import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"

const container = document.getElementById("root")
if (!container) throw new Error("Root element missing from index.html")

// StrictMode double-invokes effects in development, which is a useful check
// here: the courses fetch has to survive a mount, abort and remount without
// firing a retry on the aborted request.
createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>
)
