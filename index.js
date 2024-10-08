#!/usr/bin/env node

require('dotenv').config();
const GhostAdminAPI = require('@tryghost/admin-api');
const { google } = require('googleapis');
const csv = require('csv-writer').createObjectCsvWriter;
const { program } = require('commander');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

// Configuration from environment variables
const GHOST_API_URL = process.env.GHOST_API_URL;
const GHOST_ADMIN_API_KEY = process.env.GHOST_ADMIN_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

program
  .version('1.0.0')
  .option('-l, --limit <number>', 'Number of posts to process per request', parseInt)
  .option('-o, --output <filename>', 'Output CSV filename prefix', 'post_update_results')
  .option('-r, --reindex <bool>', 'Reindex posts on Google', (val) => {
    return val === 'true' || val === true || val === '';
  }, true)
  .option('-d, --date <date>', 'Posts older than <date> (YYYY-MM-DD)', (val) => {
    const date = val ? new Date(val) : new Date();
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  }, new Date().toISOString().split('T')[0]) // Default to today's date
  .parse(process.argv);

const options = program.opts();

const api = new GhostAdminAPI({
  url: GHOST_API_URL,
  key: GHOST_ADMIN_API_KEY,
  version: 'v5.0'
});

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function getGoogleAuth() {
  const scopes = ['https://www.googleapis.com/auth/indexing'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  console.log('Authorize this app by visiting this url:', url);
  const code = await question('Enter the code from that page here: ');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    console.log('Successfully authenticated with Google.');
  } catch (error) {
    console.error('Error authenticating with Google:', error.message);
    process.exit(1);
  }
}

async function fetchFullPostDetails(postId) {
  try {
    const post = await api.posts.read({ id: postId }, { include: 'authors,tags' });
    return post;
  } catch (error) {
    console.error(`Error fetching full details for post ${postId}:`, error.message);
    return null;
  }
}

async function logPostDetails(post) {
  try {
    const filename = `post_${post.id}_details.json`;
    await fs.writeFile(filename, JSON.stringify(post, null, 2));
    console.log(`Full post details written to ${filename}`);
  } catch (error) {
    console.error(`Error writing post details to file: ${error.message}`);
  }
}

async function updatePost(post) {
  try {
    let isUpdated = false;
    const updatedFields = {};

    // Check if the post has an excerpt and meta_description is empty
    if (post.custom_excerpt && !post.meta_description) {
      updatedFields.meta_description = post.custom_excerpt;
      isUpdated = true;
    }

    console.log(post.custom_excerpt);

    // Make the post publicly available if it's not already
    if (post.visibility !== 'public') {
      updatedFields.visibility = 'public';
      isUpdated = true;
    }

    // Only send the update request if changes were made
    if (isUpdated) {
      try {
        const updatedPost = await api.posts.edit({
          id: post.id,
          updated_at: post.updated_at,
          ...updatedFields
        });
        console.log(`Successfully updated post ${post.id}`);
        return { post: updatedPost, updated: true, error: null };
      } catch (editError) {
        console.error(`Error updating post ${post.id}:`, editError.message);
        try {
          const fullPost = await fetchFullPostDetails(post.id);
          if (fullPost) {
            await logPostDetails(fullPost);
          }
        } catch (detailError) {
          console.error(`Error fetching/logging full post details: ${detailError.message}`);
        }
        return { post: post, updated: false, error: editError.message };
      }
    } else {
      console.log(`No updates needed for post ${post.id}`);
      return { post: post, updated: false, error: null };
    }
  } catch (error) {
    console.error(`Error processing post ${post.id}:`, error.message);
    return { post: null, updated: false, error: error.message };
  }
}

async function reindexPost(url) {
  if (! options.reindex) return false;
  try {
    const indexing = google.indexing({ version: 'v3', auth: oauth2Client });
    await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: 'URL_UPDATED'
      }
    });
    console.log(`Reindexing post ${url}\n`);
    return true;
  } catch (error) {
    console.error(`Error reindexing post ${url}:`, error.message);
    return false;
  }
}

async function writeResultsToCsv(results, filename) {
    const csvWriter = csv({
      path: filename,
      header: [
        { id: 'id', title: 'Post ID' },
        { id: 'title', title: 'Title' },
        { id: 'excerptCopied', title: 'Excerpt Copied to Meta Description' },
        { id: 'madePublic', title: 'Made Public' },
        { id: 'updated', title: 'Updated' },
        { id: 'reindexed', title: 'Reindexed' },
        { id: 'error', title: 'Error' }
      ],
    });
  
    await csvWriter.writeRecords(results);
    console.log(`Results written to ${filename}\n`);
  }
  
  async function processAllPosts() {
    const results = [];
    const limit = options.limit || 15;
    let page = 1;
    let batchNumber = 1;
  
    while (true) {
      try {
        const posts = await api.posts.browse({
          limit: limit,
          page: page,
          filter: 'status:published+published_at:<' + options.date
        });
  
        if (posts.length === 0) {
          break;
        }
  
        for (const post of posts) {
          console.log(`Processing post: ${post.title}`);
  
          const { post: updatedPost, updated, error } = await updatePost(post);
          if (!updatedPost) {
            console.log(`Skipping post ${post.id} due to processing error.`);
            continue;
          }
  
          const reindexed = updated ? await reindexPost(updatedPost.url) : false;
  
          results.push({
            id: post.id,
            title: post.title,
            excerptCopied: (post.meta_description || '') !== (updatedPost.meta_description || ''),
            madePublic: updatedPost.visibility === 'public' && post.visibility !== 'public',
            updated: updated,
            reindexed: reindexed,
            error: error || ''
          });
  
          // Write CSV for every 20 posts
          if (results.length % 20 === 0) {
            const filename = `${options.output}_batch${batchNumber}.csv`;
            await writeResultsToCsv(results.slice(-20), filename);
            batchNumber++;
          }
        }
  
        page++;
      } catch (error) {
        console.error('Error fetching posts:', error.message);
        break;
      }
    }
  
    // Write any remaining results
    if (results.length % 20 !== 0) {
      const filename = `${options.output}_batch${batchNumber}.csv`;
      await writeResultsToCsv(results.slice(-(results.length % 20)), filename);
    }
  
    return results;
  }
  
  async function main() {
    console.log(`Reindexing is ${options.reindex ? 'enabled' : 'disabled'}`);
    try {
      if (options.reindex) { await getGoogleAuth() };
      const results = await processAllPosts();
      console.log(`Total posts processed: ${results.length}\n`);
    } catch (error) {
      console.error('An error occurred:', error.message);
    } finally {
      rl.close();
    }
  }
  
  main();