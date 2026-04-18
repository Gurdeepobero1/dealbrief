/**
 * GitHub adapter — public activity for technical roles.
 *
 * LEGAL BASIS: GitHub's public REST API is designed to be consumed
 * programmatically. We access only what's publicly viewable without auth.
 *
 * Docs: https://docs.github.com/rest
 */
import type { SourceAdapter } from "./types.js";
import { sourceId } from "./types.js";

export interface GitHubQuery {
  username: string;
}

export interface GitHubActivity {
  username: string;
  name?: string;
  bio?: string;
  company?: string;
  location?: string;
  blog?: string;
  publicRepos: number;
  followers: number;
  recentRepos: Array<{
    name: string;
    description?: string;
    language?: string;
    stars: number;
    updatedAt: string;
    url: string;
  }>;
  profileUrl: string;
  sourceIds: string[];
}

export const github: SourceAdapter<GitHubQuery, GitHubActivity | null> = {
  name: "github",
  sourceType: "github",
  licenseNote: "GitHub public REST API. Unauthenticated endpoints only.",

  async fetch(query: GitHubQuery): Promise<GitHubActivity | null> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const userRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(query.username)}`,
      { headers }
    );
    if (userRes.status === 404) return null;
    if (!userRes.ok) {
      throw new Error(`GitHub user error ${userRes.status}`);
    }
    const user = (await userRes.json()) as {
      login: string;
      name?: string;
      bio?: string;
      company?: string;
      location?: string;
      blog?: string;
      public_repos: number;
      followers: number;
      html_url: string;
    };

    const reposRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(query.username)}/repos?sort=updated&per_page=10`,
      { headers }
    );
    const repos = reposRes.ok
      ? ((await reposRes.json()) as Array<{
          name: string;
          description?: string;
          language?: string;
          stargazers_count: number;
          updated_at: string;
          html_url: string;
          fork: boolean;
        }>)
      : [];

    const nonForks = repos.filter(r => !r.fork);

    return {
      username: user.login,
      name: user.name,
      bio: user.bio,
      company: user.company,
      location: user.location,
      blog: user.blog,
      publicRepos: user.public_repos,
      followers: user.followers,
      recentRepos: nonForks.map(r => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        updatedAt: r.updated_at,
        url: r.html_url,
      })),
      profileUrl: user.html_url,
      sourceIds: [sourceId(user.html_url)],
    };
  },
};
