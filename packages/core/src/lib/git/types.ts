export interface GitUser {
  avatarUrl?: string;
  id: string;
  name?: string;
  username: string;
}

export interface GitRepository {
  defaultBranch: string;
  fullName: string;
  id: string;
  isPrivate: boolean;
  name: string;
  owner: string;
  url: string;
}

export type GitProviderType = "github" | "gitlab" | "bitbucket";
