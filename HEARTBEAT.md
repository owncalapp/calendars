# Heartbeat Tasks

This file is intentionally kept minimal.
All calendar tasks are now tracked in GitHub Issues.

## How to Add Tasks

Create a new GitHub Issue with title format:
`[Calendar] Add {company/topic} {type} releases`

## How Tasks Are Processed

Cron job checks open issues labeled `calendar` every hour and processes them automatically.

## Current Open Issues

Run `gh issue list --label calendar` to see pending tasks.