# Ghost Post Updater

This CLI tool updates Ghost blog posts and optionally reindexes them in Google Search Console. It performs the following tasks:

1. Fetches posts from your Ghost blog
2. Checks if each post has an excerpt, and if so, copies it to the meta description if empty
3. Makes each post publicly available
4. Saves the updated posts
5. Optionally sends each post URL to Google Search Console for reindexing
6. Writes CSV files with the results of each operation

## Info

- You will reach a rate limit on Google after about 150 posts (per day)
- You will reach a rate limit on Ghost if you do too many requests

## Prerequisites

- Node.js (v14 or later recommended)
- A Ghost blog with Admin API access
- A Google Cloud Project with the Indexing API enabled (if using reindexing feature)

## Setup

1. Clone this repository:
   ```
   git clone https://github.com/neverything/ghost-post-updater.git
   cd ghost-post-updater
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your details:
   ```
   cp .env.example .env
   ```

4. Edit the `.env` file with your Ghost blog URL, Admin API key, and Google OAuth 2.0 credentials (if using reindexing).

## Usage

Run the script with:

```
node index.js [options]
```

Options:
- `-l, --limit <number>`: Number of posts to process per request (default: 15)
- `-o, --output <filename>`: Output CSV filename prefix (default: 'post_update_results')
- `-r, --reindex <bool>`: Reindex posts on Google (default: true)
- `-d, --date <date>`: Process posts older than this date (YYYY-MM-DD) (default: today's date)
- `-v, --version`: Output the version number
- `-h, --help`: Display help for command

Examples:
```
node index.js -l 20 -o results -r false
node index.js -d 2023-01-01 -r true
```

If reindexing is enabled, the first time you run the script, it will provide a URL for you to visit and authorize the application. Follow the prompts to complete the OAuth flow.

## CSV Output

The script generates CSV files with the following columns:
- Post ID
- Title
- Excerpt Copied to Meta Description
- Made Public
- Updated
- Reindexed
- Error

CSV files are created in batches of 20 posts, with filenames following the pattern `<output-prefix>_batch<number>.csv`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.