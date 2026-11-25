#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OUT = "CHANGELOG.md";
const SECTIONS = [
  ["feat", "Added"],
  ["fix", "Fixed"],
  ["refactor", "Refactoring"],
  ["docs", "Documentation"],
  ["test", "Tests"],
  ["chore", "Chores"],
];
const OTHER = "Other";
const SUBJECT = /^(\w+)(\(([^)]*)\))?!?:\s*(.+)$/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trimEnd();
}

function listTags() {
  const out = git(["for-each-ref", "--sort=-creatordate", "--format=%(refname:short)", "refs/tags"]);
  return out ? out.split("\n") : [];
}

function previousTag(ref) {
  try {
    return execFileSync("git", ["describe", "--tags", "--abbrev=0", `${ref}^`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function commitsBetween(from, to) {
  const range = from ? `${from}..${to}` : to;
  const out = git(["log", range, "--no-merges", "--format=%h%x1f%s"]);
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [hash, subject] = line.split("\x1f");
    return { hash, subject };
  });
}

function isSkipped(commit) {
  const match = SUBJECT.exec(commit.subject);
  return !!match && match[1] === "docs" && match[3] === "changelog";
}

function renderSections(commits) {
  const groups = new Map([...SECTIONS.map(([type, title]) => [type, { title, items: [] }]),
    [OTHER, { title: OTHER, items: [] }]]);
  for (const commit of commits) {
    if (isSkipped(commit)) continue;
    const match = SUBJECT.exec(commit.subject);
    const type = match && groups.has(match[1]) ? match[1] : OTHER;
    const description = match ? match[4] : commit.subject;
    const scope = match && match[3] ? `**${match[3]}:** ` : "";
    groups.get(type).items.push(`- ${scope}${description} (${commit.hash})`);
  }
  const lines = [];
  for (const { title, items } of groups.values()) {
    if (items.length === 0) continue;
    lines.push(`### ${title}`, "", ...items, "");
  }
  return lines.length ? lines : ["_No notable changes._", ""];
}

function render() {
  const tags = listTags();
  const lines = [
    "# Changelog",
    "",
    "This file is generated automatically from Conventional Commits: `node scripts/changelog.mjs`.",
    "",
  ];

  const latest = previousTag("HEAD");
  const unreleased = commitsBetween(latest, "HEAD");
  if (unreleased.length || !tags.length) {
    lines.push("## Unreleased", "", ...renderSections(unreleased));
  }

  for (const tag of tags) {
    const date = git(["log", "-1", "--format=%ad", "--date=short", `${tag}^{commit}`]);
    lines.push(`## ${tag} — ${date}`, "", ...renderSections(commitsBetween(previousTag(tag), tag)));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

const next = render();
const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
if (current !== next) {
  writeFileSync(OUT, next);
  console.log(`${OUT} updated`);
} else {
  console.log(`${OUT} unchanged`);
}
