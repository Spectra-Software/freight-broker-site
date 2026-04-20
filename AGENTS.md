<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git (repo owner preference)

After **substantive code or config changes** in this workspace, the agent should **`git add .`**, **`git commit`** with a short descriptive message, and **`git push`** without being asked again—unless the user opts out, there is nothing to commit, or push would be unsafe (e.g. secrets, merge conflicts). On Windows PowerShell, chain with `;` if `&&` is unsupported.
