#!/bin/bash
# Wrapper script for easy CLI usage

cd "$(dirname "$0")"
npm run scrape -- "$@"
