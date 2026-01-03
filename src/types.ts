export type Comment = {
  id: number;
  user: {
    login: string;
  };
  body: string;
  path: string;
  line: number | null;
  original_line: number | null;
  diff_hunk: string;
  created_at: string;
  html_url: string;
};

export type PRInfo = {
  owner: string;
  repo: string;
  pull_number: number;
  url: string;
};
