import { create } from "zustand";

export interface GitHubUser {
  avatar_url: string;
  id: number;
  login: string;
  name?: string | null;
}

export interface GitHubRepo {
  default_branch: string;
  full_name: string;
  id: number;
  name: string;
  owner: { login: string };
  private: boolean;
}

export interface GitHubIssue {
  id: number;
  number: number;
  state: string;
  title: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  state: string;
  title: string;
}

export interface GitState {
  clearSelectedRepo: () => void;
  error: string | null;
  issues: GitHubIssue[];
  loading: boolean;
  pullRequests: GitHubPullRequest[];
  repos: GitHubRepo[];
  selectedRepo: GitHubRepo | null;
  setSelectedRepo: (repo: GitHubRepo | null) => void;
  user: GitHubUser | null;
}

const SELECTED_REPO_KEY = "marshell_github_selected_repo";

export const useGitStore = create<GitState>((set) => ({
  clearSelectedRepo: () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(SELECTED_REPO_KEY);
      } catch {
        // Ignore storage access failures.
      }
    }
    set({ selectedRepo: null });
  },
  error: null,
  issues: [],
  loading: false,
  pullRequests: [],
  repos: [],
  selectedRepo: null,
  setSelectedRepo: (repo) => {
    if (typeof window !== "undefined") {
      try {
        if (repo) {
          localStorage.setItem(SELECTED_REPO_KEY, JSON.stringify(repo));
        } else {
          localStorage.removeItem(SELECTED_REPO_KEY);
        }
      } catch {
        // Ignore storage access failures.
      }
    }
    set({ selectedRepo: repo });
  },
  user: null,
}));
