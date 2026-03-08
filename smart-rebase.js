import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

// To run this script:
// export GEMINI_API_KEY="your-api-key"
// node smart-rebase.js

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY is missing! Please export it before running this script:\n  export GEMINI_API_KEY=your_key");
    process.exit(1);
}

function run(command) {
    try {
        console.log(`> ${command}`);
        return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
        return e;
    }
}

async function resolveConflict(filePath) {
    console.log(`\n🤖 Resolving conflict in ${filePath} using Gemini AI...`);
    const content = readFileSync(filePath, 'utf8');

    const prompt = `You are an expert software engineer resolving a git conflict during a rebase.
The branch we are keeping (the working tree) contains production deployment fixes for a React app (Cloudflare tracking blocking, lazy loading API keys, Docker multi-stage builds).
The base branch ('main') might have new content or features created since.
Please resolve the following git conflict markers (<<<<<<<, =======, >>>>>>>), keeping the essential production features while merging in the new features logically.

IMPORTANT INSTRUCTION: Output ONLY the fully resolved file content. Do not include markdown codeblocks (e.g., \`\`\`tsx) wrapping the file content. Do not add any conversational text or explanation. Your output will literally be written directly to the file.

File Name: ${filePath}

File Content with Conflicts:
${content}`;

    // Target the Gemini 2.5 Flash model for speed/intelligence balance
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: "You are a git conflict resolution engine. Respond strictly with the raw, combined file data. No markdown wrap." }] }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let resolvedContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Safety Fallback: Fast strip of markdown blocks if the AI disobeyed
    if (resolvedContent.startsWith("```")) {
        resolvedContent = resolvedContent.replace(/^```[a-zA-Z]*\n/, '');
    }
    if (resolvedContent.endsWith("```\n")) {
        resolvedContent = resolvedContent.replace(/\n```\n$/, '\n');
    } else if (resolvedContent.endsWith("```")) {
        resolvedContent = resolvedContent.replace(/\n```$/, '\n');
    }

    writeFileSync(filePath, resolvedContent);

    // Add to git index
    run(`git add "${filePath}"`);
    console.log(`✅ Fully resolved and staged: ${filePath}`);
}

async function main() {
    console.log("🚀 Starting Smart Rebase & Redeploy Sequence!\n");

    const currentBranch = run('git branch --show-current').trim();
    if (currentBranch !== 'docker-deploy') {
        console.log(`Switching to docker-deploy branch...`);
        run('git checkout docker-deploy');
    }

    // 1. Fetch the latest changes
    console.log("📥 Fetching latest from origin...");
    run('git fetch origin main');

    // Clean up any modifications done by npm install
    run('git checkout -- .');

    // 2. Initiate the rebase
    console.log("🔄 Initiating rebase on origin/main...");
    let rebaseResult = run('git rebase origin/main');

    while (rebaseResult instanceof Error) {
        console.log("⚠️ Rebase conflict detected!");

        // Get list of unmerged files
        const unmergedStr = run('git diff --name-only --diff-filter=U');
        if (unmergedStr instanceof Error || !unmergedStr.trim()) {
            console.error("\n❌ Rebase failed, but no unmerged files found. Manual intervention required. See git status.");
            console.error(rebaseResult.stderr || rebaseResult.message);
            process.exit(1);
        }

        const unmerged = unmergedStr.trim().split('\n').filter(Boolean);

        for (const file of unmerged) {
            await resolveConflict(file);
        }

        console.log("\n▶️ Continuing rebase...");
        rebaseResult = run('GIT_EDITOR=true git rebase --continue');
    }

    console.log("\n🎉 Rebase finished successfully without outstanding conflicts!");

    // 3. Optional: Run the manual fix script to guarantee idempotency on HTML files
    if (run('test -f fix-blocked-resources.sh') !== false) {
        console.log("🛡️ Running fix-blocked-resources.sh to ensure protection is maintained...");
        run('./fix-blocked-resources.sh index.html');
        // re-add if changes occurred
        const status = run('git status --porcelain');
        if (typeof status === 'string' && status.includes('index.html')) {
            run('git add index.html && git commit --amend --no-edit');
        }
    }

    // 4. Force push the new branch to trigger redeployment via GitHub Actions
    console.log("\n🚀 Force pushing to rebuild and deploy...");
    const pushResult = run('git push origin docker-deploy --force');
    if (pushResult instanceof Error) {
        console.error("❌ Failed to push changes.");
        console.error(pushResult.stderr || pushResult.message);
        process.exit(1);
    }

    console.log("\n✨ Sequence complete! Successfully rebased and triggered redeployment.");
}

main().catch((err) => {
    console.error("Critical Failure: ", err);
    process.exit(1);
});
