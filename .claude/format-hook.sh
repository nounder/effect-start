#!/usr/bin/env bash
# Hook to automatically format files with dprint after Edit/Write operations

# Read JSON from stdin
input=$(cat)

# Extract file path from tool_input (for Write) or tool_response (for Edit)
# Try tool_input.file_path first (Write tool)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)

# If we found a file path and it matches supported extensions
if [[ -n "$file_path" && "$file_path" =~ \.(ts|tsx|js|jsx|json|md|mdx|html|css)$ ]]; then
  # Format the file with dprint
  bunx dprint fmt "$file_path" 2>/dev/null || true
fi

# Always exit 0 to not block operations
exit 0
