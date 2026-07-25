import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Lazy imports to prevent circular dependencies at module load time
let GmailTools: any;
let CalendarTools: any;
let SlackTools: any;
let JiraTools: any;
let GithubTools: any;
let PrioritizerTools: any;
let ContextTools: any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_PATH = path.join(process.cwd(), 'google_tokens.json');

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export class GoogleAuthHelper {
  private static server: http.Server | null = null;

  /**
   * Generates Google OAuth authorization URL
   */
  static getAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = 'http://localhost:3000/oauth/google/callback';
    const scopes = encodeURIComponent(
      'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly'
    );

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent`;
  }

  /**
   * Starts a background HTTP callback listener on port 3000
   */
  static startCallbackServer() {
    if (this.server) return;

    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', 'http://localhost:3000');

      // Enable CORS for frontend requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check endpoint
      if (url.pathname === '/api/health') {
        const slackConnected = !!process.env.SLACK_USER_TOKEN;
        const jiraConnected = !!(process.env.JIRA_DOMAIN && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
        const githubConnected = !!process.env.GITHUB_TOKEN;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          googleConnected: fs.existsSync(TOKENS_PATH),
          slackConnected,
          jiraConnected,
          githubConnected
        }));
        return;
      }

      // Live notifications prioritization endpoint
      if (url.pathname === '/api/notifications') {
        try {
          // Dynamic import of modules to resolve runtime paths
          if (!GmailTools) {
            const gmailMod = await import('../gmail/gmail.tools.js');
            const calMod = await import('../calendar/calendar.tools.js');
            const slackMod = await import('../slack/slack.tools.js');
            const jiraMod = await import('../jira/jira.tools.js');
            const ghMod = await import('../github/github.tools.js');
            const ctxMod = await import('../context/context.tools.js');
            const prioMod = await import('../prioritizer/prioritizer.tools.js');

            GmailTools = gmailMod.GmailTools;
            CalendarTools = calMod.CalendarTools;
            SlackTools = slackMod.SlackTools;
            JiraTools = jiraMod.JiraTools;
            GithubTools = ghMod.GithubTools;
            ContextTools = ctxMod.ContextTools;
            PrioritizerTools = prioMod.PrioritizerTools;
          }

          const gmail = new GmailTools();
          const calendar = new CalendarTools();
          const slack = new SlackTools();
          const jira = new JiraTools();
          const github = new GithubTools();
          const context = new ContextTools();
          const prioritizer = new PrioritizerTools();

          const loggerMock = { info: console.log, error: console.error, warn: console.warn };
          const execCtx = { logger: loggerMock } as any;

          // 1. Compile Context
          const contextOutput = await context.buildUserContext({}, execCtx);

          // 2. Fetch notifications in parallel
          const [gmailRes, calRes, slackRes, jiraRes, ghRes] = await Promise.all([
            gmail.fetchGmailNotifications({}, execCtx),
            calendar.fetchCalendarEvents({}, execCtx),
            slack.fetchSlackNotifications({}, execCtx),
            jira.fetchJiraNotifications({}, execCtx),
            github.fetchGithubNotifications({}, execCtx)
          ]);

          const allNotifications = [
            ...(gmailRes.notifications || []),
            ...(calRes.notifications || []),
            ...(slackRes.notifications || []),
            ...(jiraRes.notifications || []),
            ...(ghRes.notifications || [])
          ];

          // 3. Triage / Prioritize via Gemini LLM
          const triageResult = await prioritizer.prioritizeNotifications(
            { notifications: allNotifications, context: contextOutput },
            execCtx
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(triageResult));
        } catch (error: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Login redirect route
      if (url.pathname === '/oauth/google/login') {
        res.writeHead(302, { Location: this.getAuthUrl() });
        res.end();
        return;
      }

      // Callback route
      if (url.pathname === '/oauth/google/callback') {
        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h3>Authentication Error: No code provided.</h3>');
          return;
        }

        try {
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: process.env.GOOGLE_CLIENT_ID || '',
              client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
              redirect_uri: 'http://localhost:3000/oauth/google/callback',
              grant_type: 'authorization_code',
            }),
          });

          if (!tokenResponse.ok) {
            const errBody = await tokenResponse.text();
            throw new Error(`Token exchange failed: ${errBody}`);
          }

          const tokens = (await tokenResponse.json()) as any;
          
          // Structure and save tokens
          const savedTokens: GoogleTokens = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || (this.getSavedTokens()?.refresh_token || ''),
            expiry_date: Date.now() + (tokens.expires_in * 1000),
          };

          fs.writeFileSync(TOKENS_PATH, JSON.stringify(savedTokens, null, 2));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
              <h2 style="color: #10b981;">Authentication Successful!</h2>
              <p>Google Account successfully connected to FocusOps. You can close this tab now.</p>
            </div>
          `);
        } catch (error: any) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<h3>Authentication Failed</h3><p>${error.message}</p>`);
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.server.listen(3000, () => {
      console.log('⚡ Google OAuth Callback listener running on http://localhost:3000');
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn('⚠️ Port 3000 is already in use, skipping OAuth server startup.');
      } else {
        console.error('OAuth Server Error:', err);
      }
    });
  }

  /**
   * Reads saved tokens from disk
   */
  static getSavedTokens(): GoogleTokens | null {
    if (!fs.existsSync(TOKENS_PATH)) return null;
    try {
      return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Refreshes access token if expired, returns valid access token or null
   */
  static async getValidAccessToken(): Promise<string | null> {
    const tokens = this.getSavedTokens();
    if (!tokens) return null;

    const isExpired = Date.now() + (5 * 60 * 1000) >= tokens.expiry_date;
    if (!isExpired) {
      return tokens.access_token;
    }

    if (!tokens.refresh_token) {
      console.error('No refresh token available to renew Google access token.');
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh request failed: ${await response.text()}`);
      }

      const refreshed = (await response.json()) as any;
      const updatedTokens: GoogleTokens = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokens.refresh_token,
        expiry_date: Date.now() + (refreshed.expires_in * 1000),
      };

      fs.writeFileSync(TOKENS_PATH, JSON.stringify(updatedTokens, null, 2));
      return updatedTokens.access_token;
    } catch (err) {
      console.error('Failed to refresh Google Access Token:', err);
      return null;
    }
  }
}
