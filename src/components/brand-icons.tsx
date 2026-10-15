import { siGithub, siLinkedin, siSlack } from "simple-icons";

function BrandIcon({ path, title, size = 16, color = "currentColor" }: { path: string; title: string; size?: number; color?: string }) {
  return (
    <svg role="img" aria-label={title} width={size} height={size} viewBox="0 0 24 24" fill={color} className="shrink-0">
      <path d={path} />
    </svg>
  );
}

export const SlackLogo = ({ size }: { size?: number }) => <BrandIcon path={siSlack.path} title="Slack" size={size} />;
export const GitHubLogo = ({ size }: { size?: number }) => <BrandIcon path={siGithub.path} title="GitHub" size={size} />;
export const LinkedInLogo = ({ size }: { size?: number }) => <BrandIcon path={siLinkedin.path} title="LinkedIn" size={size} />;
