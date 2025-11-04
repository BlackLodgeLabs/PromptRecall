## 🧭 Typical Release Command Sequence

### 1. Change to your project directory

```bash
cd "d:\Projects\Black Lodge Labs\Dev\Prompt Recall v1.0.2\PromptRecall"
```

---

### 2. Update the version and create a local Git tag

Replace `patch`, `minor`, or `major` with the desired version increment —
or specify a version number like `1.0.2`.

```bash
npm version patch
```

> This command updates `package.json`, `package-lock.json`,
> creates a Git commit, and a local Git tag (e.g. `v1.0.2`).

---

### 3. Install dependencies (if not already up-to-date)

```bash
npm ci
```

---

### 4. Run your local build (optional, but good for verification)

```bash
npm run build:release
```

> This will create the local `.zip` file.

---

### 5. Push the version bump commit to the remote main branch

```bash
git push origin main
```

---

### 6. Push the created Git tag to your remote GitHub repository
 Replace v1.0.1 with the actual tag name created by npm version.
```bash
git push origin v1.0.2
```

> ✅ This final step triggers your `release.yml` GitHub Actions workflow,
> which builds the release artifact and creates a GitHub Release.

