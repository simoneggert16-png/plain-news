#!/usr/bin/env bash
# Publishes the content of a workflow to main: one commit, one push.
#
# Every push to main is a Vercel deployment, and the plan allows 100 of them a
# day. A push is therefore the scarcest thing in the newsroom, and the six
# workflows that write content used to each bring their own push logic. They
# did not agree with each other: one of them (the long reads) lost a whole
# shift of articles when the rebase stopped on content/index.json, and every
# one of them could spend a second deployment on a "merge upstream" commit.
#
# This script is the only way content reaches main:
#
#   scripts/push-content.sh "<commit message>"
#
#   0  the content is published (or there was nothing to publish)
#   1  the content is committed but could not be pushed
#
# The index is derived from the article files, so a conflict is resolved by
# rebuilding it from the files of both sides: no story is lost in the merge.
set -u

MSG="${1:-$(date -u +'%Y-%m-%d %H:%M') UTC}"

git config user.name "simoneggert16-png"
git config user.email "simoneggert16@gmail.com"

# The head of the index is what the site reads from the repository at runtime.
# It has to describe the same stories as the index, so it is rebuilt from it
# before every commit.
node scripts/build-latest.mjs || echo "the index head could not be rebuilt"

git add content
# The desk's mailbox holds the letters of people who wrote to the desk. It is
# in .gitignore; this is the belt to that pair of braces — the repository is
# public and a private letter never belongs in it.
git reset -q -- content/investigations/inbox.json 2>/dev/null || true
git reset -q -- content/investigations/leads.json 2>/dev/null || true
if ! git diff --cached --quiet; then
  git commit -q -m "$MSG" || { echo "could not commit the content"; exit 1; }
fi

git fetch -q origin main || true
if git diff --quiet HEAD origin/main; then
  echo "nothing to publish"
  exit 0
fi

# The day's deployments are counted. When they are spent, Vercel refuses the
# build - but the content is in the repository, and the site reads it from
# there. Publication must not depend on the build quota: a story that waits
# for a free build window is a story that never appears.
if ! node scripts/deploy-budget.mjs; then
  echo "the day's deployments are spent - the build will be refused, the content goes to the repository anyway"
fi

for attempt in 1 2 3 4 5; do
  if git pull -q --rebase --autostash; then
    if git push -q; then
      echo "pushed: $MSG"
      exit 0
    fi
  fi
  git rebase --abort 2>/dev/null || true

  # The other side wrote to content/ while this run was busy. Take our side
  # of the index, let the article files of both sides come in, and rebuild the
  # index from them.
  if git fetch -q origin main && git merge -q --no-edit -X ours origin/main; then
    node scripts/sync-index.mjs --all || true
    node scripts/build-latest.mjs || true
    if ! node scripts/check-content.mjs --fix; then
      echo "the index is unreadable after the merge - the content stays local"
      exit 1
    fi
    git add content
    git commit -q -m "$MSG (upstream merged)" || true
    if git push -q; then
      echo "pushed after the merge: $MSG"
      exit 0
    fi
  fi
  git merge --abort 2>/dev/null || true
  echo "push attempt $attempt failed, retrying"
  sleep $((attempt * 10))
done

echo "the content is committed but not pushed"
exit 1
