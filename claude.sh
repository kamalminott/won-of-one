#!/bin/bash

# Claude CLI helper script
# Usage: ./claude.sh "your question here"

API_KEY="${ANTHROPIC_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY environment variable not set"
  echo "Set it with: export ANTHROPIC_API_KEY=\"your-api-key\""
  exit 1
fi

if [ -z "$1" ]; then
  echo "Usage: ./claude.sh \"your question here\""
  exit 1
fi

# Escape the question for JSON - handle newlines and quotes
QUESTION=$(printf '%s' "$1" | jq -Rs .)

curl -s https://api.anthropic.com/v1/messages \
  --header "x-api-key: $API_KEY" \
  --header "anthropic-version: 2023-06-01" \
  --header "content-type: application/json" \
  --data "{
    \"model\": \"claude-sonnet-4-20250514\",
    \"max_tokens\": 1024,
    \"messages\": [
      {\"role\": \"user\", \"content\": $QUESTION}
    ]
  }" | jq -r '.content[0].text // .error.message // .'
