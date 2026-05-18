# GitHub Branch Protection Setup

Purpose: make it technically difficult to accidentally modify the already-live `master` branch.

Documentation alone is not enough. This setting must be applied in GitHub, otherwise a mistaken `git push` can still change the live branch.

## Current Required Rule

Repository:

```text
https://github.com/kame5201314-crypto/smart-return-system
```

Protected branch:

```text
master
```

Minimum required settings:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Do not allow bypassing the above settings.
- Block force pushes.
- Restrict deletions.

Recommended status check:

```text
Quality Gates / test-and-predeploy-gates
```

If GitHub shows a slightly different check name, use the check created by `.github/workflows/quality-gates.yml`.

## Manual Setup Steps

1. Open GitHub repository settings:

```text
https://github.com/kame5201314-crypto/smart-return-system/settings/branches
```

2. Click `Add branch ruleset` or `Add rule`.

3. Target branch:

```text
master
```

4. Enable:

- `Require a pull request before merging`
- `Require status checks to pass`
- `Require branches to be up to date before merging`
- `Do not allow bypassing the above settings`
- `Block force pushes`
- `Restrict deletions`

5. Save the rule.

6. Verify with:

```powershell
gh api repos/kame5201314-crypto/smart-return-system/branches/master/protection
```

If it returns branch protection JSON, protection is active.
If it returns `Branch not protected`, the setup is not complete.

## Message To Paste To Codex For Windows

Use this when asking another Codex session to apply only the GitHub platform setting:

```text
請只處理 GitHub Branch Protection，不要修改程式碼、不要 push、不要部署、不要動 Supabase。

Repo: kame5201314-crypto/smart-return-system
Branch to protect: master

請先唯讀確認：
1. gh auth status
2. gh api repos/kame5201314-crypto/smart-return-system/branches/master/protection

如果目前顯示 Branch not protected，請到 GitHub Settings → Branches 設定 master 保護規則：
- Require a pull request before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Do not allow bypassing the above settings
- Block force pushes
- Restrict deletions

完成後再用：
gh api repos/kame5201314-crypto/smart-return-system/branches/master/protection

回報是否已保護，不要做其他事情。
```

## What Not To Do

- Do not force push `master`.
- Do not push `develop-saas` to `master`.
- Do not promote a Vercel preview deployment to production unless explicitly authorized.
- Do not run production Supabase migrations without a backup and explicit authorization.
- Do not use branch protection as a substitute for rollback readiness.
