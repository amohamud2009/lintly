interface PullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
  };
}

interface Installation {
  id: number;
  account: {
    login: string;
    id: number;
  };
}

// Then use:
const pr = payload.pull_request as PullRequest;
const repo = payload.repository as Repository;
const installation = payload.installation as Installation | undefined;