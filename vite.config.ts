import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            // The three Skillpath files are real Framer code components, so
            // they import addPropertyControls and ControlType from "framer".
            // That package only exists inside the Framer editor. The demo
            // build points the import at a local shim so the exact same source
            // files run on the web, unmodified.
            framer: fileURLToPath(new URL("./demo/framer.ts", import.meta.url)),
        },
    },
})
