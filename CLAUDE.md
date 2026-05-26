# Claude Instructions

## Git Workflow
- Always work directly on the `main` branch
- Do NOT create new branches or pull requests
- After making any changes, commit and push directly to `main`
- Write clear, descriptive commit messages

## Deployment
- This repo is connected to Dokploy — every push to `main` goes live automatically
- Make sure changes are working before pushing

## CRITICAL: Git Rules
- You are on the `main` branch. Stay on it.
- NEVER run `git checkout -b` or create any new branch
- NEVER push to any branch other than `main`
- Only run: `git add`, `git commit`, `git push origin main`