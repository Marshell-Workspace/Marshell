const siteUrl = "https://marshell.bond";
// TODO: verify open-source repository URL if hosting under a dedicated org/repo
const repoUrl = "https://github.com/BhagirathsinhRana378/marshell";
const apiUrl = "https://api.github.com/repos/BhagirathsinhRana378/marshell";

export const siteConfig = {
  name: "Marshell",
  owner: "BhagirathsinhRana378",
  headline: "Project terminals, preview, and tasks in one workspace",
  description:
    "Marshell brings project terminals, live preview, process monitoring, and task tracking together into one open-source desktop workspace.",
  links: {
    website: siteUrl,
    github: repoUrl,
    issues: `${repoUrl}/issues`,
    discussions: `${repoUrl}/discussions`,
    releases: `${repoUrl}/releases/latest`,
    license: `${repoUrl}/blob/main/LICENSE`,
    changelog: `${repoUrl}/releases`,
    contributing: `${repoUrl}/blob/main/CONTRIBUTING.md`,
    githubApi: `${apiUrl}/releases?per_page=10`,
  },
};

export type SiteConfig = typeof siteConfig;
