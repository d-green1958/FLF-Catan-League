// Shows submissions straight away, before the Action has saved them and the site has republished.
//
// Saving and republishing takes about 40 seconds, but a submission exists as a GitHub issue within a second.
// So the site also reads recent issues and applies them on top of the published data, using the same
// processSubmission() check as the Action. What is shown early is what the Action will accept, and an issue
// the Action closes as refused stops being applied. The Action's commit is still the permanent record.
import { processSubmission, TITLE_PREFIX } from './submission.js';

// Long enough for the Action and the deploy to finish. An issue older than this that never got
// saved (the Action can cancel one in a busy moment) is not shown.
export const RECENT_ISSUE_MS = 15 * 60 * 1000;

/** The parts of a GitHub issue this file needs. */
export const compactIssue = ({ number, title, body, state, state_reason: stateReason, html_url: url, created_at: createdAt, user }) => (
  { number, title, body, state, stateReason, url, createdAt, author: user?.login ?? '' }
);

export const isRecentIssue = (issue, now = Date.now()) => now - Date.parse(issue.createdAt) < RECENT_ISSUE_MS;

const entryKey = ({ issue, action, type, id }) => `${issue}|${action}|${type}|${id}`;

/**
 * Applies recent issues, oldest first, to the published data. Replaying one that has already been published
 * changes nothing, so it does not matter whether the deploy has finished yet.
 * Returns the resulting data, plus what happened to each issue.
 */
export async function applyRecentIssues(published, issues, { league, colours, expansions }, now = Date.now()) {
  const state = { profiles: published.profiles, games: published.games };
  const activity = [...published.activity];
  const logged = new Set(activity.map(entryKey));
  const outcomes = [];

  const relevant = issues
    .filter((issue) => issue.title?.startsWith(TITLE_PREFIX) && isRecentIssue(issue, now))
    .sort((a, b) => a.number - b.number);

  for (const issue of relevant) {
    const outcome = await processSubmission({
      body: issue.body ?? '',
      author: issue.author,
      issue: issue.number,
      now: Date.parse(issue.createdAt),
      ...state,
      activity: [],
      league,
      colours,
      expansions,
    });
    const refusedByAction = issue.state === 'closed' && issue.stateReason === 'not_planned';
    if (outcome.status === 'applied' && !refusedByAction) {
      state.profiles = outcome.profiles;
      state.games = outcome.games;
      for (const entry of outcome.activity) {
        if (!logged.has(entryKey(entry))) activity.push(entry);
      }
    }
    outcomes.push({
      number: issue.number,
      url: issue.url,
      body: issue.body ?? '',
      accepted: !refusedByAction && ['applied', 'unchanged'].includes(outcome.status),
      message: outcome.status === 'applied' ? 'The league did not accept this. The reply on GitHub says why.' : outcome.message,
    });
  }
  return { ...state, activity, outcomes };
}
