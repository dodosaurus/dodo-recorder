#!/bin/bash

# Generate build info file with git commit hash and build timestamp
# This file is read by the Electron app to display build information

set -e

OUTPUT_DIR="${1:-.}"
OUTPUT_FILE="${OUTPUT_DIR}/build-info.json"

# Get git commit hash (short form)
if command -v git &> /dev/null && git rev-parse --git-dir &> /dev/null; then
  COMMIT_HASH=$(git rev-parse --short HEAD)
  COMMIT_FULL=$(git rev-parse HEAD)
  BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
  IS_DIRTY=$(git diff --quiet && echo "false" || echo "true")
else
  COMMIT_HASH="unknown"
  COMMIT_FULL="unknown"
  BRANCH_NAME="unknown"
  IS_DIRTY="false"
fi

# Build timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Node version
NODE_VERSION=$(node --version)

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Write build info JSON
cat > "$OUTPUT_FILE" <<EOF
{
  "commitHash": "${COMMIT_HASH}",
  "commitFull": "${COMMIT_FULL}",
  "branch": "${BRANCH_NAME}",
  "isDirty": ${IS_DIRTY},
  "buildTime": "${BUILD_TIME}",
  "nodeVersion": "${NODE_VERSION}"
}
EOF

echo "Build info written to: ${OUTPUT_FILE}"
if [ "$IS_DIRTY" = "true" ]; then
  echo "Commit: ${COMMIT_HASH} (dirty)"
else
  echo "Commit: ${COMMIT_HASH}"
fi
