# Ghost Post Updater

This CLI tool updates Ghost blog posts and reindexes them in Google Search Console. It performs the following tasks:

1. Fetches posts from your Ghost blog
2. Checks if each post has an excerpt, and if so, copies it to the meta description if empty
3. Makes each post publicly available
4. Saves the updated posts
5. Sends each post URL to Google Search Console for reindexing
6. Writes a CSV file with the results of each operation

## Info

- You will reach a rate limit on Google after about 150 posts (per day)
- You will reach a rate limit on Ghost if do too many requests

## Prerequisites

- Node.js (v14 or later recommended)
- A Ghost blog with Admin API access
- A Google Cloud Project with the Indexing API enabled

## Setup

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/ghost-post-updater.git
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

4. Edit the `.env` file with your Ghost blog URL, Admin API key, and Google OAuth 2.0 credentials.

## Usage

Run the script with:

```
npm start
```

Options:
- `-l, --limit <number>`: Number of posts to process per request (default: 15)
- `-o, --output <filename>`: Output CSV filename (default: 'post_update_results.csv')

Example:
```
npm start -- -l 20 -o results.csv
```

The first time you run the script, it will provide a URL for you to visit and authorize the application. Follow the prompts to complete the OAuth flow.

## CSV Output

The script generates a CSV file with the following columns:
- Post ID
- Title
- Excerpt Copied to Meta Description
- Made Public
- Updated
- Reindexed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.