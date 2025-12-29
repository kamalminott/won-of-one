# Claude CLI Setup

## API Key Setup

**Required:** You must set your Anthropic API key as an environment variable.

1. Get your API key from: https://console.anthropic.com

2. Set it temporarily (for current session):
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

3. Make it permanent by adding to your `~/.zshrc`:
```bash
echo 'export ANTHROPIC_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

**Note:** Never commit your API key to git. Use environment variables or a `.env` file (and add `.env` to `.gitignore`).

## Usage

Run the script with your question:

```bash
./claude.sh "Create a React Native button component"
```

Or ask coding questions:

```bash
./claude.sh "How do I fix the responsive layout in my React Native app?"
```

## Requirements

- `curl` (usually pre-installed on macOS)
- `jq` for JSON parsing (install with: `brew install jq`)

## Testing

Test it works:
```bash
./claude.sh "Hello, world"
```

