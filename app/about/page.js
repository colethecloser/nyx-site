import { aboutHtml } from '../../lib/aboutHtml';

export const metadata = {
  title: 'About the Founder — NYX',
  description: 'Why NYX exists: recovery itself, made better, instead of one more thing that hides the cost.',
};

export default function About() {
  return <main dangerouslySetInnerHTML={{ __html: aboutHtml }} />;
}
