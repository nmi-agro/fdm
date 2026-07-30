---
title: Releasing FDM
sidebar_label: Releasing FDM
---

This document outlines the release process for the `fdm` monorepo. Our process is built on a `development` -> `release` -> `main` branching strategy and is automated using GitHub Actions and [Changesets](https://github.com/changesets/changesets).

## Overview

The core idea is to separate the development of features from the release of new versions.

- **`development` branch**: This is the primary integration branch where all new features and bug fixes are merged. Pushing to this branch automatically publishes a `development` snapshot version for testing.
- **`release/*` branches**: These branches are created from `development` to prepare for a new stable release. This is where final release chores (like updating documentation, blog posts, etc.) are performed.
- **`main` branch**: This branch represents the latest stable production code. Merging a `release/*` branch into `main` triggers the publication of stable packages to the registry and the creation of official GitHub Releases.

## For Developers: Making a Change

When you contribute code that should result in a new version of one or more packages, you must include a "changeset".

1. **Make your code changes** on a feature branch as usual.
2. **Run `pnpm changeset`**. This will launch an interactive CLI.
3. **Select the packages** you have changed using the arrow keys and spacebar.
4. **Choose the version bump type** (Major, Minor, or Patch) for each selected package.
5. **Write a clear summary** of the change. This summary will be used to generate the `CHANGELOG.md` for the packages.
6. **Commit the new changeset file** (e.g., `.changeset/unique-name.md`) along with your code changes.
7. **Open a pull request** to the `development` branch.

Once your PR is merged into `development`, the automation will take over and publish a snapshot release.

## For Release Managers: Creating a New Release

Follow these steps to create a new stable release.

### Step 1: Create the Release Branch

Create a new `release/*` branch from the `development` branch.

```bash
git checkout development
git pull origin development
git checkout -b release/[YYYY-MM]
```

### Step 2: Perform Release Chores

On this `release/*` branch, you can perform any final tasks before the release. This is the time to:

- Add or update blog posts.
- Update a "What's New" section in the application.
- Run code formatters or linters.
- Perform any other final checks or documentation updates.

You can make and push as many commits as you need for these chores. The automation will not interfere.

### Step 3: Finalize and Version the Release

When you are **100% certain** the release branch is complete and ready, you must manually trigger the versioning process.

1. Go to the **Actions** tab in the GitHub repository.
2. Select the **Release** workflow from the list on the left.
3. Click the **Run workflow** dropdown.
4. Select your `release/[YYYY-MM]` branch from the "Branch" dropdown.
5. Click the green **Run workflow** button.

This will trigger the `Version Packages` job, which adds a final commit to your branch containing all the version bumps, changelog updates, and Git tags.

### Step 4: Merge to Main

1. Open a pull request from your `release/[YYYY-MM]` branch to the `main` branch.
2. The PR will have a **`Verify Versioning`** status check. This check must pass before you can merge. It fails if the versioning commit from the previous step is not present.
3. A bot will also add a comment to the PR reminding you of the process.
4. Once all checks pass, **merge the pull request**.

Merging into `main` will trigger the final step of the automation, which publishes the stable packages and creates the GitHub Releases.

### Step 5: Merge Main Back to Development

**This is a critical final step.** To ensure the `development` branch receives the latest version bumps and changelogs from the release, you must merge `main` back into `development`.

```bash
git checkout development
git pull origin development
git merge --no-ff main
git push origin development
```

## For Release Managers: Creating a Hotfix

A hotfix is used to patch a critical bug in production. The process is similar to a regular release, but it starts from the `main` branch.

1. **Create the Hotfix Branch**: Create a `hotfix/*` branch from the `main` branch.

   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/fix-critical-bug
   ```

2. **Make and Commit Changes**: Apply the necessary code changes to fix the bug. Remember to add a changeset for the patch by running `pnpm changeset`.

3. **Finalize and Version the Hotfix**: Just like a release branch, when the hotfix is ready, you must manually trigger the versioning process from the **Actions** tab on your `hotfix/*` branch.

4. **Merge to Main**: Open a pull request from your `hotfix/*` branch to `main`. The same status checks and comments will apply. Merging this will publish the patched version.

5. **Merge back to Development**: **This is a critical step.** To ensure the fix is not lost, you must also merge the `main` branch back into the `development` branch.

   ```bash
   git checkout development
   git pull origin development
   git merge --no-ff main
   git push origin development
   ```
