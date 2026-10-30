#!/usr/bin/env node
// Every push to main is a Vercel deployment, and the Hobby plan allows 100 of
// them per 24 hours - counted for the whole account, not per project. When
// the limit is reached the build fails, the commit stays on main, and the
// content never reaches the site.
//
// This script measures how much of the day's budget is spent and exits with 1
// when the workflow must not publish any more. The workflows read that exit
// code and pause instead of pushing into a rate-limited window.
import process from 'node:process';

const LIMIT = Number(process.env.DEPLOY_BUDGET_LIMIT || 100);
const MAX = Number(process.env.DEPLOY_BUDGET_MAX || 70);
const WINDOW_H = Number(process.env.DEPLOY_BUDGET_WINDOW_H || 24);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const repo = process.env.GITHUB_REPOSITORY || '';
const since = new Date(Date.now() - WINDOW_H * 3600 * 1000).toISOString();

async function api(path, query = {}) {
  const search = new URLSearchParams(query).toString();
  const url = `https://api.github.com${path}${search ? `?${search}` : ''}`;
  const res = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'plain-news-deploy-budget',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

async function pages(path, query = {}) {
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await api(path, { ...query, per_page: 100, page });
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

// The production deployments of the last day are the deployments Vercel was
// asked for. Preview builds are free, so they do not count. The window is
// applied here: the API filters "since" by the last update, and a deployment
// from last week that Vercel touched today is not a deployment of today.
async function countDeployments() {
  const all = await pages(`/repos/${repo}/deployments`);
  const fresh = all.filter((d) => (d.created_at || '') >= since);
  return fresh.filter((d) => !d.environment || d.environment === 'Production').length;
}

// A push to main produces at least one commit. This is the fallback for when
// the deployment list is unavailable, and it never undercounts.
async function countCommits() {
  const all = await pages(`/repos/${repo}/commits`, { sha: 'main', since });
  return all.length;
}

// Without a token the API refuses anonymous reads, so the budget cannot be
// measured. Publishing anyway is the lesser evil: a missed story costs more
// than one deployment over the line.
if (!token || !repo) {
  console.warn('[deploy-budget] no repository or token - publishing without a budget check.');
  process.exit(0);
}

let used = 0;
let how = '';
try {
  used = await countDeployments();
  how = 'production deployments';
} catch (err) {
  try {
    used = await countCommits();
    how = 'commits on main';
  } catch (err2) {
    console.warn(`[deploy-budget] could not read the budget (${err2.message}) - publishing anyway.`);
    process.exit(0);
  }
}

console.log(`[deploy-budget] ${used}/${LIMIT} used in the last ${WINDOW_H} h (${how}).`);

if (used >= MAX) {
  console.log(`[deploy-budget] ${used} is at or above the threshold of ${MAX} - publishing is paused.`);
  process.exit(1);
}
console.log(`[deploy-budget] below the threshold of ${MAX} - publishing is allowed.`);
process.exit(0);
