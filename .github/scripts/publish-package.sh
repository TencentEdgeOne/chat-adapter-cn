#!/usr/bin/env bash
# Publish one workspace package. Prints a per-package report for the job log
# and $GITHUB_STEP_SUMMARY.
set -euo pipefail

dir="${1:?package directory required}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root/$dir"

name="$(node -p "require('./package.json').name")"
file_version="$(node -p "require('./package.json').version")"
version="$file_version"

if [[ -n "${PUBLISH_VERSION:-}" ]]; then
  node --input-type=module -e "
    import { readFileSync, writeFileSync } from 'node:fs';
    const file = 'package.json';
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    pkg.version = process.env.PUBLISH_VERSION;
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  "
  version="$PUBLISH_VERSION"
fi

latest="$(npm view "$name" version 2>/dev/null || true)"
[[ -n "$latest" ]] || latest="(not on npm)"

on_registry="no"
if npm view "$name@$version" version >/dev/null 2>&1; then
  on_registry="yes"
fi

{
  echo "package:     $name"
  echo "path:        $dir"
  echo "file version:$file_version"
  echo "publish as:  $version"
  echo "npm latest:  $latest"
  echo "already out: $on_registry"
} | tee /tmp/publish-head.txt

status=""
if [[ "$on_registry" == "yes" ]]; then
  status="skipped (already on npm)"
  echo "status:      $status"
else
  echo "status:      publishing"
  if npm publish --access public; then
    status="published"
    echo "status:      $status"
    echo "npm page:    https://www.npmjs.com/package/${name}/v/${version}"
  else
    status="failed"
    echo "status:      $status"
  fi
fi

results="${GITHUB_WORKSPACE:-$root}/publish-results.txt"
echo "$name	$version	$status" >> "$results"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "| \`$name\` | \`$version\` | $status | \`$latest\` |" >> "$GITHUB_STEP_SUMMARY"
fi

[[ "$status" != failed ]]
